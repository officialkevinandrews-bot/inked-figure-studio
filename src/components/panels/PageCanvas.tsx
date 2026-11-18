import React, { useEffect, useRef, useState } from "react";
import type { PageLayout, PlacedElement, PanelPolygon, Point } from "@/lib/manga-layout";
import { panelBounds } from "@/lib/manga-layout";
import { findSharedDividers, moveDivider, readingOrder, centroid, type SharedDivider } from "@/lib/manga-grid";
import { buildPanelSvgPath, computeSnapPosition, type SnapGuide } from "@/lib/panel-geometry";
import { fadeGeometry, toneTile } from "@/lib/screentone";
import { PanelTransformer } from "./PanelTransformer";
import { PageZoomContext } from "./zoom-context";
import { SpeechBalloonRenderer } from "./SpeechBalloonRenderer";
import { ComicMarkRenderer, SpeedLinesRenderer, SFXStampRenderer } from "./EffectsRenderers";
import type { SpeechBalloon, ComicMark, SpeedLinesEffect, SFXStamp } from "@/lib/manga-effects";

export type CanvasTool = "select" | "dividers" | "draw" | "knife" | "corners";

interface PageCanvasProps {
  layout: PageLayout;
  selectedPanelId: string | null;
  selectedItemId: string | null;
  onSelectPanel: (panelId: string) => void;
  onSelectItem: (itemId: string | null) => void;
  onUpdateElement: (id: string, updated: Partial<PlacedElement>) => void;
  onDeleteElement: (id: string) => void;
  onUpdateBalloon: (id: string, updated: Partial<SpeechBalloon>) => void;
  onDeleteBalloon: (id: string) => void;
  onUpdateComicMark: (id: string, updated: Partial<ComicMark>) => void;
  onDeleteComicMark: (id: string) => void;
  onUpdateSpeedLines: (id: string, updated: Partial<SpeedLinesEffect>) => void;
  onDeleteSpeedLines: (id: string) => void;
  onUpdateSFXStamp: (id: string, updated: Partial<SFXStamp>) => void;
  onDeleteSFXStamp: (id: string) => void;
  onRePoseIn3D?: (source3d: NonNullable<PlacedElement["source3d"]>) => void;
  zoom?: number;
  tool?: CanvasTool;
  onKnife?: (a: Point, b: Point) => void;
  onMoveVertex?: (from: Point, to: Point) => void;
  onMoveDivider?: (nextPanels: PanelPolygon[]) => void;
  onDrawPanel?: (rect: { x0: number; y0: number; x1: number; y1: number }) => void;
  showOrder?: "rtl" | "ltr" | null;
  showGuides?: boolean;
  seamless?: boolean;
  seamCutYs?: number[];
}

const dashFor = (p: PanelPolygon) => (p.borderStyle === "dashed" ? "8,6" : p.borderStyle === "dotted" ? "3,4" : undefined);

/** SVG defs for a panel's screentone (pattern + optional fade mask). */
function ToneDefs({
  p,
  uid,
  box,
}: {
  p: PanelPolygon;
  uid: string;
  box: { minX: number; minY: number; width: number; height: number };
}) {
  if (!p.tone) return null;
  const tile = toneTile(p.tone);
  const g = fadeGeometry(p.tone.fade, box);
  return (
    <>
      <pattern id={`tone-${uid}`} patternUnits="userSpaceOnUse" width={tile.w} height={tile.h} patternTransform={`rotate(${p.tone.angle})`}>
        <g dangerouslySetInnerHTML={{ __html: tile.body }} />
      </pattern>
      {g && (
        <>
          {g.type === "linear" ? (
            <linearGradient id={`tfade-${uid}`} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </linearGradient>
          ) : (
            <radialGradient id={`tfade-${uid}`} gradientUnits="userSpaceOnUse" cx={g.cx} cy={g.cy} r={g.r}>
              <stop offset="0" stopColor={g.invert ? "#000" : "#fff"} />
              <stop offset={g.invert ? "0.35" : "0.2"} stopColor={g.invert ? "#000" : "#fff"} />
              <stop offset="1" stopColor={g.invert ? "#fff" : "#000"} />
            </radialGradient>
          )}
          <mask id={`tmask-${uid}`} maskUnits="userSpaceOnUse" x={box.minX - 20} y={box.minY - 20} width={box.width + 40} height={box.height + 40}>
            <rect x={box.minX - 20} y={box.minY - 20} width={box.width + 40} height={box.height + 40} fill={`url(#tfade-${uid})`} />
          </mask>
        </>
      )}
    </>
  );
}

export function PageCanvas({
  layout,
  selectedPanelId,
  selectedItemId,
  onSelectPanel,
  onSelectItem,
  onUpdateElement,
  onDeleteElement,
  onUpdateBalloon,
  onDeleteBalloon,
  onUpdateComicMark,
  onDeleteComicMark,
  onUpdateSpeedLines,
  onDeleteSpeedLines,
  onUpdateSFXStamp,
  onDeleteSFXStamp,
  onRePoseIn3D,
  zoom = 1,
  tool = "select",
  onKnife,
  onMoveVertex,
  onMoveDivider,
  onDrawPanel,
  showOrder = null,
  showGuides = false,
  seamless = false,
  seamCutYs = [],
}: PageCanvasProps) {
  const { width, height, margin } = layout.format;
  const pageRef = useRef<HTMLDivElement>(null);
  const [knife, setKnife] = useState<{ a: Point; b: Point } | null>(null);
  const [drawBox, setDrawBox] = useState<{ a: Point; b: Point } | null>(null);
  const [hoveredDivId, setHoveredDivId] = useState<string | null>(null);
  const dragDivider = useRef<{ divider: SharedDivider; basePanels: PanelPolygon[]; startNorm: Point } | null>(null);
  const dragVertex = useRef<Point | null>(null);
  const pointerDownPanelRef = useRef<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  useEffect(() => {
    if (snapGuides.length === 0) return;
    const clear = () => setSnapGuides([]);
    window.addEventListener("pointerup", clear, { once: true });
    return () => window.removeEventListener("pointerup", clear);
  }, [snapGuides]);

  // floating inset panels draw last so they sit over the panels they overlap
  const ordered = [...layout.panels].sort((a, b) => Number(!!a.floating) - Number(!!b.floating));
  const bounds = new Map(ordered.map((p) => [p.id, panelBounds(p, layout.format)]));

  const handleElementChangeWithSnap = (id: string, updated: Partial<PlacedElement>) => {
    if (
      updated.x !== undefined &&
      updated.y !== undefined &&
      updated.width === undefined &&
      updated.height === undefined
    ) {
      const target = layout.elements.find((e) => e.id === id);
      if (target) {
        const panelBoxList = Array.from(bounds.values());
        const siblings = layout.elements
          .filter((e) => e.id !== id)
          .map((e) => ({ x: e.x, y: e.y, width: e.width, height: e.height }));
        const snapped = computeSnapPosition(
          { x: updated.x, y: updated.y, width: target.width, height: target.height },
          panelBoxList,
          siblings,
        );
        setSnapGuides(snapped.guides);
        onUpdateElement(id, { ...updated, x: snapped.x, y: snapped.y });
        return;
      }
    }
    onUpdateElement(id, updated);
  };
  const clippedElements = layout.elements.filter((el) => !el.breakout);
  const breakoutElements = layout.elements.filter((el) => el.breakout);
  const balloons = layout.balloons ?? [];
  const comicMarks = layout.comicMarks ?? [];
  const speedLines = layout.speedLines ?? [];
  const sfxStamps = layout.sfxStamps ?? [];

  const pw = width - margin * 2;
  const ph = height - margin * 2;
  const toPage = (e: React.PointerEvent): Point => {
    const r = pageRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };
  const toNorm = (p: Point): Point => ({ x: (p.x - margin) / pw, y: (p.y - margin) / ph });
  const snapNormPt = (pt: Point, disableSnap: boolean): Point => {
    const clamped = { x: Math.min(1, Math.max(0, pt.x)), y: Math.min(1, Math.max(0, pt.y)) };
    if (disableSnap) return clamped;
    const xs = new Set<number>([0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1]);
    const ys = new Set<number>([0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1]);
    for (const p of layout.panels) for (const q of p.points) { xs.add(q.x); ys.add(q.y); }
    let bx = clamped.x, bestX = 0.016;
    for (const tx of xs) if (Math.abs(clamped.x - tx) < bestX) { bestX = Math.abs(clamped.x - tx); bx = tx; }
    let by = clamped.y, bestY = 0.016;
    for (const ty of ys) if (Math.abs(clamped.y - ty) < bestY) { bestY = Math.abs(clamped.y - ty); by = ty; }
    return { x: bx, y: by };
  };
  const sharedDividers = tool === "select" || tool === "dividers" ? findSharedDividers(layout.panels) : [];

  const renderPanelGroup = (p: PanelPolygon) => {
    const b = bounds.get(p.id)!;
    const isSelected = selectedPanelId === p.id;
    const panelPath = buildPanelSvgPath(b.points, p.cornerRadius ?? 0, Boolean(p.scalloped));
    const uid = `${layout.id}-${p.id}`;
    const panelElements = clippedElements.filter((el) => el.panelId === p.id);
    return (
      <React.Fragment key={`grp-${p.id}`}>
        <svg
          style={{ position: "absolute", top: 0, left: 0, width, height, pointerEvents: "none", opacity: p.opacity ?? 1, overflow: "visible" }}
        >
          <defs>
            <ToneDefs p={p} uid={uid} box={b} />
          </defs>
          <path
            d={panelPath}
            fill={p.backgroundColor || "#ffffff"}
            stroke={isSelected ? "#e11d2e" : "none"}
            strokeWidth={isSelected ? 2 : 0}
            className="cursor-pointer"
            data-panel-id={p.id}
            style={{ pointerEvents: tool === "select" ? "auto" : "none" }}
          onPointerDown={() => {
            pointerDownPanelRef.current = p.id;
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (pointerDownPanelRef.current !== p.id) {
              pointerDownPanelRef.current = null;
              return;
            }
            pointerDownPanelRef.current = null;
            onSelectPanel(p.id);
            onSelectItem(null);
          }}
          />
          {p.tone && (
            <path d={panelPath} fill={`url(#tone-${uid})`} mask={p.tone.fade !== "none" ? `url(#tmask-${uid})` : undefined} pointerEvents="none" />
          )}
        </svg>
        {panelElements.length > 0 && (
          <div style={{ position: "absolute", top: 0, left: 0, width, height, clipPath: `url(#clip-${uid})`, pointerEvents: "none" }}>
            {panelElements.map((el) => (
              <div
                key={el.id}
                style={{ pointerEvents: tool === "select" ? "auto" : "none", opacity: el.opacity ?? 1 }}
                onDoubleClick={() => el.source3d && onRePoseIn3D?.(el.source3d)}
              >
                <PanelTransformer
                  element={el}
                  isSelected={selectedItemId === el.id}
                  mode="art-only"
                  onSelect={() => {
                    onSelectPanel(el.panelId);
                    onSelectItem(el.id);
                  }}
                  onChange={(updated) => handleElementChangeWithSnap(el.id, updated)}
                  onDelete={() => onDeleteElement(el.id)}
                />
              </div>
            ))}
          </div>
        )}
        {/* crisp border above this panel's own art */}
        <svg style={{ position: "absolute", top: 0, left: 0, width, height, pointerEvents: "none", overflow: "visible" }}>
          <path
            d={panelPath}
            fill="none"
            stroke={isSelected ? "#e11d2e" : p.borderStyle === "none" ? "none" : p.borderColor}
            strokeWidth={isSelected ? Math.max(3.5, p.borderWidth + 1.5) : p.borderStyle === "none" ? 0 : p.borderWidth}
            strokeDasharray={dashFor(p)}
            strokeLinejoin="round"
          />
        </svg>
      </React.Fragment>
    );
  };

  const base = ordered.filter((p) => !p.floating);
  const floats = ordered.filter((p) => p.floating);
  const order = showOrder ? readingOrder(layout.panels, showOrder === "rtl") : [];

  // unique raw vertices of the selected panel for corner editing
  const selPanel = layout.panels.find((p) => p.id === selectedPanelId);
  const vertices = tool === "corners" && selPanel ? selPanel.points : [];

  return (
    <div style={{ width: `${Math.round(width * zoom)}px`, height: `${Math.round(height * zoom)}px` }} className={seamless ? "relative shrink-0 mx-auto" : "relative shrink-0 m-auto"}>
      <PageZoomContext.Provider value={zoom}>
        <div
          id={seamless ? undefined : "manga-page-container"}
          data-page-id={layout.id}
          ref={pageRef}
          style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0, backgroundColor: "#ffffff" }}
          className={
            seamless
              ? "relative overflow-hidden bg-white text-black select-none"
              : "relative overflow-hidden border-2 border-foreground bg-white text-black shadow-2xl select-none"
          }
          onPointerDownCapture={(e) => {
            pointerDownPanelRef.current = e.target === e.currentTarget ? "__page__" : null;
          }}
          onClick={(e) => {
            if (pointerDownPanelRef.current === "__page__" && e.target === e.currentTarget) {
              pointerDownPanelRef.current = null;
              onSelectItem(null);
            }
          }}
        >
          <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }} aria-hidden="true">
            <defs>
              {ordered.map((p) => {
                const b = bounds.get(p.id)!;
                const d = buildPanelSvgPath(b.points, p.cornerRadius ?? 0, Boolean(p.scalloped));
                const uid = `${layout.id}-${p.id}`;
                return (
                  <clipPath key={`clip-${uid}`} id={`clip-${uid}`} clipPathUnits="userSpaceOnUse">
                    <path d={d} />
                  </clipPath>
                );
              })}
            </defs>
          </svg>

          {base.map(renderPanelGroup)}

          {layout.panels.length === 0 && (
            <div
              data-testid="empty-canvas-hint"
              className="pointer-events-none absolute inset-12 flex flex-col items-center justify-center rounded border-2 border-dashed border-zinc-400/70 text-center text-zinc-500"
            >
              <span className="text-sm font-bold">Empty Page Canvas</span>
              <span className="mt-1 text-xs">Use ▭ Draw Panel (R) to drag boxes, or click + Blank 1-Panel / a Template</span>
            </div>
          )}

          {speedLines.map((line) => (
            <SpeedLinesRenderer
              key={line.id}
              effect={line}
              width={width}
              height={height}
              isSelected={selectedItemId === line.id}
              onSelect={() => onSelectItem(line.id)}
              onChange={(u) => onUpdateSpeedLines(line.id, u)}
              onDelete={() => onDeleteSpeedLines(line.id)}
            />
          ))}

          {floats.map(renderPanelGroup)}

          <div style={{ position: "absolute", top: 0, left: 0, width, height, pointerEvents: "none" }}>
            {breakoutElements.map((el) => (
              <div
                key={el.id}
                style={{ pointerEvents: tool === "select" ? "auto" : "none", opacity: el.opacity ?? 1 }}
                onDoubleClick={() => el.source3d && onRePoseIn3D?.(el.source3d)}
              >
                <PanelTransformer
                  element={el}
                  isSelected={selectedItemId === el.id}
                  onSelect={() => {
                    onSelectPanel(el.panelId);
                    onSelectItem(el.id);
                  }}
                  onChange={(updated) => handleElementChangeWithSnap(el.id, updated)}
                  onDelete={() => onDeleteElement(el.id)}
                />
              </div>
            ))}
            {tool === "select" &&
              clippedElements
                .filter((el) => el.id === selectedItemId)
                .map((el) => (
                  <PanelTransformer
                    key={`handles-${el.id}`}
                    element={el}
                    isSelected={true}
                    mode="handles-only"
                    onSelect={() => {
                      onSelectPanel(el.panelId);
                      onSelectItem(el.id);
                    }}
                    onChange={(updated) => handleElementChangeWithSnap(el.id, updated)}
                    onDelete={() => onDeleteElement(el.id)}
                  />
                ))}
          </div>

          {comicMarks.map((mark) => (
            <ComicMarkRenderer
              key={mark.id}
              mark={mark}
              isSelected={selectedItemId === mark.id}
              onSelect={() => onSelectItem(mark.id)}
              onChange={(u) => onUpdateComicMark(mark.id, u)}
              onDelete={() => onDeleteComicMark(mark.id)}
            />
          ))}

          {sfxStamps.map((sfx) => (
            <SFXStampRenderer
              key={sfx.id}
              stamp={sfx}
              isSelected={selectedItemId === sfx.id}
              onSelect={() => onSelectItem(sfx.id)}
              onChange={(u) => onUpdateSFXStamp(sfx.id, u)}
              onDelete={() => onDeleteSFXStamp(sfx.id)}
            />
          ))}

          {balloons.map((balloon) => (
            <SpeechBalloonRenderer
              key={balloon.id}
              balloon={balloon}
              isSelected={selectedItemId === balloon.id}
              onSelect={() => onSelectItem(balloon.id)}
              onChange={(u) => onUpdateBalloon(balloon.id, u)}
              onDelete={() => onDeleteBalloon(balloon.id)}
            />
          ))}

          {/* Print guides (screen only, never exported) */}
          {showGuides && (
            <svg data-testid="print-guides" style={{ position: "absolute", inset: 0, width, height, pointerEvents: "none" }}>
              <rect x={margin} y={margin} width={pw} height={ph} fill="none" stroke="#2563eb" strokeDasharray="6,4" strokeWidth={1} />
              <rect x={8} y={8} width={width - 16} height={height - 16} fill="none" stroke="#e11d2e" strokeDasharray="2,3" strokeWidth={1} />
              {[[0, 0], [width, 0], [0, height], [width, height]].map(([x, y], i) => {
                const sx = x === 0 ? 1 : -1;
                const sy = y === 0 ? 1 : -1;
                return (
                  <g key={i} stroke="#111" strokeWidth={1}>
                    <line x1={x + sx * 8} y1={y + sy * 2} x2={x + sx * 8} y2={y + sy * 22} />
                    <line x1={x + sx * 2} y1={y + sy * 8} x2={x + sx * 22} y2={y + sy * 8} />
                  </g>
                );
              })}
              <g stroke="#111" strokeWidth={1}>
                <line x1={width / 2 - 14} y1={6} x2={width / 2 + 14} y2={6} />
                <line x1={width / 2} y1={0} x2={width / 2} y2={14} />
                <line x1={width / 2 - 14} y1={height - 6} x2={width / 2 + 14} y2={height - 6} />
                <line x1={width / 2} y1={height} x2={width / 2} y2={height - 14} />
              </g>
            </svg>
          )}

          {/* Reading order badges */}
          {showOrder &&
            order.map((id, i) => {
              const b = bounds.get(id);
              if (!b) return null;
              const c = centroid(b.points);
              return (
                <div
                  key={`ord-${id}`}
                  data-testid="reading-order-badge"
                  style={{ position: "absolute", left: c.x - 16, top: c.y - 16, width: 32, height: 32, pointerEvents: "none" }}
                  className="flex items-center justify-center rounded-full border-2 border-black bg-white/90 text-sm font-black text-black shadow"
                >
                  {i + 1}
                </div>
              );
            })}

          {/* Shared gutter / divider drag handles (visible in Dividers mode, interactive on hover in Select mode) */}
          {sharedDividers.length > 0 && onMoveDivider && (
            <svg
              style={{ position: "absolute", inset: 0, width, height, pointerEvents: "none", zIndex: 82 }}
            >
              {sharedDividers.map((div) => {
                const x1 = margin + div.a.x * pw;
                const y1 = margin + div.a.y * ph;
                const x2 = margin + div.b.x * pw;
                const y2 = margin + div.b.y * ph;
                const isHovered = hoveredDivId === div.id || dragDivider.current?.divider.id === div.id;
                const cursor = div.axis === "h" ? "ns-resize" : div.axis === "v" ? "ew-resize" : "move";
                return (
                  <g key={div.id}>
                    {(tool === "dividers" || isHovered) && (
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isHovered ? "#e11d2e" : "#2563eb"}
                        strokeWidth={isHovered ? 6 : 4}
                        strokeLinecap="round"
                        opacity={isHovered ? 0.9 : 0.45}
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="transparent"
                      strokeWidth={Math.max(12, (layout.format.gutterY ?? layout.format.gutter) + 6)}
                      data-testid="divider-handle"
                      data-divider-axis={div.axis}
                      style={{ pointerEvents: "stroke", cursor, touchAction: "none" }}
                      onPointerEnter={() => setHoveredDivId(div.id)}
                      onPointerLeave={() => setHoveredDivId((c) => (c === div.id ? null : c))}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        (e.currentTarget as Element).setPointerCapture(e.pointerId);
                        dragDivider.current = {
                          divider: div,
                          basePanels: layout.panels,
                          startNorm: toNorm(toPage(e)),
                        };
                      }}
                      onPointerMove={(e) => {
                        const st = dragDivider.current;
                        if (!st || st.divider.id !== div.id) return;
                        const cur = toNorm(toPage(e));
                        const rawDelta =
                          (cur.x - st.startNorm.x) * st.divider.nx + (cur.y - st.startNorm.y) * st.divider.ny;
                        const { panels: moved, snappedAt } = moveDivider(st.basePanels, st.divider, rawDelta, {
                          disableSnap: e.altKey,
                        });
                        if (snappedAt !== undefined && st.divider.axis !== "angled") {
                          const pxPos =
                            st.divider.axis === "h" ? margin + snappedAt * ph : margin + snappedAt * pw;
                          setSnapGuides([{ orientation: st.divider.axis, pos: pxPos }]);
                        } else {
                          setSnapGuides([]);
                        }
                        onMoveDivider(moved);
                      }}
                      onPointerUp={() => {
                        dragDivider.current = null;
                        setSnapGuides([]);
                      }}
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Freehand Draw Custom Panel overlay */}
          {tool === "draw" && (
            <svg
              data-testid="draw-panel-overlay"
              style={{ position: "absolute", inset: 0, width, height, cursor: "crosshair", touchAction: "none", zIndex: 88 }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                const pt = snapNormPt(toNorm(toPage(e)), e.altKey);
                setDrawBox({ a: pt, b: pt });
              }}
              onPointerMove={(e) => {
                if (!drawBox) return;
                const pt = snapNormPt(toNorm(toPage(e)), e.altKey);
                setDrawBox({ a: drawBox.a, b: pt });
              }}
              onPointerUp={() => {
                if (drawBox) {
                  const x0 = Math.min(drawBox.a.x, drawBox.b.x);
                  const x1 = Math.max(drawBox.a.x, drawBox.b.x);
                  const y0 = Math.min(drawBox.a.y, drawBox.b.y);
                  const y1 = Math.max(drawBox.a.y, drawBox.b.y);
                  if (x1 - x0 >= 0.04 && y1 - y0 >= 0.04) {
                    onDrawPanel?.({ x0, y0, x1, y1 });
                  }
                }
                setDrawBox(null);
              }}
            >
              {drawBox && (() => {
                const x = margin + Math.min(drawBox.a.x, drawBox.b.x) * pw;
                const y = margin + Math.min(drawBox.a.y, drawBox.b.y) * ph;
                const rw = Math.abs(drawBox.b.x - drawBox.a.x) * pw;
                const rh = Math.abs(drawBox.b.y - drawBox.a.y) * ph;
                return (
                  <rect
                    x={x}
                    y={y}
                    width={rw}
                    height={rh}
                    fill="rgba(225, 29, 46, 0.08)"
                    stroke="#e11d2e"
                    strokeWidth={2.5}
                    strokeDasharray="6,4"
                  />
                );
              })()}
            </svg>
          )}

          {/* Knife tool overlay */}
          {tool === "knife" && (
            <svg
              data-testid="knife-overlay"
              style={{ position: "absolute", inset: 0, width, height, cursor: "crosshair", touchAction: "none" }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                const p = toPage(e);
                setKnife({ a: p, b: p });
              }}
              onPointerMove={(e) => {
                if (!knife) return;
                let b = toPage(e);
                if (e.shiftKey) {
                  const ang = Math.atan2(b.y - knife.a.y, b.x - knife.a.x);
                  const step = Math.PI / 12;
                  const s = Math.round(ang / step) * step;
                  const len = Math.hypot(b.x - knife.a.x, b.y - knife.a.y);
                  b = { x: knife.a.x + Math.cos(s) * len, y: knife.a.y + Math.sin(s) * len };
                }
                setKnife({ a: knife.a, b });
              }}
              onPointerUp={() => {
                if (knife) onKnife?.(toNorm(knife.a), toNorm(knife.b));
                setKnife(null);
              }}
            >
              {knife && (
                <>
                  <line x1={knife.a.x} y1={knife.a.y} x2={knife.b.x} y2={knife.b.y} stroke="#fff" strokeWidth={6} />
                  <line x1={knife.a.x} y1={knife.a.y} x2={knife.b.x} y2={knife.b.y} stroke="#e11d2e" strokeWidth={2.5} strokeDasharray="10,6" />
                </>
              )}
            </svg>
          )}

          {/* Corner editing handles */}
          {vertices.map((v, i) => (
            <div
              key={`v-${i}`}
              data-testid="corner-handle"
              style={{ position: "absolute", left: margin + v.x * pw - 8, top: margin + v.y * ph - 8, width: 16, height: 16, touchAction: "none" }}
              className="cursor-move rounded-full border-2 border-black bg-primary shadow hover:scale-125"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                dragVertex.current = { ...v };
              }}
              onPointerMove={(e) => {
                if (!dragVertex.current) return;
                const n = toNorm(toPage(e));
                const to = { x: Math.min(1, Math.max(0, n.x)), y: Math.min(1, Math.max(0, n.y)) };
                // keep page-edge vertices glued to their edge
                const from = dragVertex.current;
                if (from.x === 0 || from.x === 1) to.x = from.x;
                if (from.y === 0 || from.y === 1) to.y = from.y;
                onMoveVertex?.(from, to);
                dragVertex.current = to;
              }}
              onPointerUp={() => (dragVertex.current = null)}
            />
          ))}

          {/* Smart alignment snap guides during drag */}
          {snapGuides.length > 0 && (
            <svg data-testid="snap-guides" style={{ position: "absolute", inset: 0, width, height, pointerEvents: "none", zIndex: 95 }}>
              {snapGuides.map((g, i) =>
                g.orientation === "v" ? (
                  <line key={i} x1={g.pos} y1={0} x2={g.pos} y2={height} stroke="#e11d2e" strokeWidth={1} strokeDasharray="4,3" />
                ) : (
                  <line key={i} x1={0} y1={g.pos} x2={width} y2={g.pos} stroke="#e11d2e" strokeWidth={1} strokeDasharray="4,3" />
                ),
              )}
            </svg>
          )}

          {/* Webtoon 800x1280 slice seam guides */}
          {seamCutYs.length > 0 && (
            <svg style={{ position: "absolute", inset: 0, width, height, pointerEvents: "none", zIndex: 94 }}>
              {seamCutYs.map((y, idx) => (
                <g key={idx} data-testid="webtoon-seam-line">
                  <line x1={0} y1={y} x2={width} y2={y} stroke="#0284c7" strokeWidth={1.5} strokeDasharray="8,5" />
                  <rect x={8} y={Math.max(4, y - 16)} width={126} height={15} rx={3} fill="#0284c7" />
                  <text x={14} y={Math.max(15, y - 5)} fill="#ffffff" fontSize={10} fontWeight="bold" fontFamily="monospace">
                    SLICE CUT @ {Math.round(y)}px
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>
      </PageZoomContext.Provider>
    </div>
  );
}

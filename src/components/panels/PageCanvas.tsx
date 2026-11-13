import React, { useRef, useState } from "react";
import type { PageLayout, PlacedElement, PanelPolygon, Point } from "@/lib/manga-layout";
import { panelBounds } from "@/lib/manga-layout";
import { readingOrder, centroid } from "@/lib/manga-grid";
import { fadeGeometry, toneTile } from "@/lib/screentone";
import { PanelTransformer } from "./PanelTransformer";
import { PageZoomContext } from "./zoom-context";
import { SpeechBalloonRenderer } from "./SpeechBalloonRenderer";
import { ComicMarkRenderer, SpeedLinesRenderer, SFXStampRenderer } from "./EffectsRenderers";
import type { SpeechBalloon, ComicMark, SpeedLinesEffect, SFXStamp } from "@/lib/manga-effects";

export type CanvasTool = "select" | "knife" | "corners";

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
  onRePoseIn3D?: (source3d: any) => void;
  zoom?: number;
  tool?: CanvasTool;
  onKnife?: (a: Point, b: Point) => void;
  onMoveVertex?: (from: Point, to: Point) => void;
  showOrder?: "rtl" | "ltr" | null;
  showGuides?: boolean;
}

const dashFor = (p: PanelPolygon) => (p.borderStyle === "dashed" ? "8,6" : p.borderStyle === "dotted" ? "3,4" : undefined);

/** SVG defs for a panel's screentone (pattern + optional fade mask). */
function ToneDefs({ p, box }: { p: PanelPolygon; box: { minX: number; minY: number; width: number; height: number } }) {
  if (!p.tone) return null;
  const tile = toneTile(p.tone);
  const g = fadeGeometry(p.tone.fade, box);
  return (
    <>
      <pattern id={`tone-${p.id}`} patternUnits="userSpaceOnUse" width={tile.w} height={tile.h} patternTransform={`rotate(${p.tone.angle})`}>
        <g dangerouslySetInnerHTML={{ __html: tile.body }} />
      </pattern>
      {g && (
        <>
          {g.type === "linear" ? (
            <linearGradient id={`tfade-${p.id}`} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </linearGradient>
          ) : (
            <radialGradient id={`tfade-${p.id}`} gradientUnits="userSpaceOnUse" cx={g.cx} cy={g.cy} r={g.r}>
              <stop offset="0" stopColor={g.invert ? "#000" : "#fff"} />
              <stop offset={g.invert ? "0.35" : "0.2"} stopColor={g.invert ? "#000" : "#fff"} />
              <stop offset="1" stopColor={g.invert ? "#fff" : "#000"} />
            </radialGradient>
          )}
          <mask id={`tmask-${p.id}`} maskUnits="userSpaceOnUse" x={box.minX - 20} y={box.minY - 20} width={box.width + 40} height={box.height + 40}>
            <rect x={box.minX - 20} y={box.minY - 20} width={box.width + 40} height={box.height + 40} fill={`url(#tfade-${p.id})`} />
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
  showOrder = null,
  showGuides = false,
}: PageCanvasProps) {
  const { width, height, margin } = layout.format;
  const pageRef = useRef<HTMLDivElement>(null);
  const [knife, setKnife] = useState<{ a: Point; b: Point } | null>(null);
  const dragVertex = useRef<Point | null>(null);

  // floating inset panels draw last so they sit over the panels they overlap
  const ordered = [...layout.panels].sort((a, b) => Number(!!a.floating) - Number(!!b.floating));
  const bounds = new Map(ordered.map((p) => [p.id, panelBounds(p, layout.format)]));
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

  const renderPanelGroup = (p: PanelPolygon) => {
    const b = bounds.get(p.id)!;
    const isSelected = selectedPanelId === p.id;
    const svgPoints = b.points.map((pt) => `${pt.x},${pt.y}`).join(" ");
    const panelElements = clippedElements.filter((el) => el.panelId === p.id);
    return (
      <React.Fragment key={`grp-${p.id}`}>
        <svg
          style={{ position: "absolute", top: 0, left: 0, width, height, pointerEvents: tool === "select" ? "auto" : "none", opacity: p.opacity ?? 1, overflow: "visible" }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectPanel(p.id);
            onSelectItem(null);
          }}
        >
          <defs>
            <ToneDefs p={p} box={b} />
          </defs>
          <polygon
            points={svgPoints}
            fill={p.backgroundColor || "#ffffff"}
            stroke={isSelected ? "#e11d2e" : "none"}
            strokeWidth={isSelected ? 2 : 0}
            className="cursor-pointer"
            data-panel-id={p.id}
          />
          {p.tone && (
            <polygon points={svgPoints} fill={`url(#tone-${p.id})`} mask={p.tone.fade !== "none" ? `url(#tmask-${p.id})` : undefined} pointerEvents="none" />
          )}
        </svg>
        {panelElements.length > 0 && (
          <div style={{ position: "absolute", top: 0, left: 0, width, height, clipPath: `url(#clip-${p.id})`, pointerEvents: "none" }}>
            {panelElements.map((el) => (
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
                  onChange={(updated) => onUpdateElement(el.id, updated)}
                  onDelete={() => onDeleteElement(el.id)}
                />
              </div>
            ))}
          </div>
        )}
        {/* crisp border above this panel's own art */}
        <svg style={{ position: "absolute", top: 0, left: 0, width, height, pointerEvents: "none", overflow: "visible" }}>
          <polygon
            points={svgPoints}
            fill="none"
            stroke={isSelected ? "#e11d2e" : p.borderStyle === "none" ? "none" : p.borderColor}
            strokeWidth={isSelected ? Math.max(3.5, p.borderWidth + 1.5) : p.borderStyle === "none" ? 0 : p.borderWidth}
            strokeDasharray={dashFor(p)}
            strokeLinejoin="miter"
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
    <div style={{ width: `${Math.round(width * zoom)}px`, height: `${Math.round(height * zoom)}px` }} className="relative shrink-0 m-auto">
      <PageZoomContext.Provider value={zoom}>
        <div
          id="manga-page-container"
          ref={pageRef}
          style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0, backgroundColor: "#ffffff" }}
          className="relative overflow-hidden border-2 border-foreground bg-white text-black shadow-2xl select-none"
          onClick={() => onSelectItem(null)}
        >
          <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }} aria-hidden="true">
            <defs>
              {ordered.map((p) => {
                const b = bounds.get(p.id)!;
                const d = b.points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ") + " Z";
                return (
                  <clipPath key={`clip-${p.id}`} id={`clip-${p.id}`} clipPathUnits="userSpaceOnUse">
                    <path d={d} />
                  </clipPath>
                );
              })}
            </defs>
          </svg>

          {base.map(renderPanelGroup)}

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
                  onChange={(updated) => onUpdateElement(el.id, updated)}
                  onDelete={() => onDeleteElement(el.id)}
                />
              </div>
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
        </div>
      </PageZoomContext.Provider>
    </div>
  );
}

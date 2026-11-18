import React, { useEffect, useRef, useState } from "react";
import type {
  DrawnLine,
  LineCapStyle,
  LineStyleVariant,
  PageLayout,
  PanelOverlapPreference,
  PanelPolygon,
  PlacedElement,
  Point,
} from "@/lib/manga-layout";
import { PAGE_LAYER_ID, panelBounds, panelPointsForTargetRect } from "@/lib/manga-layout";
import { findSharedDividers, moveDivider, readingOrder, centroid, type SharedDivider } from "@/lib/manga-grid";
import { buildPanelSvgPath, computeSnapPosition, type SnapGuide } from "@/lib/panel-geometry";
import { computeResizedBox } from "@/lib/transform-box";
import {
  arrowHeadPolygon,
  lineDashArray,
  lineSegmentsForStyle,
  snapLineAngle,
  taperedNibPolygon,
} from "@/lib/drawn-lines";
import { fadeGeometry, toneTile } from "@/lib/screentone";
import { PanelTransformer } from "./PanelTransformer";
import { PageZoomContext } from "./zoom-context";
import { SpeechBalloonRenderer } from "./SpeechBalloonRenderer";
import { ComicMarkRenderer, SpeedLinesRenderer, SFXStampRenderer } from "./EffectsRenderers";
import type { SpeechBalloon, ComicMark, SpeedLinesEffect, SFXStamp } from "@/lib/manga-effects";

export type CanvasTool = "select" | "move-panel" | "dividers" | "draw" | "knife" | "corners" | "line";

export interface LinePenOptions {
  color: string;
  width: number;
  style: LineStyleVariant;
  cap: LineCapStyle;
  layer: "above" | "behind";
  angleSnap: boolean;
}

interface PageCanvasProps {
  layout: PageLayout;
  selectedPanelId: string | null;
  selectedItemId: string | null;
  onSelectPanel: (panelId: string | null) => void;
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
  onTransformPanel?: (
    panelId: string,
    nextNormPoints: Point[],
    options?: { forceFloating?: boolean },
  ) => void;
  panelOverlapPref?: PanelOverlapPreference;
  onAddDrawnLine?: (line: Omit<DrawnLine, "id" | "zIndex">) => void;
  onUpdateDrawnLine?: (id: string, updated: Partial<DrawnLine>) => void;
  onDeleteDrawnLine?: (id: string) => void;
  linePenOptions?: LinePenOptions;
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
  onTransformPanel,
  panelOverlapPref = "float",
  onAddDrawnLine,
  onUpdateDrawnLine,
  linePenOptions,
  showOrder = null,
  showGuides = false,
  seamless = false,
  seamCutYs = [],
}: PageCanvasProps) {
  const { width, height, margin } = layout.format;
  const pageRef = useRef<HTMLDivElement>(null);
  const [knife, setKnife] = useState<{ a: Point; b: Point } | null>(null);
  const [drawBox, setDrawBox] = useState<{ a: Point; b: Point } | null>(null);
  const [pendingLine, setPendingLine] = useState<{ a: Point; b: Point; dragged: boolean } | null>(null);
  const [hoveredDivId, setHoveredDivId] = useState<string | null>(null);
  const dragDivider = useRef<{ divider: SharedDivider; basePanels: PanelPolygon[]; startNorm: Point } | null>(null);
  const dragVertex = useRef<Point | null>(null);
  const dragPanelRef = useRef<{
    panelId: string;
    basePanel: PanelPolygon;
    startRect: { x: number; y: number; width: number; height: number };
    startPtr: Point;
    mode: "move" | string;
  } | null>(null);
  const dragLineRef = useRef<{
    id: string;
    mode: "start" | "end" | "body";
    startPtr: Point;
    orig: { x1: number; y1: number; x2: number; y2: number };
  } | null>(null);
  const pointerDownPanelRef = useRef<string | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  useEffect(() => {
    setPendingLine(null);
  }, [tool]);

  useEffect(() => {
    if (!pendingLine) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingLine(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [pendingLine]);

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
  const panelIdSet = new Set(layout.panels.map((p) => p.id));
  const pageElements = layout.elements.filter((el) => el.panelId === PAGE_LAYER_ID);
  const pageKind = (el: PlacedElement) =>
    el.pageLayer?.kind ?? (el.type === "background" ? "behind" : "above");
  const behindPageEls = pageElements
    .filter((el) => pageKind(el) === "behind")
    .sort((a, b) => a.zIndex - b.zIndex);
  const abovePageEls = pageElements
    .filter((el) => {
      const lyr = el.pageLayer;
      if (!lyr) return el.type !== "background";
      if (lyr.kind === "above") return true;
      if ((lyr.kind === "below-panel" || lyr.kind === "above-panel") && !panelIdSet.has(lyr.panelId)) return true;
      return false;
    })
    .sort((a, b) => a.zIndex - b.zIndex);
  const clippedElements = layout.elements.filter((el) => el.panelId !== PAGE_LAYER_ID && !el.breakout);
  const breakoutElements = layout.elements.filter((el) => el.panelId !== PAGE_LAYER_ID && el.breakout);
  const handleTargetElements = [...clippedElements, ...pageElements];
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

  const renderPageLayerElement = (el: PlacedElement) => (
    <div
      key={el.id}
      style={{ position: "absolute", top: 0, left: 0, width, height, pointerEvents: tool === "select" ? "auto" : "none", opacity: el.opacity ?? 1 }}
      onDoubleClick={() => el.source3d && onRePoseIn3D?.(el.source3d)}
    >
      <PanelTransformer
        element={el}
        isSelected={selectedItemId === el.id}
        mode="art-only"
        onSelect={() => {
          onSelectPanel(null);
          onSelectItem(el.id);
        }}
        onChange={(updated) => handleElementChangeWithSnap(el.id, updated)}
        onDelete={() => onDeleteElement(el.id)}
      />
    </div>
  );

  const renderPanelGroup = (p: PanelPolygon) => {
    const b = bounds.get(p.id)!;
    const isSelected = selectedPanelId === p.id;
    const panelPath = buildPanelSvgPath(b.points, p.cornerRadius ?? 0, Boolean(p.scalloped));
    const uid = `${layout.id}-${p.id}`;
    const panelElements = clippedElements.filter((el) => el.panelId === p.id);
    const belowPanelEls = pageElements
      .filter((el) => el.pageLayer?.kind === "below-panel" && el.pageLayer.panelId === p.id)
      .sort((a, b2) => a.zIndex - b2.zIndex);
    const abovePanelEls = pageElements
      .filter((el) => el.pageLayer?.kind === "above-panel" && el.pageLayer.panelId === p.id)
      .sort((a, b2) => a.zIndex - b2.zIndex);
    return (
      <React.Fragment key={`grp-${p.id}`}>
        {belowPanelEls.map(renderPageLayerElement)}
        <svg
          style={{ position: "absolute", top: 0, left: 0, width, height, pointerEvents: "none", opacity: p.opacity ?? 1, overflow: "visible" }}
        >
          <defs>
            <ToneDefs p={p} uid={uid} box={b} />
          </defs>
          <path
            d={panelPath}
            fill={p.backgroundColor === "transparent" ? "none" : p.backgroundColor || "#ffffff"}
            stroke={isSelected ? "#e11d2e" : "none"}
            strokeWidth={isSelected ? 2 : 0}
            className="cursor-pointer"
            data-panel-id={p.id}
            style={{ pointerEvents: tool === "select" || tool === "move-panel" ? "all" : "none" }}
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
        {abovePanelEls.map(renderPageLayerElement)}
      </React.Fragment>
    );
  };

  const renderSvgDrawnLine = (line: DrawnLine, isPreview = false) => {
    const isSel = !isPreview && selectedItemId === line.id;
    const dash = lineDashArray(line.style, line.width)?.join(",");
    const segs = lineSegmentsForStyle(line);
    const arrowPts = (pts: Point[]) => pts.map((pt) => `${pt.x},${pt.y}`).join(" ");
    return (
      <g
        key={line.id}
        opacity={line.opacity ?? 1}
        data-drawn-line-id={isPreview ? undefined : line.id}
      >
        {isSel && (
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#2563eb"
            strokeOpacity={0.35}
            strokeWidth={Math.max(8, line.width + 6)}
            strokeLinecap="round"
            style={{ pointerEvents: "none" }}
          />
        )}
        {line.cap === "tapered" && line.style === "solid" ? (
          <polygon
            points={arrowPts(taperedNibPolygon(line))}
            fill={line.color || "#000000"}
            style={{ pointerEvents: "none" }}
          />
        ) : (
          segs.map((seg, i) => (
            <line
              key={i}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={line.color || "#000000"}
              strokeWidth={line.width}
              strokeDasharray={dash}
              strokeLinecap={line.style === "dotted" ? "round" : "butt"}
              style={{ pointerEvents: "none" }}
            />
          ))
        )}
        {(line.cap === "arrow" || line.cap === "both") && (
          <polygon
            points={arrowPts(arrowHeadPolygon(line.x2, line.y2, line.x1, line.y1, line.width))}
            fill={line.color || "#000000"}
            style={{ pointerEvents: "none" }}
          />
        )}
        {line.cap === "both" && (
          <polygon
            points={arrowPts(arrowHeadPolygon(line.x1, line.y1, line.x2, line.y2, line.width))}
            fill={line.color || "#000000"}
            style={{ pointerEvents: "none" }}
          />
        )}
        {!isPreview && tool === "select" && (
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="transparent"
            strokeWidth={Math.max(14, line.width + 10)}
            style={{ pointerEvents: "stroke", cursor: "move" }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (line.panelId !== PAGE_LAYER_ID) onSelectPanel(line.panelId);
              onSelectItem(line.id);
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              dragLineRef.current = {
                id: line.id,
                mode: "body",
                startPtr: toPage(e),
                orig: { x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 },
              };
            }}
            onPointerMove={(e) => {
              const st = dragLineRef.current;
              if (!st || st.id !== line.id || st.mode !== "body") return;
              const cur = toPage(e);
              const dx = cur.x - st.startPtr.x;
              const dy = cur.y - st.startPtr.y;
              onUpdateDrawnLine?.(line.id, {
                x1: st.orig.x1 + dx,
                y1: st.orig.y1 + dy,
                x2: st.orig.x2 + dx,
                y2: st.orig.y2 + dy,
              });
            }}
            onPointerUp={() => {
              dragLineRef.current = null;
            }}
          />
        )}
      </g>
    );
  };

  const behindLines = (layout.drawnLines ?? []).filter((l) => l.layer === "behind").sort((a, b) => a.zIndex - b.zIndex);
  const aboveLines = (layout.drawnLines ?? []).filter((l) => l.layer !== "behind").sort((a, b) => a.zIndex - b.zIndex);
  const selLine = aboveLines.concat(behindLines).find((l) => l.id === selectedItemId) ?? null;

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
              onSelectPanel(null);
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

          {behindPageEls.map(renderPageLayerElement)}

          {behindLines.length > 0 && (
            <svg style={{ position: "absolute", inset: 0, width, height, pointerEvents: "none", zIndex: 1, overflow: "visible" }}>
              {behindLines.map((l) => renderSvgDrawnLine(l))}
            </svg>
          )}

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

          {abovePageEls.map(renderPageLayerElement)}

          {(aboveLines.length > 0 || (tool === "select" && selLine)) && (
            <svg
              data-testid="drawn-lines-layer"
              style={{ position: "absolute", inset: 0, width, height, pointerEvents: "none", zIndex: 83, overflow: "visible" }}
            >
              {aboveLines.map((l) => renderSvgDrawnLine(l))}
              {tool === "select" && selLine && (
                <>
                  {(["start", "end"] as const).map((end) => {
                    const cx = end === "start" ? selLine.x1 : selLine.x2;
                    const cy = end === "start" ? selLine.y1 : selLine.y2;
                    return (
                      <circle
                        key={end}
                        cx={cx}
                        cy={cy}
                        r={6.5}
                        fill="#ffffff"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        data-testid={`line-handle-${end}`}
                        style={{ pointerEvents: "all", cursor: "crosshair", touchAction: "none" }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          (e.currentTarget as Element).setPointerCapture(e.pointerId);
                          dragLineRef.current = {
                            id: selLine.id,
                            mode: end,
                            startPtr: toPage(e),
                            orig: { x1: selLine.x1, y1: selLine.y1, x2: selLine.x2, y2: selLine.y2 },
                          };
                        }}
                        onPointerMove={(e) => {
                          const st = dragLineRef.current;
                          if (!st || st.id !== selLine.id || st.mode !== end) return;
                          let pt = toPage(e);
                          if (e.shiftKey) {
                            const anchor = end === "start" ? { x: st.orig.x2, y: st.orig.y2 } : { x: st.orig.x1, y: st.orig.y1 };
                            pt = snapLineAngle(anchor, pt);
                          }
                          onUpdateDrawnLine?.(
                            selLine.id,
                            end === "start" ? { x1: pt.x, y1: pt.y } : { x2: pt.x, y2: pt.y },
                          );
                        }}
                        onPointerUp={() => {
                          dragLineRef.current = null;
                        }}
                      />
                    );
                  })}
                </>
              )}
            </svg>
          )}

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
              handleTargetElements
                .filter((el) => el.id === selectedItemId)
                .map((el) => (
                  <PanelTransformer
                    key={`handles-${el.id}`}
                    element={el}
                    isSelected={true}
                    mode="handles-only"
                    onSelect={() => {
                      onSelectPanel(el.panelId === PAGE_LAYER_ID ? null : el.panelId);
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

          {/* Selected Panel Move & 8-Handle Resize Box */}
          {tool === "move-panel" && selPanel && onTransformPanel && (() => {
            const box = bounds.get(selPanel.id);
            if (!box) return null;
            const forceFloat = panelOverlapPref === "float";
            const PANEL_HANDLES: { id: string; label: string; style: React.CSSProperties; cursor: string }[] = [
              { id: "nw", label: "Resize panel top-left corner", style: { left: -6, top: -6 }, cursor: "nwse-resize" },
              { id: "n", label: "Resize panel top edge", style: { left: "50%", top: -6, transform: "translateX(-50%)" }, cursor: "ns-resize" },
              { id: "ne", label: "Resize panel top-right corner", style: { right: -6, top: -6 }, cursor: "nesw-resize" },
              { id: "e", label: "Resize panel right edge", style: { right: -6, top: "50%", transform: "translateY(-50%)" }, cursor: "ew-resize" },
              { id: "se", label: "Resize panel bottom-right corner", style: { right: -6, bottom: -6 }, cursor: "nwse-resize" },
              { id: "s", label: "Resize panel bottom edge", style: { left: "50%", bottom: -6, transform: "translateX(-50%)" }, cursor: "ns-resize" },
              { id: "sw", label: "Resize panel bottom-left corner", style: { left: -6, bottom: -6 }, cursor: "nesw-resize" },
              { id: "w", label: "Resize panel left edge", style: { left: -6, top: "50%", transform: "translateY(-50%)" }, cursor: "ew-resize" },
            ];
            return (
              <div
                data-testid="panel-move-box"
                style={{
                  position: "absolute",
                  left: box.minX,
                  top: box.minY,
                  width: box.width,
                  height: box.height,
                  zIndex: 87,
                  touchAction: "none",
                }}
                className="cursor-move border-2 border-dashed border-primary bg-primary/5"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  dragPanelRef.current = {
                    panelId: selPanel.id,
                    basePanel: selPanel,
                    startRect: { x: box.minX, y: box.minY, width: box.width, height: box.height },
                    startPtr: toPage(e),
                    mode: "move",
                  };
                }}
                onPointerMove={(e) => {
                  const st = dragPanelRef.current;
                  if (!st || st.panelId !== selPanel.id || st.mode !== "move") return;
                  const cur = toPage(e);
                  let targetX = st.startRect.x + (cur.x - st.startPtr.x);
                  let targetY = st.startRect.y + (cur.y - st.startPtr.y);
                  if (!e.altKey) {
                    const otherPanels = Array.from(bounds.entries())
                      .filter(([pid]) => pid !== selPanel.id)
                      .map(([, b2]) => ({ x: b2.minX, y: b2.minY, width: b2.width, height: b2.height }));
                    const snapped = computeSnapPosition(
                      { x: targetX, y: targetY, width: st.startRect.width, height: st.startRect.height },
                      [{ minX: margin, minY: margin, width: pw, height: ph }],
                      otherPanels,
                    );
                    targetX = snapped.x;
                    targetY = snapped.y;
                    setSnapGuides(snapped.guides);
                  } else {
                    setSnapGuides([]);
                  }
                  const targetFloat = forceFloat || Boolean(selPanel.floating);
                  const nextPts = panelPointsForTargetRect(
                    selPanel,
                    { x: targetX, y: targetY, width: st.startRect.width, height: st.startRect.height },
                    layout.format,
                    targetFloat,
                  );
                  onTransformPanel(selPanel.id, nextPts, { forceFloating: forceFloat });
                }}
                onPointerUp={() => {
                  dragPanelRef.current = null;
                  setSnapGuides([]);
                }}
              >
                <span className="pointer-events-none absolute -top-5 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
                  Drag to Move · Handles to Resize ({Math.round(box.width)}×{Math.round(box.height)})
                </span>
                {PANEL_HANDLES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    aria-label={h.label}
                    data-testid={`panel-resize-${h.id}`}
                    data-touch-handle="true"
                    style={{ position: "absolute", width: 12, height: 12, cursor: h.cursor, touchAction: "none", ...h.style }}
                    className="rounded-sm border-2 border-foreground bg-white shadow hover:bg-primary hover:border-white"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      dragPanelRef.current = {
                        panelId: selPanel.id,
                        basePanel: selPanel,
                        startRect: { x: box.minX, y: box.minY, width: box.width, height: box.height },
                        startPtr: toPage(e),
                        mode: h.id,
                      };
                    }}
                    onPointerMove={(e) => {
                      const st = dragPanelRef.current;
                      if (!st || st.panelId !== selPanel.id || st.mode !== h.id) return;
                      const cur = toPage(e);
                      const nextBox = computeResizedBox(
                        st.startRect,
                        h.id,
                        cur.x - st.startPtr.x,
                        cur.y - st.startPtr.y,
                        e.shiftKey,
                      );
                      const targetFloat = forceFloat || Boolean(selPanel.floating);
                      const nextPts = panelPointsForTargetRect(
                        selPanel,
                        {
                          x: nextBox.x,
                          y: nextBox.y,
                          width: Math.max(24, nextBox.width),
                          height: Math.max(24, nextBox.height),
                        },
                        layout.format,
                        targetFloat,
                      );
                      onTransformPanel(selPanel.id, nextPts, { forceFloating: forceFloat });
                    }}
                    onPointerUp={() => {
                      dragPanelRef.current = null;
                      setSnapGuides([]);
                    }}
                  />
                ))}
              </div>
            );
          })()}

          {/* Straight-Line Pen Tool Overlay (click-start->click-end OR drag) */}
          {tool === "line" && (() => {
            const opts = linePenOptions ?? {
              color: selPanel?.borderColor || "#000000",
              width: 3,
              style: "solid" as const,
              cap: "none" as const,
              layer: "above" as const,
              angleSnap: false,
            };
            const commitLine = (a: Point, b: Point) => {
              if (Math.hypot(b.x - a.x, b.y - a.y) < 4) return;
              onAddDrawnLine?.({
                panelId: selPanel ? selPanel.id : PAGE_LAYER_ID,
                x1: a.x,
                y1: a.y,
                x2: b.x,
                y2: b.y,
                color: opts.color || selPanel?.borderColor || "#000000",
                matchPanelBorder: Boolean(
                  selPanel && (!opts.color || opts.color.toLowerCase() === selPanel.borderColor.toLowerCase()),
                ),
                width: opts.width,
                style: opts.style,
                cap: opts.cap,
                opacity: 1,
                layer: opts.layer,
              });
            };
            return (
              <svg
                data-testid="line-pen-overlay"
                style={{ position: "absolute", inset: 0, width, height, cursor: "crosshair", touchAction: "none", zIndex: 89 }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const p = toPage(e);
                  if (!pendingLine) {
                    (e.currentTarget as Element).setPointerCapture(e.pointerId);
                    setPendingLine({ a: p, b: p, dragged: false });
                  } else {
                    const endPt = (e.shiftKey || opts.angleSnap) ? snapLineAngle(pendingLine.a, p) : p;
                    commitLine(pendingLine.a, endPt);
                    setPendingLine(null);
                  }
                }}
                onPointerMove={(e) => {
                  if (!pendingLine) return;
                  const raw = toPage(e);
                  const moved = pendingLine.dragged || Math.hypot(raw.x - pendingLine.a.x, raw.y - pendingLine.a.y) > 8;
                  const b = (e.shiftKey || opts.angleSnap) ? snapLineAngle(pendingLine.a, raw) : raw;
                  setPendingLine({ a: pendingLine.a, b, dragged: moved });
                }}
                onPointerUp={(e) => {
                  if (!pendingLine) return;
                  const raw = toPage(e);
                  const len = Math.hypot(raw.x - pendingLine.a.x, raw.y - pendingLine.a.y);
                  if (pendingLine.dragged && len >= 8) {
                    const endPt = (e.shiftKey || opts.angleSnap) ? snapLineAngle(pendingLine.a, raw) : raw;
                    commitLine(pendingLine.a, endPt);
                    setPendingLine(null);
                  }
                }}
              >
                {pendingLine &&
                  renderSvgDrawnLine(
                    {
                      id: "preview-line",
                      panelId: selPanel ? selPanel.id : PAGE_LAYER_ID,
                      x1: pendingLine.a.x,
                      y1: pendingLine.a.y,
                      x2: pendingLine.b.x,
                      y2: pendingLine.b.y,
                      color: opts.color || selPanel?.borderColor || "#000000",
                      width: opts.width,
                      style: opts.style,
                      cap: opts.cap,
                      opacity: 0.85,
                      layer: "above",
                      zIndex: 99,
                    },
                    true,
                  )}
                {pendingLine && (
                  <>
                    <circle cx={pendingLine.a.x} cy={pendingLine.a.y} r={4.5} fill="#2563eb" stroke="#fff" strokeWidth={1.5} />
                    <circle cx={pendingLine.b.x} cy={pendingLine.b.y} r={4.5} fill="#e11d2e" stroke="#fff" strokeWidth={1.5} />
                  </>
                )}
              </svg>
            );
          })()}

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
              data-touch-handle="true"
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

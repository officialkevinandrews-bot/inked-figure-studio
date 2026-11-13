import React, { useMemo, useRef, useState } from "react";
import { GripHorizontal, Minus, Plus, PlusCircle, Scissors } from "lucide-react";
import type { PageLayout, PlacedElement, Point } from "@/lib/manga-layout";
import type { ComicMark, SFXStamp, SpeechBalloon, SpeedLinesEffect } from "@/lib/manga-effects";
import {
  WEBTOON_SLICE_HEIGHT,
  WEBTOON_WIDTH,
  adjustWebtoonSegmentHeight,
  createWebtoonBeatPage,
  createWebtoonSpacerPage,
  getWebtoonSeams,
} from "@/lib/webtoon";
import { PageCanvas, type CanvasTool } from "./PageCanvas";

interface WebtoonCanvasProps {
  pages: PageLayout[];
  activePageIndex: number;
  selectedPanelId: string | null;
  selectedItemId: string | null;
  zoom: number;
  tool: CanvasTool;
  showGuides: boolean;
  showOrder: "rtl" | "ltr" | null;
  showSeams: boolean;
  onToggleSeams: (v: boolean) => void;
  onSelectPage: (index: number) => void;
  onSelectPanel: (panelId: string) => void;
  onSelectItem: (itemId: string | null) => void;
  onUpdatePageAt: (index: number, updated: PageLayout) => void;
  onInsertPageAt: (index: number, page: PageLayout) => void;
  onKnife?: (pageIndex: number, a: Point, b: Point) => void;
  onMoveVertex?: (pageIndex: number, from: Point, to: Point) => void;
  onRePoseIn3D?: (source3d: NonNullable<PlacedElement["source3d"]>) => void;
}

/**
 * Infinite continuous vertical Webtoon canvas stacking all chapter beats seamlessly at 800px normalized width,
 * with inline pacing spacer drag handles and 800x1280 export slice guides.
 */
export function WebtoonCanvas({
  pages,
  activePageIndex,
  selectedPanelId,
  selectedItemId,
  zoom,
  tool,
  showGuides,
  showOrder,
  showSeams,
  onToggleSeams,
  onSelectPage,
  onSelectPanel,
  onSelectItem,
  onUpdatePageAt,
  onInsertPageAt,
  onKnife,
  onMoveVertex,
  onRePoseIn3D,
}: WebtoonCanvasProps) {
  const dragResizeRef = useRef<{ pageIndex: number; startY: number; lastDy: number } | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const seams = useMemo(
    () => (showSeams ? getWebtoonSeams(pages, WEBTOON_SLICE_HEIGHT, WEBTOON_WIDTH) : []),
    [pages, showSeams],
  );

  const totalHeight800 = useMemo(
    () =>
      pages.reduce(
        (sum, p) => sum + Math.round(p.format.height * (WEBTOON_WIDTH / Math.max(1, p.format.width))),
        0,
      ),
    [pages],
  );

  const sliceCount = Math.max(1, Math.ceil(totalHeight800 / WEBTOON_SLICE_HEIGHT));

  const patchPage = (idx: number, patcher: (p: PageLayout) => PageLayout) => {
    const p = pages[idx];
    if (!p) return;
    onUpdatePageAt(idx, patcher(p));
  };

  return (
    <div data-testid="webtoon-scroll-canvas" className="mx-auto flex flex-col items-center pb-16">
      {/* Top Floating Summary Pill */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-full border border-foreground bg-card px-4 py-1 text-[11px] font-medium shadow-ink">
        <span className="font-bold">Continuous Webtoon Scroll</span>
        <span className="font-mono text-muted-foreground">
          800×{totalHeight800}px ({sliceCount} mobile slice{sliceCount === 1 ? "" : "s"})
        </span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={showSeams}
            onChange={(e) => onToggleSeams(e.target.checked)}
            className="accent-primary"
          />
          <Scissors className="h-3 w-3 text-sky-600" />
          Slice Seams
        </label>
      </div>

      {/* Continuous Stacked Strip */}
      <div className="border-2 border-foreground bg-white shadow-2xl">
        {pages.map((page, idx) => {
          const isCurrent = idx === activePageIndex;
          const pageZoom = zoom * (WEBTOON_WIDTH / Math.max(1, page.format.width));
          const seamYs = seams.filter((s) => s.pageIndex === idx).map((s) => s.localY);

          return (
            <div
              key={page.id}
              data-testid={`webtoon-segment-${idx}`}
              onPointerDown={() => {
                if (activePageIndex !== idx) onSelectPage(idx);
              }}
              className={`relative transition-shadow ${
                isCurrent ? "ring-2 ring-inset ring-primary/60" : ""
              }`}
            >
              <PageCanvas
                layout={page}
                seamless
                seamCutYs={seamYs}
                selectedPanelId={isCurrent ? selectedPanelId : null}
                selectedItemId={isCurrent ? selectedItemId : null}
                zoom={pageZoom}
                tool={tool}
                showGuides={showGuides}
                showOrder={showOrder}
                onSelectPanel={(panelId) => {
                  if (activePageIndex !== idx) onSelectPage(idx);
                  onSelectPanel(panelId);
                }}
                onSelectItem={(itemId) => {
                  if (activePageIndex !== idx && itemId !== null) onSelectPage(idx);
                  onSelectItem(itemId);
                }}
                onKnife={onKnife ? (a, b) => onKnife(idx, a, b) : undefined}
                onMoveVertex={onMoveVertex ? (from, to) => onMoveVertex(idx, from, to) : undefined}
                onRePoseIn3D={onRePoseIn3D}
                onUpdateElement={(id, u) =>
                  patchPage(idx, (cur) => ({
                    ...cur,
                    elements: cur.elements.map((el) => (el.id === id ? { ...el, ...u } : el)),
                  }))
                }
                onDeleteElement={(id) => {
                  patchPage(idx, (cur) => ({
                    ...cur,
                    elements: cur.elements.filter((el) => el.id !== id),
                  }));
                  if (selectedItemId === id) onSelectItem(null);
                }}
                onUpdateBalloon={(id, u: Partial<SpeechBalloon>) =>
                  patchPage(idx, (cur) => ({
                    ...cur,
                    balloons: (cur.balloons ?? []).map((b) => (b.id === id ? { ...b, ...u } : b)),
                  }))
                }
                onDeleteBalloon={(id) => {
                  patchPage(idx, (cur) => ({
                    ...cur,
                    balloons: (cur.balloons ?? []).filter((b) => b.id !== id),
                  }));
                  if (selectedItemId === id) onSelectItem(null);
                }}
                onUpdateComicMark={(id, u: Partial<ComicMark>) =>
                  patchPage(idx, (cur) => ({
                    ...cur,
                    comicMarks: (cur.comicMarks ?? []).map((m) => (m.id === id ? { ...m, ...u } : m)),
                  }))
                }
                onDeleteComicMark={(id) => {
                  patchPage(idx, (cur) => ({
                    ...cur,
                    comicMarks: (cur.comicMarks ?? []).filter((m) => m.id !== id),
                  }));
                  if (selectedItemId === id) onSelectItem(null);
                }}
                onUpdateSpeedLines={(id, u: Partial<SpeedLinesEffect>) =>
                  patchPage(idx, (cur) => ({
                    ...cur,
                    speedLines: (cur.speedLines ?? []).map((l) => (l.id === id ? { ...l, ...u } : l)),
                  }))
                }
                onDeleteSpeedLines={(id) => {
                  patchPage(idx, (cur) => ({
                    ...cur,
                    speedLines: (cur.speedLines ?? []).filter((l) => l.id !== id),
                  }));
                  if (selectedItemId === id) onSelectItem(null);
                }}
                onUpdateSFXStamp={(id, u: Partial<SFXStamp>) =>
                  patchPage(idx, (cur) => ({
                    ...cur,
                    sfxStamps: (cur.sfxStamps ?? []).map((s) => (s.id === id ? { ...s, ...u } : s)),
                  }))
                }
                onDeleteSFXStamp={(id) => {
                  patchPage(idx, (cur) => ({
                    ...cur,
                    sfxStamps: (cur.sfxStamps ?? []).filter((s) => s.id !== id),
                  }));
                  if (selectedItemId === id) onSelectItem(null);
                }}
              />

              {/* Segment Footer Pacing Bar (drag vertically to tune scroll pacing, or insert whitespace gap) */}
              <div
                data-testid="webtoon-spacer-handle"
                className={`flex items-center justify-between border-y border-dashed px-3 py-1 text-[10px] select-none transition-colors ${
                  draggingIdx === idx
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-zinc-300 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <span className="font-mono font-semibold">
                  Beat {idx + 1} · {page.format.height}px tall
                </span>

                <div
                  role="slider"
                  aria-label={`Drag height for Beat ${idx + 1}`}
                  aria-valuenow={page.format.height}
                  tabIndex={0}
                  title="Drag up/down to resize segment height"
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as Element).setPointerCapture(e.pointerId);
                    dragResizeRef.current = { pageIndex: idx, startY: e.clientY, lastDy: 0 };
                    setDraggingIdx(idx);
                  }}
                  onPointerMove={(e) => {
                    const st = dragResizeRef.current;
                    if (!st || st.pageIndex !== idx) return;
                    const dyScreen = e.clientY - st.startY;
                    const deltaPx = Math.round((dyScreen - st.lastDy) / Math.max(0.2, pageZoom));
                    if (Math.abs(deltaPx) >= 8) {
                      st.lastDy = dyScreen;
                      onUpdatePageAt(idx, adjustWebtoonSegmentHeight(page, deltaPx));
                    }
                  }}
                  onPointerUp={() => {
                    dragResizeRef.current = null;
                    setDraggingIdx(null);
                  }}
                  className="flex cursor-ns-resize items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-0.5 font-semibold hover:border-foreground"
                >
                  <GripHorizontal className="h-3 w-3" />
                  Drag Pace
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdatePageAt(idx, adjustWebtoonSegmentHeight(page, -160));
                    }}
                    title="Tighten vertical spacing (-160px)"
                    className="rounded border border-zinc-300 bg-white p-0.5 hover:border-foreground"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdatePageAt(idx, adjustWebtoonSegmentHeight(page, 160));
                    }}
                    title="Expand vertical spacing (+160px)"
                    className="rounded border border-zinc-300 bg-white p-0.5 hover:border-foreground"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onInsertPageAt(idx + 1, createWebtoonSpacerPage(idx + 2, 420));
                    }}
                    title="Insert blank vertical pacing gap after this beat"
                    className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 font-semibold hover:border-foreground"
                  >
                    + Gap
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Append Control */}
      <button
        data-testid="append-webtoon-beat"
        onClick={() => onInsertPageAt(pages.length, createWebtoonBeatPage(pages.length + 1))}
        className="mt-4 flex items-center gap-2 rounded-sm border-2 border-foreground bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5"
      >
        <PlusCircle className="h-4 w-4" />
        Append Webtoon Beat ({pages.length + 1})
      </button>
    </div>
  );
}


import React, { useMemo, useState } from "react";
import { Smartphone, X, Scissors } from "lucide-react";
import type { PageLayout } from "@/lib/manga-layout";
import { calculateWebtoonSlices } from "@/lib/export";
import { getWebtoonMetrics, getWebtoonSeams, WEBTOON_SLICE_HEIGHT, WEBTOON_WIDTH } from "@/lib/webtoon";
import { PageCanvas } from "./PageCanvas";

interface MobileWebtoonPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  pages: PageLayout[];
  activePageIndex: number;
  onJumpToPage?: (pageIndex: number) => void;
  onOpenExport?: () => void;
}

const PHONE_VIEWPORT_WIDTH = 340;
const noop = () => {};

/** Slide-over 9:16 smartphone frame simulating vertical Webtoon reading & 800x1280 export slice seams. */
export function MobileWebtoonPreview({
  isOpen,
  onClose,
  pages,
  activePageIndex,
  onJumpToPage,
  onOpenExport,
}: MobileWebtoonPreviewProps) {
  const [showSeams, setShowSeams] = useState(true);

  const metrics = useMemo(() => getWebtoonMetrics(pages, WEBTOON_WIDTH), [pages]);
  const seams = useMemo(() => getWebtoonSeams(pages, WEBTOON_SLICE_HEIGHT, WEBTOON_WIDTH), [pages]);
  const slices = useMemo(
    () => calculateWebtoonSlices(metrics.totalHeight, WEBTOON_SLICE_HEIGHT),
    [metrics.totalHeight],
  );

  if (!isOpen) return null;

  return (
    <div
      data-testid="mobile-preview-drawer"
      className="fixed inset-y-0 right-0 z-50 flex w-[410px] max-w-full flex-col border-l-2 border-foreground bg-card shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-foreground bg-muted px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          <div>
            <h2 className="font-display text-sm tracking-wide">MOBILE 9:16 READER</h2>
            <p className="text-[10px] text-muted-foreground">
              800×{metrics.totalHeight}px scroll · {slices.length} slice{slices.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close mobile preview"
          className="rounded border border-border p-1 hover:border-foreground hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs">
        <label className="flex items-center gap-1.5 font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={showSeams}
            onChange={(e) => setShowSeams(e.target.checked)}
            className="accent-primary"
          />
          <Scissors className="h-3.5 w-3.5 text-sky-600" />
          1280px Export Seams ({seams.length})
        </label>
        {onOpenExport && (
          <button
            onClick={onOpenExport}
            className="rounded border border-foreground bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-ink"
          >
            Export Slices
          </button>
        )}
      </div>

      {/* 9:16 Smartphone Bezel */}
      <div className="flex-1 overflow-hidden flex items-center justify-center bg-zinc-900/90 p-4">
        <div
          className="flex flex-col rounded-[28px] border-4 border-zinc-700 bg-zinc-950 p-2.5 shadow-2xl"
          style={{ width: PHONE_VIEWPORT_WIDTH + 28, height: "100%", maxHeight: 650 }}
        >
          {/* Speaker Notch */}
          <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-zinc-700 shrink-0" />

          {/* Scrollable 9:16 Viewport */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-[18px] bg-white">
            <div className="flex flex-col">
              {pages.map((page, idx) => {
                const scale = PHONE_VIEWPORT_WIDTH / Math.max(1, page.format.width);
                const pageSeams = showSeams
                  ? seams.filter((s) => s.pageIndex === idx).map((s) => s.localY)
                  : [];
                return (
                  <div
                    key={page.id}
                    onClick={() => onJumpToPage?.(idx)}
                    title={`Click to edit Beat ${idx + 1}`}
                    className={`relative cursor-pointer ${
                      idx === activePageIndex ? "ring-2 ring-inset ring-primary/50" : ""
                    }`}
                  >
                    <div className="pointer-events-none">
                      <PageCanvas
                        layout={page}
                        seamless
                        seamCutYs={pageSeams}
                        zoom={scale}
                        selectedPanelId={null}
                        selectedItemId={null}
                        onSelectPanel={noop}
                        onSelectItem={noop}
                        onUpdateElement={noop}
                        onDeleteElement={noop}
                        onUpdateBalloon={noop}
                        onDeleteBalloon={noop}
                        onUpdateComicMark={noop}
                        onDeleteComicMark={noop}
                        onUpdateSpeedLines={noop}
                        onDeleteSpeedLines={noop}
                        onUpdateSFXStamp={noop}
                        onDeleteSFXStamp={noop}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Home Gesture Bar */}
          <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-zinc-700 shrink-0" />
        </div>
      </div>
    </div>
  );
}


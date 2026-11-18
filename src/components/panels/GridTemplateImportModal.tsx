import React, { useEffect, useState } from "react";
import { Grid, Layers, PlusCircle, Replace, RotateCcw, Sparkles, Upload, X } from "lucide-react";
import type { PanelPolygon } from "@/lib/manga-layout";
import {
  extractPanelsFromImageFile,
  type ExtractedTemplateResult,
  type TemplateExtractOptions,
} from "@/lib/template-image-extractor";

interface GridTemplateImportModalProps {
  open: boolean;
  initialFile: File | null;
  pageAspectRatio: number; // width / height
  onClose: () => void;
  onApplyLayout: (options: {
    panels: PanelPolygon[];
    mode: "replace" | "new-page";
    saveAsTemplate: boolean;
    templateName: string;
  }) => void;
}

export function GridTemplateImportModal({
  open,
  initialFile,
  pageAspectRatio,
  onClose,
  onApplyLayout,
}: GridTemplateImportModalProps) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [inkThreshold, setInkThreshold] = useState(170);
  const [snapAngles, setSnapAngles] = useState(true);
  const [scaleMode, setScaleMode] = useState<"fit" | "exact">("fit");
  const [readingDirection, setReadingDirection] = useState<"rtl" | "ltr">("rtl");
  const [saveAsTemplate, setSaveAsTemplate] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [extracted, setExtracted] = useState<ExtractedTemplateResult | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(initialFile);
    setHiddenIds(new Set());
    setErrorMsg(null);
    const cleanBase = (initialFile?.name ?? "Uploaded Layout")
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim();
    setTemplateName(cleanBase || "Uploaded Layout");
  }, [open, initialFile]);

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setExtracting(true);
    setErrorMsg(null);

    const opts: TemplateExtractOptions = {
      inkThreshold,
      snapAngles,
      scaleMode,
      readingDirection,
      borderWidth: 3.5,
    };

    extractPanelsFromImageFile(file, opts)
      .then(({ result, previewDataUrl }) => {
        if (cancelled) return;
        setPreviewUrl(previewDataUrl);
        setExtracted(result);
        setHiddenIds(new Set());
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Could not read template image.");
      })
      .finally(() => {
        if (!cancelled) setExtracting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, file, inkThreshold, snapAngles, scaleMode, readingDirection]);

  if (!open) return null;

  const activePanels = (extracted?.panels ?? []).filter((p) => !hiddenIds.has(p.id));

  const handleTogglePanel = (panelId: string) => {
    setHiddenIds((cur) => {
      const next = new Set(cur);
      if (next.has(panelId)) next.delete(panelId);
      else next.add(panelId);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-label="Import Grid Layout Template"
        data-testid="grid-template-import-modal"
        className="flex w-full max-w-4xl max-h-[92dvh] flex-col rounded-sm border-2 border-foreground bg-card shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Grid className="h-4 w-4 text-primary shrink-0" />
            <h2 className="font-display text-sm sm:text-base tracking-wide truncate">
              IMPORT GRID LAYOUT TEMPLATE
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Grid Import Modal"
            className="rounded border border-border p-1 hover:border-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
          {/* Left / Top: Visual Vector Extraction Preview */}
          <div className="flex flex-1 min-h-[260px] flex-col items-center justify-center bg-muted/30 p-3 sm:p-5 overflow-auto">
            {!file ? (
              <label className="flex w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-foreground/40 bg-card p-6 text-center hover:border-primary">
                <Upload className="h-7 w-7 text-primary" />
                <span className="text-xs font-bold">Choose a Grid Template Image</span>
                <span className="text-[11px] text-muted-foreground">
                  Clean black-on-white panel layouts (PNG, JPG, WEBP)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    if (picked) setFile(picked);
                  }}
                />
              </label>
            ) : (
              <div className="flex flex-col items-center gap-2 w-full">
                <div
                  className="relative w-full max-w-[340px] rounded-xs border-2 border-foreground bg-white shadow-ink overflow-hidden"
                  style={{ aspectRatio: String(pageAspectRatio || 800 / 1200) }}
                >
                  {previewUrl && scaleMode === "exact" && (
                    <img
                      src={previewUrl}
                      alt="Uploaded template reference"
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-25"
                    />
                  )}
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="relative z-10 h-full w-full"
                    data-testid="extracted-panels-svg"
                  >
                    {activePanels.map((p, idx) => {
                      const xs = p.points.map((pt) => pt.x * 100);
                      const ys = p.points.map((pt) => pt.y * 100);
                      const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
                      const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
                      const ptsStr = p.points
                        .map((pt) => `${(pt.x * 100).toFixed(2)},${(pt.y * 100).toFixed(2)}`)
                        .join(" ");
                      return (
                        <g key={p.id}>
                          <polygon
                            points={ptsStr}
                            fill="rgba(59, 130, 246, 0.08)"
                            stroke="#111111"
                            strokeWidth="0.9"
                            vectorEffect="non-scaling-stroke"
                          />
                          <circle cx={cx} cy={cy} r="4.2" fill="#e11d48" />
                          <text
                            x={cx}
                            y={cy + 1.4}
                            textAnchor="middle"
                            fontSize="4.2"
                            fontWeight="bold"
                            fill="#ffffff"
                          >
                            {idx + 1}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <span>
                    {extracting
                      ? "Detecting panels…"
                      : `Detected ${activePanels.length} editable panel${activePanels.length === 1 ? "" : "s"}`}
                  </span>
                  {extracted?.droppedOuterFrame && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Outer frame ignored
                    </span>
                  )}
                  <label className="cursor-pointer rounded border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-foreground hover:border-foreground">
                    Change Image
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const picked = e.target.files?.[0] ?? null;
                        if (picked) {
                          setFile(picked);
                          setTemplateName(
                            picked.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() ||
                              "Uploaded Layout",
                          );
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="mt-2 rounded border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Right / Bottom: Tuning & Apply Controls */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border bg-card p-3.5 sm:p-4 overflow-y-auto space-y-3 text-xs shrink-0">
            <div className="space-y-2 rounded border border-border bg-muted/30 p-2.5">
              <div className="flex items-center gap-1.5 font-bold text-[11px]">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Detection Tuning</span>
              </div>

              <label className="block text-[11px]">
                <span className="flex justify-between mb-1">
                  <span>Line Sensitivity</span>
                  <span className="font-mono text-muted-foreground">{inkThreshold}</span>
                </span>
                <input
                  type="range"
                  min={70}
                  max={205}
                  step={5}
                  value={inkThreshold}
                  onChange={(e) => setInkThreshold(+e.target.value)}
                  className="w-full accent-primary"
                />
                <span className="block text-[10px] text-muted-foreground">
                  Lower ignores light gray text; raise for thin/faint borders.
                </span>
              </label>

              <label className="flex items-center justify-between gap-2 text-[11px] cursor-pointer pt-1">
                <span>Snap Straight Horizontal/Vertical</span>
                <input
                  type="checkbox"
                  checked={snapAngles}
                  onChange={(e) => setSnapAngles(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>

              <div className="pt-1">
                <span className="block text-[11px] font-semibold mb-1">Page Fit</span>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      ["fit", "Fill Page Bounds"],
                      ["exact", "Keep Sheet Margins"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setScaleMode(id)}
                      className={`rounded border py-1 px-1.5 text-[10px] font-semibold ${
                        scaleMode === id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background hover:border-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1">
                <span className="block text-[11px] font-semibold mb-1">Panel Order</span>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      ["rtl", "Manga (R → L)"],
                      ["ltr", "Comic (L → R)"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setReadingDirection(id)}
                      className={`rounded border py-1 px-1.5 text-[10px] font-semibold ${
                        readingDirection === id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background hover:border-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Detected panels toggle list */}
            {extracted && extracted.panels.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span>Detected Panels ({activePanels.length})</span>
                  </span>
                  {hiddenIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setHiddenIds(new Set())}
                      className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {extracted.panels.map((p, i) => {
                    const isHidden = hiddenIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleTogglePanel(p.id)}
                        title={isHidden ? "Click to restore panel" : "Click to exclude panel"}
                        className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
                          isHidden
                            ? "border-border bg-muted text-muted-foreground line-through"
                            : "border-foreground bg-accent/50 text-foreground"
                        }`}
                      >
                        #{i + 1} ({p.points.length}v) {isHidden ? "+" : "×"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Save as Custom Template */}
            <div className="space-y-1.5 rounded border border-border bg-muted/20 p-2.5">
              <label className="flex items-center gap-2 text-[11px] font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span>Also save to Custom Templates</span>
              </label>
              {saveAsTemplate && (
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name..."
                  aria-label="Imported template name"
                  className="w-full rounded border border-input bg-background px-2 py-1 text-[11px]"
                />
              )}
            </div>

            {/* Apply Actions */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                data-testid="grid-import-replace-btn"
                disabled={activePanels.length === 0 || extracting}
                onClick={() =>
                  onApplyLayout({
                    panels: activePanels,
                    mode: "replace",
                    saveAsTemplate,
                    templateName,
                  })
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-sm border-2 border-foreground bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-ink hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Replace className="h-3.5 w-3.5" />
                <span>Replace Current Page</span>
              </button>

              <button
                type="button"
                data-testid="grid-import-newpage-btn"
                disabled={activePanels.length === 0 || extracting}
                onClick={() =>
                  onApplyLayout({
                    panels: activePanels,
                    mode: "new-page",
                    saveAsTemplate,
                    templateName,
                  })
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-sm border-2 border-foreground bg-card px-3 py-2 text-xs font-bold hover:bg-accent disabled:opacity-50"
              >
                <PlusCircle className="h-3.5 w-3.5 text-primary" />
                <span>Create New Page</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

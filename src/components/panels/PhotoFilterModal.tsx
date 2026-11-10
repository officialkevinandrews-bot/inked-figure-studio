import React, { useState, useEffect, useRef } from "react";
import {
  type PhotoFilterOptions,
  DEFAULT_FILTER_OPTIONS,
  applyPhotoToMangaFilter,
} from "@/lib/photo-filter";
import { Sparkles, Sliders, Download, Check, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface PhotoFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImage?: string | null;
  onApplyToPanel: (filteredImageUrl: string) => void;
}

export function PhotoFilterModal({
  isOpen,
  onClose,
  initialImage,
  onApplyToPanel,
}: PhotoFilterModalProps) {
  const [sourceImage, setSourceImage] = useState<string | null>(initialImage || null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [options, setOptions] = useState<PhotoFilterOptions>(DEFAULT_FILTER_OPTIONS);
  const [previewMode, setPreviewMode] = useState<"side-by-side" | "manga">("side-by-side");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialImage) {
      setSourceImage(initialImage);
    }
  }, [initialImage]);

  // Re-process whenever options or sourceImage change
  useEffect(() => {
    if (!sourceImage || !isOpen) return;

    let isMounted = true;
    setIsProcessing(true);

    const timer = setTimeout(async () => {
      try {
        const result = await applyPhotoToMangaFilter(sourceImage, options);
        if (isMounted) {
          setProcessedImage(result);
          setIsProcessing(false);
        }
      } catch (err) {
        console.error("Filter error:", err);
        if (isMounted) setIsProcessing(false);
      }
    }, 150); // slight debounce for snappy slider feel

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [sourceImage, options, isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSourceImage(url);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;
    const a = document.createElement("a");
    a.href = processedImage;
    a.download = `photo-to-manga-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex h-[90vh] max-h-[850px] w-full max-w-5xl flex-col rounded-lg border-2 border-foreground bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-foreground bg-muted px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg tracking-wide">
              PHOTO-TO-MANGA <span className="text-primary">FILTER</span>
            </h2>
            <span className="text-xs text-muted-foreground ml-2">
              Transform real photos into authentic monochrome manga backgrounds & screentones
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Controls Sidebar */}
          <div className="w-80 border-r-2 border-foreground bg-card p-4 overflow-y-auto space-y-5 text-xs">
            <div>
              <label className="font-semibold block mb-2 text-foreground">Source Image</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded border-2 border-dashed border-foreground/40 bg-muted/40 py-2.5 font-medium hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <ImageIcon className="h-4 w-4" />
                Upload Photo / Background
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Inking Line controls */}
            <div className="space-y-3 border-t border-border pt-3">
              <h3 className="font-semibold text-foreground uppercase tracking-wider text-[11px] text-primary">
                1. Ink Outlines
              </h3>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Line Strength</span>
                  <span className="font-mono">{options.edgeStrength.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={options.edgeStrength}
                  onChange={(e) =>
                    setOptions({ ...options, edgeStrength: parseFloat(e.target.value) })
                  }
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Line Sensitivity (Threshold)</span>
                  <span className="font-mono">{options.edgeThreshold}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="1"
                  value={options.edgeThreshold}
                  onChange={(e) =>
                    setOptions({ ...options, edgeThreshold: parseInt(e.target.value) })
                  }
                  className="w-full accent-primary"
                />
              </div>
            </div>

            {/* Screentone & Shading */}
            <div className="space-y-3 border-t border-border pt-3">
              <h3 className="font-semibold text-foreground uppercase tracking-wider text-[11px] text-primary">
                2. Screentone & Shading
              </h3>
              <div>
                <label className="text-muted-foreground block mb-1">Pattern Style</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["dots", "crosshatch", "lines", "posterize"] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setOptions({ ...options, toneStyle: style })}
                      className={`rounded border px-2 py-1 text-center font-medium capitalize transition-colors ${
                        options.toneStyle === style
                          ? "border-foreground bg-primary text-primary-foreground font-semibold"
                          : "border-border bg-muted/30 hover:bg-muted"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Screentone Frequency</span>
                  <span className="font-mono">{options.toneFrequency} LPI</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="16"
                  step="1"
                  value={options.toneFrequency}
                  onChange={(e) =>
                    setOptions({ ...options, toneFrequency: parseInt(e.target.value) })
                  }
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Contrast</span>
                  <span className="font-mono">{options.contrast.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="2.0"
                  step="0.05"
                  value={options.contrast}
                  onChange={(e) =>
                    setOptions({ ...options, contrast: parseFloat(e.target.value) })
                  }
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Brightness Offset</span>
                  <span className="font-mono">{options.brightness}</span>
                </div>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  step="2"
                  value={options.brightness}
                  onChange={(e) =>
                    setOptions({ ...options, brightness: parseInt(e.target.value) })
                  }
                  className="w-full accent-primary"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="border-t border-border pt-3">
              <label className="text-muted-foreground block mb-2 font-semibold">Quick Presets</label>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() =>
                    setOptions({
                      ...DEFAULT_FILTER_OPTIONS,
                      edgeStrength: 1.8,
                      edgeThreshold: 30,
                      toneStyle: "dots",
                      toneFrequency: 8,
                    })
                  }
                  className="rounded border border-border bg-muted/40 px-2 py-1 text-left hover:border-foreground"
                >
                  Standard Shonen (Dots & Ink)
                </button>
                <button
                  onClick={() =>
                    setOptions({
                      ...DEFAULT_FILTER_OPTIONS,
                      edgeStrength: 2.2,
                      edgeThreshold: 24,
                      toneStyle: "crosshatch",
                      contrast: 1.4,
                      toneFrequency: 6,
                    })
                  }
                  className="rounded border border-border bg-muted/40 px-2 py-1 text-left hover:border-foreground"
                >
                  Dark Seinen (Heavy Hatch & Shadows)
                </button>
                <button
                  onClick={() =>
                    setOptions({
                      ...DEFAULT_FILTER_OPTIONS,
                      edgeStrength: 1.3,
                      edgeThreshold: 45,
                      toneStyle: "dots",
                      contrast: 1.1,
                      toneFrequency: 12,
                      brightness: 20,
                    })
                  }
                  className="rounded border border-border bg-muted/40 px-2 py-1 text-left hover:border-foreground"
                >
                  Shojo / Crisp Clean (Light Screentone)
                </button>
              </div>
            </div>
          </div>

          {/* Viewport & Preview */}
          <div className="flex flex-1 flex-col bg-muted/20">
            {/* View Mode Bar */}
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setPreviewMode("side-by-side")}
                  className={`rounded px-2.5 py-1 font-semibold ${
                    previewMode === "side-by-side"
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  Side-by-Side Comparison
                </button>
                <button
                  onClick={() => setPreviewMode("manga")}
                  className={`rounded px-2.5 py-1 font-semibold ${
                    previewMode === "manga"
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  Manga Filter Only
                </button>
              </div>

              {isProcessing && (
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Rendering Manga Inks...
                </div>
              )}
            </div>

            {/* Images display */}
            <div className="flex flex-1 items-center justify-center p-4 overflow-auto">
              {!sourceImage ? (
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <ImageIcon className="h-16 w-16 stroke-1" />
                  <p className="text-sm">Upload a photo to see the instant manga transformation</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-sm border-2 border-foreground bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-ink text-xs"
                  >
                    Select Photo
                  </button>
                </div>
              ) : previewMode === "side-by-side" ? (
                <div className="grid h-full w-full grid-cols-2 gap-4 items-center">
                  <div className="flex flex-col items-center justify-center rounded border border-border bg-card p-2 h-full max-h-[600px] overflow-hidden">
                    <span className="text-xs font-semibold text-muted-foreground mb-2">
                      Original Photo
                    </span>
                    <img
                      src={sourceImage}
                      alt="Original"
                      className="max-h-[500px] w-auto max-w-full object-contain rounded"
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center rounded border-2 border-foreground bg-white p-2 h-full max-h-[600px] overflow-hidden shadow-ink">
                    <span className="text-xs font-bold text-foreground mb-2">
                      ComiPo Manga Lineart + Screentone
                    </span>
                    {processedImage ? (
                      <img
                        src={processedImage}
                        alt="Manga filter"
                        className="max-h-[500px] w-auto max-w-full object-contain rounded"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-64 text-xs text-muted-foreground">
                        Processing...
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-foreground bg-white p-4 shadow-ink max-h-[600px] overflow-hidden">
                  {processedImage && (
                    <img
                      src={processedImage}
                      alt="Manga filter"
                      className="max-h-[540px] w-auto max-w-full object-contain"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t-2 border-foreground bg-card px-5 py-3">
          <button
            onClick={onClose}
            className="rounded border border-foreground px-4 py-1.5 font-medium text-xs hover:bg-muted"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              disabled={!processedImage}
              className="flex items-center gap-1.5 rounded border-2 border-foreground bg-secondary px-3 py-1.5 font-semibold text-xs shadow-ink disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download Plate
            </button>
            <button
              onClick={() => {
                if (processedImage) {
                  onApplyToPanel(processedImage);
                  onClose();
                }
              }}
              disabled={!processedImage}
              className="flex items-center gap-1.5 rounded border-2 border-foreground bg-primary px-4 py-1.5 font-bold text-primary-foreground shadow-ink text-xs disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Add as Panel Background
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


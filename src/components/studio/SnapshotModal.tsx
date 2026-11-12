import React, { useState } from "react";
import { downloadDataUrl, type SnapshotResult } from "@/lib/snapshot";
import { Download, PlusCircle, X, Sparkles } from "lucide-react";

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: SnapshotResult | null;
  onReRender: (ratio: number) => void;
  panels?: { id: string }[];
  onAddToPanel?: (panelId: string, dataUrl: string) => void;
}

export function SnapshotModal({
  isOpen,
  onClose,
  snapshot,
  onReRender,
  panels = [],
  onAddToPanel,
}: SnapshotModalProps) {
  const [ratio, setRatio] = useState<number>(2);
  const [panelId, setPanelId] = useState<string>("");

  if (!isOpen || !snapshot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-sm border-2 border-foreground bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b-2 border-foreground px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg">2D Transparent Manga Render</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Checkerboard preview container for transparent PNG */}
        <div className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] p-6 bg-muted/40">
          <img
            src={snapshot.dataUrl}
            alt="Manga Character Snapshot"
            className="max-h-[50vh] object-contain drop-shadow-md"
          />
          <div className="absolute bottom-2 right-3 rounded-sm bg-background/80 px-2 py-0.5 text-[11px] font-mono text-muted-foreground backdrop-blur-xs border">
            {snapshot.width} × {snapshot.height} px (Transparent Alpha)
          </div>
        </div>

        {/* Quality selector and action buttons */}
        <footer className="flex flex-col gap-3 border-t-2 border-foreground bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">Quality:</span>
            {[
              { label: "1x (Web)", value: 1 },
              { label: "2x (HD)", value: 2 },
              { label: "4x (Print 300DPI)", value: 4 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setRatio(opt.value);
                  onReRender(opt.value);
                }}
                className={`rounded-sm border px-2 py-1 text-xs font-semibold ${
                  ratio === opt.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                downloadDataUrl(snapshot.dataUrl, "manga-character-transparent.png");
              }}
              className="flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-transform hover:-translate-y-0.5"
            >
              <Download className="h-4 w-4" />
              Download PNG
            </button>

            {onAddToPanel && panels.length > 0 && (
              <select
                value={panelId || panels[0].id}
                onChange={(e) => setPanelId(e.target.value)}
                className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
                aria-label="Target panel"
              >
                {panels.map((p, i) => (
                  <option key={p.id} value={p.id}>Panel {i + 1}</option>
                ))}
              </select>
            )}
            {onAddToPanel && panels.length > 0 && (
              <button
                onClick={() => {
                  onAddToPanel(panelId || panels[0].id, snapshot.dataUrl);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5"
              >
                <PlusCircle className="h-4 w-4" />
                Add to Manga Panel
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}


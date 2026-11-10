import React from "react";
import type { PageLayout } from "@/lib/manga-layout";
import { getPresetPanels } from "@/lib/manga-layout";
import { Plus, Copy, Trash2, ChevronLeft, ChevronRight, FileText } from "lucide-react";

interface PageManagerProps {
  pages: PageLayout[];
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
}

export function PageManager({
  pages,
  activePageIndex,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
}: PageManagerProps) {
  return (
    <div className="flex items-center gap-3 border-t-2 border-foreground bg-card px-4 py-2 text-xs select-none overflow-x-auto">
      <div className="flex items-center gap-1.5 font-bold text-foreground">
        <FileText className="h-4 w-4 text-primary" />
        <span>Chapter Pages ({pages.length}):</span>
      </div>

      {/* Pages List */}
      <div className="flex items-center gap-2">
        {pages.map((p, idx) => {
          const isActive = idx === activePageIndex;
          return (
            <div
              key={p.id}
              onClick={() => onSelectPage(idx)}
              className={`group relative flex cursor-pointer flex-col items-center justify-between rounded border-2 px-3 py-1.5 transition-all ${
                isActive
                  ? "border-primary bg-primary/10 shadow-ink font-bold text-primary"
                  : "border-border bg-muted/40 hover:border-foreground text-foreground"
              }`}
            >
              <div className="flex items-center gap-1">
                <span>Page {idx + 1}</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  ({p.panels.length}p)
                </span>
              </div>

              {/* Hover Actions */}
              <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  disabled={idx === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMovePage(idx, idx - 1);
                  }}
                  title="Move page left"
                  className="rounded p-0.5 hover:bg-background disabled:opacity-30"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicatePage(idx);
                  }}
                  title="Duplicate page"
                  className="rounded p-0.5 hover:bg-background text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  disabled={pages.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(idx);
                  }}
                  title="Delete page"
                  className="rounded p-0.5 hover:bg-background text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <button
                  disabled={idx === pages.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMovePage(idx, idx + 1);
                  }}
                  title="Move page right"
                  className="rounded p-0.5 hover:bg-background disabled:opacity-30"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Page Button */}
      <button
        onClick={onAddPage}
        className="flex items-center gap-1 rounded border-2 border-dashed border-foreground/50 bg-background px-3 py-2 font-semibold hover:border-primary hover:text-primary transition-colors shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Page
      </button>
    </div>
  );
}


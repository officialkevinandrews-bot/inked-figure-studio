import React, { useEffect, useState } from "react";
import type { PageLayout } from "@/lib/manga-layout";
import {
  exportPageAsImage,
  downloadDataUrl,
  exportChapterAsPdf,
  exportWebtoonSlices,
} from "@/lib/export";
import {
  Download,
  FileText,
  Smartphone,
  Image as ImageIcon,
  X,
  Loader2,
  Check,
  Layers,
} from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: PageLayout;
  allPages: PageLayout[];
  initialTab?: "image" | "pdf" | "webtoon";
}

export function ExportModal({
  isOpen,
  onClose,
  currentPage,
  allPages,
  initialTab = "image",
}: ExportModalProps) {
  const [tab, setTab] = useState<"image" | "pdf" | "webtoon">(initialTab);
  useEffect(() => {
    if (isOpen) setTab(initialTab);
  }, [isOpen, initialTab]);
  const [scale, setScale] = useState<number>(2); // 1 = standard, 2 = 150 DPI, 3 = 300 DPI print
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [isExporting, setIsExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [webtoonPreviews, setWebtoonPreviews] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportSinglePage = async () => {
    setIsExporting(true);
    setSuccessMessage(null);
    try {
      const dataUrl = await exportPageAsImage(currentPage, { scale, format });
      setPreviewUrl(dataUrl);
      const filename = `manga-page-${currentPage.pageNumber || 1}-${scale}x.${format}`;
      downloadDataUrl(dataUrl, filename);
      setSuccessMessage(`Downloaded high-res page (${filename})`);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    setSuccessMessage(null);
    try {
      const pagesToExport = allPages.length > 0 ? allPages : [currentPage];
      await exportChapterAsPdf(pagesToExport, {
        filename: `manga-chapter-${pagesToExport.length}pages.pdf`,
        scale,
      });
      setSuccessMessage(`Compiled & downloaded ${pagesToExport.length}-page PDF chapter!`);
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportWebtoon = async () => {
    setIsExporting(true);
    setSuccessMessage(null);
    try {
      const pagesToExport = allPages.length > 0 ? allPages : [currentPage];
      const slices = await exportWebtoonSlices(pagesToExport, 1280);
      setWebtoonPreviews(slices);

      // Trigger download for each slice
      slices.forEach((dataUrl, idx) => {
        downloadDataUrl(dataUrl, `webtoon-strip-${idx + 1}.png`);
      });
      setSuccessMessage(`Sliced and downloaded ${slices.length} Webtoon strips (800x1280px)!`);
    } catch (err) {
      console.error("Webtoon export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex h-auto max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border-2 border-foreground bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-foreground bg-muted px-5 py-3">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg tracking-wide">
              EXPORT <span className="text-primary">MANGA STUDIO</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Export Tabs */}
        <div className="flex border-b border-border bg-card text-xs font-semibold">
          <button
            onClick={() => setTab("image")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${
              tab === "image"
                ? "border-b-2 border-primary bg-accent/40 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Single Page (PNG / JPG)
          </button>
          <button
            onClick={() => setTab("pdf")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${
              tab === "pdf"
                ? "border-b-2 border-primary bg-accent/40 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            Multi-Page PDF Book ({allPages.length || 1}{" "}
            {(allPages.length || 1) === 1 ? "page" : "pages"})
          </button>
          <button
            onClick={() => setTab("webtoon")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition-colors ${
              tab === "webtoon"
                ? "border-b-2 border-primary bg-accent/40 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            Webtoon Slices (800x1280)
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 text-xs">
          {tab === "image" && (
            <div className="space-y-4">
              <div>
                <label className="font-semibold block mb-2 text-foreground">
                  Resolution / Print Quality
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { s: 1, label: "Screen (72 DPI)", desc: "Fast preview" },
                    { s: 2, label: "HD (150 DPI)", desc: "Web publication" },
                    { s: 3, label: "Print (300 DPI)", desc: "Commercial print" },
                  ].map((item) => (
                    <button
                      key={item.s}
                      onClick={() => setScale(item.s)}
                      className={`flex flex-col items-center rounded border p-2.5 text-center transition-all ${
                        scale === item.s
                          ? "border-foreground bg-primary text-primary-foreground font-semibold shadow-ink"
                          : "border-border bg-muted/30 hover:border-foreground"
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] opacity-75 mt-0.5">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-2 text-foreground">Image Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormat("png")}
                    className={`rounded border py-2 text-center font-medium ${
                      format === "png"
                        ? "border-foreground bg-accent font-bold"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    PNG (Lossless & Crisp Ink Lines)
                  </button>
                  <button
                    onClick={() => setFormat("jpeg")}
                    className={`rounded border py-2 text-center font-medium ${
                      format === "jpeg"
                        ? "border-foreground bg-accent font-bold"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    JPEG (Smaller File Size)
                  </button>
                </div>
              </div>

              <div className="rounded border border-border bg-muted/20 p-3 text-muted-foreground">
                <span className="font-semibold text-foreground">Output Canvas Dimensions: </span>
                {currentPage.format.width * scale} × {currentPage.format.height * scale} pixels (
                {currentPage.format.name})
              </div>
            </div>
          )}

          {tab === "pdf" && (
            <div className="space-y-4">
              <div className="rounded border-2 border-foreground bg-accent/20 p-4">
                <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  Manga Chapter Compilation
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Export all{" "}
                  <strong>
                    {allPages.length || 1} {(allPages.length || 1) === 1 ? "page" : "pages"}
                  </strong>{" "}
                  formatted into a single printable high-resolution PDF document ready for physical
                  comic printing or digital tankobon release.
                </p>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">PDF Quality</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setScale(2)}
                    className={`rounded border py-2 ${
                      scale === 2 ? "border-foreground bg-accent font-bold" : "border-border"
                    }`}
                  >
                    Standard Print (150 DPI)
                  </button>
                  <button
                    onClick={() => setScale(3)}
                    className={`rounded border py-2 ${
                      scale === 3 ? "border-foreground bg-accent font-bold" : "border-border"
                    }`}
                  >
                    High-Res Manga Tankobon (300 DPI)
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "webtoon" && (
            <div className="space-y-4">
              <div className="rounded border-2 border-foreground bg-accent/20 p-4">
                <h3 className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Vertical Webtoon Auto-Slicer
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Webtoon and Tapas require vertical strips exactly <strong>800px wide</strong> and
                  up to <strong>1280px tall</strong>. This tool automatically compiles your pages
                  and slices them into sequential mobile-friendly PNG strips.
                </p>
              </div>

              {webtoonPreviews.length > 0 && (
                <div className="space-y-1">
                  <span className="font-semibold">Generated Slices:</span>
                  <div className="flex gap-2 overflow-x-auto py-2">
                    {webtoonPreviews.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`Slice ${i + 1}`}
                        className="h-28 w-auto rounded border border-foreground shadow-sm"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 rounded border-2 border-green-600 bg-green-50 p-2.5 text-green-800 text-xs font-semibold">
              <Check className="h-4 w-4 text-green-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t-2 border-foreground bg-muted px-5 py-3">
          <button
            onClick={onClose}
            className="rounded border border-foreground px-4 py-1.5 font-medium text-xs hover:bg-background"
          >
            Close
          </button>

          <button
            disabled={isExporting}
            onClick={
              tab === "image"
                ? handleExportSinglePage
                : tab === "pdf"
                ? handleExportPdf
                : handleExportWebtoon
            }
            className="flex items-center gap-2 rounded-sm border-2 border-foreground bg-primary px-5 py-2 font-bold text-primary-foreground shadow-ink text-xs transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Rendering Manga Chapter...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {tab === "image"
                  ? "Download Page"
                  : tab === "pdf"
                  ? "Generate PDF Chapter"
                  : "Slice & Download Webtoon"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


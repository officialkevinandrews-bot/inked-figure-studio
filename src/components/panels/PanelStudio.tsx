import React, { useState, useRef } from "react";
import {
  type PageLayout,
  type PlacedElement,
  PAGE_FORMATS,
  getPresetPanels,
  splitPanel,
  getPanelPixelBounds,
} from "@/lib/manga-layout";
import {
  type BalloonShape,
  type SpeechBalloon,
  type ComicMark,
  type SpeedLinesEffect,
  type SFXStamp,
  SFX_PRESETS,
  COMIC_MARK_PRESETS,
} from "@/lib/manga-effects";
import { PageCanvas } from "./PageCanvas";
import { PhotoFilterModal } from "./PhotoFilterModal";
import { ExportModal } from "./ExportModal";
import { PageManager } from "@/components/pages/PageManager";
import {
  Scissors,
  SplitSquareVertical,
  SplitSquareHorizontal,
  Maximize2,
  Trash2,
  ZoomIn,
  ZoomOut,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Sparkles,
  Layers,
  ArrowLeft,
  MessageSquare,
  Zap,
  Smile,
  Volume2,
  Download,
} from "lucide-react";

export interface PanelStudioProps {
  layout: PageLayout;
  onUpdateLayout: (updated: PageLayout) => void;
  onOpen3dStudio: () => void;
  allPages?: PageLayout[];
  activePageIndex?: number;
  onSelectPage?: (index: number) => void;
  onAddPage?: () => void;
  onDuplicatePage?: (index: number) => void;
  onDeletePage?: (index: number) => void;
  onMovePage?: (fromIndex: number, toIndex: number) => void;
}

export function PanelStudio({
  layout,
  onUpdateLayout,
  onOpen3dStudio,
  allPages,
  activePageIndex = 0,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
}: PanelStudioProps) {
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(
    layout.panels[0]?.id ?? null
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPanel = layout.panels.find((p) => p.id === selectedPanelId);

  // Identify what is currently selected
  const selectedElement = layout.elements.find((el) => el.id === selectedItemId);
  const selectedBalloon = layout.balloons?.find((b) => b.id === selectedItemId);
  const selectedComicMark = layout.comicMarks?.find((m) => m.id === selectedItemId);
  const selectedSpeedLine = layout.speedLines?.find((l) => l.id === selectedItemId);
  const selectedSFX = layout.sfxStamps?.find((s) => s.id === selectedItemId);

  // Template change
  const handleApplyTemplate = (templateName: string) => {
    const newPanels = getPresetPanels(templateName);
    onUpdateLayout({
      ...layout,
      panels: newPanels,
      elements: layout.elements.map((el) => ({
        ...el,
        panelId: newPanels[0].id,
      })),
    });
    setSelectedPanelId(newPanels[0].id);
  };

  // Format change
  const handleFormatChange = (formatId: string) => {
    const fmt = PAGE_FORMATS.find((f) => f.id === formatId) || PAGE_FORMATS[0];
    onUpdateLayout({
      ...layout,
      format: fmt,
    });
  };

  // Knife Cut tools
  const handleKnifeSplit = (type: "horizontal" | "vertical" | "diagonal") => {
    if (!selectedPanel) return;
    const [p1, p2] = splitPanel(selectedPanel, type);
    const updatedPanels = layout.panels.flatMap((p) => (p.id === selectedPanel.id ? [p1, p2] : [p]));

    onUpdateLayout({
      ...layout,
      panels: updatedPanels,
    });
    setSelectedPanelId(p1.id);
  };

  // Delete selected panel
  const handleDeletePanel = () => {
    if (!selectedPanel || layout.panels.length <= 1) return;
    const remaining = layout.panels.filter((p) => p.id !== selectedPanel.id);
    onUpdateLayout({
      ...layout,
      panels: remaining,
      elements: layout.elements.filter((el) => el.panelId !== selectedPanel.id),
    });
    setSelectedPanelId(remaining[0].id);
  };

  // Adders for Speech Balloons
  const handleAddBalloon = (shape: BalloonShape = "oval") => {
    if (!selectedPanel) return;
    const bounds = getPanelPixelBounds(
      selectedPanel,
      layout.format.width,
      layout.format.height,
      layout.format.margin,
      layout.format.gutter
    );

    const newBalloon: SpeechBalloon = {
      id: `balloon-${Date.now()}`,
      panelId: selectedPanel.id,
      shape,
      text: shape === "shout" ? "N-NANI?!" : shape === "thought" ? "..." : "Speech...",
      x: bounds.minX + bounds.width * 0.25,
      y: bounds.minY + bounds.height * 0.2,
      width: Math.min(bounds.width * 0.5, 180),
      height: Math.min(bounds.height * 0.35, 110),
      tail: {
        x: bounds.minX + bounds.width * 0.35,
        y: bounds.minY + bounds.height * 0.55,
      },
      fontSize: 16,
      fontWeight: shape === "shout" ? "bold" : "normal",
      writingMode: "horizontal-tb",
      backgroundColor: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 2.5,
      fontColor: "#000000",
      zIndex: (layout.balloons?.length ?? 0) + 100,
    };

    onUpdateLayout({
      ...layout,
      balloons: [...(layout.balloons ?? []), newBalloon],
    });
    setSelectedItemId(newBalloon.id);
  };

  const handleAddComicMark = (type: string) => {
    if (!selectedPanel) return;
    const bounds = getPanelPixelBounds(
      selectedPanel,
      layout.format.width,
      layout.format.height,
      layout.format.margin,
      layout.format.gutter
    );

    const newMark: ComicMark = {
      id: `mark-${Date.now()}`,
      panelId: selectedPanel.id,
      type,
      x: bounds.minX + bounds.width * 0.4,
      y: bounds.minY + bounds.height * 0.2,
      size: 36,
      rotation: 0,
      zIndex: (layout.comicMarks?.length ?? 0) + 50,
    };

    onUpdateLayout({
      ...layout,
      comicMarks: [...(layout.comicMarks ?? []), newMark],
    });
    setSelectedItemId(newMark.id);
  };

  const handleAddSpeedLines = (type: "radial" | "linear" = "radial") => {
    if (!selectedPanel) return;
    const bounds = getPanelPixelBounds(
      selectedPanel,
      layout.format.width,
      layout.format.height,
      layout.format.margin,
      layout.format.gutter
    );

    const newLines: SpeedLinesEffect = {
      id: `speedlines-${Date.now()}`,
      panelId: selectedPanel.id,
      type,
      centerX: bounds.minX + bounds.width / 2,
      centerY: bounds.minY + bounds.height / 2,
      angle: 0,
      density: 55,
      innerRadius: Math.min(bounds.width, bounds.height) * 0.2,
      outerRadius: Math.max(bounds.width, bounds.height) * 0.9,
      strokeWidth: 1.5,
      color: "#000000",
      zIndex: 2,
    };

    onUpdateLayout({
      ...layout,
      speedLines: [...(layout.speedLines ?? []), newLines],
    });
    setSelectedItemId(newLines.id);
  };

  const handleAddSFX = (text: string) => {
    if (!selectedPanel) return;
    const bounds = getPanelPixelBounds(
      selectedPanel,
      layout.format.width,
      layout.format.height,
      layout.format.margin,
      layout.format.gutter
    );

    const newSFX: SFXStamp = {
      id: `sfx-${Date.now()}`,
      panelId: selectedPanel.id,
      text,
      x: bounds.minX + bounds.width * 0.3,
      y: bounds.minY + bounds.height * 0.4,
      fontSize: 48,
      fillColor: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 4,
      rotation: -12,
      skewX: -10,
      zIndex: 80,
    };

    onUpdateLayout({
      ...layout,
      sfxStamps: [...(layout.sfxStamps ?? []), newSFX],
    });
    setSelectedItemId(newSFX.id);
  };

  // Image import onto panel
  const handleImportImage = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !selectedPanel) return;
    const url = URL.createObjectURL(file);
    const bounds = getPanelPixelBounds(
      selectedPanel,
      layout.format.width,
      layout.format.height,
      layout.format.margin,
      layout.format.gutter
    );

    const newEl: PlacedElement = {
      id: `el-${Date.now()}`,
      panelId: selectedPanel.id,
      type: "character",
      imageUrl: url,
      x: bounds.minX + 20,
      y: bounds.minY + 20,
      width: Math.min(bounds.width * 0.8, 300),
      height: Math.min(bounds.height * 0.8, 400),
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: layout.elements.length + 1,
      breakout: false,
    };

    onUpdateLayout({
      ...layout,
      elements: [...layout.elements, newEl],
    });
    setSelectedItemId(newEl.id);
  };

  // Photo Filter Background Injection
  const handleApplyPhotoFilter = (filteredUrl: string) => {
    if (!selectedPanel) return;
    const bounds = getPanelPixelBounds(
      selectedPanel,
      layout.format.width,
      layout.format.height,
      layout.format.margin,
      layout.format.gutter
    );

    const newEl: PlacedElement = {
      id: `bg-${Date.now()}`,
      panelId: selectedPanel.id,
      type: "background",
      imageUrl: filteredUrl,
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.width,
      height: bounds.height,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 1, // behind characters
      breakout: false,
    };

    onUpdateLayout({
      ...layout,
      elements: [newEl, ...layout.elements],
    });
    setSelectedItemId(newEl.id);
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground select-none">
      {/* Top Bar */}
      <header className="flex items-center gap-3 border-b-2 border-foreground px-4 py-2 bg-card">
        <button
          onClick={onOpen3dStudio}
          className="flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-primary px-3 py-1 font-semibold text-primary-foreground shadow-ink text-xs transition-transform hover:-translate-y-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to 3D Pose Studio
        </button>

        <h1 className="font-display text-lg tracking-wide hidden sm:block">
          MANGA<span className="text-primary">PANELS</span>
        </h1>

        {/* Templates Selector */}
        <div className="flex items-center gap-1 text-xs">
          <span className="font-semibold text-muted-foreground hidden md:inline">Layout:</span>
          {[
            { id: "1-splash", label: "1-Splash" },
            { id: "2-vert", label: "2-Panel" },
            { id: "4-koma", label: "4-Koma" },
            { id: "action-5", label: "Action 5" },
            { id: "classic-6", label: "Classic 6" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => handleApplyTemplate(t.id)}
              className="rounded-sm border border-border px-2 py-1 hover:border-foreground hover:bg-accent text-xs"
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Format Selector */}
        <select
          value={layout.format.id}
          onChange={(e) => handleFormatChange(e.target.value)}
          className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
        >
          {PAGE_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.width}×{f.height})
            </option>
          ))}
        </select>

        {/* Zoom Controls */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            className="rounded-sm border border-border p-1 hover:border-foreground"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center tabular-nums font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
            className="rounded-sm border border-border p-1 hover:border-foreground"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Photo-to-Manga Filter Button */}
          <button
            onClick={() => setFilterModalOpen(true)}
            className="flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-accent px-3 py-1 font-semibold text-xs shadow-ink hover:-translate-y-0.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Photo Filter
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-sm border border-border px-2.5 py-1 text-xs hover:border-foreground font-medium"
          >
            + Sprite
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleImportImage(e.target.files)}
          />

          {/* Export Button */}
          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-primary px-3.5 py-1 font-bold text-primary-foreground shadow-ink hover:-translate-y-0.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export Manga
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex min-h-0 flex-1">
        {/* Left Toolbar: Knife Cut & Manga Adders */}
        <aside className="flex w-64 flex-col border-r-2 border-foreground bg-card p-3 space-y-4 overflow-y-auto">
          {/* Knife Tools */}
          <div>
            <h2 className="font-display text-sm flex items-center gap-1.5 mb-1.5">
              <Scissors className="h-4 w-4 text-primary" /> Knife Split
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                disabled={!selectedPanel}
                onClick={() => handleKnifeSplit("horizontal")}
                className="flex items-center justify-center gap-1 rounded-sm border border-border py-1.5 text-xs font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40"
              >
                <SplitSquareHorizontal className="h-3.5 w-3.5" /> Horiz Cut
              </button>
              <button
                disabled={!selectedPanel}
                onClick={() => handleKnifeSplit("vertical")}
                className="flex items-center justify-center gap-1 rounded-sm border border-border py-1.5 text-xs font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40"
              >
                <SplitSquareVertical className="h-3.5 w-3.5" /> Vert Cut
              </button>
              <button
                disabled={!selectedPanel}
                onClick={() => handleKnifeSplit("diagonal")}
                className="col-span-2 flex items-center justify-center gap-1.5 rounded-sm border-2 border-primary bg-primary/10 py-1.5 text-xs font-semibold hover:bg-primary/20 disabled:opacity-40"
              >
                <Scissors className="h-3.5 w-3.5 text-primary" /> Action Slash (Diagonal)
              </button>
            </div>
          </div>

          {/* Speech Balloons Adder */}
          <div className="border-t border-border pt-3">
            <h2 className="font-display text-sm flex items-center gap-1.5 mb-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Speech Balloons
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: "oval", label: "Dialogue" },
                  { id: "shout", label: "💥 Shout" },
                  { id: "thought", label: "💭 Thought" },
                  { id: "whisper", label: "⋯ Whisper" },
                  { id: "square", label: "Narration" },
                  { id: "radio", label: "⚡ Broadcast" },
                ] as const
              ).map((b) => (
                <button
                  key={b.id}
                  disabled={!selectedPanel}
                  onClick={() => handleAddBalloon(b.id as BalloonShape)}
                  className="rounded-sm border border-border py-1.5 text-xs font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40 text-center"
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comic Marks */}
          <div className="border-t border-border pt-3">
            <h2 className="font-display text-sm flex items-center gap-1.5 mb-2">
              <Smile className="h-4 w-4 text-primary" /> Comic Emotion Marks
            </h2>
            <div className="grid grid-cols-4 gap-1">
              {COMIC_MARK_PRESETS.map((m) => (
                <button
                  key={m.label}
                  disabled={!selectedPanel}
                  onClick={() => handleAddComicMark(m.mark)}
                  title={m.label}
                  className="rounded-sm border border-border py-1 text-base hover:border-foreground hover:bg-accent disabled:opacity-40 flex items-center justify-center"
                >
                  {m.mark}
                </button>
              ))}
            </div>
          </div>

          {/* Screentones & Speed Lines */}
          <div className="border-t border-border pt-3">
            <h2 className="font-display text-sm flex items-center gap-1.5 mb-2">
              <Zap className="h-4 w-4 text-primary" /> Action Speed Lines
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                disabled={!selectedPanel}
                onClick={() => handleAddSpeedLines("radial")}
                className="rounded-sm border border-border py-1.5 text-xs font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40"
              >
                Radial Burst
              </button>
              <button
                disabled={!selectedPanel}
                onClick={() => handleAddSpeedLines("linear")}
                className="rounded-sm border border-border py-1.5 text-xs font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40"
              >
                Motion Lines
              </button>
            </div>
          </div>

          {/* SFX Stamps */}
          <div className="border-t border-border pt-3">
            <h2 className="font-display text-sm flex items-center gap-1.5 mb-2">
              <Volume2 className="h-4 w-4 text-primary" /> Onomatopoeia SFX
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {SFX_PRESETS.map((sfx) => (
                <button
                  key={sfx.text}
                  disabled={!selectedPanel}
                  onClick={() => handleAddSFX(sfx.text)}
                  className="rounded-sm border border-border py-1 text-xs font-black italic hover:border-foreground hover:bg-accent disabled:opacity-40"
                >
                  {sfx.text}
                </button>
              ))}
            </div>
          </div>

          {/* Gutter & Margins Settings */}
          <div className="space-y-2 border-t border-border pt-3 text-xs">
            <h3 className="font-display text-xs">Gutters & Margins</h3>
            <label className="block">
              <span className="flex justify-between">
                <span>Gutter:</span>
                <span className="font-semibold">{layout.format.gutter}px</span>
              </span>
              <input
                type="range"
                min={4}
                max={40}
                value={layout.format.gutter}
                onChange={(e) =>
                  onUpdateLayout({
                    ...layout,
                    format: { ...layout.format, gutter: +e.target.value },
                  })
                }
                className="w-full accent-primary"
              />
            </label>
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 overflow-auto p-8 flex items-center justify-center bg-muted/40">
          <PageCanvas
            layout={layout}
            selectedPanelId={selectedPanelId}
            selectedItemId={selectedItemId}
            onSelectPanel={setSelectedPanelId}
            onSelectItem={setSelectedItemId}
            onUpdateElement={(id, u) =>
              onUpdateLayout({
                ...layout,
                elements: layout.elements.map((el) => (el.id === id ? { ...el, ...u } : el)),
              })
            }
            onDeleteElement={(id) => {
              onUpdateLayout({
                ...layout,
                elements: layout.elements.filter((el) => el.id !== id),
              });
              if (selectedItemId === id) setSelectedItemId(null);
            }}
            onUpdateBalloon={(id, u) =>
              onUpdateLayout({
                ...layout,
                balloons: (layout.balloons ?? []).map((b) => (b.id === id ? { ...b, ...u } : b)),
              })
            }
            onDeleteBalloon={(id) => {
              onUpdateLayout({
                ...layout,
                balloons: (layout.balloons ?? []).filter((b) => b.id !== id),
              });
              if (selectedItemId === id) setSelectedItemId(null);
            }}
            onUpdateComicMark={(id, u) =>
              onUpdateLayout({
                ...layout,
                comicMarks: (layout.comicMarks ?? []).map((m) =>
                  m.id === id ? { ...m, ...u } : m
                ),
              })
            }
            onDeleteComicMark={(id) => {
              onUpdateLayout({
                ...layout,
                comicMarks: (layout.comicMarks ?? []).filter((m) => m.id !== id),
              });
              if (selectedItemId === id) setSelectedItemId(null);
            }}
            onUpdateSpeedLines={(id, u) =>
              onUpdateLayout({
                ...layout,
                speedLines: (layout.speedLines ?? []).map((l) =>
                  l.id === id ? { ...l, ...u } : l
                ),
              })
            }
            onDeleteSpeedLines={(id) => {
              onUpdateLayout({
                ...layout,
                speedLines: (layout.speedLines ?? []).filter((l) => l.id !== id),
              });
              if (selectedItemId === id) setSelectedItemId(null);
            }}
            onUpdateSFXStamp={(id, u) =>
              onUpdateLayout({
                ...layout,
                sfxStamps: (layout.sfxStamps ?? []).map((s) =>
                  s.id === id ? { ...s, ...u } : s
                ),
              })
            }
            onDeleteSFXStamp={(id) => {
              onUpdateLayout({
                ...layout,
                sfxStamps: (layout.sfxStamps ?? []).filter((s) => s.id !== id),
              });
              if (selectedItemId === id) setSelectedItemId(null);
            }}
            zoom={zoom}
          />
        </main>

        {/* Right Inspector */}
        <aside className="flex w-72 flex-col border-l-2 border-foreground bg-card p-3 space-y-4 overflow-y-auto">
          {/* Selected Panel Inspector */}
          {selectedPanel && (
            <div className="border-b border-border pb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-sm">Panel Properties</h3>
                {layout.panels.length > 1 && (
                  <button
                    onClick={handleDeletePanel}
                    className="text-destructive hover:bg-destructive/10 p-1 rounded"
                    title="Delete panel"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <label className="block">
                  <span className="flex justify-between">
                    <span>Border Thickness</span>
                    <span className="font-mono">{selectedPanel.borderWidth}px</span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={selectedPanel.borderWidth}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        panels: layout.panels.map((p) =>
                          p.id === selectedPanel.id ? { ...p, borderWidth: +e.target.value } : p
                        ),
                      })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>

                <div className="flex items-center justify-between">
                  <span>Border Style</span>
                  <div className="flex gap-1">
                    {(["solid", "dashed", "none"] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() =>
                          onUpdateLayout({
                            ...layout,
                            panels: layout.panels.map((p) =>
                              p.id === selectedPanel.id ? { ...p, borderStyle: style } : p
                            ),
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                          selectedPanel.borderStyle === style
                            ? "bg-foreground text-background border-foreground"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selected Element Inspector */}
          {selectedElement && (
            <div className="border-b border-border pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm">Sprite / Character</h3>
                <button
                  onClick={() => {
                    onUpdateLayout({
                      ...layout,
                      elements: layout.elements.filter((el) => el.id !== selectedElement.id),
                    });
                    setSelectedItemId(null);
                  }}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* 1-Click Breakout Overlay Toggle */}
              <div className="rounded border-2 border-primary bg-primary/10 p-2 text-xs">
                <label className="flex items-center justify-between cursor-pointer font-semibold text-primary">
                  <span>Breakout (Pop-out of border)</span>
                  <input
                    type="checkbox"
                    checked={selectedElement.breakout}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        elements: layout.elements.map((el) =>
                          el.id === selectedElement.id ? { ...el, breakout: e.target.checked } : el
                        ),
                      })
                    }
                    className="h-4 w-4 accent-primary"
                  />
                </label>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Allows character heads or weapons to boldly overlap gutters and borders.
                </p>
              </div>

              {/* Quick Flip & Rotate */}
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  onClick={() =>
                    onUpdateLayout({
                      ...layout,
                      elements: layout.elements.map((el) =>
                        el.id === selectedElement.id ? { ...el, flipX: !el.flipX } : el
                      ),
                    })
                  }
                  className={`flex items-center justify-center gap-1 py-1.5 rounded border ${
                    selectedElement.flipX ? "bg-accent font-bold" : "border-border"
                  }`}
                >
                  <FlipHorizontal className="h-3.5 w-3.5" /> Flip Horiz
                </button>
                <button
                  onClick={() =>
                    onUpdateLayout({
                      ...layout,
                      elements: layout.elements.map((el) =>
                        el.id === selectedElement.id
                          ? { ...el, rotation: (el.rotation + 90) % 360 }
                          : el
                      ),
                    })
                  }
                  className="flex items-center justify-center gap-1 py-1.5 rounded border border-border hover:bg-accent"
                >
                  <RotateCw className="h-3.5 w-3.5" /> +90° Rot
                </button>
              </div>
            </div>
          )}

          {/* Selected Speech Balloon Inspector */}
          {selectedBalloon && (
            <div className="border-b border-border pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm">Speech Balloon</h3>
                <button
                  onClick={() => {
                    onUpdateLayout({
                      ...layout,
                      balloons: layout.balloons?.filter((b) => b.id !== selectedBalloon.id),
                    });
                    setSelectedItemId(null);
                  }}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Dialogue Text</label>
                <textarea
                  rows={2}
                  value={selectedBalloon.text}
                  onChange={(e) =>
                    onUpdateLayout({
                      ...layout,
                      balloons: layout.balloons.map((b) =>
                        b.id === selectedBalloon.id ? { ...b, text: e.target.value } : b
                      ),
                    })
                  }
                  className="w-full p-2 text-xs rounded-sm border border-input bg-background"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Vertical Japanese Mode</span>
                <input
                  type="checkbox"
                  checked={selectedBalloon.writingMode === "vertical-rl"}
                  onChange={(e) =>
                    onUpdateLayout({
                      ...layout,
                      balloons: layout.balloons.map((b) =>
                        b.id === selectedBalloon.id
                          ? {
                              ...b,
                              writingMode: e.target.checked ? "vertical-rl" : "horizontal-tb",
                            }
                          : b
                      ),
                    })
                  }
                  className="h-4 w-4 accent-primary"
                />
              </div>

              <div className="space-y-2 text-xs">
                <label className="block">
                  <span className="flex justify-between">
                    <span>Font Size</span>
                    <span className="font-mono">{selectedBalloon.fontSize}px</span>
                  </span>
                  <input
                    type="range"
                    min={11}
                    max={36}
                    value={selectedBalloon.fontSize}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        balloons: layout.balloons.map((b) =>
                          b.id === selectedBalloon.id ? { ...b, fontSize: +e.target.value } : b
                        ),
                      })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Selected SFX Stamp Inspector */}
          {selectedSFX && (
            <div className="border-b border-border pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm">SFX Onomatopoeia</h3>
                <button
                  onClick={() => {
                    onUpdateLayout({
                      ...layout,
                      sfxStamps: layout.sfxStamps?.filter((s) => s.id !== selectedSFX.id),
                    });
                    setSelectedItemId(null);
                  }}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">SFX Word</label>
                <input
                  type="text"
                  value={selectedSFX.text}
                  onChange={(e) =>
                    onUpdateLayout({
                      ...layout,
                      sfxStamps: layout.sfxStamps.map((s) =>
                        s.id === selectedSFX.id ? { ...s, text: e.target.value } : s
                      ),
                    })
                  }
                  className="w-full px-2 py-1 text-xs rounded-sm border border-input bg-background font-bold"
                />
              </div>

              <div className="space-y-2 text-xs">
                <label className="block">
                  <span className="flex justify-between">
                    <span>Font Size</span>
                    <span className="font-mono">{selectedSFX.fontSize}px</span>
                  </span>
                  <input
                    type="range"
                    min={20}
                    max={120}
                    value={selectedSFX.fontSize}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        sfxStamps: layout.sfxStamps.map((s) =>
                          s.id === selectedSFX.id ? { ...s, fontSize: +e.target.value } : s
                        ),
                      })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>

                <label className="block">
                  <span className="flex justify-between">
                    <span>Rotation</span>
                    <span className="font-mono">{selectedSFX.rotation}°</span>
                  </span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={selectedSFX.rotation}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        sfxStamps: layout.sfxStamps.map((s) =>
                          s.id === selectedSFX.id ? { ...s, rotation: +e.target.value } : s
                        ),
                      })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>
              </div>
            </div>
          )}

          {!selectedElement &&
            !selectedBalloon &&
            !selectedSFX &&
            !selectedComicMark &&
            !selectedSpeedLine && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
                <Layers className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs font-semibold">Select an Element</p>
                <p className="text-[11px] mt-1">
                  Click any character, balloon, or effect on the canvas to configure its properties.
                </p>
              </div>
            )}
        </aside>
      </div>

      {/* Chapter Page Manager Filmstrip */}
      {allPages && allPages.length > 0 && onSelectPage && (
        <PageManager
          pages={allPages}
          activePageIndex={activePageIndex}
          onSelectPage={onSelectPage}
          onAddPage={onAddPage || (() => {})}
          onDuplicatePage={onDuplicatePage || (() => {})}
          onDeletePage={onDeletePage || (() => {})}
          onMovePage={onMovePage || (() => {})}
        />
      )}

      {/* Photo-to-Manga Filter Modal */}
      <PhotoFilterModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        onApplyToPanel={handleApplyPhotoFilter}
      />

      {/* Export Chapter & Page Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        currentPage={layout}
        allPages={allPages || [layout]}
      />
    </div>
  );
}

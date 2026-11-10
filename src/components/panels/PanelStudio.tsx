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
} from "lucide-react";

interface PanelStudioProps {
  layout: PageLayout;
  onUpdateLayout: (updated: PageLayout) => void;
  onOpen3dStudio: () => void;
}

export function PanelStudio({ layout, onUpdateLayout, onOpen3dStudio }: PanelStudioProps) {
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(
    layout.panels[0]?.id ?? null
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
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

  // --- Adders for Phase 3 features ---
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
      text: shape === "burst" ? "WHAT?!" : shape === "cloud" ? "(Thinking...)" : "Dialogue text here...",
      x: bounds.minX + bounds.width * 0.2,
      y: bounds.minY + 20,
      width: 140,
      height: 90,
      tailX: 30,
      tailY: 60,
      hasTail: shape !== "box",
      fontSize: 13,
      fontFamily: "'Zen Kaku Gothic New', sans-serif",
      isVertical: false,
      borderWidth: 2.5,
      borderColor: "#000000",
      backgroundColor: "#ffffff",
      zIndex: (layout.balloons?.length ?? 0) + 100,
    };

    onUpdateLayout({
      ...layout,
      balloons: [...(layout.balloons ?? []), newBalloon],
    });
    setSelectedItemId(newBalloon.id);
  };

  const handleAddComicMark = (type: ComicMark["type"]) => {
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

  return (
    <div className="flex h-screen flex-col bg-background text-foreground select-none">
      {/* Top Bar */}
      <header className="flex items-center gap-4 border-b-2 border-foreground px-4 py-2 bg-card">
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

          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-sm border-2 border-foreground bg-accent px-3 py-1 font-semibold text-xs shadow-ink hover:-translate-y-0.5"
          >
            + Add Image / Sprite
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleImportImage(e.target.files)}
          />
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
              {[
                { shape: "oval" as const, label: "Oval" },
                { shape: "burst" as const, label: "Shout / Spiky" },
                { shape: "cloud" as const, label: "Thought Cloud" },
                { shape: "box" as const, label: "Narration Box" },
                { shape: "whisper" as const, label: "Whisper (Dash)" },
                { shape: "electric" as const, label: "Electric / Radio" },
              ].map((b) => (
                <button
                  key={b.shape}
                  disabled={!selectedPanel}
                  onClick={() => handleAddBalloon(b.shape)}
                  className="rounded-sm border border-border p-1.5 text-xs font-medium hover:border-foreground hover:bg-accent text-left disabled:opacity-40 truncate"
                >
                  + {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Comic Marks & Emotion Symbols */}
          <div className="border-t border-border pt-3">
            <h2 className="font-display text-sm flex items-center gap-1.5 mb-2">
              <Smile className="h-4 w-4 text-primary" /> Comic Marks
            </h2>
            <div className="grid grid-cols-4 gap-1.5">
              {COMIC_MARK_PRESETS.map((m) => (
                <button
                  key={m.type}
                  disabled={!selectedPanel}
                  onClick={() => handleAddComicMark(m.type)}
                  title={m.label}
                  className="rounded-sm border border-border p-1.5 text-base flex items-center justify-center hover:border-foreground hover:bg-accent disabled:opacity-40"
                >
                  {m.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Speed Lines & Screentones */}
          <div className="border-t border-border pt-3">
            <h2 className="font-display text-sm flex items-center gap-1.5 mb-2">
              <Zap className="h-4 w-4 text-primary" /> Speed Lines
            </h2>
            <button
              disabled={!selectedPanel}
              onClick={() => handleAddSpeedLines("radial")}
              className="w-full flex items-center justify-center gap-1.5 rounded-sm border border-border py-1.5 text-xs font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40"
            >
              + Radial Focus Burst
            </button>
          </div>

          {/* SFX / Onomatopoeia Stamps */}
          <div className="border-t border-border pt-3">
            <h2 className="font-display text-sm flex items-center gap-1.5 mb-2">
              <Volume2 className="h-4 w-4 text-primary" /> Manga SFX Stamps
            </h2>
            <div className="grid grid-cols-3 gap-1">
              {SFX_PRESETS.map((s) => (
                <button
                  key={s.text}
                  disabled={!selectedPanel}
                  onClick={() => handleAddSFX(s.text)}
                  title={s.label}
                  className="rounded-sm border border-border px-1 py-1 text-xs font-bold hover:border-foreground hover:bg-accent disabled:opacity-40 truncate"
                >
                  {s.text}
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
                balloons: layout.balloons.map((b) => (b.id === id ? { ...b, ...u } : b)),
              })
            }
            onDeleteBalloon={(id) => {
              onUpdateLayout({
                ...layout,
                balloons: layout.balloons.filter((b) => b.id !== id),
              });
              if (selectedItemId === id) setSelectedItemId(null);
            }}
            onUpdateComicMark={(id, u) =>
              onUpdateLayout({
                ...layout,
                comicMarks: layout.comicMarks.map((m) => (m.id === id ? { ...m, ...u } : m)),
              })
            }
            onDeleteComicMark={(id) => {
              onUpdateLayout({
                ...layout,
                comicMarks: layout.comicMarks.filter((m) => m.id !== id),
              });
              if (selectedItemId === id) setSelectedItemId(null);
            }}
            onUpdateSpeedLines={(id, u) =>
              onUpdateLayout({
                ...layout,
                speedLines: layout.speedLines.map((l) => (l.id === id ? { ...l, ...u } : l)),
              })
            }
            onDeleteSpeedLines={(id) => {
              onUpdateLayout({
                ...layout,
                speedLines: layout.speedLines.filter((l) => l.id !== id),
              });
              if (selectedItemId === id) setSelectedItemId(null);
            }}
            onUpdateSFXStamp={(id, u) =>
              onUpdateLayout({
                ...layout,
                sfxStamps: layout.sfxStamps.map((s) => (s.id === id ? { ...s, ...u } : s)),
              })
            }
            onDeleteSFXStamp={(id) => {
              onUpdateLayout({
                ...layout,
                sfxStamps: layout.sfxStamps.filter((s) => s.id !== id),
              });
              if (selectedItemId === id) setSelectedItemId(null);
            }}
            zoom={zoom}
          />
        </main>

        {/* Right Inspector Sidebar */}
        <aside className="flex w-72 flex-col border-l-2 border-foreground bg-card p-3 space-y-4 overflow-y-auto">
          {/* 1. Character Element Selected */}
          {selectedElement && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h2 className="font-display text-base">Figure Inspector</h2>
                <button
                  onClick={() => {
                    onUpdateLayout({
                      ...layout,
                      elements: layout.elements.filter((el) => el.id !== selectedElement.id),
                    });
                    setSelectedItemId(null);
                  }}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Breakout Toggle */}
              <div
                onClick={() =>
                  onUpdateLayout({
                    ...layout,
                    elements: layout.elements.map((el) =>
                      el.id === selectedElement.id ? { ...el, breakout: !el.breakout } : el
                    ),
                  })
                }
                className={`p-3 rounded-sm border-2 cursor-pointer transition-all ${
                  selectedElement.breakout
                    ? "border-primary bg-primary/10 shadow-ink"
                    : "border-border bg-background hover:border-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs flex items-center gap-1.5">
                    <Maximize2 className="h-4 w-4 text-primary" /> Breakout / Pop-out
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-xs ${
                      selectedElement.breakout
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {selectedElement.breakout ? "ENABLED" : "OFF"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Pop out past panel borders and gutters!
                </p>
              </div>

              {/* Dimensions */}
              <div className="space-y-3 text-xs">
                <label className="block">
                  <span className="flex justify-between">
                    <span>Width</span>
                    <span className="font-mono">{Math.round(selectedElement.width)}px</span>
                  </span>
                  <input
                    type="range"
                    min={40}
                    max={1200}
                    value={selectedElement.width}
                    onChange={(e) => {
                      const w = +e.target.value;
                      const ratio = selectedElement.height / selectedElement.width;
                      onUpdateLayout({
                        ...layout,
                        elements: layout.elements.map((el) =>
                          el.id === selectedElement.id ? { ...el, width: w, height: Math.round(w * ratio) } : el
                        ),
                      });
                    }}
                    className="w-full accent-primary mt-1"
                  />
                </label>

                <label className="block">
                  <span className="flex justify-between">
                    <span>Rotation</span>
                    <span className="font-mono">{selectedElement.rotation}°</span>
                  </span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={selectedElement.rotation}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        elements: layout.elements.map((el) =>
                          el.id === selectedElement.id ? { ...el, rotation: +e.target.value } : el
                        ),
                      })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>
              </div>

              {selectedElement.source3d && (
                <div className="border-t border-border pt-3">
                  <button
                    onClick={onOpen3dStudio}
                    className="w-full flex items-center justify-center gap-1.5 rounded-sm border-2 border-foreground bg-accent py-2 text-xs font-semibold shadow-ink hover:-translate-y-0.5"
                  >
                    <RotateCw className="h-3.5 w-3.5 text-primary" />
                    Re-pose Figure in 3D
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. Speech Balloon Selected */}
          {selectedBalloon && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h2 className="font-display text-base">Speech Balloon</h2>
                <button
                  onClick={() => {
                    onUpdateLayout({
                      ...layout,
                      balloons: layout.balloons.filter((b) => b.id !== selectedBalloon.id),
                    });
                    setSelectedItemId(null);
                  }}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Dialogue Text</label>
                <textarea
                  value={selectedBalloon.text}
                  onChange={(e) =>
                    onUpdateLayout({
                      ...layout,
                      balloons: layout.balloons.map((b) =>
                        b.id === selectedBalloon.id ? { ...b, text: e.target.value } : b
                      ),
                    })
                  }
                  className="w-full h-24 p-2 text-xs rounded-sm border border-input bg-background"
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
                    min={9}
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

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedBalloon.isVertical}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        balloons: layout.balloons.map((b) =>
                          b.id === selectedBalloon.id ? { ...b, isVertical: e.target.checked } : b
                        ),
                      })
                    }
                    className="accent-primary"
                  />
                  Vertical Reading (Japanese)
                </label>
              </div>
            </div>
          )}

          {/* 3. SFX Stamp Selected */}
          {selectedSFX && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h2 className="font-display text-base">SFX Stamp</h2>
                <button
                  onClick={() => {
                    onUpdateLayout({
                      ...layout,
                      sfxStamps: layout.sfxStamps.filter((s) => s.id !== selectedSFX.id),
                    });
                    setSelectedItemId(null);
                  }}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Sound Word</label>
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

          {!selectedElement && !selectedBalloon && !selectedSFX && !selectedComicMark && !selectedSpeedLine && (
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
    </div>
  );
}

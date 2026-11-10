import React, { useState, useRef } from "react";
import {
  type PageLayout,
  type PlacedElement,
  PAGE_FORMATS,
  getPresetPanels,
  splitPanel,
  getPanelPixelBounds,
} from "@/lib/manga-layout";
import { PageCanvas } from "./PageCanvas";
import {
  Scissors,
  SplitSquareVertical,
  SplitSquareHorizontal,
  Maximize2,
  Trash2,
  Plus,
  ZoomIn,
  ZoomOut,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Sparkles,
  Layers,
  ArrowLeft,
  Download,
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
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPanel = layout.panels.find((p) => p.id === selectedPanelId);
  const selectedElement = layout.elements.find((el) => el.id === selectedElementId);

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

  // Update element
  const handleUpdateElement = (id: string, updated: Partial<PlacedElement>) => {
    onUpdateLayout({
      ...layout,
      elements: layout.elements.map((el) => (el.id === id ? { ...el, ...updated } : el)),
    });
  };

  // Delete element
  const handleDeleteElement = (id: string) => {
    onUpdateLayout({
      ...layout,
      elements: layout.elements.filter((el) => el.id !== id),
    });
    if (selectedElementId === id) setSelectedElementId(null);
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
    setSelectedElementId(newEl.id);
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

      {/* Main Page Canvas Area */}
      <div className="flex min-h-0 flex-1">
        {/* Left Toolbar: Knife Cut & Panel Tools */}
        <aside className="flex w-64 flex-col border-r-2 border-foreground bg-card p-3 space-y-4">
          <div>
            <h2 className="font-display text-sm flex items-center gap-1.5 mb-2">
              <Scissors className="h-4 w-4 text-primary" /> Knife Split Tools
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Select a panel and click a cut style to split it dynamically:
            </p>

            <div className="space-y-2">
              <button
                disabled={!selectedPanel}
                onClick={() => handleKnifeSplit("horizontal")}
                className="w-full flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 text-xs font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40"
              >
                <SplitSquareHorizontal className="h-4 w-4" />
                Horizontal Split
              </button>

              <button
                disabled={!selectedPanel}
                onClick={() => handleKnifeSplit("vertical")}
                className="w-full flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 text-xs font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40"
              >
                <SplitSquareVertical className="h-4 w-4" />
                Vertical Split
              </button>

              <button
                disabled={!selectedPanel}
                onClick={() => handleKnifeSplit("diagonal")}
                className="w-full flex items-center gap-2 rounded-sm border-2 border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary/20 disabled:opacity-40"
              >
                <Scissors className="h-4 w-4 text-primary" />
                Diagonal Action Slash
              </button>
            </div>
          </div>

          {/* Gutter & Margin adjustments */}
          <div className="space-y-3 border-t border-border pt-3 text-xs">
            <h3 className="font-display text-sm">Gutter & Margins</h3>
            <label className="block">
              <span className="flex justify-between">
                <span>Gutter Spacing</span>
                <span className="font-semibold">{layout.format.gutter} px</span>
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
                className="w-full accent-primary mt-1"
              />
            </label>

            <label className="block">
              <span className="flex justify-between">
                <span>Outer Margin</span>
                <span className="font-semibold">{layout.format.margin} px</span>
              </span>
              <input
                type="range"
                min={10}
                max={60}
                value={layout.format.margin}
                onChange={(e) =>
                  onUpdateLayout({
                    ...layout,
                    format: { ...layout.format, margin: +e.target.value },
                  })
                }
                className="w-full accent-primary mt-1"
              />
            </label>
          </div>

          {/* Selected Panel Info */}
          {selectedPanel && (
            <div className="border-t border-border pt-3 space-y-2 text-xs">
              <h3 className="font-display text-sm">Active Panel: {selectedPanel.id}</h3>
              <label className="block">
                <span className="flex justify-between">
                  <span>Border Weight</span>
                  <span>{selectedPanel.borderWidth} px</span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={selectedPanel.borderWidth}
                  onChange={(e) => {
                    const bw = +e.target.value;
                    onUpdateLayout({
                      ...layout,
                      panels: layout.panels.map((p) =>
                        p.id === selectedPanel.id ? { ...p, borderWidth: bw } : p
                      ),
                    });
                  }}
                  className="w-full accent-primary mt-1"
                />
              </label>

              {layout.panels.length > 1 && (
                <button
                  onClick={handleDeletePanel}
                  className="w-full flex items-center justify-center gap-1.5 rounded-sm border border-destructive text-destructive px-3 py-1.5 text-xs hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Panel
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Center: Scrollable Manga Page Canvas */}
        <main className="flex-1 overflow-auto p-8 flex items-center justify-center bg-muted/40">
          <PageCanvas
            layout={layout}
            selectedPanelId={selectedPanelId}
            selectedElementId={selectedElementId}
            onSelectPanel={setSelectedPanelId}
            onSelectElement={setSelectedElementId}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            zoom={zoom}
          />
        </main>

        {/* Right Sidebar: Element Inspector & Breakout Controls */}
        <aside className="flex w-72 flex-col border-l-2 border-foreground bg-card p-3 space-y-4 overflow-y-auto">
          {selectedElement ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h2 className="font-display text-base">Selected Figure</h2>
                <button
                  onClick={() => handleDeleteElement(selectedElement.id)}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded-sm"
                  title="Delete element"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* 1-Click Breakout Pop-Out Toggle */}
              <div
                onClick={() =>
                  handleUpdateElement(selectedElement.id, {
                    breakout: !selectedElement.breakout,
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
                  When enabled, weapons, character heads, or limbs pop out past panel borders into gutters!
                </p>
              </div>

              {/* Transform Controls */}
              <div className="space-y-3 text-xs">
                <h3 className="font-semibold text-muted-foreground">Dimensions & Scale</h3>
                <label className="block">
                  <span className="flex justify-between">
                    <span>Width</span>
                    <span className="tabular-nums font-mono">{Math.round(selectedElement.width)} px</span>
                  </span>
                  <input
                    type="range"
                    min={40}
                    max={1200}
                    value={selectedElement.width}
                    onChange={(e) => {
                      const w = +e.target.value;
                      const ratio = selectedElement.height / selectedElement.width;
                      handleUpdateElement(selectedElement.id, {
                        width: w,
                        height: Math.round(w * ratio),
                      });
                    }}
                    className="w-full accent-primary mt-1"
                  />
                </label>

                <label className="block">
                  <span className="flex justify-between">
                    <span>Rotation</span>
                    <span className="tabular-nums font-mono">{selectedElement.rotation}°</span>
                  </span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={selectedElement.rotation}
                    onChange={(e) =>
                      handleUpdateElement(selectedElement.id, {
                        rotation: +e.target.value,
                      })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>

                {/* Flip options */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() =>
                      handleUpdateElement(selectedElement.id, {
                        flipX: !selectedElement.flipX,
                      })
                    }
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm border text-xs font-semibold ${
                      selectedElement.flipX
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    <FlipHorizontal className="h-3.5 w-3.5" /> Flip Horiz
                  </button>
                  <button
                    onClick={() =>
                      handleUpdateElement(selectedElement.id, {
                        flipY: !selectedElement.flipY,
                      })
                    }
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-sm border text-xs font-semibold ${
                      selectedElement.flipY
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    <FlipVertical className="h-3.5 w-3.5" /> Flip Vert
                  </button>
                </div>
              </div>

              {/* Non-destructive 3D Re-pose button */}
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
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
              <Layers className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-xs font-semibold">No Element Selected</p>
              <p className="text-[11px] mt-1">
                Click a character on the page to adjust its scale, rotation, layer order, or toggle
                Breakout Pop-out mode.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

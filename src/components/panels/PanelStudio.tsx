import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  type PageLayout,
  type PlacedElement,
  type PanelPolygon,
  PAGE_FORMATS,
  PRESET_LAYOUT_CATALOG,
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
  SFX_STYLES,
} from "@/lib/manga-effects";
import { VECTOR_MARKS, markPath } from "@/lib/manga-marks";
import { MANGA_FONTS, fontStack } from "@/lib/manga-fonts";
import { MANGA_BACKGROUNDS, getMangaBackgroundDataUrl, type MangaBackground } from "@/lib/manga-backgrounds";
import { PRESET_ROSTER, loadSavedRoster, type RosterCharacter } from "@/lib/character-roster";
import { PageCanvas, type CanvasTool } from "./PageCanvas";
import {
  GRID_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  buildTemplate,
  knifeCut,
  angledSplit,
  moveSharedVertex,
  mirrorPanels,
  pointInPolygon,
  insetPanelPoints,
} from "@/lib/manga-grid";
import { TONE_PRESETS, TONE_KINDS, TONE_FADES, toneDataUrl, type Screentone } from "@/lib/screentone";
import type { Point } from "@/lib/manga-layout";
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
  Image as ImageIcon,
  User,
  Copy,
  ArrowUp,
  ArrowDown,
  AlignCenter,
  AlignVerticalJustifyCenter,
  Palette,
  Eye,
  Camera,
  Compass,
} from "lucide-react";

export interface PanelStudioProps {
  layout: PageLayout;
  onUpdateLayout: (updated: PageLayout) => void;
  onOpen3dStudio: () => void;
  onRePoseIn3D?: (source3d: any) => void;
  allPages?: PageLayout[];
  activePageIndex?: number;
  onSelectPage?: (index: number) => void;
  onAddPage?: () => void;
  onDuplicatePage?: (index: number) => void;
  onDeletePage?: (index: number) => void;
  onMovePage?: (fromIndex: number, toIndex: number) => void;
}

type LeftTrayTab = "panels" | "backgrounds" | "characters" | "balloons";

export function PanelStudio({
  layout,
  onUpdateLayout,
  onOpen3dStudio,
  onRePoseIn3D,
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
  const [zoom, setZoom] = useState(0.65);
  const [leftTab, setLeftTab] = useState<LeftTrayTab>("panels");
  const [bgCategory, setBgCategory] = useState<"scenery" | "action" | "mood" | "screentone">("scenery");
  const [customSfxText, setCustomSfxText] = useState("ドンッ!!");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [splitAngle, setSplitAngle] = useState(0);
  const [splitRatio, setSplitRatio] = useState(50);
  const [tplCat, setTplCat] = useState<TemplateCategory | "all">("all");
  const [showOrder, setShowOrder] = useState<"rtl" | "ltr" | null>(null);
  const [showGuides, setShowGuides] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const selectedPanel = layout.panels.find((p) => p.id === selectedPanelId);

  // Identify what is currently selected
  const selectedElement = layout.elements.find((el) => el.id === selectedItemId);
  const selectedBalloon = layout.balloons?.find((b) => b.id === selectedItemId);
  const selectedComicMark = layout.comicMarks?.find((m) => m.id === selectedItemId);
  const selectedSpeedLine = layout.speedLines?.find((l) => l.id === selectedItemId);
  const selectedSFX = layout.sfxStamps?.find((s) => s.id === selectedItemId);

  // Dynamic Auto-Fit calculation
  const fitToScreen = useCallback(() => {
    if (!canvasContainerRef.current) return;
    const { clientWidth, clientHeight } = canvasContainerRef.current;
    const paddingX = 48;
    const paddingY = 48;
    const availW = Math.max(150, clientWidth - paddingX);
    const availH = Math.max(150, clientHeight - paddingY);
    const scale = Math.min(availW / layout.format.width, availH / layout.format.height);
    // Round to 2 decimal places, clamped comfortably
    setZoom(Math.max(0.2, Math.min(1.2, Math.round(scale * 100) / 100)));
  }, [layout.format.width, layout.format.height]);

  // Run auto-fit on initial mount and when layout dimensions change
  useEffect(() => {
    fitToScreen();
    const handleResize = () => fitToScreen();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fitToScreen]);

  /** Re-home elements whose panel vanished (cut / new template) into the panel under their centre. */
  const rehome = (panels: PanelPolygon[], elements: PlacedElement[]) => {
    const f = layout.format;
    return elements.map((el) => {
      if (panels.some((p) => p.id === el.panelId)) return el;
      const c = {
        x: (el.x + el.width / 2 - f.margin) / (f.width - f.margin * 2),
        y: (el.y + el.height / 2 - f.margin) / (f.height - f.margin * 2),
      };
      const home = [...panels].reverse().find((p) => pointInPolygon(c, p.points)) ?? panels[0];
      return { ...el, panelId: home.id };
    });
  };

  const commitPanels = (panels: PanelPolygon[], select?: string) => {
    onUpdateLayout({
      ...layout,
      panels,
      elements: rehome(panels, layout.elements),
      balloons: (layout.balloons ?? []).map((x) => (panels.some((p) => p.id === x.panelId) ? x : { ...x, panelId: panels[0].id })),
    });
    if (select) setSelectedPanelId(select);
    else if (!panels.some((p) => p.id === selectedPanelId)) setSelectedPanelId(panels[0]?.id ?? null);
  };

  // Template change
  const handleApplyTemplate = (templateName: string) => {
    const newPanels = buildTemplate(templateName) ?? getPresetPanels(templateName);
    commitPanels(newPanels, newPanels[0].id);
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
  const handleKnifeSplit = (type: "horizontal" | "vertical" | "diagonal" | "custom") => {
    if (!selectedPanel) return;
    const angle = type === "horizontal" ? 0 : type === "vertical" ? 90 : type === "diagonal" ? -12 : splitAngle;
    const res = angledSplit(selectedPanel, angle, splitRatio / 100);
    if (!res) return;
    commitPanels(
      layout.panels.flatMap((p) => (p.id === selectedPanel.id ? res : [p])),
      res[0].id
    );
  };

  const handleKnifeStroke = (a: Point, b: Point) => {
    const { panels, cut } = knifeCut(layout.panels, a, b);
    if (cut.length) commitPanels(panels);
  };

  const handleMoveVertex = (from: Point, to: Point) => {
    onUpdateLayout({ ...layout, panels: moveSharedVertex(layout.panels, from, to) });
  };

  const updatePanel = (id: string, patch: Partial<PanelPolygon>) =>
    onUpdateLayout({ ...layout, panels: layout.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const handleAddInset = () => {
    const id = `inset-${Date.now()}`;
    const pts = [
      { x: 0.55, y: 0.06 }, { x: 0.94, y: 0.06 }, { x: 0.94, y: 0.3 }, { x: 0.55, y: 0.3 },
    ];
    commitPanels(
      [...layout.panels, { id, points: pts, borderWidth: 3.5, borderColor: "#000000", borderStyle: "solid", backgroundColor: "#ffffff", floating: true }],
      id
    );
  };

  const nudgePanel = (dx: number, dy: number, scale = 1) => {
    if (!selectedPanel) return;
    const xs = selectedPanel.points.map((p) => p.x), ys = selectedPanel.points.map((p) => p.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    updatePanel(selectedPanel.id, {
      points: selectedPanel.points.map((p) => ({ x: cx + (p.x - cx) * scale + dx, y: cy + (p.y - cy) * scale + dy })),
    });
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
      text: shape === "burst" || shape === "double_burst" ? "N-NANI?!" : shape === "cloud" ? "..." : "Speech...",
      x: bounds.minX + bounds.width * 0.25,
      y: bounds.minY + bounds.height * 0.2,
      width: Math.min(bounds.width * 0.55, 200),
      height: Math.min(bounds.height * 0.4, 120),
      tail: {
        x: bounds.minX + bounds.width * 0.35,
        y: bounds.minY + bounds.height * 0.55,
      },
      tailX: -Math.min(bounds.width * 0.55, 200) * 0.2,
      tailY: Math.min(bounds.height * 0.4, 120) * 0.85,
      hasTail: shape !== "box",
      fontSize: 16,
      fontWeight: shape === "burst" || shape === "double_burst" ? "bold" : "normal",
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
      markType: type as ComicMark["markType"],
      x: bounds.minX + bounds.width * 0.5,
      y: bounds.minY + bounds.height * 0.3,
      size: 60,
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
      innerRadius: Math.min(bounds.width, bounds.height) * 0.22,
      outerRadius: Math.max(bounds.width, bounds.height) * 0.95,
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
      x: bounds.minX + bounds.width * 0.25,
      y: bounds.minY + bounds.height * 0.35,
      fontSize: 50,
      fillColor: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 4.5,
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

  // Stamp a Manga Background Plate into the Active Panel
  const handleApplyBackground = (bg: MangaBackground) => {
    if (!selectedPanel) return;
    const bounds = getPanelPixelBounds(
      selectedPanel,
      layout.format.width,
      layout.format.height,
      layout.format.margin,
      layout.format.gutter
    );

    const dataUrl = getMangaBackgroundDataUrl(bg, Math.round(bounds.width), Math.round(bounds.height));

    const newEl: PlacedElement = {
      id: `bg-${Date.now()}`,
      panelId: selectedPanel.id,
      type: "background",
      imageUrl: dataUrl,
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.width,
      height: bounds.height,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 1, // Base background layer
      breakout: false,
    };

    // Remove existing background in this panel if user wants to replace it
    const remaining = layout.elements.filter((el) => !(el.panelId === selectedPanel.id && el.type === "background"));

    onUpdateLayout({
      ...layout,
      elements: [newEl, ...remaining],
    });
    setSelectedItemId(newEl.id);
  };

  // Stamp a Character from Roster onto the Active Panel
  const handleAddCharacterFromRoster = (char: RosterCharacter) => {
    if (!selectedPanel) return;
    const bounds = getPanelPixelBounds(
      selectedPanel,
      layout.format.width,
      layout.format.height,
      layout.format.margin,
      layout.format.gutter
    );

    const newEl: PlacedElement = {
      id: `char-${Date.now()}`,
      panelId: selectedPanel.id,
      type: "character",
      imageUrl: char.previewUrl,
      x: bounds.minX + bounds.width * 0.1,
      y: bounds.minY + bounds.height * 0.1,
      width: Math.min(bounds.width * 0.8, 320),
      height: Math.min(bounds.height * 0.85, 460),
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: layout.elements.length + 10,
      breakout: false,
      source3d: char.source3d ? { ...char.source3d, hipsDrop: char.source3d.hipsDrop ?? 0 } : undefined,
    };

    onUpdateLayout({
      ...layout,
      elements: [...layout.elements, newEl],
    });
    setSelectedItemId(newEl.id);
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

  // Element Layer Ordering Helpers
  const handleReorderElement = (id: string, direction: "up" | "down" | "top" | "bottom") => {
    const el = layout.elements.find((e) => e.id === id);
    if (!el) return;

    let updatedElements = [...layout.elements];
    const index = updatedElements.findIndex((e) => e.id === id);

    if (direction === "top") {
      const maxZ = Math.max(...updatedElements.map((e) => e.zIndex), 1);
      updatedElements[index] = { ...el, zIndex: maxZ + 1 };
    } else if (direction === "bottom") {
      const minZ = Math.min(...updatedElements.map((e) => e.zIndex), 1);
      updatedElements[index] = { ...el, zIndex: Math.max(1, minZ - 1) };
    } else if (direction === "up") {
      updatedElements[index] = { ...el, zIndex: el.zIndex + 1 };
    } else if (direction === "down") {
      updatedElements[index] = { ...el, zIndex: Math.max(1, el.zIndex - 1) };
    }

    onUpdateLayout({ ...layout, elements: updatedElements });
  };

  // 1-Click Duplicate Element
  const handleDuplicateElement = (el: PlacedElement) => {
    const dup: PlacedElement = {
      ...el,
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: el.x + 25,
      y: el.y + 25,
      zIndex: el.zIndex + 1,
    };
    onUpdateLayout({ ...layout, elements: [...layout.elements, dup] });
    setSelectedItemId(dup.id);
  };

  // Center Element in Panel
  const handleCenterInPanel = (el: PlacedElement) => {
    const panel = layout.panels.find((p) => p.id === el.panelId);
    if (!panel) return;
    const bounds = getPanelPixelBounds(
      panel,
      layout.format.width,
      layout.format.height,
      layout.format.margin,
      layout.format.gutter
    );
    onUpdateLayout({
      ...layout,
      elements: layout.elements.map((e) =>
        e.id === el.id
          ? {
              ...e,
              x: bounds.minX + (bounds.width - e.width) / 2,
              y: bounds.minY + (bounds.height - e.height) / 2,
            }
          : e
      ),
    });
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground select-none overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center gap-3 border-b-2 border-foreground px-4 py-2 bg-card shrink-0">
        <button
          onClick={onOpen3dStudio}
          className="flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-primary px-3 py-1 font-semibold text-primary-foreground shadow-ink text-xs transition-transform hover:-translate-y-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to 3D Pose Studio
        </button>

        <h1 className="font-display text-lg tracking-wide hidden sm:block">
          MANGA<span className="text-primary">STUDIO</span>
        </h1>

        {/* Format Selector */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-muted-foreground hidden lg:inline">Paper:</span>
          <select
            value={layout.format.id}
            onChange={(e) => handleFormatChange(e.target.value)}
            className="rounded-sm border border-input bg-background px-2 py-1 text-xs font-medium"
          >
            {PAGE_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.width}×{f.height})
              </option>
            ))}
          </select>
        </div>

        {/* Viewport Zoom & Fit Controls */}
        <div className="ml-auto flex items-center gap-1.5 text-xs">
          <button
            onClick={fitToScreen}
            title="Auto-Fit Page to Screen (no cutoffs)"
            className="rounded-sm border-2 border-foreground bg-accent px-2 py-1 font-semibold text-xs shadow-ink hover:bg-accent/80 flex items-center gap-1"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Fit Screen</span>
          </button>
          <button
            onClick={() => setZoom(1.0)}
            title="100% Actual Size"
            className={`rounded-sm border px-2 py-1 text-xs font-semibold ${
              zoom === 1.0 ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
            }`}
          >
            100%
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}
            className="rounded-sm border border-border p-1 hover:border-foreground"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center tabular-nums font-mono font-semibold">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}
            className="rounded-sm border border-border p-1 hover:border-foreground"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Quick Photo Filter */}
          <button
            onClick={() => setFilterModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-accent px-3 py-1 font-semibold text-xs shadow-ink hover:-translate-y-0.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Photo Filter
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="hidden sm:inline rounded-sm border border-border px-2.5 py-1 text-xs hover:border-foreground font-medium"
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
            className="flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-primary px-3.5 py-1 font-bold text-primary-foreground shadow-ink hover:-translate-y-0.5 text-xs ml-1"
          >
            <Download className="h-3.5 w-3.5" />
            Export Chapter
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Toolbar: 4 Creative Trays (Panels, Backgrounds, Characters, Dialogue) */}
        <aside className="flex w-76 flex-col border-r-2 border-foreground bg-card overflow-hidden shrink-0">
          {/* Tray Tab Bar */}
          <div className="grid grid-cols-4 border-b-2 border-foreground bg-muted text-[11px] font-semibold text-center">
            <button
              onClick={() => setLeftTab("panels")}
              className={`py-2 transition-colors border-r border-border ${
                leftTab === "panels" ? "border-b-2 border-primary bg-card text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Panels, Knife Cut & Grid Layouts"
            >
              📐 Panels
            </button>
            <button
              onClick={() => setLeftTab("backgrounds")}
              className={`py-2 transition-colors border-r border-border ${
                leftTab === "backgrounds" ? "border-b-2 border-primary bg-card text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Manga Background Plates & Screentones"
            >
              🖼️ Backs
            </button>
            <button
              onClick={() => setLeftTab("characters")}
              className={`py-2 transition-colors border-r border-border ${
                leftTab === "characters" ? "border-b-2 border-primary bg-card text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Character Staging Shelf & Poses"
            >
              👤 Chars
            </button>
            <button
              onClick={() => setLeftTab("balloons")}
              className={`py-2 transition-colors ${
                leftTab === "balloons" ? "border-b-2 border-primary bg-card text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Speech Balloons, Comic Marks & SFX"
            >
              💬 SFX
            </button>
          </div>

          {/* Tray 1: Panels, Knife Tools & Templates */}
          {leftTab === "panels" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {/* Canvas tools */}
              <div>
                <h2 className="font-display text-sm flex items-center gap-1.5 mb-1.5">
                  <Scissors className="h-4 w-4 text-primary" /> Panel Tools
                </h2>
                <div className="grid grid-cols-3 gap-1" role="group" aria-label="Canvas tool">
                  {([
                    { id: "select", label: "Select" },
                    { id: "knife", label: "✂ Knife" },
                    { id: "corners", label: "◇ Corners" },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      aria-pressed={tool === t.id}
                      onClick={() => setTool(t.id)}
                      className={`rounded-sm border border-border py-1.5 text-[11px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40 ${tool === t.id ? "bg-foreground text-background border-foreground" : ""}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                  {tool === "knife"
                    ? "Drag a line across the page to slice every panel it crosses. Hold Shift to snap the angle."
                    : tool === "corners"
                    ? "Drag the dots on the selected panel. Shared corners move neighbouring panels too."
                    : "Click a panel to select it. Switch to Knife or Corners to reshape the grid."}
                </p>
              </div>

              {/* Quick splits */}
              <div className="border-t border-border pt-3 space-y-2">
                <h3 className="font-display text-xs">Split Selected Panel</h3>
                <div className="grid grid-cols-3 gap-1">
                  <button disabled={!selectedPanel} onClick={() => handleKnifeSplit("horizontal")} className="rounded-sm border border-border py-1.5 text-[11px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40 flex items-center justify-center gap-1">
                    <SplitSquareHorizontal className="h-3.5 w-3.5" /> Horiz
                  </button>
                  <button disabled={!selectedPanel} onClick={() => handleKnifeSplit("vertical")} className="rounded-sm border border-border py-1.5 text-[11px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40 flex items-center justify-center gap-1">
                    <SplitSquareVertical className="h-3.5 w-3.5" /> Vert
                  </button>
                  <button disabled={!selectedPanel} onClick={() => handleKnifeSplit("diagonal")} className="rounded-sm border border-border py-1.5 text-[11px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40">
                    ⟋ Slash
                  </button>
                </div>
                <label className="block">
                  <span className="flex justify-between"><span>Cut angle</span><span className="font-mono">{splitAngle}°</span></span>
                  <input type="range" min={-90} max={90} value={splitAngle} onChange={(e) => setSplitAngle(+e.target.value)} className="w-full accent-primary" />
                </label>
                <label className="block">
                  <span className="flex justify-between"><span>Cut position</span><span className="font-mono">{splitRatio}%</span></span>
                  <input type="range" min={15} max={85} value={splitRatio} onChange={(e) => setSplitRatio(+e.target.value)} className="w-full accent-primary" />
                </label>
                <button disabled={!selectedPanel} onClick={() => handleKnifeSplit("custom")} className="w-full rounded-sm border-2 border-primary bg-primary/10 py-1.5 text-xs font-bold hover:bg-primary/20 disabled:opacity-40">
                  ✂ Cut at {splitAngle}°
                </button>
                <div className="grid grid-cols-2 gap-1">
                  <button onClick={handleAddInset} className="rounded-sm border border-border py-1.5 text-[11px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40">＋ Inset panel</button>
                  <button onClick={() => commitPanels(mirrorPanels(layout.panels))} className="rounded-sm border border-border py-1.5 text-[11px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40" title="Flip the grid left↔right">⇋ Mirror page</button>
                </div>
              </div>

              {/* Layout Template Gallery */}
              <div className="border-t border-border pt-3">
                <h2 className="font-display text-sm flex items-center gap-1.5 mb-2">
                  <Compass className="h-4 w-4 text-primary" /> Grid Templates
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground">{GRID_TEMPLATES.length} layouts</span>
                </h2>
                <div className="flex flex-wrap gap-1 mb-2">
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setTplCat(c.id)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tplCat === c.id ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5" data-testid="template-grid">
                  {GRID_TEMPLATES.filter((t) => tplCat === "all" || t.category === tplCat).map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => handleApplyTemplate(tmpl.id)}
                      title={tmpl.description}
                      aria-label={`Template ${tmpl.label}`}
                      className="rounded border border-border p-1 text-left hover:border-foreground hover:bg-accent/40 transition-all group"
                    >
                      <TemplateThumb panels={tmpl.build()} />
                      <div className="mt-1 text-[10px] font-semibold leading-tight text-foreground group-hover:text-primary line-clamp-1">{tmpl.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gutters & Margins Settings */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xs">Gutters & Margins</h3>
                  <button
                    onClick={() => onUpdateLayout({ ...layout, format: { ...layout.format, gutter: 10, gutterY: 24 } })}
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold hover:border-foreground"
                    title="Thin column gutters, wide tier gutters — the eye reads across before moving down"
                  >
                    Manga ratio
                  </button>
                </div>
                <label className="block">
                  <span className="flex justify-between"><span>Column gutter (↔)</span><span className="font-semibold">{layout.format.gutter}px</span></span>
                  <input type="range" min={0} max={48} value={layout.format.gutter}
                    onChange={(e) => onUpdateLayout({ ...layout, format: { ...layout.format, gutter: +e.target.value } })}
                    className="w-full accent-primary" />
                </label>
                <label className="block">
                  <span className="flex justify-between"><span>Tier gutter (↕)</span><span className="font-semibold">{layout.format.gutterY ?? layout.format.gutter}px</span></span>
                  <input type="range" min={0} max={60} value={layout.format.gutterY ?? layout.format.gutter}
                    onChange={(e) => onUpdateLayout({ ...layout, format: { ...layout.format, gutterY: +e.target.value } })}
                    className="w-full accent-primary" />
                </label>
                <label className="block">
                  <span className="flex justify-between"><span>Outer page margin</span><span className="font-semibold">{layout.format.margin}px</span></span>
                  <input type="range" min={0} max={80} value={layout.format.margin}
                    onChange={(e) => onUpdateLayout({ ...layout, format: { ...layout.format, margin: +e.target.value } })}
                    className="w-full accent-primary" />
                </label>
              </div>

              {/* Page guides */}
              <div className="space-y-1.5 border-t border-border pt-3">
                <h3 className="font-display text-xs">Page Guides</h3>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} className="accent-primary" />
                  Print guides (crop marks, trim, safe area)
                </label>
                <div className="flex items-center gap-1">
                  <span className="mr-1">Reading order:</span>
                  {([["off", null], ["Manga ←", "rtl"], ["Comic →", "ltr"]] as const).map(([lbl, v]) => (
                    <button key={lbl} onClick={() => setShowOrder(v)}
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${showOrder === v ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground"}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tray 2: Manga Background Plates & Screentones */}
          {leftTab === "backgrounds" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              {/* Photo-to-Manga Filter Hero Button */}
              <button
                onClick={() => setFilterModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded border-2 border-foreground bg-primary py-2 font-bold text-primary-foreground shadow-ink hover:opacity-90 transition-transform hover:-translate-y-0.5"
              >
                <Sparkles className="h-4 w-4" />
                Photo-to-Manga Inking Filter
              </button>

              {/* Category tabs */}
              <div className="flex gap-1 border-b border-border pb-2">
                {(["scenery", "action", "mood", "screentone"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setBgCategory(cat)}
                    className={`flex-1 py-1 rounded text-center text-[10px] font-semibold capitalize ${
                      bgCategory === cat ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Backgrounds Grid */}
              <div className="grid grid-cols-2 gap-2">
                {MANGA_BACKGROUNDS.filter((b) => b.category === bgCategory).map((bg) => (
                  <button
                    key={bg.id}
                    disabled={!selectedPanel}
                    onClick={() => handleApplyBackground(bg)}
                    className="flex flex-col items-center rounded border border-border p-2 hover:border-foreground hover:bg-accent/30 transition-all text-center group disabled:opacity-40"
                    title={`Stamp ${bg.name} to active panel`}
                  >
                    <span className="text-2xl mb-1">{bg.thumbnail}</span>
                    <span className="font-semibold text-[11px] line-clamp-2 leading-tight">
                      {bg.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tray 3: Character Staging Shelf */}
          {leftTab === "characters" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" /> Preset Characters
                </h3>
                <button
                  onClick={onOpen3dStudio}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Camera className="h-3 w-3" /> Pose 3D
                </button>
              </div>

              {/* Built-in Roster Figures */}
              <div className="grid grid-cols-2 gap-2">
                {PRESET_ROSTER.map((char) => (
                  <button
                    key={char.id}
                    disabled={!selectedPanel}
                    onClick={() => handleAddCharacterFromRoster(char)}
                    className="flex flex-col items-center rounded border border-border p-2.5 hover:border-foreground hover:bg-accent/40 text-center transition-all group disabled:opacity-40"
                    title={`Stamp ${char.name} to selected panel`}
                  >
                    <div className="w-12 h-16 rounded bg-muted/60 border border-foreground/30 flex items-center justify-center font-bold text-xs mb-1.5">
                      🧍
                    </div>
                    <span className="font-bold text-[11px] line-clamp-1">{char.name}</span>
                    <span className="text-[10px] text-muted-foreground">{char.role}</span>
                  </button>
                ))}
              </div>

              {/* Upload Custom Sprite */}
              <div className="border-t border-border pt-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 rounded border-2 border-dashed border-foreground/40 bg-muted/40 py-2 font-medium hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <ImageIcon className="h-4 w-4" />
                  Upload Custom Transparent Sprite
                </button>
              </div>
            </div>
          )}

          {/* Tray 4: Dialogue, Comic Marks & SFX */}
          {leftTab === "balloons" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {/* Speech Balloons */}
              <div>
                <h2 className="font-display text-sm flex items-center gap-1.5 mb-2">
                  <MessageSquare className="h-4 w-4 text-primary" /> Speech Balloons
                </h2>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "oval", label: "💬 Dialogue" },
                      { id: "burst", label: "💥 Shout / Scream" },
                      { id: "double_burst", label: "⚡ Mega Explosion" },
                      { id: "cloud", label: "💭 Thought" },
                      { id: "whisper", label: "⋯ Whisper" },
                      { id: "box", label: "📜 Narration Box" },
                      { id: "electric", label: "📻 Broadcast" },
                      { id: "heart", label: "❤️ Idol / Heart" },
                      { id: "rounded", label: "▢ Rounded" },
                      { id: "scream", label: "😱 Ragged Scream" },
                      { id: "wavy", label: "〰 Nervous / Weak" },
                      { id: "flash", label: "✴ Uni-Flash" },
                      { id: "icy", label: "🧊 Icy / Menace" },
                    ] as const
                  ).map((b) => (
                    <button
                      key={b.id}
                      disabled={!selectedPanel}
                      onClick={() => handleAddBalloon(b.id as BalloonShape)}
                      className="rounded-sm border border-border py-1.5 text-[11px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40 text-center"
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
                  {VECTOR_MARKS.map((m) => (
                    <button
                      key={m.type}
                      disabled={!selectedPanel}
                      onClick={() => handleAddComicMark(m.type)}
                      title={m.label}
                      aria-label={`Mark ${m.label}`}
                      className="rounded-sm border border-border p-1 hover:border-foreground hover:bg-accent disabled:opacity-40 flex items-center justify-center bg-white"
                    >
                      <svg viewBox="0 0 100 100" className="h-6 w-6" style={{ overflow: "visible" }}>
                        {(markPath(m.type) ?? []).map((part, i) => (
                          <path key={i} d={part.d} fill={part.fill ?? "none"} stroke={part.stroke} strokeWidth={part.width ?? 4} strokeLinecap="round" strokeLinejoin="round" />
                        ))}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed Lines */}
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

                {/* Custom SFX Creator */}
                <div className="flex gap-1.5 mt-2">
                  <input
                    type="text"
                    value={customSfxText}
                    onChange={(e) => setCustomSfxText(e.target.value)}
                    placeholder="Custom SFX..."
                    className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs font-bold"
                  />
                  <button
                    disabled={!selectedPanel || !customSfxText}
                    onClick={() => handleAddSFX(customSfxText)}
                    className="rounded bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-ink disabled:opacity-40"
                  >
                    Stamp
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Center Canvas Viewport with Auto-Fit Scrolling */}
        <main
          ref={canvasContainerRef}
          className="flex-1 min-w-0 overflow-auto p-6 flex bg-muted/30"
          onWheel={(e) => {
            if (e.ctrlKey) {
              e.preventDefault();
              setZoom((z) => Math.max(0.2, Math.min(1.5, z - e.deltaY * 0.0015)));
            }
          }}
        >
          <PageCanvas
            layout={layout}
            selectedPanelId={selectedPanelId}
            selectedItemId={selectedItemId}
            tool={tool}
            onKnife={handleKnifeStroke}
            onMoveVertex={handleMoveVertex}
            showOrder={showOrder}
            showGuides={showGuides}
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
            onRePoseIn3D={onRePoseIn3D}
            zoom={zoom}
          />
        </main>

        {/* Right Inspector: Panels, Characters, Balloons, Layers */}
        <aside className="flex w-76 flex-col border-l-2 border-foreground bg-card p-3 space-y-4 overflow-y-auto shrink-0">
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
                {/* Border thickness */}
                <label className="block">
                  <span className="flex justify-between">
                    <span>Border Thickness</span>
                    <span className="font-mono">{selectedPanel.borderWidth}px</span>
                  </span>
                  <input
                    type="range"
                    min={0}
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

                {/* Border Style */}
                <div className="flex items-center justify-between">
                  <span>Border Style</span>
                  <div className="flex gap-1">
                    {(["solid", "dashed", "dotted", "none"] as const).map((style) => (
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
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border capitalize ${
                          selectedPanel.borderStyle === style
                            ? "bg-foreground text-background border-foreground font-bold"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panel Background Color */}
                <div>
                  <span className="block mb-1 font-semibold">Background Fill</span>
                  <div className="flex gap-1.5">
                    {[
                      { color: "#ffffff", label: "White" },
                      { color: "#09090b", label: "Night Black" },
                      { color: "#e4e4e7", label: "Gray" },
                      { color: "#fef3c7", label: "Warm" },
                    ].map((c) => (
                      <button
                        key={c.color}
                        onClick={() =>
                          onUpdateLayout({
                            ...layout,
                            panels: layout.panels.map((p) =>
                              p.id === selectedPanel.id ? { ...p, backgroundColor: c.color } : p
                            ),
                          })
                        }
                        className={`flex-1 py-1 rounded text-[10px] border font-medium ${
                          selectedPanel.backgroundColor === c.color ? "border-primary ring-1 ring-primary font-bold" : "border-border"
                        }`}
                        style={{ backgroundColor: c.color, color: c.color === "#09090b" ? "#ffffff" : "#000000" }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panel shape flags */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={!!selectedPanel.bleed} onChange={(e) => updatePanel(selectedPanel.id, { bleed: e.target.checked })} className="accent-primary" />
                    Full bleed
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={!!selectedPanel.floating} onChange={(e) => updatePanel(selectedPanel.id, { floating: e.target.checked })} className="accent-primary" />
                    Floating inset
                  </label>
                </div>
                <div>
                  <span className="block mb-1 font-semibold">Border colour</span>
                  <div className="flex items-center gap-1.5">
                    {["#000000", "#ffffff", "#52525b", "#e11d2e"].map((c) => (
                      <button key={c} aria-label={`Border ${c}`} onClick={() => updatePanel(selectedPanel.id, { borderColor: c })}
                        className={`h-5 w-5 rounded-full border ${selectedPanel.borderColor === c ? "ring-2 ring-primary" : "border-border"}`} style={{ backgroundColor: c }} />
                    ))}
                    <input type="color" value={selectedPanel.borderColor} onChange={(e) => updatePanel(selectedPanel.id, { borderColor: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-border" />
                    <span className="ml-auto">Fill</span>
                    <input type="color" value={selectedPanel.backgroundColor} onChange={(e) => updatePanel(selectedPanel.id, { backgroundColor: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-border" />
                  </div>
                </div>
                {selectedPanel.floating && (
                  <div>
                    <span className="block mb-1 font-semibold">Move / resize inset</span>
                    <div className="grid grid-cols-6 gap-1">
                      <button className="rounded border px-1.5 py-0.5 text-[10px] font-semibold border-border" onClick={() => nudgePanel(-0.02, 0)}>←</button>
                      <button className="rounded border px-1.5 py-0.5 text-[10px] font-semibold border-border" onClick={() => nudgePanel(0.02, 0)}>→</button>
                      <button className="rounded border px-1.5 py-0.5 text-[10px] font-semibold border-border" onClick={() => nudgePanel(0, -0.02)}>↑</button>
                      <button className="rounded border px-1.5 py-0.5 text-[10px] font-semibold border-border" onClick={() => nudgePanel(0, 0.02)}>↓</button>
                      <button className="rounded border px-1.5 py-0.5 text-[10px] font-semibold border-border" onClick={() => nudgePanel(0, 0, 1.08)}>＋</button>
                      <button className="rounded border px-1.5 py-0.5 text-[10px] font-semibold border-border" onClick={() => nudgePanel(0, 0, 0.92)}>－</button>
                    </div>
                  </div>
                )}

                {/* Screentone */}
                <div className="border-t border-border pt-2" data-testid="tone-section">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">Screentone</span>
                    {selectedPanel.tone && (
                      <button className="text-[10px] text-destructive hover:underline" onClick={() => updatePanel(selectedPanel.id, { tone: null })}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {TONE_PRESETS.map((t) => (
                      <button key={t.id} title={t.label} aria-label={`Tone ${t.label}`}
                        onClick={() => updatePanel(selectedPanel.id, { tone: { ...t.tone } })}
                        className="rounded border border-border p-0.5 hover:border-foreground">
                        <div className="h-7 w-full rounded-sm bg-white" style={{ backgroundImage: `url("${toneDataUrl(t.tone)}")` }} />
                        <div className="text-[8px] leading-tight mt-0.5 line-clamp-1">{t.label}</div>
                      </button>
                    ))}
                  </div>
                  {selectedPanel.tone && (() => {
                    const tone = selectedPanel.tone as Screentone;
                    const setTone = (patch: Partial<Screentone>) => updatePanel(selectedPanel.id, { tone: { ...tone, ...patch } });
                    return (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {TONE_KINDS.map((k) => (
                            <button key={k.id} onClick={() => setTone({ kind: k.id })}
                              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${tone.kind === k.id ? "bg-foreground text-background border-foreground" : "border-border"}`}>{k.label}</button>
                          ))}
                        </div>
                        <label className="block"><span className="flex justify-between"><span>Density</span><span className="font-mono">{Math.round(tone.density * 100)}%</span></span>
                          <input type="range" min={2} max={90} value={Math.round(tone.density * 100)} onChange={(e) => setTone({ density: +e.target.value / 100 })} className="w-full accent-primary" /></label>
                        <label className="block"><span className="flex justify-between"><span>Line pitch (coarse ↔ fine)</span><span className="font-mono">{tone.cell}px</span></span>
                          <input type="range" min={3} max={24} value={tone.cell} onChange={(e) => setTone({ cell: +e.target.value })} className="w-full accent-primary" /></label>
                        <label className="block"><span className="flex justify-between"><span>Angle</span><span className="font-mono">{tone.angle}°</span></span>
                          <input type="range" min={0} max={180} value={tone.angle} onChange={(e) => setTone({ angle: +e.target.value })} className="w-full accent-primary" /></label>
                        <div className="flex flex-wrap gap-1">
                          {TONE_FADES.map((f) => (
                            <button key={f.id} onClick={() => setTone({ fade: f.id })}
                              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${tone.fade === f.id ? "bg-foreground text-background border-foreground" : "border-border"}`}>{f.label}</button>
                          ))}
                        </div>
                        <label className="flex items-center gap-2">Ink colour
                          <input type="color" value={tone.color} onChange={(e) => setTone({ color: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-border" /></label>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Selected Character / Sprite Inspector */}
          {selectedElement && (
            <div className="border-b border-border pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm">
                  {selectedElement.type === "character" ? "Character Figure" : "Background / Prop"}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicateElement(selectedElement)}
                    className="p-1 hover:text-primary rounded"
                    title="Clone / Duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      onUpdateLayout({
                        ...layout,
                        elements: layout.elements.filter((el) => el.id !== selectedElement.id),
                      });
                      setSelectedItemId(null);
                    }}
                    className="text-destructive hover:bg-destructive/10 p-1 rounded"
                    title="Delete element"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 1-Click Breakout Overlay Toggle */}
              <div className="rounded border-2 border-primary bg-primary/10 p-2 text-xs">
                <label className="flex items-center justify-between cursor-pointer font-bold text-primary">
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
                  Allows character heads, weapons, or action blasts to boldly overlap borders and gutters!
                </p>
              </div>

              {/* Non-Destructive Re-Pose in 3D Button */}
              {selectedElement.source3d && onRePoseIn3D && (
                <button
                  onClick={() => onRePoseIn3D(selectedElement.source3d)}
                  className="w-full flex items-center justify-center gap-1.5 rounded border-2 border-foreground bg-accent py-1.5 font-bold shadow-ink text-xs hover:bg-accent/80 transition-transform hover:-translate-y-0.5"
                >
                  <Camera className="h-3.5 w-3.5 text-primary" />
                  Re-Pose in 3D Studio
                </button>
              )}

              {/* Layer Ordering (Bring to Front, Send to Back) */}
              <div className="space-y-1 text-xs">
                <span className="font-semibold block">Layer Order</span>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={() => handleReorderElement(selectedElement.id, "top")}
                    className="rounded border border-border py-1 hover:border-foreground text-[10px] font-semibold"
                    title="Bring to absolute front"
                  >
                    Front
                  </button>
                  <button
                    onClick={() => handleReorderElement(selectedElement.id, "up")}
                    className="rounded border border-border py-1 hover:border-foreground text-[10px]"
                    title="Move up one layer"
                  >
                    Up +1
                  </button>
                  <button
                    onClick={() => handleReorderElement(selectedElement.id, "down")}
                    className="rounded border border-border py-1 hover:border-foreground text-[10px]"
                    title="Move down one layer"
                  >
                    Down -1
                  </button>
                  <button
                    onClick={() => handleReorderElement(selectedElement.id, "bottom")}
                    className="rounded border border-border py-1 hover:border-foreground text-[10px] font-semibold"
                    title="Send to back"
                  >
                    Back
                  </button>
                </div>
              </div>

              {/* Alignment & Flip */}
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold block">Position & Transforms</span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => handleCenterInPanel(selectedElement)}
                    className="rounded border border-border py-1 hover:border-foreground text-[10px] flex items-center justify-center gap-1"
                  >
                    <AlignCenter className="h-3 w-3" /> Center
                  </button>
                  <button
                    onClick={() =>
                      onUpdateLayout({
                        ...layout,
                        elements: layout.elements.map((el) =>
                          el.id === selectedElement.id ? { ...el, flipX: !el.flipX } : el
                        ),
                      })
                    }
                    className={`rounded border py-1 text-[10px] flex items-center justify-center gap-1 ${
                      selectedElement.flipX ? "bg-accent font-bold" : "border-border"
                    }`}
                  >
                    <FlipHorizontal className="h-3 w-3" /> Flip H
                  </button>
                  <button
                    onClick={() =>
                      onUpdateLayout({
                        ...layout,
                        elements: layout.elements.map((el) =>
                          el.id === selectedElement.id ? { ...el, flipY: !el.flipY } : el
                        ),
                      })
                    }
                    className={`rounded border py-1 text-[10px] flex items-center justify-center gap-1 ${
                      selectedElement.flipY ? "bg-accent font-bold" : "border-border"
                    }`}
                  >
                    <FlipVertical className="h-3 w-3" /> Flip V
                  </button>
                </div>
              </div>

              {/* Opacity Slider */}
              <div>
                <label className="block text-xs">
                  <span className="flex justify-between">
                    <span>Opacity</span>
                    <span className="font-mono">{Math.round((selectedElement.opacity ?? 1) * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={selectedElement.opacity ?? 1}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        elements: layout.elements.map((el) =>
                          el.id === selectedElement.id ? { ...el, opacity: +e.target.value } : el
                        ),
                      })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>
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
                      balloons: (layout.balloons ?? []).map((b) =>
                        b.id === selectedBalloon.id ? { ...b, text: e.target.value } : b
                      ),
                    })
                  }
                  className="w-full p-2 text-xs rounded-sm border border-input bg-background font-medium"
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
                      balloons: (layout.balloons ?? []).map((b) =>
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

              {/* Balloon Color Fill & Dark Demon Voice */}
              <div>
                <span className="block mb-1 text-xs font-semibold">Balloon Style</span>
                <div className="flex gap-1.5 text-xs">
                  <button
                    onClick={() =>
                      onUpdateLayout({
                        ...layout,
                        balloons: (layout.balloons ?? []).map((b) =>
                          b.id === selectedBalloon.id
                            ? { ...b, backgroundColor: "#ffffff", fontColor: "#000000", strokeColor: "#000000" }
                            : b
                        ),
                      })
                    }
                    className="flex-1 py-1 rounded border border-border bg-white text-black font-semibold text-[11px]"
                  >
                    Standard White
                  </button>
                  <button
                    onClick={() =>
                      onUpdateLayout({
                        ...layout,
                        balloons: (layout.balloons ?? []).map((b) =>
                          b.id === selectedBalloon.id
                            ? { ...b, backgroundColor: "#09090b", fontColor: "#ffffff", strokeColor: "#ffffff" }
                            : b
                        ),
                      })
                    }
                    className="flex-1 py-1 rounded border border-foreground bg-black text-white font-semibold text-[11px]"
                  >
                    Dark / Demon
                  </button>
                </div>
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
                    max={42}
                    value={selectedBalloon.fontSize}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        balloons: (layout.balloons ?? []).map((b) =>
                          b.id === selectedBalloon.id ? { ...b, fontSize: +e.target.value } : b
                        ),
                      })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>
                {(() => {
                  const setB = (patch: Partial<SpeechBalloon>) => onUpdateLayout({ ...layout, balloons: (layout.balloons ?? []).map((b) => (b.id === selectedBalloon.id ? { ...b, ...patch } : b)) });
                  return (
                    <div className="space-y-2" data-testid="balloon-lettering">
                      <label className="block">
                        <span className="block mb-1 font-semibold">Lettering font</span>
                        <select value={selectedBalloon.fontFamily ?? "comic-neue"} onChange={(e) => setB({ fontFamily: e.target.value })}
                          className="w-full rounded border border-border bg-background px-1.5 py-1" style={{ fontFamily: fontStack(selectedBalloon.fontFamily) }}>
                          {MANGA_FONTS.filter((f) => f.use !== "sfx").map((f) => (
                            <option key={f.id} value={f.id} style={{ fontFamily: fontStack(f.id) }}>{f.label}</option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setB({ fontWeight: selectedBalloon.fontWeight === "normal" ? "bold" : "normal" })}
                          className="rounded border border-border px-2 py-0.5 font-bold">{selectedBalloon.fontWeight === "normal" ? "Regular" : "Bold"}</button>
                        <label className="flex items-center gap-1">Text <input type="color" value={selectedBalloon.fontColor ?? "#000000"} onChange={(e) => setB({ fontColor: e.target.value })} className="h-6 w-7 rounded border border-border" /></label>
                        <label className="flex items-center gap-1">Fill <input type="color" value={selectedBalloon.backgroundColor ?? "#ffffff"} onChange={(e) => setB({ backgroundColor: e.target.value })} className="h-6 w-7 rounded border border-border" /></label>
                        <label className="flex items-center gap-1">Line <input type="color" value={selectedBalloon.borderColor ?? "#000000"} onChange={(e) => setB({ borderColor: e.target.value })} className="h-6 w-7 rounded border border-border" /></label>
                      </div>
                      <label className="block">
                        <span className="flex justify-between"><span>Outline</span><span className="font-mono">{selectedBalloon.borderWidth ?? 2.5}px</span></span>
                        <input type="range" min={0} max={8} step={0.5} value={selectedBalloon.borderWidth ?? 2.5} onChange={(e) => setB({ borderWidth: +e.target.value })} className="w-full accent-primary" />
                      </label>
                      <label className="block">
                        <span className="block mb-1 font-semibold">Shape</span>
                        <select value={selectedBalloon.shape} onChange={(e) => setB({ shape: e.target.value as BalloonShape })} className="w-full rounded border border-border bg-background px-1.5 py-1">
                          {["oval", "rounded", "burst", "double_burst", "scream", "cloud", "whisper", "wavy", "flash", "box", "electric", "heart", "icy"].map((sh) => (
                            <option key={sh} value={sh}>{sh.replace("_", " ")}</option>
                          ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="flex items-center gap-1.5"><input type="checkbox" checked={selectedBalloon.hasTail} onChange={(e) => setB({ hasTail: e.target.checked })} className="accent-primary" /> Tail</label>
                        <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!selectedBalloon.isVertical} onChange={(e) => setB({ isVertical: e.target.checked, writingMode: e.target.checked ? "vertical-rl" : "horizontal-tb" })} className="accent-primary" /> Vertical (tategaki)</label>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="block"><span className="flex justify-between"><span>Width</span><span className="font-mono">{Math.round(selectedBalloon.width)}</span></span>
                          <input type="range" min={60} max={500} value={selectedBalloon.width} onChange={(e) => setB({ width: +e.target.value })} className="w-full accent-primary" /></label>
                        <label className="block"><span className="flex justify-between"><span>Height</span><span className="font-mono">{Math.round(selectedBalloon.height)}</span></span>
                          <input type="range" min={40} max={400} value={selectedBalloon.height} onChange={(e) => setB({ height: +e.target.value })} className="w-full accent-primary" /></label>
                      </div>
                    </div>
                  );
                })()}
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
                      sfxStamps: (layout.sfxStamps ?? []).map((s) =>
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
                    max={140}
                    value={selectedSFX.fontSize}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        sfxStamps: (layout.sfxStamps ?? []).map((s) =>
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
                        sfxStamps: (layout.sfxStamps ?? []).map((s) =>
                          s.id === selectedSFX.id ? { ...s, rotation: +e.target.value } : s
                        ),
                      })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>

                <label className="block">
                  <span className="flex justify-between">
                    <span>Perspective Skew</span>
                    <span className="font-mono">{selectedSFX.skewX}°</span>
                  </span>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    value={selectedSFX.skewX}
                    onChange={(e) =>
                      onUpdateLayout({
                        ...layout,
                        sfxStamps: (layout.sfxStamps ?? []).map((s) =>
                          s.id === selectedSFX.id ? { ...s, skewX: +e.target.value } : s
                        ),
                      })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>
                {(() => {
                  const setS = (patch: Partial<SFXStamp>) => onUpdateLayout({ ...layout, sfxStamps: (layout.sfxStamps ?? []).map((x) => (x.id === selectedSFX.id ? { ...x, ...patch } : x)) });
                  return (
                    <div className="space-y-2" data-testid="sfx-style">
                      <label className="block">
                        <span className="block mb-1 font-semibold">SFX font</span>
                        <select value={selectedSFX.fontFamily ?? "dela-gothic"} onChange={(e) => setS({ fontFamily: e.target.value })}
                          className="w-full rounded border border-border bg-background px-1.5 py-1">
                          {MANGA_FONTS.filter((f) => f.use !== "dialogue").map((f) => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                          ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {SFX_STYLES.map((st) => (
                          <button key={st.id} onClick={() => setS(st.patch)} className="rounded border border-border px-1 py-0.5 text-[10px] font-semibold hover:border-foreground">{st.label}</button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1">Fill <input type="color" value={selectedSFX.fillColor?.startsWith("#") ? selectedSFX.fillColor : "#ffffff"} onChange={(e) => setS({ fillColor: e.target.value })} className="h-6 w-7 rounded border border-border" /></label>
                        <label className="flex items-center gap-1">Outline <input type="color" value={selectedSFX.strokeColor ?? "#000000"} onChange={(e) => setS({ strokeColor: e.target.value })} className="h-6 w-7 rounded border border-border" /></label>
                      </div>
                      <label className="block"><span className="flex justify-between"><span>Outline width</span><span className="font-mono">{selectedSFX.strokeWidth}px</span></span>
                        <input type="range" min={0} max={14} value={selectedSFX.strokeWidth} onChange={(e) => setS({ strokeWidth: +e.target.value })} className="w-full accent-primary" /></label>
                      <label className="block"><span className="flex justify-between"><span>Opacity</span><span className="font-mono">{Math.round((selectedSFX.opacity ?? 1) * 100)}%</span></span>
                        <input type="range" min={10} max={100} value={Math.round((selectedSFX.opacity ?? 1) * 100)} onChange={(e) => setS({ opacity: +e.target.value / 100 })} className="w-full accent-primary" /></label>
                    </div>
                  );
                })()}
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
                  Click any panel, character, balloon, or effect to configure properties, re-pose in 3D, or adjust layer depths.
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

/** Tiny page preview of a grid template. */
function TemplateThumb({ panels }: { panels: PanelPolygon[] }) {
  const W = 60, H = 86;
  const ordered = [...panels].sort((a, b) => Number(!!a.floating) - Number(!!b.floating));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-sm bg-white" aria-hidden="true">
      {ordered.map((p) => (
        <polygon
          key={p.id}
          points={insetPanelPoints(p.points, W, H, 4, 2, 3, { bleed: p.bleed, floating: p.floating }).map((q) => `${q.x},${q.y}`).join(" ")}
          fill={p.backgroundColor === "#ffffff" ? "#fff" : p.backgroundColor}
          stroke={p.borderStyle === "none" ? "#bbb" : "#111"}
          strokeDasharray={p.borderStyle === "none" || p.borderStyle === "dashed" ? "2,1.5" : undefined}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { FeedbackButton } from "@/components/feedback/FeedbackProvider";
import {
  PAGE_LAYER_ID,
  applyManualElementPatch,
  loadPanelOverlapPreference,
  panelBounds,
  panelPointsForTargetRect,
  savePanelOverlapPreference,
  transformPanelWithContents,
  type DrawnLine,
  type LineCapStyle,
  type LineStyleVariant,
  type PageLayerPlacement,
  type PageLayout,
  type PanelOverlapPreference,
  type PlacedElement,
  type PanelPolygon,
  PAGE_FORMATS,
  PRESET_LAYOUT_CATALOG,
  getPresetPanels,
  splitPanel,
  getPanelPixelBounds,
  swapPanelContents,
  syncPanelBoundElements,
} from "@/lib/manga-layout";
import {
  DEFAULT_TAIL_WIDTH,
  MAX_BALLOON_TAILS,
  type BalloonShape,
  type SpeechBalloon,
  type ComicMark,
  type SpeedLinesEffect,
  type SFXStamp,
  SFX_PRESETS,
  SFX_STYLES,
  addBalloonTail,
  balloonPatchWithTails,
  defaultCurveControlForTail,
  getBalloonTails,
  supportsBalloonTails,
} from "@/lib/manga-effects";
import { BALLOON_TAIL_BADGE_CLASSES } from "./SpeechBalloonRenderer";
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
  mergeCandidates,
  splitPanelGrid,
  pointInPolygon,
  insetPanelPoints,
  type MergeCandidate,
} from "@/lib/manga-grid";
import {
  loadCustomTemplates,
  saveCustomTemplates,
  addCustomTemplate,
  removeCustomTemplate,
  toGridTemplates,
  type SavedCustomTemplate,
} from "@/lib/custom-templates";
import { TONE_PRESETS, TONE_KINDS, TONE_FADES, toneDataUrl, type Screentone } from "@/lib/screentone";
import type { Point } from "@/lib/manga-layout";
import { PhotoFilterModal } from "./PhotoFilterModal";
import { ExportModal } from "./ExportModal";
import { WebtoonCanvas } from "./WebtoonCanvas";
import { MobileWebtoonPreview } from "./MobileWebtoonPreview";
import { MangaProjectsModal } from "./MangaProjectsModal";
import { GridTemplateImportModal } from "./GridTemplateImportModal";
import { PageManager } from "@/components/pages/PageManager";
import { ResponsiveDrawer } from "@/components/ui/ResponsiveDrawer";
import { useDeviceLayout } from "@/lib/use-device-layout";
import {
  getActiveChapter,
  getActiveProject,
  type MangaLibraryState,
} from "@/lib/manga-projects";
import {
  Scissors,
  SplitSquareVertical,
  SplitSquareHorizontal,
  Maximize2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Sparkles,
  Layers,
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
  Smartphone,
  ScrollText,
  BookOpen,
  FolderOpen,
  Move,
  PenTool,
  Plus,
  MoreHorizontal,
  PanelLeft,
  SlidersHorizontal,
  FileText,
  X,
  Upload,
} from "lucide-react";

export interface PanelStudioProps {
  layout: PageLayout;
  onUpdateLayout: (updated: PageLayout) => void;
  onOpenCreateCharacter?: () => void;
  onEdit2DCharacter?: (
    elementId: string,
    source2d: import("@/lib/character2d-types").Source2DMetadata,
  ) => void;
  onOpen3dStudio: () => void;
  onRePoseIn3D?: (source3d: NonNullable<PlacedElement["source3d"]>) => void;
  allPages?: PageLayout[];
  activePageIndex?: number;
  onSelectPage?: (index: number) => void;
  onAddPage?: () => void;
  onDuplicatePage?: (index: number) => void;
  onDeletePage?: (index: number) => void;
  onMovePage?: (fromIndex: number, toIndex: number) => void;
  onUpdatePageAt?: (index: number, updated: PageLayout) => void;
  onInsertPageAt?: (index: number, page: PageLayout) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  library?: MangaLibraryState;
  saveStatus?: "saved" | "saving";
  onSaveProjectNow?: () => void | Promise<void>;
  onSelectLibraryChapter?: (projectId: string, chapterId: string) => void | Promise<void>;
  onCreateProject?: (title: string) => void | Promise<void>;
  onAddChapterToProject?: (projectId: string, chapterTitle?: string) => void | Promise<void>;
  onRenameProject?: (projectId: string, title: string) => void;
  onRenameChapter?: (projectId: string, chapterId: string, title: string) => void;
  onDuplicateProject?: (projectId: string) => void | Promise<void>;
  onDuplicateChapter?: (projectId: string, chapterId: string) => void | Promise<void>;
  onDeleteProject?: (projectId: string) => void | Promise<void>;
  onDeleteChapter?: (projectId: string, chapterId: string) => void | Promise<void>;
  onExportProject?: (projectId: string) => void | Promise<void>;
  onImportProject?: (file: File) => void | Promise<void>;
}

type LeftTrayTab = "panels" | "backgrounds" | "characters" | "balloons";

export function PanelStudio({
  layout,
  onUpdateLayout,
  onOpenCreateCharacter,
  onEdit2DCharacter,
  onOpen3dStudio,
  onRePoseIn3D,
  allPages,
  activePageIndex = 0,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
  onUpdatePageAt,
  onInsertPageAt,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  library,
  saveStatus = "saved",
  onSaveProjectNow,
  onSelectLibraryChapter,
  onCreateProject,
  onAddChapterToProject,
  onRenameProject,
  onRenameChapter,
  onDuplicateProject,
  onDuplicateChapter,
  onDeleteProject,
  onDeleteChapter,
  onExportProject,
  onImportProject,
}: PanelStudioProps) {
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(
    layout.panels[0]?.id ?? null
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.65);
  const [viewMode, setViewMode] = useState<"page" | "webtoon">("page");
  const [showSeams, setShowSeams] = useState(true);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTrayTab>("panels");
  const [bgCategory, setBgCategory] = useState<"scenery" | "action" | "mood" | "screentone">("scenery");
  const [customSfxText, setCustomSfxText] = useState("ドンッ!!");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportInitialTab, setExportInitialTab] = useState<"image" | "pdf" | "webtoon">("image");
  const [tool, setTool] = useState<CanvasTool>("select");
  const [splitAngle, setSplitAngle] = useState(0);
  const [splitRatio, setSplitRatio] = useState(50);
  const [tplCat, setTplCat] = useState<TemplateCategory | "all">("all");
  const [tplCount, setTplCount] = useState<number | "all">("all");
  const [tplStyle, setTplStyle] = useState<"all" | "stagger" | "banner" | "wrap" | "diagonal" | "custom">("all");
  const [tplSearch, setTplSearch] = useState("");
  const [customTemplates, setCustomTemplates] = useState<SavedCustomTemplate[]>(() => loadCustomTemplates());
  const [savingTplOpen, setSavingTplOpen] = useState(false);
  const [customTplName, setCustomTplName] = useState("");
  const [gridImportOpen, setGridImportOpen] = useState(false);
  const [gridImportFile, setGridImportFile] = useState<File | null>(null);
  const gridTemplateInputRef = useRef<HTMLInputElement>(null);
  const [showOrder, setShowOrder] = useState<"rtl" | "ltr" | null>(null);
  const [showGuides, setShowGuides] = useState(false);
  const [panelOverlapPref, setPanelOverlapPref] = useState<PanelOverlapPreference>(() =>
    loadPanelOverlapPreference(),
  );
  const [lineColor, setLineColor] = useState<string>("#000000");
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [lineStyle, setLineStyle] = useState<LineStyleVariant>("solid");
  const [lineCap, setLineCap] = useState<LineCapStyle>("none");
  const [lineLayer, setLineLayer] = useState<"above" | "behind">("above");
  const [lineAngleSnap, setLineAngleSnap] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const device = useDeviceLayout();
  const [panelsLeftOpen, setPanelsLeftOpen] = useState(() => device.pinLeftByDefault);
  const [panelsRightOpen, setPanelsRightOpen] = useState(() => device.pinRightByDefault);
  const [mobilePagesOpen, setMobilePagesOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const pinchRef = useRef<{ dist: number; startZoom: number; midX: number; midY: number } | null>(null);

  const selectedPanel = layout.panels.find((p) => p.id === selectedPanelId);

  // Sync Straight-Line Pen color automatically with the active panel's border colour when editing a panel
  useEffect(() => {
    if (selectedPanel?.borderColor) {
      setLineColor(selectedPanel.borderColor);
    }
  }, [selectedPanel?.id, selectedPanel?.borderColor]);

  // Identify what is currently selected
  const selectedElement = layout.elements.find((el) => el.id === selectedItemId);
  const selectedBalloon = layout.balloons?.find((b) => b.id === selectedItemId);
  const selectedComicMark = layout.comicMarks?.find((m) => m.id === selectedItemId);
  const selectedSpeedLine = layout.speedLines?.find((l) => l.id === selectedItemId);
  const selectedSFX = layout.sfxStamps?.find((s) => s.id === selectedItemId);
  const selectedDrawnLine = layout.drawnLines?.find((l) => l.id === selectedItemId);

  // Dynamic Auto-Fit calculation
  const fitToScreen = useCallback(() => {
    if (!canvasContainerRef.current) return;
    const { clientWidth, clientHeight } = canvasContainerRef.current;
    const paddingX = device.isCompact ? 16 : 48;
    const paddingY = device.isCompact ? 16 : 48;
    const availW = Math.max(150, clientWidth - paddingX);
    const availH = Math.max(150, clientHeight - paddingY);
    const scale = Math.min(availW / layout.format.width, availH / layout.format.height);
    // Round to 2 decimal places, clamped comfortably
    setZoom(Math.max(0.2, Math.min(1.2, Math.round(scale * 100) / 100)));
  }, [layout.format.width, layout.format.height, device.isCompact]);

  // Sync drawer defaults when orientation or device tier changes, then refit canvas cleanly
  useEffect(() => {
    setPanelsLeftOpen(device.pinLeftByDefault);
    setPanelsRightOpen(device.pinRightByDefault);
    setMobilePagesOpen(false);
    setMobileMoreOpen(false);
    const id = requestAnimationFrame(() => fitToScreen());
    return () => cancelAnimationFrame(id);
  }, [device.tier, device.pinLeftByDefault, device.pinRightByDefault, fitToScreen]);

  const togglePanelsLeft = () => {
    setPanelsLeftOpen((open) => {
      const next = !open;
      if (next && !device.pinRightByDefault) setPanelsRightOpen(false);
      if (next) setMobilePagesOpen(false);
      return next;
    });
  };
  const togglePanelsRight = () => {
    setPanelsRightOpen((open) => {
      const next = !open;
      if (next && !device.pinLeftByDefault) setPanelsLeftOpen(false);
      if (next) setMobilePagesOpen(false);
      return next;
    });
  };
  const toggleMobilePages = () => {
    setMobilePagesOpen((open) => {
      const next = !open;
      if (next && !device.pinLeftByDefault) setPanelsLeftOpen(false);
      if (next && !device.pinRightByDefault) setPanelsRightOpen(false);
      return next;
    });
  };

  // Keep selectedPanelId synced when switching chapters/pages or deleting an active panel; allow explicit null deselection.
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const activeProject = useMemo(() => (library ? getActiveProject(library) : null), [library]);
  const activeChapter = useMemo(
    () => (activeProject ? getActiveChapter(activeProject) : null),
    [activeProject],
  );
  const activeChapterId = activeChapter?.id ?? null;

  const prevPageKeyRef = useRef(`${activeChapterId ?? ""}:${layout.id}`);
  useEffect(() => {
    const key = `${activeChapterId ?? ""}:${layout.id}`;
    if (prevPageKeyRef.current !== key) {
      prevPageKeyRef.current = key;
      setSelectedPanelId(layout.panels[0]?.id ?? null);
      setSelectedItemId(null);
      return;
    }
    if (selectedPanelId && !layout.panels.some((p) => p.id === selectedPanelId)) {
      setSelectedPanelId(layout.panels[0]?.id ?? null);
    }
  }, [activeChapterId, layout.id, layout.panels, selectedPanelId]);

  // Run auto-fit on initial mount and when layout dimensions change
  useEffect(() => {
    fitToScreen();
    const handleResize = () => fitToScreen();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fitToScreen]);

  // Canvas item keyboard shortcuts: Delete/Backspace, Arrow nudge (+Shift x10), Ctrl/Cmd+D duplicate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const canNudgePanel = !selectedItemId && tool === "move-panel" && Boolean(selectedPanel);
      if (!selectedItemId && !canNudgePanel) return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable)
      ) {
        return;
      }

      const nudgeDelta = (axis: "x" | "y", sign: number) => {
        const step = (e.shiftKey ? 10 : 1) * sign;
        if (canNudgePanel && selectedPanel) {
          const box = panelBounds(selectedPanel, layout.format);
          const forceFloat = panelOverlapPref === "float";
          const nextPts = panelPointsForTargetRect(
            selectedPanel,
            {
              x: box.minX + (axis === "x" ? step : 0),
              y: box.minY + (axis === "y" ? step : 0),
              width: box.width,
              height: box.height,
            },
            layout.format,
            forceFloat || Boolean(selectedPanel.floating),
          );
          onUpdateLayout(transformPanelWithContents(layout, selectedPanel.id, nextPts, { forceFloating: forceFloat }));
          return;
        }
        if (selectedElement) {
          onUpdateLayout({
            ...layout,
            elements: layout.elements.map((el) =>
              el.id === selectedElement.id ? applyManualElementPatch(el, { [axis]: el[axis] + step }) : el
            ),
          });
        } else if (selectedBalloon) {
          onUpdateLayout({
            ...layout,
            balloons: (layout.balloons ?? []).map((b) =>
              b.id === selectedBalloon.id ? { ...b, [axis]: b[axis] + step } : b
            ),
          });
        } else if (selectedComicMark) {
          onUpdateLayout({
            ...layout,
            comicMarks: (layout.comicMarks ?? []).map((m) =>
              m.id === selectedComicMark.id ? { ...m, [axis]: m[axis] + step } : m
            ),
          });
        } else if (selectedSpeedLine) {
          const field = axis === "x" ? "centerX" : "centerY";
          onUpdateLayout({
            ...layout,
            speedLines: (layout.speedLines ?? []).map((l) =>
              l.id === selectedSpeedLine.id ? { ...l, [field]: l[field] + step } : l
            ),
          });
        } else if (selectedSFX) {
          onUpdateLayout({
            ...layout,
            sfxStamps: (layout.sfxStamps ?? []).map((s) =>
              s.id === selectedSFX.id ? { ...s, [axis]: s[axis] + step } : s
            ),
          });
        } else if (selectedDrawnLine) {
          const f1 = axis === "x" ? "x1" : "y1";
          const f2 = axis === "x" ? "x2" : "y2";
          onUpdateLayout({
            ...layout,
            drawnLines: (layout.drawnLines ?? []).map((l) =>
              l.id === selectedDrawnLine.id ? { ...l, [f1]: l[f1] + step, [f2]: l[f2] + step } : l
            ),
          });
        }
      };

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedElement) {
          onUpdateLayout({ ...layout, elements: layout.elements.filter((el) => el.id !== selectedElement.id) });
        } else if (selectedBalloon) {
          onUpdateLayout({ ...layout, balloons: (layout.balloons ?? []).filter((b) => b.id !== selectedBalloon.id) });
        } else if (selectedComicMark) {
          onUpdateLayout({ ...layout, comicMarks: (layout.comicMarks ?? []).filter((m) => m.id !== selectedComicMark.id) });
        } else if (selectedSpeedLine) {
          onUpdateLayout({ ...layout, speedLines: (layout.speedLines ?? []).filter((l) => l.id !== selectedSpeedLine.id) });
        } else if (selectedSFX) {
          onUpdateLayout({ ...layout, sfxStamps: (layout.sfxStamps ?? []).filter((s) => s.id !== selectedSFX.id) });
        } else if (selectedDrawnLine) {
          onUpdateLayout({ ...layout, drawnLines: (layout.drawnLines ?? []).filter((l) => l.id !== selectedDrawnLine.id) });
        }
        setSelectedItemId(null);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudgeDelta("x", -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nudgeDelta("x", 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        nudgeDelta("y", -1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        nudgeDelta("y", 1);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const suffix = Date.now();
        if (selectedElement) {
          const copy: PlacedElement = {
            ...selectedElement,
            id: `${selectedElement.type}-${suffix}`,
            x: selectedElement.x + 20,
            y: selectedElement.y + 20,
          };
          onUpdateLayout({ ...layout, elements: [...layout.elements, copy] });
          setSelectedItemId(copy.id);
        } else if (selectedBalloon) {
          const copy: SpeechBalloon = {
            ...selectedBalloon,
            id: `balloon-${suffix}`,
            x: selectedBalloon.x + 20,
            y: selectedBalloon.y + 20,
            tails: selectedBalloon.tails?.map((t) => ({ ...t })),
            secondaryTail: selectedBalloon.secondaryTail
              ? { ...selectedBalloon.secondaryTail }
              : undefined,
          };
          onUpdateLayout({ ...layout, balloons: [...(layout.balloons ?? []), copy] });
          setSelectedItemId(copy.id);
        } else if (selectedComicMark) {
          const copy: ComicMark = {
            ...selectedComicMark,
            id: `mark-${suffix}`,
            x: selectedComicMark.x + 20,
            y: selectedComicMark.y + 20,
          };
          onUpdateLayout({ ...layout, comicMarks: [...(layout.comicMarks ?? []), copy] });
          setSelectedItemId(copy.id);
        } else if (selectedSpeedLine) {
          const copy: SpeedLinesEffect = {
            ...selectedSpeedLine,
            id: `speed-${suffix}`,
            centerX: selectedSpeedLine.centerX + 20,
            centerY: selectedSpeedLine.centerY + 20,
          };
          onUpdateLayout({ ...layout, speedLines: [...(layout.speedLines ?? []), copy] });
          setSelectedItemId(copy.id);
        } else if (selectedSFX) {
          const copy: SFXStamp = {
            ...selectedSFX,
            id: `sfx-${suffix}`,
            x: selectedSFX.x + 20,
            y: selectedSFX.y + 20,
          };
          onUpdateLayout({ ...layout, sfxStamps: [...(layout.sfxStamps ?? []), copy] });
          setSelectedItemId(copy.id);
        } else if (selectedDrawnLine) {
          const copy: DrawnLine = {
            ...selectedDrawnLine,
            id: `line-${suffix}`,
            x1: selectedDrawnLine.x1 + 20,
            y1: selectedDrawnLine.y1 + 20,
            x2: selectedDrawnLine.x2 + 20,
            y2: selectedDrawnLine.y2 + 20,
          };
          onUpdateLayout({ ...layout, drawnLines: [...(layout.drawnLines ?? []), copy] });
          setSelectedItemId(copy.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    layout,
    onUpdateLayout,
    panelOverlapPref,
    selectedBalloon,
    selectedComicMark,
    selectedDrawnLine,
    selectedElement,
    selectedItemId,
    selectedPanel,
    selectedSFX,
    selectedSpeedLine,
    tool,
  ]);

  // Hotkeys for Panel Canvas Tools & Esc Deselection: V Select, M Move/Size, D Dividers, R Draw Panel, K Knife, C Corners, L Line Pen
  useEffect(() => {
    const onToolKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Escape") {
        setSelectedItemId((cur) => {
          if (cur) return null;
          setSelectedPanelId(null);
          return null;
        });
        return;
      }
      const keyMap: Record<string, CanvasTool> = {
        v: "select",
        m: "move-panel",
        d: "dividers",
        r: "draw",
        k: "knife",
        c: "corners",
        l: "line",
      };
      const next = keyMap[e.key.toLowerCase()];
      if (next) setTool(next);
    };
    window.addEventListener("keydown", onToolKey);
    return () => window.removeEventListener("keydown", onToolKey);
  }, []);

  /** Re-home overlays whose panel vanished (cut / merge / new template) into the panel under their centre. */
  const rehomeAt = useCallback(
    (panels: PanelPolygon[], x: number, y: number, curId: string, targetFormat = layout.format): string => {
      if (panels.length === 0) return curId;
      if (panels.some((p) => p.id === curId)) return curId;
      const pw = Math.max(1, targetFormat.width - targetFormat.margin * 2);
      const ph = Math.max(1, targetFormat.height - targetFormat.margin * 2);
      const c = { x: (x - targetFormat.margin) / pw, y: (y - targetFormat.margin) / ph };
      const home = [...panels].reverse().find((p) => pointInPolygon(c, p.points)) ?? panels[0];
      return home.id;
    },
    [layout.format],
  );

  const rehome = (panels: PanelPolygon[], elements: PlacedElement[]) => {
    const valid = new Set(panels.map((p) => p.id));
    return elements.map((el) => {
      if (el.panelId === PAGE_LAYER_ID) {
        if (
          (el.pageLayer?.kind === "below-panel" || el.pageLayer?.kind === "above-panel") &&
          !valid.has(el.pageLayer.panelId)
        ) {
          return { ...el, pageLayer: { kind: "behind" as const } };
        }
        return el;
      }
      return { ...el, panelId: rehomeAt(panels, el.x + el.width / 2, el.y + el.height / 2, el.panelId) };
    });
  };

  const rehomeLayout = (base: PageLayout, panels: PanelPolygon[]): PageLayout =>
    syncPanelBoundElements({
      ...base,
      panels,
      elements: rehome(panels, base.elements),
      balloons: (base.balloons ?? []).map((b) => ({
        ...b,
        panelId: rehomeAt(panels, b.x + b.width / 2, b.y + b.height / 2, b.panelId, base.format),
      })),
      sfxStamps: (base.sfxStamps ?? []).map((s) => ({
        ...s,
        panelId: rehomeAt(panels, s.x, s.y, s.panelId, base.format),
      })),
      comicMarks: (base.comicMarks ?? []).map((m) => ({
        ...m,
        panelId: rehomeAt(panels, m.x, m.y, m.panelId, base.format),
      })),
      speedLines: (base.speedLines ?? []).map((l) => ({
        ...l,
        panelId: rehomeAt(panels, l.centerX, l.centerY, l.panelId, base.format),
      })),
      drawnLines: (base.drawnLines ?? []).map((d) =>
        d.panelId === PAGE_LAYER_ID
          ? d
          : {
              ...d,
              panelId: rehomeAt(panels, (d.x1 + d.x2) / 2, (d.y1 + d.y2) / 2, d.panelId, base.format),
            },
      ),
    });

  const commitPanels = (panels: PanelPolygon[], select?: string) => {
    onUpdateLayout(rehomeLayout(layout, panels));
    if (select) setSelectedPanelId(select);
    else if (!panels.some((p) => p.id === selectedPanelId)) setSelectedPanelId(panels[0]?.id ?? null);
  };

  const merges = useMemo(
    () => (selectedPanel ? mergeCandidates(selectedPanel, layout.panels) : []),
    [selectedPanel, layout.panels],
  );

  // Blank page / empty slate / custom draw / merge
  const handleBlankPage = (emptyCanvas = false) => {
    const msg = emptyCanvas
      ? "Clear the page to a 0-panel empty canvas? Panels and items will be removed."
      : "Reset to a 1-panel blank page frame? Existing panels and items will be removed.";
    if (!confirm(msg)) return;
    if (emptyCanvas) {
      onUpdateLayout({
        ...layout,
        panels: [],
        elements: [],
        balloons: [],
        sfxStamps: [],
        comicMarks: [],
        speedLines: [],
        drawnLines: [],
      });
      setSelectedPanelId(null);
      setTool("draw");
      return;
    }
    const blank: PanelPolygon = {
      id: `p${Date.now()}`,
      points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
      borderWidth: 3,
      borderColor: "#000000",
      borderStyle: "solid",
      backgroundColor: "#ffffff",
    };
    onUpdateLayout({
      ...layout,
      panels: [blank],
      elements: [],
      balloons: [],
      sfxStamps: [],
      comicMarks: [],
      speedLines: [],
      drawnLines: [],
    });
    setSelectedPanelId(blank.id);
  };

  const buildDrawnPanel = (
    existing: PanelPolygon[],
    r: { x0: number; y0: number; x1: number; y1: number },
  ): PanelPolygon => {
    // Auto-tile if it does not overlap existing base panels; otherwise place as floating inset.
    const overlaps = existing.some((p) => {
      if (p.floating) return false;
      const px0 = Math.min(...p.points.map((q) => q.x)), px1 = Math.max(...p.points.map((q) => q.x));
      const py0 = Math.min(...p.points.map((q) => q.y)), py1 = Math.max(...p.points.map((q) => q.y));
      const ix = Math.max(0, Math.min(r.x1, px1) - Math.max(r.x0, px0));
      const iy = Math.max(0, Math.min(r.y1, py1) - Math.max(r.y0, py0));
      return ix * iy > 0.002;
    });
    return {
      id: `p${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      points: [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }],
      borderWidth: 3,
      borderColor: "#000000",
      borderStyle: "solid",
      backgroundColor: "#ffffff",
      floating: overlaps,
    };
  };

  const handleDrawPanel = (r: { x0: number; y0: number; x1: number; y1: number }) => {
    const np = buildDrawnPanel(layout.panels, r);
    commitPanels([...layout.panels, np], np.id);
  };

  const handleMergeWith = (cand: MergeCandidate) => {
    if (!selectedPanel) return;
    const move = <T extends { panelId: string }>(xs?: T[]) =>
      (xs ?? []).map((x) => (x.panelId === cand.neighborId ? { ...x, panelId: selectedPanel.id } : x));
    onUpdateLayout(
      syncPanelBoundElements(
        {
          ...layout,
          panels: layout.panels
            .filter((p) => p.id !== cand.neighborId)
            .map((p) => (p.id === selectedPanel.id ? { ...p, points: cand.mergedPoints } : p)),
          elements: move(layout.elements),
          balloons: move(layout.balloons),
          sfxStamps: move(layout.sfxStamps),
          comicMarks: move(layout.comicMarks),
          speedLines: move(layout.speedLines),
          drawnLines: move(layout.drawnLines),
        },
        [selectedPanel.id],
      ),
    );
  };

  const handleMergePanel = () => {
    if (!selectedPanel) return;
    if (merges[0]) {
      handleMergeWith(merges[0]);
      return;
    }
    alert("No neighbouring panel lines up cleanly to merge into one rectangle.");
  };

  const handleGridSplit = (rows: number, cols: number) => {
    if (!selectedPanel) return;
    const parts = splitPanelGrid(selectedPanel, rows, cols);
    commitPanels(
      layout.panels.flatMap((p) => (p.id === selectedPanel.id ? parts : [p])),
      parts[0].id,
    );
  };

  const handleSaveCustomTemplate = () => {
    if (layout.panels.length === 0) return;
    const next = addCustomTemplate(customTemplates, customTplName, layout.panels);
    setCustomTemplates(next);
    saveCustomTemplates(next);
    setCustomTplName("");
    setSavingTplOpen(false);
    setTplSearch("");
    setTplCat("all");
    setTplCount("all");
    setTplStyle("custom");
  };

  // Template change
  const allTemplates = useMemo(
    () => [...toGridTemplates(customTemplates), ...GRID_TEMPLATES],
    [customTemplates],
  );
  const handleApplyTemplate = (templateId: string) => {
    const found = allTemplates.find((t) => t.id === templateId);
    const newPanels = found ? found.build() : buildTemplate(templateId) ?? getPresetPanels(templateId);
    commitPanels(newPanels, newPanels[0]?.id);
  };

  const handleApplyImportedGridLayout = (opts: {
    panels: PanelPolygon[];
    mode: "replace" | "new-page";
    saveAsTemplate: boolean;
    templateName: string;
  }) => {
    const freshPanels: PanelPolygon[] = opts.panels.map((p, idx) => ({
      ...p,
      id: `p${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      points: p.points.map((pt) => ({ ...pt })),
    }));

    if (opts.saveAsTemplate && freshPanels.length > 0) {
      const next = addCustomTemplate(customTemplates, opts.templateName || "Imported Layout", freshPanels);
      setCustomTemplates(next);
      saveCustomTemplates(next);
    }

    if (opts.mode === "new-page" && onInsertPageAt) {
      const insertAt = Math.min((allPages?.length ?? activePageIndex + 1), activePageIndex + 1);
      const newPage: PageLayout = {
        id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pageNumber: insertAt + 1,
        format: { ...layout.format },
        panels: freshPanels,
        elements: [],
        balloons: [],
        comicMarks: [],
        speedLines: [],
        sfxStamps: [],
      };
      onInsertPageAt(insertAt, newPage);
      setSelectedPanelId(freshPanels[0]?.id ?? null);
      setSelectedItemId(null);
    } else {
      commitPanels(freshPanels, freshPanels[0]?.id);
    }

    setGridImportOpen(false);
    setGridImportFile(null);
    if (!device.pinLeftByDefault) {
      setPanelsLeftOpen(false);
    }
  };

  // Format change
  const handleFormatChange = (formatId: string) => {
    const fmt = PAGE_FORMATS.find((f) => f.id === formatId) || PAGE_FORMATS[0];
    onUpdateLayout(
      syncPanelBoundElements({
        ...layout,
        format: fmt,
      }),
    );
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
    onUpdateLayout(syncPanelBoundElements({ ...layout, panels: moveSharedVertex(layout.panels, from, to) }));
  };

  const updatePanel = (id: string, patch: Partial<PanelPolygon>) =>
    onUpdateLayout(
      syncPanelBoundElements(
        {
          ...layout,
          panels: layout.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          drawnLines:
            patch.borderColor !== undefined
              ? (layout.drawnLines ?? []).map((l) =>
                  l.panelId === id && l.matchPanelBorder ? { ...l, color: patch.borderColor! } : l,
                )
              : layout.drawnLines,
        },
        [id],
      ),
    );

  const handleTransformPanelRect = (
    panelId: string,
    targetRect: { x: number; y: number; width: number; height: number },
  ) => {
    const targetPanel = layout.panels.find((p) => p.id === panelId);
    if (!targetPanel) return;
    const forceFloat = panelOverlapPref === "float";
    const nextPts = panelPointsForTargetRect(
      targetPanel,
      targetRect,
      layout.format,
      forceFloat || Boolean(targetPanel.floating),
    );
    onUpdateLayout(
      transformPanelWithContents(layout, panelId, nextPts, { forceFloating: forceFloat }),
    );
  };

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
    const nextPts = selectedPanel.points.map((p) => ({
      x: cx + (p.x - cx) * scale + dx,
      y: cy + (p.y - cy) * scale + dy,
    }));
    onUpdateLayout(
      transformPanelWithContents(layout, selectedPanel.id, nextPts, {
        forceFloating: panelOverlapPref === "float",
      }),
    );
  };

  // Delete selected panel & its child items
  const handleDeletePanel = () => {
    if (!selectedPanel || layout.panels.length <= 1) return;
    const pid = selectedPanel.id;
    const remaining = layout.panels.filter((p) => p.id !== pid);
    onUpdateLayout({
      ...layout,
      panels: remaining,
      elements: layout.elements.filter((el) => el.panelId !== pid),
      balloons: (layout.balloons ?? []).filter((b) => b.panelId !== pid),
      comicMarks: (layout.comicMarks ?? []).filter((m) => m.panelId !== pid),
      speedLines: (layout.speedLines ?? []).filter((l) => l.panelId !== pid),
      sfxStamps: (layout.sfxStamps ?? []).filter((s) => s.panelId !== pid),
      drawnLines: (layout.drawnLines ?? []).filter((d) => d.panelId !== pid),
    });
    setSelectedPanelId(remaining[0].id);
    setSelectedItemId(null);
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

    const isNarr = shape === "narration";
    const initWidth = Math.min(bounds.width * (isNarr ? 0.72 : 0.55), isNarr ? 260 : 200);
    const initHeight = Math.min(bounds.height * (isNarr ? 0.42 : 0.4), isNarr ? 140 : 120);
    const initTailX = -initWidth * 0.2;
    const initTailY = initHeight * 0.85;
    const canHaveTail = supportsBalloonTails(shape);
    const newBalloon: SpeechBalloon = {
      id: `balloon-${Date.now()}`,
      panelId: selectedPanel.id,
      shape,
      text: shape === "burst" || shape === "double_burst" ? "N-NANI?!" : shape === "cloud" ? "..." : isNarr ? "Forty-two plates stacked. Three minutes until the shuttle." : "Speech...",
      x: bounds.minX + bounds.width * (isNarr ? 0.08 : 0.25),
      y: bounds.minY + bounds.height * (isNarr ? 0.45 : 0.2),
      width: initWidth,
      height: initHeight,
      tail: {
        x: bounds.minX + bounds.width * 0.35,
        y: bounds.minY + bounds.height * 0.55,
      },
      tailX: initTailX,
      tailY: initTailY,
      hasTail: canHaveTail,
      tails: canHaveTail
        ? [{ id: "tail-0", x: initTailX, y: initTailY, curved: false, width: DEFAULT_TAIL_WIDTH }]
        : [],
      fontSize: isNarr ? 14 : 16,
      fontFamily: isNarr ? "sawarabi-mincho" : "comic-neue",
      fontWeight: shape === "burst" || shape === "double_burst" ? "bold" : isNarr ? "normal" : "normal",
      textAlign: isNarr ? "left" : "center",
      doubleBorder: isNarr,
      shadow: isNarr,
      borderWidth: isNarr ? 2 : 2.5,
      writingMode: "horizontal-tb",
      backgroundColor: isNarr ? "#faf7f2" : "#ffffff",
      strokeColor: "#000000",
      strokeWidth: isNarr ? 2 : 2.5,
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

  /** Reads an uploaded image file cleanly to a persistent data URL plus natural pixel dimensions. */
  const readImageFileWithSize = (file: File): Promise<{ dataUrl: string; width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        const img = new Image();
        img.onload = () => resolve({ dataUrl, width: img.naturalWidth || 400, height: img.naturalHeight || 400 });
        img.onerror = () => resolve({ dataUrl, width: 400, height: 400 });
        img.src = dataUrl;
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  // Upload Background Image: auto-fills selected panel & scales with it, OR places freely on whole page at natural size
  const handleUploadBackground = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const { dataUrl, width: natW, height: natH } = await readImageFileWithSize(file);
    if (selectedPanel) {
      const b = panelBounds(selectedPanel, layout.format);
      const newBg: PlacedElement = {
        id: `bg-${Date.now()}`,
        panelId: selectedPanel.id,
        type: "background",
        fitMode: "fill-panel",
        imageUrl: dataUrl,
        x: Math.round(b.minX),
        y: Math.round(b.minY),
        width: Math.max(1, Math.round(b.width)),
        height: Math.max(1, Math.round(b.height)),
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: 1,
        breakout: false,
      };
      onUpdateLayout({
        ...layout,
        elements: [
          newBg,
          ...layout.elements.filter((el) => !(el.panelId === selectedPanel.id && el.type === "background")),
        ],
      });
      setSelectedItemId(newBg.id);
      return;
    }

    const freeBg: PlacedElement = {
      id: `bg-${Date.now()}`,
      panelId: PAGE_LAYER_ID,
      type: "background",
      fitMode: "free",
      pageLayer: { kind: "behind" },
      imageUrl: dataUrl,
      x: Math.round((layout.format.width - natW) / 2),
      y: Math.round((layout.format.height - natH) / 2),
      width: natW,
      height: natH,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 1,
      breakout: false,
    };
    onUpdateLayout({ ...layout, elements: [freeBg, ...layout.elements] });
    setSelectedItemId(freeBg.id);
  };

  // Image import onto selected panel OR whole page at natural image size
  const handleImportImage = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const { dataUrl, width: natW, height: natH } = await readImageFileWithSize(file);
    if (selectedPanel) {
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
        fitMode: "free",
        imageUrl: dataUrl,
        x: Math.round(bounds.minX + (bounds.width - natW) / 2),
        y: Math.round(bounds.minY + (bounds.height - natH) / 2),
        width: natW,
        height: natH,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: layout.elements.length + 1,
        breakout: false,
      };
      onUpdateLayout({ ...layout, elements: [...layout.elements, newEl] });
      setSelectedItemId(newEl.id);
      return;
    }

    const freeEl: PlacedElement = {
      id: `el-${Date.now()}`,
      panelId: PAGE_LAYER_ID,
      type: "character",
      fitMode: "free",
      pageLayer: { kind: "above" },
      imageUrl: dataUrl,
      x: Math.round((layout.format.width - natW) / 2),
      y: Math.round((layout.format.height - natH) / 2),
      width: natW,
      height: natH,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: layout.elements.length + 10,
      breakout: false,
    };
    onUpdateLayout({ ...layout, elements: [...layout.elements, freeEl] });
    setSelectedItemId(freeEl.id);
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

    const updatedElements = [...layout.elements];
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

  // Center & Frame Element in Panel
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
          ? applyManualElementPatch(e, {
              x: bounds.minX + (bounds.width - e.width) / 2,
              y: bounds.minY + (bounds.height - e.height) / 2,
            })
          : e
      ),
    });
  };

  /** Fits or fills an image element cleanly inside its parent panel bounds. */
  const handleFrameInPanel = (el: PlacedElement, mode: "fit" | "fill") => {
    const panel = layout.panels.find((p) => p.id === el.panelId);
    if (!panel) return;
    const bounds = getPanelPixelBounds(
      panel,
      layout.format.width,
      layout.format.height,
      layout.format.margin,
      layout.format.gutter,
    );
    const aspect = Math.max(0.1, el.width / Math.max(1, el.height));
    const bw = Math.max(20, bounds.width);
    const bh = Math.max(20, bounds.height);
    let w = bw;
    let h = w / aspect;
    if (mode === "fit" ? h > bh : h < bh) {
      h = bh;
      w = h * aspect;
    }
    onUpdateLayout({
      ...layout,
      elements: layout.elements.map((item) =>
        item.id === el.id
          ? applyManualElementPatch(item, {
              width: Math.round(w),
              height: Math.round(h),
              x: Math.round(bounds.minX + (bw - w) / 2),
              y: Math.round(bounds.minY + (bh - h) / 2),
            })
          : item,
      ),
    });
  };

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground select-none overflow-hidden">
      {/* Top Bar */}
      <header className="relative flex flex-wrap items-center gap-1.5 sm:gap-2.5 border-b-2 border-foreground px-2 sm:px-4 py-1.5 sm:py-2 bg-card safe-pt shrink-0">
        <h1 className="font-display text-base sm:text-lg tracking-wide shrink-0">
          MANGAKA<span className="text-primary">DESK</span>
        </h1>

        <nav aria-label="Workspace views" className="flex items-center gap-1 text-xs sm:text-sm overflow-x-auto max-w-full">
          <button
            type="button"
            aria-pressed={true}
            className="whitespace-nowrap rounded-sm bg-foreground text-background px-2 sm:px-2.5 py-1 font-semibold transition-colors"
          >
            <span className="hidden sm:inline">Manga Panels</span>
            <span className="sm:hidden">Panels</span>
            {layout.elements.length > 0 && ` (${layout.elements.length})`}
          </button>
          {onOpenCreateCharacter && (
            <button
              type="button"
              onClick={onOpenCreateCharacter}
              aria-pressed={false}
              className="whitespace-nowrap rounded-sm px-2 sm:px-2.5 py-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="hidden sm:inline">Create Character</span>
              <span className="sm:hidden">Character</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpen3dStudio}
            aria-pressed={false}
            className="whitespace-nowrap rounded-sm px-2 sm:px-2.5 py-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="hidden sm:inline">3D Pose Studio</span>
            <span className="sm:hidden">3D Pose</span>
          </button>
        </nav>

        {/* Manga Series & Chapter Library Switcher (Manga Panels only) */}
        {library && activeProject && activeChapter && (
          <div className="flex items-center gap-1 rounded-sm border border-border bg-muted/40 px-1 py-0.5 text-xs max-w-full">
            <button
              type="button"
              data-testid="projects-library-btn"
              onClick={() => setProjectsModalOpen(true)}
              title="Open Saved Manga Series & Chapters Library"
              className="flex items-center gap-1 rounded-xs border border-foreground bg-card px-1.5 sm:px-2 py-0.5 font-bold hover:bg-accent transition-colors max-w-[105px] sm:max-w-[165px]"
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{activeProject.title}</span>
              <span
                title={saveStatus === "saving" ? "Saving..." : "Saved to browser storage"}
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  saveStatus === "saving" ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                }`}
              />
            </button>
            <select
              aria-label="Active chapter"
              data-testid="chapter-switcher"
              value={activeChapter.id}
              onChange={(e) => void onSelectLibraryChapter?.(activeProject.id, e.target.value)}
              className="max-w-[95px] sm:max-w-[130px] rounded-xs border border-input bg-background px-1 sm:px-1.5 py-0.5 text-[11px] font-semibold"
            >
              {activeProject.chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title} ({ch.pages.length}p)
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="quick-add-chapter-btn"
              onClick={() => void onAddChapterToProject?.(activeProject.id)}
              title={`Add new chapter to "${activeProject.title}"`}
              className="flex items-center gap-0.5 rounded-xs border border-primary/70 bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
            >
              <Plus className="h-3 w-3" />
              <span>Ch</span>
            </button>
          </div>
        )}

        {/* Format Selector (hidden on ultra-short phone landscape; always reachable inside More menu on phones/tablets) */}
        <div className="hidden sm:flex [@media(max-height:480px)]:hidden items-center gap-1.5 text-xs shrink-0">
          <span className="font-semibold text-muted-foreground hidden lg:inline">Paper:</span>
          <select
            aria-label="Paper format"
            value={layout.format.id}
            onChange={(e) => handleFormatChange(e.target.value)}
            className="max-w-[140px] lg:max-w-none rounded-sm border border-input bg-background px-1.5 py-1 text-xs font-medium"
          >
            {PAGE_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.width}×{f.height})
              </option>
            ))}
          </select>
        </div>

        {/* Print Page vs Infinite Webtoon Scroll Switcher + 9:16 Reader */}
        <div className="flex items-center rounded-sm border border-foreground bg-muted/60 p-0.5 text-[11px] font-semibold shrink-0">
          <button
            data-testid="mode-page"
            aria-label="Print Page"
            onClick={() => setViewMode("page")}
            className={`flex items-center gap-1 rounded-xs px-1.5 sm:px-2 py-0.5 transition-colors ${
              viewMode === "page"
                ? "bg-foreground text-background font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Print Page</span>
          </button>
          <button
            data-testid="mode-webtoon"
            aria-label="Webtoon Scroll"
            onClick={() => setViewMode("webtoon")}
            className={`flex items-center gap-1 rounded-xs px-1.5 sm:px-2 py-0.5 transition-colors ${
              viewMode === "webtoon"
                ? "bg-foreground text-background font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ScrollText className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Webtoon Scroll</span>
          </button>
        </div>

        <button
          data-testid="mobile-preview-toggle"
          onClick={() => setMobilePreviewOpen((o) => !o)}
          title="Live 9:16 Mobile Webtoon Reading Preview"
          className={`hidden md:flex items-center gap-1 rounded-sm border px-2 py-1 text-xs font-semibold transition-colors shrink-0 ${
            mobilePreviewOpen
              ? "border-primary bg-primary text-primary-foreground shadow-ink"
              : "border-border hover:border-foreground"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Mobile 9:16</span>
        </button>

        {/* History Undo / Redo */}
        {(onUndo || onRedo) && (
          <div className="flex items-center gap-1 text-xs shrink-0">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="rounded-sm border border-border p-1 hover:border-foreground disabled:opacity-35"
            >
              <Undo2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
              className="rounded-sm border border-border p-1 hover:border-foreground disabled:opacity-35"
            >
              <Redo2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        )}

        {/* Viewport Zoom & Fit + Actions */}
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5 text-xs shrink-0">
          <button
            onClick={fitToScreen}
            title="Auto-Fit Page to Screen (no cutoffs)"
            aria-label="Fit Screen"
            className="hidden sm:flex [@media(max-height:480px)]:hidden rounded-sm border-2 border-foreground bg-accent px-2 py-1 font-semibold text-xs shadow-ink hover:bg-accent/80 items-center gap-1"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Fit Screen</span>
          </button>
          <button
            onClick={() => setZoom(1.0)}
            title="100% Actual Size"
            className={`hidden md:inline-block [@media(max-height:480px)]:hidden rounded-sm border px-2 py-1 text-xs font-semibold ${
              zoom === 1.0 ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
            }`}
          >
            100%
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}
            aria-label="Zoom out"
            className="hidden sm:inline-block [@media(max-height:480px)]:hidden rounded-sm border border-border p-1 hover:border-foreground"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="hidden sm:inline-block [@media(max-height:480px)]:hidden w-10 text-center tabular-nums font-mono font-semibold">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}
            aria-label="Zoom in"
            className="hidden sm:inline-block [@media(max-height:480px)]:hidden rounded-sm border border-border p-1 hover:border-foreground"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Desktop Photo Filter & + Sprite */}
          <button
            onClick={() => setFilterModalOpen(true)}
            className="hidden lg:flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-accent px-2.5 py-1 font-semibold text-xs shadow-ink hover:-translate-y-0.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Photo Filter
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="hidden lg:inline rounded-sm border border-border px-2.5 py-1 text-xs hover:border-foreground font-medium"
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

          {/* Compact Overflow Menu (keeps Photo Filter, + Sprite, Mobile 9:16, Paper & Fit accessible on Phone & Tablet) */}
          <div className="relative lg:hidden">
            <button
              type="button"
              data-testid="panels-more-btn"
              aria-label="More panel tools"
              aria-expanded={mobileMoreOpen}
              onClick={() => setMobileMoreOpen((v) => !v)}
              className={`rounded-sm border px-2 py-1 text-xs font-semibold flex items-center gap-1 ${
                mobileMoreOpen ? "border-foreground bg-foreground text-background" : "border-border bg-background"
              }`}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">More</span>
            </button>
            {mobileMoreOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMobileMoreOpen(false)} aria-hidden="true" />
                <div
                  data-testid="panels-more-menu"
                  className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded border-2 border-foreground bg-card p-2 shadow-2xl space-y-1.5 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      setFilterModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 rounded border border-border px-2.5 py-1.5 font-semibold hover:bg-accent text-left"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Photo Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 rounded border border-border px-2.5 py-1.5 font-semibold hover:bg-accent text-left"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-primary" /> + Upload Sprite
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      setMobilePreviewOpen((o) => !o);
                    }}
                    className="w-full flex items-center gap-2 rounded border border-border px-2.5 py-1.5 font-semibold hover:bg-accent text-left"
                  >
                    <Smartphone className="h-3.5 w-3.5 text-primary" /> Mobile 9:16 Reader
                  </button>
                  <div className="flex items-center gap-1 pt-1 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        fitToScreen();
                        setMobileMoreOpen(false);
                      }}
                      className="flex-1 rounded border border-border px-2 py-1 font-semibold hover:bg-accent"
                    >
                      Fit Screen
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}
                      className="rounded border border-border px-2 py-1 font-bold"
                    >
                      −
                    </button>
                    <span className="font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}
                      className="rounded border border-border px-2 py-1 font-bold"
                    >
                      +
                    </button>
                  </div>
                  <div className="sm:hidden pt-1 border-t border-border">
                    <span className="block text-[10px] font-semibold text-muted-foreground mb-1">Paper Format</span>
                    <select
                      aria-label="Paper format mobile"
                      value={layout.format.id}
                      onChange={(e) => handleFormatChange(e.target.value)}
                      className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                    >
                      {PAGE_FORMATS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.width}×{f.height})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Export Button */}
          <button
            onClick={() => {
              setExportInitialTab(viewMode === "webtoon" ? "webtoon" : "image");
              setExportModalOpen(true);
            }}
            aria-label="Export Chapter"
            className="flex items-center gap-1 rounded-sm border-2 border-foreground bg-primary px-2 sm:px-3 py-1 font-bold text-primary-foreground shadow-ink hover:-translate-y-0.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export Chapter</span>
            <span className="sm:hidden">Export</span>
          </button>
          <FeedbackButton compact area="Manga Panels" />
          <AccountMenu compact />
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Toolbar: 4 Creative Trays (Pinned on Desktop / Tablet Landscape, Drawer/Sheet on Portrait & Phone) */}
        <ResponsiveDrawer
          mode={
            device.pinLeftByDefault
              ? "pinned-left"
              : device.useBottomSheet
              ? "sheet-bottom"
              : "drawer-left"
          }
          isOpen={panelsLeftOpen}
          onClose={() => setPanelsLeftOpen(false)}
          title="Panel Tools, Backs, Chars & SFX"
          pinnedClassName={device.tier === "tablet-landscape" ? "w-64" : "w-76"}
          testId="panels-left-drawer"
        >
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
                    { id: "select", label: "Select (V)" },
                    { id: "move-panel", label: "✥ Move/Size (M)" },
                    { id: "dividers", label: "⇕ Dividers (D)" },
                    { id: "draw", label: "▭ Draw (R)" },
                    { id: "knife", label: "✂ Knife (K)" },
                    { id: "corners", label: "◇ Corners (C)" },
                    { id: "line", label: "╱ Line Pen (L)" },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      aria-pressed={tool === t.id}
                      onClick={() => {
                        setTool(t.id);
                        if (!device.pinLeftByDefault && t.id !== "select") {
                          setPanelsLeftOpen(false);
                        }
                      }}
                      className={`rounded-sm border border-border py-1.5 text-[10px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40 ${tool === t.id ? "bg-foreground text-background border-foreground" : ""}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                  {tool === "move-panel"
                    ? "Drag inside the selected panel to move it, or drag its 8 handles to resize — everything inside moves & scales with it."
                    : tool === "line"
                    ? "Click start & end (or drag) to draw a straight line. Matches panel border colour when selected, or draws anywhere if none selected. Shift snaps angles."
                    : tool === "dividers"
                    ? "Grab any shared gutter line to slide panels smoothly (hold Alt to skip snap)."
                    : tool === "draw"
                    ? "Drag on the canvas to draw a custom panel or floating inset frame (Alt skips snap)."
                    : tool === "knife"
                    ? "Drag a line across the page to slice every panel it crosses. Hold Shift to snap the angle."
                    : tool === "corners"
                    ? "Drag the dots on the selected panel. Shared corners move neighbouring panels too."
                    : "Click a panel to select it, or hover directly over any gutter line to drag it."}
                </p>

                {/* Straight-Line Pen Options (shown whenever Line Pen is active) */}
                {tool === "line" && (
                  <div
                    data-testid="line-pen-options"
                    className="mt-2 rounded border-2 border-primary/70 bg-primary/5 p-2 space-y-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-1 font-bold text-primary">
                      <span className="flex items-center gap-1">
                        <PenTool className="h-3 w-3" /> Straight-Line Pen
                      </span>
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {selectedPanel
                          ? `Panel #${layout.panels.findIndex((p) => p.id === selectedPanel.id) + 1}`
                          : "Whole Page"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {selectedPanel ? "Auto-matches panel border:" : "Free page line colour:"}
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          aria-label="Straight line colour"
                          value={lineColor}
                          onChange={(e) => setLineColor(e.target.value)}
                          className="h-6 w-7 cursor-pointer rounded border border-border"
                        />
                        {selectedPanel && lineColor.toLowerCase() !== selectedPanel.borderColor.toLowerCase() && (
                          <button
                            type="button"
                            onClick={() => setLineColor(selectedPanel.borderColor)}
                            className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] hover:border-foreground"
                          >
                            Match
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedPanel && (
                      <button
                        type="button"
                        onClick={() => setSelectedPanelId(null)}
                        className="w-full rounded border border-border bg-background px-2 py-0.5 text-[10px] font-semibold hover:border-foreground"
                      >
                        Deselect Panel to Draw Anywhere
                      </button>
                    )}

                    <div>
                      <span className="block mb-1 font-semibold text-[10px]">Line Style</span>
                      <div className="grid grid-cols-4 gap-1">
                        {(["solid", "dashed", "dotted", "double"] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setLineStyle(st)}
                            className={`rounded border py-0.5 text-[10px] capitalize font-semibold ${
                              lineStyle === st
                                ? "bg-foreground text-background border-foreground"
                                : "border-border bg-background hover:border-foreground"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block mb-1 font-semibold text-[10px]">Line Ends</span>
                      <div className="grid grid-cols-4 gap-1">
                        {([
                          { id: "none", label: "None" },
                          { id: "arrow", label: "Arrow →" },
                          { id: "both", label: "Both ↔" },
                          { id: "tapered", label: "Taper" },
                        ] as const).map((cp) => (
                          <button
                            key={cp.id}
                            type="button"
                            onClick={() => setLineCap(cp.id)}
                            className={`rounded border py-0.5 text-[10px] font-semibold ${
                              lineCap === cp.id
                                ? "bg-foreground text-background border-foreground"
                                : "border-border bg-background hover:border-foreground"
                            }`}
                          >
                            {cp.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block">
                      <span className="flex justify-between text-[10px]">
                        <span>Thickness</span>
                        <span className="font-mono">{lineWidth}px</span>
                      </span>
                      <input
                        type="range"
                        aria-label="Straight line thickness"
                        min={1}
                        max={18}
                        step={0.5}
                        value={lineWidth}
                        onChange={(e) => setLineWidth(+e.target.value)}
                        className="w-full accent-primary"
                      />
                    </label>

                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={lineAngleSnap}
                          onChange={(e) => setLineAngleSnap(e.target.checked)}
                          className="accent-primary"
                        />
                        Snap 0°/45°/90°
                      </label>
                      <select
                        aria-label="Straight line layer"
                        value={lineLayer}
                        onChange={(e) => setLineLayer(e.target.value as "above" | "behind")}
                        className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
                      >
                        <option value="above">Above Panels</option>
                        <option value="behind">Behind Panels</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick splits & Merge & Blank */}
              <div className="border-t border-border pt-3 space-y-2">
                <h3 className="font-display text-xs">Split, Carve &amp; Merge</h3>
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
                <div className="grid grid-cols-3 gap-1">
                  <button disabled={!selectedPanel} onClick={() => handleGridSplit(2, 2)} className="rounded-sm border border-border py-1 text-[10px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40">2×2 Grid</button>
                  <button disabled={!selectedPanel} onClick={() => handleGridSplit(3, 1)} className="rounded-sm border border-border py-1 text-[10px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40">3 Rows</button>
                  <button disabled={!selectedPanel} onClick={() => handleGridSplit(1, 3)} className="rounded-sm border border-border py-1 text-[10px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40">3 Cols</button>
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
                  <button disabled={!selectedPanel} onClick={handleMergePanel} className="rounded-sm border border-border py-1.5 text-[11px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40" title="Join the selected panel with the neighbour it lines up with">⊞ Merge panel</button>
                  <button disabled={!selectedPanel || layout.panels.length <= 1} onClick={handleDeletePanel} className="rounded-sm border border-border py-1.5 text-[11px] font-semibold hover:border-destructive hover:text-destructive disabled:opacity-40">🗑 Delete panel</button>
                </div>
                {merges.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 rounded border border-border bg-muted/40 p-1" data-testid="merge-directions">
                    <span className="text-[10px] font-semibold text-muted-foreground mr-0.5">Merge:</span>
                    {merges.map((cand) => {
                      const arrow = cand.direction === "up" ? "↑ Up" : cand.direction === "down" ? "↓ Down" : cand.direction === "left" ? "← Left" : "→ Right";
                      return (
                        <button
                          key={cand.neighborId}
                          onClick={() => handleMergeWith(cand)}
                          className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold hover:border-foreground hover:bg-accent"
                        >
                          {arrow}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1">
                  <button onClick={() => handleBlankPage(false)} className="rounded-sm border border-dashed border-border py-1.5 text-[10px] font-semibold hover:border-foreground hover:bg-accent">□ Blank 1-Panel</button>
                  <button onClick={() => handleBlankPage(true)} className="rounded-sm border border-dashed border-border py-1.5 text-[10px] font-semibold hover:border-foreground hover:bg-accent">▢ Empty Canvas</button>
                </div>
              </div>

              {/* Layout Template Gallery */}
              <div className="border-t border-border pt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <h2 className="font-display text-sm flex items-center gap-1.5">
                    <Compass className="h-4 w-4 text-primary" /> Grid Templates
                  </h2>
                  <button
                    type="button"
                    disabled={layout.panels.length === 0}
                    onClick={() => setSavingTplOpen((v) => !v)}
                    className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold hover:border-foreground disabled:opacity-40"
                    title="Save current page layout as a reusable template"
                  >
                    + Save
                  </button>
                  <span className="text-[10px] font-normal text-muted-foreground">{allTemplates.length}</span>
                </div>
                <button
                  type="button"
                  data-testid="upload-grid-template-btn"
                  onClick={() => gridTemplateInputRef.current?.click()}
                  className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-sm border-2 border-dashed border-primary/70 bg-primary/10 px-2 py-1.5 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Grid Layout Image</span>
                </button>
                <input
                  ref={gridTemplateInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (!picked) return;
                    setGridImportFile(picked);
                    setGridImportOpen(true);
                  }}
                />
                {savingTplOpen && (
                  <div className="mb-2 flex gap-1 rounded border border-border bg-muted/40 p-1.5">
                    <input
                      value={customTplName}
                      onChange={(e) => setCustomTplName(e.target.value)}
                      placeholder="Template name..."
                      aria-label="Custom template name"
                      className="flex-1 rounded border border-input bg-background px-1.5 py-0.5 text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomTemplate}
                      className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"
                    >
                      Save
                    </button>
                  </div>
                )}
                <input
                  type="search"
                  value={tplSearch}
                  onChange={(e) => setTplSearch(e.target.value)}
                  placeholder="Search layouts (e.g. Stagger, Hero, Rhythm)..."
                  aria-label="Search grid templates"
                  className="mb-2 w-full rounded border border-input bg-background px-2 py-1 text-[11px]"
                />
                <div className="flex flex-wrap gap-1 mb-1.5">
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
                <div className="flex flex-wrap items-center gap-1 mb-1.5" role="group" aria-label="Panel count">
                  <span className="text-[10px] text-muted-foreground mr-0.5">Panels:</span>
                  {(["all", 1, 2, 3, 4, 5, 6, 7] as const).map((n) => (
                    <button key={n} onClick={() => setTplCount(n)} aria-pressed={tplCount === n}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tplCount === n ? "bg-foreground text-background border-foreground" : "border-border hover:border-foreground"}`}>
                      {n === "all" ? "Any" : n === 7 ? "7+" : n}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1 mb-2" role="group" aria-label="Layout style">
                  {(
                    [
                      ["all", "All styles"],
                      ["stagger", "Staggered"],
                      ["banner", "Wide Opener"],
                      ["wrap", "Hero Wrap"],
                      ["diagonal", "Diagonal"],
                      ...(customTemplates.length ? [["custom", `My Saved (${customTemplates.length})`]] : []),
                    ] as const
                  ).map(([id, lbl]) => (
                    <button
                      key={id}
                      onClick={() => setTplStyle(id as typeof tplStyle)}
                      className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${tplStyle === id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-foreground"}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5" data-testid="template-grid">
                  {allTemplates
                    .filter((t) => {
                      const q = tplSearch.trim().toLowerCase();
                      if (q && !t.label.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
                      if (tplCat !== "all" && t.category !== tplCat) return false;
                      const cnt = t.build().length;
                      if (tplCount !== "all" && (tplCount === 7 ? cnt < 7 : cnt !== tplCount)) return false;
                      if (tplStyle === "custom") return "isCustom" in t;
                      if (tplStyle === "stagger") return t.id.startsWith("st-") || t.id === "wr-kitchen" || t.description.toLowerCase().includes("offset");
                      if (tplStyle === "banner") return t.description.toLowerCase().includes("opener") || t.id.includes("establish") || t.id === "wr-kitchen";
                      if (tplStyle === "wrap") return t.id.startsWith("wr-hero") || t.id.includes("Lshape") || t.id.includes("shojo-focus");
                      if (tplStyle === "diagonal") return t.id.startsWith("ta-") || t.category === "action";
                      return true;
                    })
                    .map((tmpl) => (
                      <div key={tmpl.id} className="relative group">
                        <button
                          onClick={() => handleApplyTemplate(tmpl.id)}
                          title={tmpl.description}
                          aria-label={`Template ${tmpl.label}`}
                          className="w-full rounded border border-border p-1 text-left hover:border-foreground hover:bg-accent/40 transition-all"
                        >
                          <TemplateThumb panels={tmpl.build()} />
                          <div className="mt-1 text-[10px] font-semibold leading-tight text-foreground group-hover:text-primary line-clamp-1">{tmpl.label}</div>
                        </button>
                        {"isCustom" in tmpl && (
                          <button
                            type="button"
                            aria-label={`Delete template ${tmpl.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = removeCustomTemplate(customTemplates, tmpl.id);
                              setCustomTemplates(next);
                              saveCustomTemplates(next);
                            }}
                            className="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white group-hover:flex"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Gutters & Margins Settings */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xs">Gutters &amp; Margins</h3>
                  <button
                    onClick={() =>
                      onUpdateLayout(
                        syncPanelBoundElements({ ...layout, format: { ...layout.format, gutter: 10, gutterY: 24 } }),
                      )
                    }
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold hover:border-foreground"
                    title="Thin column gutters, wide tier gutters — the eye reads across before moving down"
                  >
                    Manga ratio
                  </button>
                </div>
                <label className="block">
                  <span className="flex justify-between"><span>Column gutter (↔)</span><span className="font-semibold">{layout.format.gutter}px</span></span>
                  <input type="range" min={0} max={48} value={layout.format.gutter}
                    onChange={(e) =>
                      onUpdateLayout(
                        syncPanelBoundElements({ ...layout, format: { ...layout.format, gutter: +e.target.value } }),
                      )
                    }
                    className="w-full accent-primary" />
                </label>
                <label className="block">
                  <span className="flex justify-between"><span>Tier gutter (↕)</span><span className="font-semibold">{layout.format.gutterY ?? layout.format.gutter}px</span></span>
                  <input type="range" min={0} max={60} value={layout.format.gutterY ?? layout.format.gutter}
                    onChange={(e) =>
                      onUpdateLayout(
                        syncPanelBoundElements({ ...layout, format: { ...layout.format, gutterY: +e.target.value } }),
                      )
                    }
                    className="w-full accent-primary" />
                </label>
                <label className="block">
                  <span className="flex justify-between"><span>Outer page margin</span><span className="font-semibold">{layout.format.margin}px</span></span>
                  <input type="range" min={0} max={80} value={layout.format.margin}
                    onChange={(e) =>
                      onUpdateLayout(
                        syncPanelBoundElements({ ...layout, format: { ...layout.format, margin: +e.target.value } }),
                      )
                    }
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
              {/* Dedicated Upload Background Image */}
              <div className="space-y-1.5 rounded border border-border bg-muted/30 p-2">
                <button
                  type="button"
                  data-testid="upload-background-btn"
                  onClick={() => bgFileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 rounded border-2 border-foreground bg-card py-2 font-bold shadow-ink hover:bg-accent transition-colors"
                >
                  <ImageIcon className="h-4 w-4 text-primary" />
                  Upload Background Image
                </button>
                <input
                  ref={bgFileInputRef}
                  type="file"
                  accept="image/*"
                  aria-label="Upload Background Image File"
                  hidden
                  onChange={(e) => {
                    void handleUploadBackground(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                  <span>
                    {selectedPanel
                      ? `Auto-scales to fill Panel #${layout.panels.findIndex((p) => p.id === selectedPanel.id) + 1}`
                      : "No panel selected — places freely on page"}
                  </span>
                  {selectedPanel && (
                    <button
                      type="button"
                      onClick={() => setSelectedPanelId(null)}
                      className="shrink-0 font-semibold text-primary underline"
                    >
                      Deselect panel
                    </button>
                  )}
                </div>
              </div>

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
              <div className="border-t border-border pt-3 space-y-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 rounded border-2 border-dashed border-foreground/40 bg-muted/40 py-2 font-medium hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <ImageIcon className="h-4 w-4" />
                  Upload Custom Transparent Sprite
                </button>
                <p className="text-[10px] text-muted-foreground text-center">
                  {selectedPanel ? "Drops into selected panel" : "No panel selected — places freely on whole page"}
                </p>
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
                      { id: "narration", label: "▤ Narration Caption" },
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
        </ResponsiveDrawer>

        {/* Center Canvas Viewport with Auto-Fit Scrolling + 2-Finger Pinch Zoom */}
        <main
          ref={canvasContainerRef}
          style={{ touchAction: "manipulation" }}
          className={`relative flex-1 min-w-0 overflow-auto p-2 sm:p-6 bg-muted/30 ${
            viewMode === "webtoon" ? "block" : "flex"
          }`}
          onWheel={(e) => {
            if (e.ctrlKey) {
              e.preventDefault();
              setZoom((z) => Math.max(0.2, Math.min(1.5, z - e.deltaY * 0.0015)));
            }
          }}
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              const t1 = e.touches[0];
              const t2 = e.touches[1];
              pinchRef.current = {
                dist: Math.max(1, Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)),
                startZoom: zoom,
                midX: (t1.clientX + t2.clientX) / 2,
                midY: (t1.clientY + t2.clientY) / 2,
              };
            }
          }}
          onTouchMove={(e) => {
            const p = pinchRef.current;
            if (!p || e.touches.length !== 2) return;
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const nextZoom = Math.max(
              0.2,
              Math.min(1.5, Math.round(p.startZoom * (dist / p.dist) * 100) / 100),
            );
            setZoom(nextZoom);
            const curMidX = (t1.clientX + t2.clientX) / 2;
            const curMidY = (t1.clientY + t2.clientY) / 2;
            if (canvasContainerRef.current) {
              canvasContainerRef.current.scrollLeft -= curMidX - p.midX;
              canvasContainerRef.current.scrollTop -= curMidY - p.midY;
            }
            p.midX = curMidX;
            p.midY = curMidY;
          }}
          onTouchEnd={() => {
            if (pinchRef.current) pinchRef.current = null;
          }}
        >
          {device.isCompact && tool !== "select" && (
            <div className="fixed left-1/2 top-16 z-20 -translate-x-1/2 flex items-center gap-1.5 rounded-full border-2 border-foreground bg-card/95 px-3 py-1 text-[11px] font-bold shadow-ink">
              <span className="text-primary uppercase">{tool}</span>
              <button
                type="button"
                onClick={() => setTool("select")}
                className="rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background"
              >
                Done
              </button>
            </div>
          )}
          {viewMode === "webtoon" ? (
            <WebtoonCanvas
              pages={allPages && allPages.length > 0 ? allPages : [layout]}
              activePageIndex={activePageIndex}
              selectedPanelId={selectedPanelId}
              selectedItemId={selectedItemId}
              zoom={zoom}
              tool={tool}
              showGuides={showGuides}
              showOrder={showOrder}
              showSeams={showSeams}
              onToggleSeams={setShowSeams}
              onSelectPage={(idx) => onSelectPage?.(idx)}
              onSelectPanel={setSelectedPanelId}
              onSelectItem={setSelectedItemId}
              onUpdatePageAt={(idx, updated) => {
                if (onUpdatePageAt) onUpdatePageAt(idx, updated);
                else if (idx === activePageIndex) onUpdateLayout(updated);
              }}
              onInsertPageAt={(idx, newPage) => {
                if (onInsertPageAt) onInsertPageAt(idx, newPage);
                else onAddPage?.();
              }}
              onKnife={(pageIdx, a, b) => {
                const target = (allPages && allPages[pageIdx]) || layout;
                const { panels, cut } = knifeCut(target.panels, a, b);
                if (!cut.length) return;
                const next = rehomeLayout(target, panels);
                if (onUpdatePageAt) onUpdatePageAt(pageIdx, next);
                else onUpdateLayout(next);
              }}
              onMoveVertex={(pageIdx, from, to) => {
                const target = (allPages && allPages[pageIdx]) || layout;
                const next: PageLayout = {
                  ...target,
                  panels: moveSharedVertex(target.panels, from, to),
                };
                if (onUpdatePageAt) onUpdatePageAt(pageIdx, next);
                else onUpdateLayout(next);
              }}
              onMoveDivider={(pageIdx, nextPanels) => {
                const target = (allPages && allPages[pageIdx]) || layout;
                const next = syncPanelBoundElements({ ...target, panels: nextPanels });
                if (onUpdatePageAt) onUpdatePageAt(pageIdx, next);
                else onUpdateLayout(next);
              }}
              onDrawPanel={(pageIdx, r) => {
                const target = (allPages && allPages[pageIdx]) || layout;
                const np = buildDrawnPanel(target.panels, r);
                const next = rehomeLayout(target, [...target.panels, np]);
                if (onUpdatePageAt) onUpdatePageAt(pageIdx, next);
                else onUpdateLayout(next);
                setSelectedPanelId(np.id);
              }}
              panelOverlapPref={panelOverlapPref}
              linePenOptions={{
                color: lineColor,
                width: lineWidth,
                style: lineStyle,
                cap: lineCap,
                layer: lineLayer,
                angleSnap: lineAngleSnap,
              }}
              onRePoseIn3D={onRePoseIn3D}
            />
          ) : (
            <PageCanvas
            layout={layout}
            selectedPanelId={selectedPanelId}
            selectedItemId={selectedItemId}
            tool={tool}
            onKnife={handleKnifeStroke}
            onMoveVertex={handleMoveVertex}
            onMoveDivider={(nextPanels) => onUpdateLayout(syncPanelBoundElements({ ...layout, panels: nextPanels }))}
            onDrawPanel={handleDrawPanel}
            onTransformPanel={(panelId, nextPts, opts) =>
              onUpdateLayout(transformPanelWithContents(layout, panelId, nextPts, opts))
            }
            panelOverlapPref={panelOverlapPref}
            linePenOptions={{
              color: lineColor,
              width: lineWidth,
              style: lineStyle,
              cap: lineCap,
              layer: lineLayer,
              angleSnap: lineAngleSnap,
            }}
            onAddDrawnLine={(line) => {
              const id = `line-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
              const maxZ = Math.max(20, ...(layout.drawnLines ?? []).map((l) => l.zIndex));
              const nextLine: DrawnLine = { ...line, id, zIndex: maxZ + 1 };
              onUpdateLayout({
                ...layout,
                drawnLines: [...(layout.drawnLines ?? []), nextLine],
              });
              setSelectedItemId(id);
            }}
            onUpdateDrawnLine={(id, u) =>
              onUpdateLayout({
                ...layout,
                drawnLines: (layout.drawnLines ?? []).map((l) => (l.id === id ? { ...l, ...u } : l)),
              })
            }
            onDeleteDrawnLine={(id) => {
              onUpdateLayout({
                ...layout,
                drawnLines: (layout.drawnLines ?? []).filter((l) => l.id !== id),
              });
              if (selectedItemId === id) setSelectedItemId(null);
            }}
            showOrder={showOrder}
            showGuides={showGuides}
            onSelectPanel={setSelectedPanelId}
            onSelectItem={setSelectedItemId}
            onUpdateElement={(id, u) =>
              onUpdateLayout({
                ...layout,
                elements: layout.elements.map((el) => (el.id === id ? applyManualElementPatch(el, u) : el)),
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
          )}
        </main>

        {/* Right Inspector: Panels, Characters, Balloons, Layers */}
        <ResponsiveDrawer
          mode={
            device.pinRightByDefault
              ? "pinned-right"
              : device.useBottomSheet
              ? "sheet-bottom"
              : "drawer-right"
          }
          isOpen={panelsRightOpen}
          onClose={() => setPanelsRightOpen(false)}
          title="Panel & Element Inspector"
          pinnedClassName="w-76"
          testId="panels-right-drawer"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {/* Free Whole-Page Elements (visible even when no panel is selected or image sits behind panels) */}
          {layout.elements.some((el) => el.panelId === PAGE_LAYER_ID) && (
            <div className="border-b border-border pb-3 space-y-1.5" data-testid="page-layer-list">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs">Whole-Page Images</span>
                {selectedPanel && (
                  <button
                    type="button"
                    onClick={() => setSelectedPanelId(null)}
                    className="text-[10px] font-semibold text-primary underline"
                  >
                    Target Page
                  </button>
                )}
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {layout.elements
                  .filter((el) => el.panelId === PAGE_LAYER_ID)
                  .map((el) => {
                    const lyr = el.pageLayer ?? (el.type === "background" ? { kind: "behind" as const } : { kind: "above" as const });
                    const pNum =
                      lyr.kind === "below-panel" || lyr.kind === "above-panel"
                        ? layout.panels.findIndex((p) => p.id === lyr.panelId) + 1
                        : 0;
                    const tag =
                      lyr.kind === "behind"
                        ? "Behind all"
                        : lyr.kind === "above"
                        ? "Above all"
                        : `${lyr.kind === "below-panel" ? "Below" : "Above"} P${pNum || "?"}`;
                    return (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => {
                          setSelectedPanelId(null);
                          setSelectedItemId(el.id);
                        }}
                        className={`w-full flex items-center justify-between rounded border px-2 py-1 text-[11px] font-medium ${
                          selectedItemId === el.id
                            ? "border-primary bg-primary/10 font-bold text-foreground"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        <span className="truncate">{el.type === "background" ? "🖼️ Page Background" : "🧍 Page Sprite"}</span>
                        <span className="ml-1 shrink-0 text-[9px] text-muted-foreground">{tag}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Selected Panel Inspector */}
          {selectedPanel && (
            <div className="border-b border-border pb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-sm">Panel Properties</h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPanelId(null)}
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold hover:border-foreground"
                    title="Deselect panel to target whole page"
                  >
                    Deselect
                  </button>
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

                {/* Corner Radius & Scalloped Flashback Frame */}
                <label className="block">
                  <div className="flex justify-between">
                    <span>Corner Radius</span>
                    <span className="font-mono">{selectedPanel.cornerRadius ?? 0}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={32}
                    step={2}
                    value={selectedPanel.cornerRadius ?? 0}
                    onChange={(e) =>
                      updatePanel(selectedPanel.id, { cornerRadius: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-primary mt-1"
                  />
                </label>

                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedPanel.scalloped)}
                    onChange={(e) =>
                      updatePanel(selectedPanel.id, { scalloped: e.target.checked })
                    }
                    className="accent-primary"
                  />
                  Scalloped Memory Border
                </label>

                {/* Panel Background Color */}
                <div>
                  <span className="block mb-1 font-semibold">Background Fill</span>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { color: "#ffffff", label: "White" },
                      { color: "transparent", label: "Clear" },
                      { color: "#09090b", label: "Black" },
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
                        className={`py-1 rounded text-[10px] border font-medium ${
                          selectedPanel.backgroundColor === c.color ? "border-primary ring-1 ring-primary font-bold" : "border-border"
                        }`}
                        style={
                          c.color === "transparent"
                            ? {
                                backgroundImage:
                                  "linear-gradient(45deg, #e4e4e7 25%, transparent 25%), linear-gradient(-45deg, #e4e4e7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e4e4e7 75%), linear-gradient(-45deg, transparent 75%, #e4e4e7 75%)",
                                backgroundSize: "8px 8px",
                                backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
                                color: "#000000",
                              }
                            : { backgroundColor: c.color, color: c.color === "#09090b" ? "#ffffff" : "#000000" }
                        }
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Move & Resize Panel (everything inside moves & scales with it) */}
                {(() => {
                  const pBox = panelBounds(selectedPanel, layout.format);
                  const rx = Math.round(pBox.minX);
                  const ry = Math.round(pBox.minY);
                  const rw = Math.round(pBox.width);
                  const rh = Math.round(pBox.height);
                  return (
                    <div
                      data-testid="panel-transform-inspector"
                      className="rounded border border-primary/50 bg-primary/5 p-2 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-primary flex items-center gap-1">
                          <Move className="h-3 w-3" /> Move &amp; Resize Panel
                        </span>
                        <button
                          type="button"
                          onClick={() => setTool(tool === "move-panel" ? "select" : "move-panel")}
                          className={`rounded border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                            tool === "move-panel"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-foreground bg-card hover:bg-accent"
                          }`}
                        >
                          {tool === "move-panel" ? "Editing Box" : "Drag / Handles"}
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[10px]">
                        <label className="block">
                          <span className="text-muted-foreground">X</span>
                          <input
                            type="number"
                            aria-label="Panel X"
                            value={rx}
                            onChange={(e) =>
                              handleTransformPanelRect(selectedPanel.id, {
                                x: Number(e.target.value) || 0,
                                y: ry,
                                width: rw,
                                height: rh,
                              })
                            }
                            className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono"
                          />
                        </label>
                        <label className="block">
                          <span className="text-muted-foreground">Y</span>
                          <input
                            type="number"
                            aria-label="Panel Y"
                            value={ry}
                            onChange={(e) =>
                              handleTransformPanelRect(selectedPanel.id, {
                                x: rx,
                                y: Number(e.target.value) || 0,
                                width: rw,
                                height: rh,
                              })
                            }
                            className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono"
                          />
                        </label>
                        <label className="block">
                          <span className="text-muted-foreground">W</span>
                          <input
                            type="number"
                            min={24}
                            aria-label="Panel Width"
                            value={rw}
                            onChange={(e) =>
                              handleTransformPanelRect(selectedPanel.id, {
                                x: rx,
                                y: ry,
                                width: Math.max(24, Number(e.target.value) || 24),
                                height: rh,
                              })
                            }
                            className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono"
                          />
                        </label>
                        <label className="block">
                          <span className="text-muted-foreground">H</span>
                          <input
                            type="number"
                            min={24}
                            aria-label="Panel Height"
                            value={rh}
                            onChange={(e) =>
                              handleTransformPanelRect(selectedPanel.id, {
                                x: rx,
                                y: ry,
                                width: rw,
                                height: Math.max(24, Number(e.target.value) || 24),
                              })
                            }
                            className="w-full rounded border border-border bg-background px-1 py-0.5 font-mono"
                          />
                        </label>
                      </div>
                      <label className="block text-[10px]">
                        <span className="block font-semibold text-muted-foreground mb-0.5">
                          Moved/Resized Panel Layer Preference (Saved)
                        </span>
                        <select
                          aria-label="Moved panel layer preference"
                          value={panelOverlapPref}
                          onChange={(e) => {
                            const next = e.target.value as PanelOverlapPreference;
                            setPanelOverlapPref(next);
                            savePanelOverlapPreference(next);
                          }}
                          className="w-full rounded border border-border bg-background px-1.5 py-0.5"
                        >
                          <option value="float">Float Above Other Panels (Default)</option>
                          <option value="keep">Keep Current Layer Order</option>
                        </select>
                      </label>
                    </div>
                  );
                })()}

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

                {/* Swap panel contents */}
                {layout.panels.length > 1 && (
                  <div className="border-t border-border pt-2">
                    <label className="flex items-center justify-between gap-2">
                      <span className="font-semibold shrink-0">Swap contents</span>
                      <select
                        aria-label="Swap contents with panel"
                        value=""
                        onChange={(e) => {
                          if (!e.target.value) return;
                          onUpdateLayout(swapPanelContents(layout, selectedPanel.id, e.target.value));
                        }}
                        className="flex-1 rounded border border-input bg-background px-1.5 py-0.5 text-[10px]"
                      >
                        <option value="">Swap with Panel...</option>
                        {layout.panels
                          .map((p, idx) => ({ id: p.id, num: idx + 1 }))
                          .filter((x) => x.id !== selectedPanel.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              Panel {x.num}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                )}

                {/* Items in this panel (selectable even when overlapped) */}
                {(() => {
                  const pid = selectedPanel.id;
                  const items: { id: string; label: string }[] = [
                    ...layout.elements
                      .filter((el) => el.panelId === pid)
                      .map((el) => ({
                        id: el.id,
                        label: `${el.type === "character" ? "🧍 Figure" : el.type === "background" ? "🖼️ Background" : "📦 Prop"}${el.breakout ? " ★" : ""}`,
                      })),
                    ...(layout.balloons ?? [])
                      .filter((b) => b.panelId === pid)
                      .map((b) => ({ id: b.id, label: `💬 ${b.text.slice(0, 18) || "Balloon"}` })),
                    ...(layout.comicMarks ?? [])
                      .filter((m) => m.panelId === pid)
                      .map((m) => ({ id: m.id, label: `✨ Mark (${m.type})` })),
                    ...(layout.speedLines ?? [])
                      .filter((l) => l.panelId === pid)
                      .map((l) => ({ id: l.id, label: `⚡ Speed Lines (${l.type})` })),
                    ...(layout.sfxStamps ?? [])
                      .filter((s) => s.panelId === pid)
                      .map((s) => ({ id: s.id, label: `🔊 SFX: ${s.text.slice(0, 14)}` })),
                  ];
                  if (items.length === 0) return null;
                  return (
                    <div className="border-t border-border pt-2" data-testid="panel-layer-list">
                      <span className="font-semibold block mb-1">Panel Layers ({items.length})</span>
                      <div className="max-h-28 overflow-y-auto space-y-1">
                        {items.map((it) => (
                          <button
                            key={it.id}
                            onClick={() => setSelectedItemId(it.id)}
                            className={`w-full text-left truncate rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                              selectedItemId === it.id
                                ? "border-primary bg-primary/10 font-bold text-foreground"
                                : "border-border hover:border-foreground"
                            }`}
                          >
                            {it.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Selected Character / Sprite Inspector */}
          {selectedElement && (() => {
            const setEl = (patch: Partial<typeof selectedElement>) => {
              const elements = layout.elements.map((el) => {
                if (el.id !== selectedElement.id) return el;
                const patched = applyManualElementPatch(el, patch);
                if (patched.fitMode === "fill-panel" && patched.panelId !== PAGE_LAYER_ID && !patched.breakout) {
                  const targetPanel = layout.panels.find((p) => p.id === patched.panelId);
                  if (targetPanel) {
                    const b = panelBounds(targetPanel, layout.format);
                    return {
                      ...patched,
                      x: Math.round(b.minX),
                      y: Math.round(b.minY),
                      width: Math.max(1, Math.round(b.width)),
                      height: Math.max(1, Math.round(b.height)),
                    };
                  }
                }
                return patched;
              });
              onUpdateLayout({ ...layout, elements });
            };
            const currentLayer: PageLayerPlacement =
              selectedElement.pageLayer ??
              (selectedElement.type === "background" ? { kind: "behind" } : { kind: "above" });
            const encodeLayer = (layer: PageLayerPlacement): string => {
              if (layer.kind === "below-panel") return `below:${layer.panelId}`;
              if (layer.kind === "above-panel") return `above:${layer.panelId}`;
              return layer.kind;
            };
            const decodeLayer = (value: string): PageLayerPlacement => {
              if (value === "behind") return { kind: "behind" };
              if (value === "above") return { kind: "above" };
              if (value.startsWith("below:")) return { kind: "below-panel", panelId: value.slice(6) };
              if (value.startsWith("above:")) return { kind: "above-panel", panelId: value.slice(6) };
              return { kind: "behind" };
            };
            const isWholePage = selectedElement.panelId === PAGE_LAYER_ID;
            return (
            <div className="border-b border-border pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm">
                  {isWholePage
                    ? "Whole-Page Image"
                    : selectedElement.type === "character"
                    ? "Character Figure"
                    : "Background / Prop"}
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

              {isWholePage ? (
                <div className="rounded border-2 border-primary/70 bg-primary/5 p-2 text-xs space-y-2">
                  <div className="font-bold text-primary">Page Layer Placement</div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setEl({ pageLayer: { kind: "behind" } })}
                      className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                        currentLayer.kind === "behind"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-accent"
                      }`}
                    >
                      Behind All Panels
                    </button>
                    <button
                      type="button"
                      onClick={() => setEl({ pageLayer: { kind: "above" } })}
                      className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                        currentLayer.kind === "above"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-accent"
                      }`}
                    >
                      Above All Panels
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block">
                      Relative to Panel
                    </label>
                    <select
                      aria-label="Page element layer relative to panel"
                      value={encodeLayer(currentLayer)}
                      onChange={(e) => setEl({ pageLayer: decodeLayer(e.target.value) })}
                      className="w-full px-2 py-1 text-xs rounded border border-border bg-background"
                    >
                      <option value="behind">Behind All Panels</option>
                      <option value="above">Above All Panels</option>
                      {layout.panels.map((p, idx) => (
                        <option key={`below-${p.id}`} value={`below:${p.id}`}>
                          Below Panel {idx + 1}
                        </option>
                      ))}
                      {layout.panels.map((p, idx) => (
                        <option key={`above-${p.id}`} value={`above:${p.id}`}>
                          Above Panel {idx + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                  {layout.panels.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-border/60">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground block">
                        Attach Inside Panel
                      </label>
                      <select
                        aria-label="Attach image inside panel"
                        value=""
                        onChange={(e) => {
                          const targetPanelId = e.target.value;
                          if (!targetPanelId) return;
                          setEl({
                            panelId: targetPanelId,
                            pageLayer: undefined,
                            fitMode: selectedElement.type === "background" ? "fill-panel" : "free",
                          });
                          setSelectedPanelId(targetPanelId);
                        }}
                        className="w-full px-2 py-1 text-xs rounded border border-border bg-background"
                      >
                        <option value="">Move into a panel...</option>
                        {layout.panels.map((p, idx) => (
                          <option key={p.id} value={p.id}>
                            Attach to Panel {idx + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* 1-Click Breakout Overlay Toggle */}
                  <div className="rounded border-2 border-primary bg-primary/10 p-2 text-xs">
                    <label className="flex items-center justify-between cursor-pointer font-bold text-primary">
                      <span>Breakout (Pop-out of border)</span>
                      <input
                        type="checkbox"
                        checked={selectedElement.breakout}
                        onChange={(e) => setEl({ breakout: e.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Allows character heads, weapons, or action blasts to boldly overlap borders and gutters!
                    </p>
                  </div>

                  {/* Auto-scale with Panel + Detach to Whole Page */}
                  <div className="rounded border border-border bg-muted/40 p-2 text-xs space-y-2">
                    <label className="flex items-center justify-between cursor-pointer font-medium">
                      <span>Auto-scale with panel</span>
                      <input
                        type="checkbox"
                        checked={selectedElement.fitMode === "fill-panel"}
                        onChange={(e) =>
                          setEl(
                            e.target.checked ? { fitMode: "fill-panel", breakout: false } : { fitMode: "free" }
                          )
                        }
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEl({
                          panelId: PAGE_LAYER_ID,
                          fitMode: "free",
                          breakout: false,
                          pageLayer: {
                            kind: selectedElement.type === "background" ? "behind" : "above",
                          },
                        });
                        setSelectedPanelId(null);
                      }}
                      className="w-full px-2 py-1 rounded border border-border bg-background hover:bg-accent text-[11px] font-medium"
                    >
                      Detach to Whole Page
                    </button>
                  </div>
                </>
              )}

              {/* Non-Destructive Re-Edit 2D Character Angle / Look */}
              {selectedElement.source2d && onEdit2DCharacter && (
                <button
                  type="button"
                  data-testid="panel-edit-2d-char-btn"
                  onClick={() =>
                    selectedElement.source2d &&
                    onEdit2DCharacter(selectedElement.id, selectedElement.source2d)
                  }
                  className="w-full flex items-center justify-center gap-1.5 rounded border-2 border-foreground bg-primary/15 py-1.5 font-bold shadow-ink text-xs hover:bg-primary/25 transition-transform hover:-translate-y-0.5"
                >
                  <User className="h-3.5 w-3.5 text-primary" />
                  Edit 2D Angle / Look ({selectedElement.source2d.angle}°)
                </button>
              )}

              {/* Non-Destructive Re-Pose in 3D Button */}
              {selectedElement.source3d && onRePoseIn3D && (
                <button
                  onClick={() => selectedElement.source3d && onRePoseIn3D(selectedElement.source3d)}
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

              {/* Alignment, Fit/Fill & Flip */}
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold block">Position &amp; Transforms</span>
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
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => handleFrameInPanel(selectedElement, "fit")}
                    className="rounded border border-border py-1 hover:border-foreground text-[10px] font-semibold"
                    title="Scale cleanly inside panel without cropping"
                  >
                    Fit inside panel
                  </button>
                  <button
                    onClick={() => handleFrameInPanel(selectedElement, "fill")}
                    className="rounded border border-border py-1 hover:border-foreground text-[10px] font-semibold"
                    title="Scale to cover full panel width & height"
                  >
                    Fill panel edges
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
            );
          })()}

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
                  aria-label="Dialogue Text"
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

              {/* Balloon Color Fill & Narration / Demon Presets */}
              <div>
                <span className="block mb-1 text-xs font-semibold">Balloon Style</span>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <button
                    onClick={() =>
                      onUpdateLayout({
                        ...layout,
                        balloons: (layout.balloons ?? []).map((b) =>
                          b.id === selectedBalloon.id
                            ? { ...b, backgroundColor: "#ffffff", fontColor: "#000000", strokeColor: "#000000", borderColor: "#000000" }
                            : b
                        ),
                      })
                    }
                    className="py-1 rounded border border-border bg-white text-black font-semibold text-[10px]"
                  >
                    White
                  </button>
                  <button
                    onClick={() =>
                      onUpdateLayout({
                        ...layout,
                        balloons: (layout.balloons ?? []).map((b) =>
                          b.id === selectedBalloon.id
                            ? { ...b, backgroundColor: "#faf7f2", fontColor: "#000000", strokeColor: "#000000", borderColor: "#000000", textAlign: "left", fontWeight: "normal", doubleBorder: true, shadow: true }
                            : b
                        ),
                      })
                    }
                    className="py-1 rounded border border-border bg-[#faf7f2] text-black font-semibold text-[10px]"
                  >
                    Caption Paper
                  </button>
                  <button
                    onClick={() =>
                      onUpdateLayout({
                        ...layout,
                        balloons: (layout.balloons ?? []).map((b) =>
                          b.id === selectedBalloon.id
                            ? { ...b, backgroundColor: "#09090b", fontColor: "#ffffff", strokeColor: "#ffffff", borderColor: "#ffffff" }
                            : b
                        ),
                      })
                    }
                    className="py-1 rounded border border-foreground bg-black text-white font-semibold text-[10px]"
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
                          {["oval", "rounded", "burst", "double_burst", "scream", "cloud", "whisper", "wavy", "flash", "box", "electric", "heart", "icy", "narration"].map((sh) => (
                            <option key={sh} value={sh}>{sh.replace("_", " ")}</option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold">Align:</span>
                        {(["left", "center", "right"] as const).map((al) => (
                          <button
                            key={al}
                            type="button"
                            onClick={() => setB({ textAlign: al })}
                            className={`rounded border px-1.5 py-0.5 text-[10px] capitalize ${(selectedBalloon.textAlign ?? (selectedBalloon.shape === "narration" ? "left" : "center")) === al ? "bg-foreground text-background border-foreground font-bold" : "border-border hover:border-foreground"}`}
                          >
                            {al}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!selectedBalloon.isVertical} onChange={(e) => setB({ isVertical: e.target.checked, writingMode: e.target.checked ? "vertical-rl" : "horizontal-tb" })} className="accent-primary" /> Vertical (tategaki)</label>
                        <label className="flex items-center gap-1.5"><input type="checkbox" checked={Boolean(selectedBalloon.doubleBorder ?? selectedBalloon.shape === "narration")} onChange={(e) => setB({ doubleBorder: e.target.checked })} className="accent-primary" /> Double Border</label>
                        <label className="flex items-center gap-1.5"><input type="checkbox" checked={Boolean(selectedBalloon.shadow ?? selectedBalloon.shape === "narration")} onChange={(e) => setB({ shadow: e.target.checked })} className="accent-primary" /> Drop Shadow</label>
                      </div>

                      {supportsBalloonTails(selectedBalloon.shape) && (() => {
                        const currentTails = getBalloonTails(selectedBalloon);
                        const isCloud = selectedBalloon.shape === "cloud";
                        return (
                          <div className="space-y-1.5 rounded border border-border bg-muted/20 p-2" data-testid="inspector-tails-section">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold">
                                {isCloud ? "Thought Trails" : "Speaker Tails"} ({currentTails.length}/{MAX_BALLOON_TAILS})
                              </span>
                              <button
                                type="button"
                                data-testid="inspector-add-tail-btn"
                                disabled={currentTails.length >= MAX_BALLOON_TAILS}
                                onClick={() => {
                                  const patch = addBalloonTail(selectedBalloon);
                                  if (patch) setB(patch);
                                }}
                                className="inline-flex items-center gap-1 rounded border border-foreground/70 bg-background px-1.5 py-0.5 text-[10px] font-bold hover:border-primary hover:text-primary disabled:opacity-40"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                <span>Add Tail</span>
                              </button>
                            </div>

                            {currentTails.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground">
                                Floating bubble (0 tails). Click Add Tail to point at speakers.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {currentTails.map((tail, idx) => {
                                  const badgeCls = BALLOON_TAIL_BADGE_CLASSES[idx % BALLOON_TAIL_BADGE_CLASSES.length];
                                  const tailW = Math.round(tail.width ?? DEFAULT_TAIL_WIDTH);
                                  return (
                                    <div
                                      key={tail.id ?? idx}
                                      data-testid={`inspector-tail-row-${idx}`}
                                      className="space-y-1 rounded border border-border/80 bg-background px-2 py-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className={`inline-flex h-4 w-4 items-center justify-center rounded-full border border-foreground text-[9px] font-bold leading-none ${badgeCls}`}
                                          >
                                            {idx + 1}
                                          </span>
                                          <span className="text-[10px] font-semibold">
                                            Tail #{idx + 1}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <label className="flex items-center gap-1 text-[10px]">
                                            <input
                                              type="checkbox"
                                              data-testid={`inspector-tail-curve-${idx}`}
                                              checked={Boolean(tail.curved)}
                                              onChange={(e) => {
                                                const checked = e.target.checked;
                                                const ctrl = checked ? defaultCurveControlForTail(tail) : null;
                                                const nextTails = currentTails.map((item, i) =>
                                                  i === idx
                                                    ? {
                                                        ...item,
                                                        curved: checked,
                                                        ...(ctrl ? { curveX: ctrl.x, curveY: ctrl.y } : {}),
                                                      }
                                                    : item
                                                );
                                                setB(balloonPatchWithTails(selectedBalloon, nextTails));
                                              }}
                                              className="accent-primary"
                                            />
                                            <span>Curved</span>
                                          </label>
                                          <button
                                            type="button"
                                            data-testid={`inspector-tail-delete-${idx}`}
                                            aria-label={`Remove tail ${idx + 1}`}
                                            title={`Remove tail ${idx + 1}`}
                                            onClick={() => {
                                              const nextTails = currentTails.filter((_, i) => i !== idx);
                                              setB(balloonPatchWithTails(selectedBalloon, nextTails));
                                            }}
                                            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>

                                      <label className="flex items-center gap-2 text-[10px]">
                                        <span className="shrink-0 text-muted-foreground">
                                          {isCloud ? "Dots" : "Width"}
                                        </span>
                                        <input
                                          type="range"
                                          min={10}
                                          max={44}
                                          step={2}
                                          aria-label={`Tail ${idx + 1} width`}
                                          value={tailW}
                                          onChange={(e) => {
                                            const nextWidth = +e.target.value;
                                            const nextTails = currentTails.map((item, i) =>
                                              i === idx ? { ...item, width: nextWidth } : item
                                            );
                                            setB(balloonPatchWithTails(selectedBalloon, nextTails));
                                          }}
                                          className="w-full accent-primary"
                                        />
                                        <span className="w-8 shrink-0 text-right font-mono text-[10px]">
                                          {tailW}px
                                        </span>
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
                      <label className="block"><span className="flex justify-between"><span>White Halo</span><span className="font-mono">{selectedSFX.haloWidth ?? 3}px</span></span>
                        <input type="range" min={0} max={8} step={0.5} value={selectedSFX.haloWidth ?? 3} onChange={(e) => setS({ haloWidth: +e.target.value })} className="w-full accent-primary" /></label>
                      <label className="block"><span className="flex justify-between"><span>Opacity</span><span className="font-mono">{Math.round((selectedSFX.opacity ?? 1) * 100)}%</span></span>
                        <input type="range" min={10} max={100} value={Math.round((selectedSFX.opacity ?? 1) * 100)} onChange={(e) => setS({ opacity: +e.target.value / 100 })} className="w-full accent-primary" /></label>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Selected Drawn Straight Line Inspector */}
          {selectedDrawnLine && (() => {
            const setL = (patch: Partial<DrawnLine>) =>
              onUpdateLayout({
                ...layout,
                drawnLines: (layout.drawnLines ?? []).map((l) =>
                  l.id === selectedDrawnLine.id ? { ...l, ...patch } : l
                ),
              });
            const parentPanel = layout.panels.find((p) => p.id === selectedDrawnLine.panelId);
            return (
              <div className="border-b border-border pb-3 space-y-2.5 text-xs" data-testid="drawn-line-inspector">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm">Straight Line</h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const copy: DrawnLine = {
                          ...selectedDrawnLine,
                          id: `line-${Date.now()}`,
                          x1: selectedDrawnLine.x1 + 20,
                          y1: selectedDrawnLine.y1 + 20,
                          x2: selectedDrawnLine.x2 + 20,
                          y2: selectedDrawnLine.y2 + 20,
                        };
                        onUpdateLayout({
                          ...layout,
                          drawnLines: [...(layout.drawnLines ?? []), copy],
                        });
                        setSelectedItemId(copy.id);
                      }}
                      title="Duplicate line"
                      className="rounded p-1 hover:text-primary"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateLayout({
                          ...layout,
                          drawnLines: (layout.drawnLines ?? []).filter((l) => l.id !== selectedDrawnLine.id),
                        });
                        setSelectedItemId(null);
                      }}
                      title="Delete line"
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span>Colour</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      aria-label="Selected line colour"
                      value={selectedDrawnLine.color || "#000000"}
                      onChange={(e) => setL({ color: e.target.value, matchPanelBorder: false })}
                      className="h-6 w-8 cursor-pointer rounded border border-border"
                    />
                    {parentPanel && (
                      <button
                        type="button"
                        onClick={() => setL({ color: parentPanel.borderColor, matchPanelBorder: true })}
                        className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold hover:border-foreground"
                      >
                        Match Panel Border
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span className="block mb-1 font-semibold">Line Style</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(["solid", "dashed", "dotted", "double"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setL({ style: st })}
                        className={`rounded border py-1 text-[10px] capitalize font-semibold ${
                          selectedDrawnLine.style === st
                            ? "bg-foreground text-background border-foreground"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block mb-1 font-semibold">Line Ends</span>
                  <div className="grid grid-cols-4 gap-1">
                    {([
                      { id: "none", label: "None" },
                      { id: "arrow", label: "Arrow →" },
                      { id: "both", label: "Both ↔" },
                      { id: "tapered", label: "Taper" },
                    ] as const).map((cp) => (
                      <button
                        key={cp.id}
                        type="button"
                        onClick={() => setL({ cap: cp.id })}
                        className={`rounded border py-1 text-[10px] font-semibold ${
                          (selectedDrawnLine.cap ?? "none") === cp.id
                            ? "bg-foreground text-background border-foreground"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        {cp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="flex justify-between">
                    <span>Thickness</span>
                    <span className="font-mono">{selectedDrawnLine.width}px</span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={18}
                    step={0.5}
                    value={selectedDrawnLine.width}
                    onChange={(e) => setL({ width: +e.target.value })}
                    className="w-full accent-primary"
                  />
                </label>

                <label className="block">
                  <span className="flex justify-between">
                    <span>Opacity</span>
                    <span className="font-mono">{Math.round((selectedDrawnLine.opacity ?? 1) * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={Math.round((selectedDrawnLine.opacity ?? 1) * 100)}
                    onChange={(e) => setL({ opacity: +e.target.value / 100 })}
                    className="w-full accent-primary"
                  />
                </label>

                <label className="block">
                  <span className="block mb-1 font-semibold">Page Layer</span>
                  <select
                    aria-label="Drawn line layer"
                    value={selectedDrawnLine.layer ?? "above"}
                    onChange={(e) => setL({ layer: e.target.value as "above" | "behind" })}
                    className="w-full rounded border border-border bg-background px-1.5 py-1"
                  >
                    <option value="above">Above Panels</option>
                    <option value="behind">Behind Panels</option>
                  </select>
                </label>
              </div>
            );
          })()}

          {!selectedElement &&
            !selectedBalloon &&
            !selectedSFX &&
            !selectedComicMark &&
            !selectedSpeedLine &&
            !selectedDrawnLine && (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
                <Layers className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs font-semibold">Select an Element</p>
                <p className="text-[11px] mt-1">
                  Click any panel, character, balloon, or effect to configure properties, re-pose in 3D, or adjust layer depths.
                </p>
              </div>
            )}
          </div>
        </ResponsiveDrawer>
      </div>

      {/* Chapter Page Manager Filmstrip (Pinned on Desktop/Tablet Landscape, Toggleable Strip on Phone/Tablet Portrait) */}
      {allPages && allPages.length > 0 && onSelectPage && device.showPagesBarPinned && (
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

      {allPages && allPages.length > 0 && onSelectPage && !device.showPagesBarPinned && mobilePagesOpen && (
        <div
          data-testid="mobile-pages-drawer"
          className="border-t-2 border-foreground bg-card shadow-lg shrink-0"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-1 text-[11px] font-bold">
            <span>Chapter Pages ({allPages.length})</span>
            <button
              type="button"
              onClick={() => setMobilePagesOpen(false)}
              aria-label="Close pages strip"
              className="rounded p-0.5 hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <PageManager
            pages={allPages}
            activePageIndex={activePageIndex}
            onSelectPage={(idx) => {
              onSelectPage(idx);
              setMobilePagesOpen(false);
            }}
            onAddPage={onAddPage || (() => {})}
            onDuplicatePage={onDuplicatePage || (() => {})}
            onDeletePage={onDeletePage || (() => {})}
            onMovePage={onMovePage || (() => {})}
          />
        </div>
      )}

      {/* Mobile / Tablet Bottom Quick Dock */}
      {device.isCompact && (
        <div
          data-testid="panels-mobile-dock"
          className="flex items-center justify-around gap-1.5 border-t-2 border-foreground bg-card px-2 py-1.5 text-xs safe-pb shrink-0"
        >
          {!device.pinLeftByDefault && (
            <button
              type="button"
              data-testid="panels-dock-tools"
              onClick={togglePanelsLeft}
              className={`flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1.5 font-semibold ${
                panelsLeftOpen ? "border-foreground bg-foreground text-background" : "border-border bg-background"
              }`}
            >
              <PanelLeft className="h-3.5 w-3.5" />
              <span>Tools</span>
            </button>
          )}
          <button
            type="button"
            data-testid="panels-dock-inspector"
            onClick={togglePanelsRight}
            className={`flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1.5 font-semibold ${
              panelsRightOpen
                ? "border-foreground bg-foreground text-background"
                : selectedItemId || selectedPanelId
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="truncate">
              {selectedDrawnLine
                ? "Edit Line"
                : selectedBalloon
                ? "Edit Balloon"
                : selectedElement
                ? "Edit Image"
                : selectedPanel
                ? `Panel #${layout.panels.findIndex((p) => p.id === selectedPanel.id) + 1}`
                : "Properties"}
            </span>
          </button>
          {!device.showPagesBarPinned && allPages && allPages.length > 0 && (
            <button
              type="button"
              data-testid="panels-dock-pages"
              onClick={toggleMobilePages}
              className={`flex items-center justify-center gap-1 rounded border px-2.5 py-1.5 font-semibold ${
                mobilePagesOpen ? "border-foreground bg-foreground text-background" : "border-border bg-background"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Pages ({allPages.length})</span>
            </button>
          )}
          {(selectedPanelId || selectedItemId) && (
            <button
              type="button"
              onClick={() => {
                setSelectedItemId(null);
                setSelectedPanelId(null);
              }}
              title="Deselect all (target whole page)"
              className="rounded border border-border bg-background px-2 py-1.5 font-semibold"
            >
              Deselect
            </button>
          )}
        </div>
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
        initialTab={exportInitialTab}
      />

      {/* Mobile 9:16 Continuous Webtoon Reading Preview Drawer */}
      <MobileWebtoonPreview
        isOpen={mobilePreviewOpen}
        onClose={() => setMobilePreviewOpen(false)}
        pages={allPages && allPages.length > 0 ? allPages : [layout]}
        activePageIndex={activePageIndex}
        onJumpToPage={(idx) => {
          onSelectPage?.(idx);
          setViewMode("webtoon");
        }}
        onOpenExport={() => {
          setMobilePreviewOpen(false);
          setExportInitialTab("webtoon");
          setExportModalOpen(true);
        }}
      />

      {/* Saved Manga Series & Chapters Library Modal */}
      {library && (
        <MangaProjectsModal
          isOpen={projectsModalOpen}
          onClose={() => setProjectsModalOpen(false)}
          library={library}
          saveStatus={saveStatus}
          onSaveNow={() => onSaveProjectNow?.()}
          onSelectChapter={(projId, chId) => onSelectLibraryChapter?.(projId, chId)}
          onCreateProject={(title) => onCreateProject?.(title)}
          onAddChapter={(projId, chTitle) => onAddChapterToProject?.(projId, chTitle)}
          onRenameProject={(projId, title) => onRenameProject?.(projId, title)}
          onRenameChapter={(projId, chId, title) => onRenameChapter?.(projId, chId, title)}
          onDuplicateProject={(projId) => onDuplicateProject?.(projId)}
          onDuplicateChapter={(projId, chId) => onDuplicateChapter?.(projId, chId)}
          onDeleteProject={(projId) => onDeleteProject?.(projId)}
          onDeleteChapter={(projId, chId) => onDeleteChapter?.(projId, chId)}
          onExportProject={(projId) => onExportProject?.(projId)}
          onImportProject={(file) => onImportProject?.(file)}
        />
      )}

      {/* Upload Grid Layout Template Extractor Modal */}
      <GridTemplateImportModal
        open={gridImportOpen}
        initialFile={gridImportFile}
        pageAspectRatio={layout.format.width / Math.max(1, layout.format.height)}
        onClose={() => {
          setGridImportOpen(false);
          setGridImportFile(null);
        }}
        onApplyLayout={handleApplyImportedGridLayout}
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

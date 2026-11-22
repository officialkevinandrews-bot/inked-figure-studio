import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Circle,
  Compass,
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Grid,
  Highlighter,
  Image as ImageIcon,
  Layers,
  Lock,
  Minus,
  MousePointer,
  MoveDown,
  MoveUp,
  Palette,
  PenTool,
  Plus,
  Redo2,
  RotateCcw,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
} from "lucide-react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { FeedbackButton } from "@/components/feedback/FeedbackProvider";
import type { PageLayout } from "@/lib/manga-layout";
import {
  BUILTIN_SCENE_OBJECTS,
  SCENE2D_H,
  SCENE2D_W,
  SCENE_BACKDROPS,
  SCENE_OBJECT_CATEGORIES,
  STARTER_SCENE_TEMPLATES,
  createScene2DFromTemplate,
  type Scene2D,
  type SceneDepthLayer,
  type SceneDrawTool,
  type SceneLighting2D,
  type SceneObjectAsset2D,
  type SceneObjectCategory,
  type SceneObjectInstance2D,
  type SceneStroke2D,
  type SceneTonePattern,
  type SourceScene2DMetadata,
} from "@/lib/scene2d-types";
import {
  deleteUploadedSceneObject2D,
  ensureScenes2DInitialized,
  loadCustomSceneObjects2D,
  loadSceneImageElement2D,
  prepareSceneObjectImages,
  removeScene2D,
  saveUploadedSceneObject2D,
  upsertScene2D,
} from "@/lib/scene2d-store";
import {
  exportScene2DPng,
  preloadScene2DImages,
  renderScene2DSync,
  renderSceneObjectThumbnailDataUrl,
} from "@/lib/scene2d-draw";

export interface Scene2DStudioProps {
  panels: PageLayout["panels"];
  elementCount: number;
  editingTarget?: { elementId: string; sourceScene2d: SourceScene2DMetadata } | null;
  onCancelEditingTarget?: () => void;
  onGoTab: (tab: "panels" | "create" | "scenes" | "pose") => void;
  onStampToPanel: (panelId: string, dataUrl: string, sourceScene2d: SourceScene2DMetadata) => void;
  onUpdatePanelElement: (
    elementId: string,
    dataUrl: string,
    sourceScene2d: SourceScene2DMetadata,
  ) => void;
}

type InspectorTab = "objects" | "backdrop" | "presets" | "layers" | "upload";

const BRUSH_SWATCHES = [
  "#000000",
  "#ffffff",
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#64748b",
  "#9a3412",
];

function CustomObjThumb({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState<string>(() => (src && !src.startsWith("idb://") ? src : ""));
  useEffect(() => {
    if (!src) {
      setUrl("");
      return;
    }
    if (!src.startsWith("idb://")) {
      setUrl(src);
      return;
    }
    let alive = true;
    loadSceneImageElement2D(src).then((im) => {
      if (alive && im?.src) setUrl(im.src);
    });
    return () => {
      alive = false;
    };
  }, [src]);
  if (!url) return <div className="h-12 w-full rounded-xs bg-muted animate-pulse" />;
  return <img src={url} alt={alt} className="mx-auto h-12 max-w-full object-contain" />;
}

function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode image file."));
      img.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function Scene2DStudio({
  panels,
  elementCount,
  editingTarget,
  onCancelEditingTarget,
  onGoTab,
  onStampToPanel,
  onUpdatePanelElement,
}: Scene2DStudioProps) {
  const [scenes, setScenes] = useState<Scene2D[]>(() => ensureScenes2DInitialized());
  const [activeId, setActiveId] = useState<string>(() => {
    if (editingTarget?.sourceScene2d?.sceneId) return editingTarget.sourceScene2d.sceneId;
    return ensureScenes2DInitialized()[0]?.id ?? "";
  });
  const [customObjects, setCustomObjects] = useState<SceneObjectAsset2D[]>(() =>
    loadCustomSceneObjects2D(),
  );
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("objects");
  const [targetPanelId, setTargetPanelId] = useState<string>(() => panels[0]?.id ?? "");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [showGuidesOverlay, setShowGuidesOverlay] = useState(true);

  // Undo/redo stack per session
  const [undoStack, setUndoStack] = useState<Scene2D[]>([]);
  const [redoStack, setRedoStack] = useState<Scene2D[]>([]);

  // Objects library filters & cached procedural thumbnails
  const [objCat, setObjCat] = useState<"all" | SceneObjectCategory>("all");
  const [objSearch, setObjSearch] = useState("");
  const builtinThumbs = useMemo(() => {
    const map: Record<string, string> = {};
    for (const def of BUILTIN_SCENE_OBJECTS) {
      map[def.id] = renderSceneObjectThumbnailDataUrl(def.id);
    }
    return map;
  }, []);

  // Manual Art Toolbar state
  const [tool, setTool] = useState<SceneDrawTool>("select");
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [tonePattern, setTonePattern] = useState<SceneTonePattern>("dots-med");
  const [shapeFilled, setShapeFilled] = useState(false);
  const [strokeLayer, setStrokeLayer] = useState<"front" | "behind">("front");
  const [textDraft, setTextDraft] = useState("COFFEE SHOP");
  const [activeStroke, setActiveStroke] = useState<SceneStroke2D | null>(null);

  // Custom Scene Object Uploader
  const [uploadMode, setUploadMode] = useState<"single" | "grid-4" | "grid-8">("single");
  const [uploadCategory, setUploadCategory] = useState<SceneObjectCategory>("props");
  const [uploadName, setUploadName] = useState("");
  const [uploadRemoveBg, setUploadRemoveBg] = useState(true);
  const [uploadPreviews, setUploadPreviews] = useState<
    Array<{ src: string; width: number; height: number }>
  >([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    mode: "move" | "resize" | "vp1" | "vp2";
    objId?: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    snapshot: Scene2D;
    moved: boolean;
  } | null>(null);
  const appliedEditTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!panels.some((p) => p.id === targetPanelId)) {
      setTargetPanelId(panels[0]?.id ?? "");
    }
  }, [panels, targetPanelId]);

  useEffect(() => {
    if (!editingTarget) {
      appliedEditTargetRef.current = null;
      return;
    }
    const sig = `${editingTarget.elementId}:${editingTarget.sourceScene2d.sceneId}`;
    if (appliedEditTargetRef.current === sig) return;
    appliedEditTargetRef.current = sig;

    const meta = editingTarget.sourceScene2d;
    setScenes((prev) => {
      const existing = prev.find((s) => s.id === meta.sceneId);
      if (existing) {
        setActiveId(existing.id);
        return prev;
      }
      if (meta.snapshot) {
        setActiveId(meta.snapshot.id);
        return upsertScene2D(prev, meta.snapshot);
      }
      return prev;
    });
  }, [editingTarget]);

  const activeScene = useMemo(() => {
    return (
      scenes.find((s) => s.id === activeId) ??
      scenes[0] ??
      createScene2DFromTemplate("cozy-bedroom")
    );
  }, [scenes, activeId]);

  const selectedObj = useMemo(
    () => activeScene.objects.find((o) => o.id === selectedObjId) ?? null,
    [activeScene.objects, selectedObjId],
  );

  const commitScene = useCallback(
    (updater: (cur: Scene2D) => Scene2D, pushUndo = true) => {
      setScenes((prev) => {
        const cur = prev.find((s) => s.id === activeScene.id) ?? activeScene;
        if (pushUndo) {
          setUndoStack((u) => [...u.slice(-30), cur]);
          setRedoStack([]);
        }
        return upsertScene2D(prev, updater(cur));
      });
    },
    [activeScene],
  );

  const handleUndo = useCallback(() => {
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const previous = u[u.length - 1]!;
      setRedoStack((r) => [...r.slice(-30), activeScene]);
      setScenes((prev) => upsertScene2D(prev, previous));
      return u.slice(0, -1);
    });
  }, [activeScene]);

  const handleRedo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const nextScene = r[r.length - 1]!;
      setUndoStack((u) => [...u.slice(-30), activeScene]);
      setScenes((prev) => upsertScene2D(prev, nextScene));
      return r.slice(0, -1);
    });
  }, [activeScene]);

  // Keyboard shortcuts for undo/redo & delete selected object
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Delete" && selectedObjId) {
        commitScene((s) => ({
          ...s,
          objects: s.objects.filter((o) => o.id !== selectedObjId),
        }));
        setSelectedObjId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo, selectedObjId, commitScene]);

  // Render preview canvas whenever scene, custom objects, active stroke, or selection changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const imageMap = await preloadScene2DImages(activeScene, customObjects);
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (canvas.width !== SCENE2D_W || canvas.height !== SCENE2D_H) {
        canvas.width = SCENE2D_W;
        canvas.height = SCENE2D_H;
      }

      renderScene2DSync(ctx, activeScene, customObjects, imageMap, {
        showGuides: showGuidesOverlay,
        selectedObjectId: tool === "select" ? selectedObjId : null,
        activeStroke,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeScene, customObjects, showGuidesOverlay, selectedObjId, activeStroke, tool]);

  const canvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * SCENE2D_W,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * SCENE2D_H,
    };
  };

  const snapIfGrid = (v: number) => {
    if (!activeScene.guides.snapToGrid) return v;
    const gs = Math.max(8, activeScene.guides.gridSize || 32);
    return Math.round(v / gs) * gs;
  };

  const snapEndToVanishingPoint = (p0: { x: number; y: number }, p1: { x: number; y: number }) => {
    const g = activeScene.guides;
    if (g.mode === "off" || !g.aimLinesToVp) return p1;
    const targetVp =
      g.mode === "2pt" && Math.abs(p1.x - g.vp2X) < Math.abs(p1.x - g.vp1X)
        ? { x: g.vp2X, y: g.horizonY }
        : { x: g.vp1X, y: g.horizonY };
    const vx = targetVp.x - p0.x;
    const vy = targetVp.y - p0.y;
    const vLen = Math.hypot(vx, vy);
    if (vLen < 1) return p1;
    const ux = vx / vLen;
    const uy = vy / vLen;
    const dist = (p1.x - p0.x) * ux + (p1.y - p0.y) * uy;
    return { x: Math.round(p0.x + ux * dist), y: Math.round(p0.y + uy * dist) };
  };

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pt = canvasCoords(e);

    if (tool === "select") {
      // 1. Check draggable VP handles when guide overlay active
      if (showGuidesOverlay && activeScene.guides.mode !== "off") {
        if (Math.hypot(pt.x - activeScene.guides.vp1X, pt.y - activeScene.guides.horizonY) < 20) {
          dragRef.current = {
            mode: "vp1",
            startX: pt.x,
            startY: pt.y,
            origX: activeScene.guides.vp1X,
            origY: activeScene.guides.horizonY,
            origW: 0,
            origH: 0,
            snapshot: activeScene,
            moved: false,
          };
          return;
        }
        if (
          activeScene.guides.mode === "2pt" &&
          Math.hypot(pt.x - activeScene.guides.vp2X, pt.y - activeScene.guides.horizonY) < 20
        ) {
          dragRef.current = {
            mode: "vp2",
            startX: pt.x,
            startY: pt.y,
            origX: activeScene.guides.vp2X,
            origY: activeScene.guides.horizonY,
            origW: 0,
            origH: 0,
            snapshot: activeScene,
            moved: false,
          };
          return;
        }
      }

      // 2. Hit test selected object corner handle for resize
      if (selectedObj && !selectedObj.locked) {
        const hx = selectedObj.x + selectedObj.width / 2;
        const hy = selectedObj.y + selectedObj.height / 2;
        if (Math.hypot(pt.x - hx, pt.y - hy) < 22) {
          dragRef.current = {
            mode: "resize",
            objId: selectedObj.id,
            startX: pt.x,
            startY: pt.y,
            origX: selectedObj.x,
            origY: selectedObj.y,
            origW: selectedObj.width,
            origH: selectedObj.height,
            snapshot: activeScene,
            moved: false,
          };
          return;
        }
      }

      // 3. Hit test top-most visible unlocked object (foreground -> midground -> background)
      const order = { foreground: 2, midground: 1, background: 0 } as const;
      const hitList = [...activeScene.objects].sort((a, b) => order[b.depth] - order[a.depth]);
      const hit = hitList.find(
        (o) =>
          o.visible &&
          !o.locked &&
          pt.x >= o.x - o.width / 2 &&
          pt.x <= o.x + o.width / 2 &&
          pt.y >= o.y - o.height / 2 &&
          pt.y <= o.y + o.height / 2,
      );
      if (hit) {
        setSelectedObjId(hit.id);
        dragRef.current = {
          mode: "move",
          objId: hit.id,
          startX: pt.x,
          startY: pt.y,
          origX: hit.x,
          origY: hit.y,
          origW: hit.width,
          origH: hit.height,
          snapshot: activeScene,
          moved: false,
        };
      } else {
        setSelectedObjId(null);
      }
      return;
    }

    if (tool === "text") {
      const label = textDraft.trim();
      if (!label) return;
      const stroke: SceneStroke2D = {
        id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        layer: strokeLayer,
        tool: "text",
        color: brushColor,
        size: brushSize,
        opacity: brushOpacity,
        points: [{ x: Math.round(pt.x), y: Math.round(pt.y) }],
        text: label,
        fontSize: Math.max(24, brushSize * 5),
      };
      commitScene((s) => ({ ...s, strokes: [...s.strokes, stroke] }));
      return;
    }

    const stroke: SceneStroke2D = {
      id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      layer: strokeLayer,
      tool,
      color: tool === "marker" ? brushColor : brushColor,
      size:
        tool === "erase" || tool === "tone" || tool === "marker"
          ? Math.max(12, brushSize * 3)
          : brushSize,
      opacity: tool === "marker" ? Math.min(0.45, brushOpacity) : brushOpacity,
      tonePattern,
      filled: shapeFilled,
      points: [{ x: Math.round(pt.x), y: Math.round(pt.y) }],
    };
    setActiveStroke(stroke);
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = canvasCoords(e);
    const dr = dragRef.current;
    if (dr) {
      dr.moved = true;
      if (dr.mode === "vp1") {
        const dx = pt.x - dr.startX;
        const dy = pt.y - dr.startY;
        commitScene(
          (s) => ({
            ...s,
            guides: {
              ...s.guides,
              vp1X: Math.max(40, Math.min(SCENE2D_W - 40, Math.round(dr.origX + dx))),
              horizonY: Math.max(100, Math.min(SCENE2D_H - 100, Math.round(dr.origY + dy))),
            },
          }),
          false,
        );
      } else if (dr.mode === "vp2") {
        const dx = pt.x - dr.startX;
        const dy = pt.y - dr.startY;
        commitScene(
          (s) => ({
            ...s,
            guides: {
              ...s.guides,
              vp2X: Math.max(40, Math.min(SCENE2D_W - 40, Math.round(dr.origX + dx))),
              horizonY: Math.max(100, Math.min(SCENE2D_H - 100, Math.round(dr.origY + dy))),
            },
          }),
          false,
        );
      } else if (dr.mode === "move" && dr.objId) {
        const nx = snapIfGrid(Math.round(dr.origX + (pt.x - dr.startX)));
        const ny = snapIfGrid(Math.round(dr.origY + (pt.y - dr.startY)));
        commitScene(
          (s) => ({
            ...s,
            objects: s.objects.map((o) => (o.id === dr.objId ? { ...o, x: nx, y: ny } : o)),
          }),
          false,
        );
      } else if (dr.mode === "resize" && dr.objId) {
        const nw = Math.max(28, Math.round(dr.origW + (pt.x - dr.startX) * 2));
        const nh = Math.max(28, Math.round(dr.origH + (pt.y - dr.startY) * 2));
        commitScene(
          (s) => ({
            ...s,
            objects: s.objects.map((o) =>
              o.id === dr.objId ? { ...o, width: nw, height: nh } : o,
            ),
          }),
          false,
        );
      }
      return;
    }

    if (activeStroke) {
      setActiveStroke((prev) => {
        if (!prev) return prev;
        if (prev.tool === "line" || prev.tool === "rect" || prev.tool === "ellipse") {
          const endPt =
            prev.tool === "line"
              ? snapEndToVanishingPoint(prev.points[0]!, pt)
              : { x: Math.round(pt.x), y: Math.round(pt.y) };
          return { ...prev, points: [prev.points[0]!, endPt] };
        }
        return { ...prev, points: [...prev.points, { x: Math.round(pt.x), y: Math.round(pt.y) }] };
      });
    }
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (dragRef.current) {
      if (dragRef.current.moved) {
        const snap = dragRef.current.snapshot;
        setUndoStack((u) => [...u.slice(-30), snap]);
        setRedoStack([]);
      }
      dragRef.current = null;
      return;
    }
    if (activeStroke) {
      const committed = activeStroke;
      setActiveStroke(null);
      commitScene((s) => ({ ...s, strokes: [...s.strokes, committed] }));
    }
  };

  const addBuiltinObjectToScene = (defId: string) => {
    const def = BUILTIN_SCENE_OBJECTS.find((o) => o.id === defId);
    if (!def) return;
    const inst: SceneObjectInstance2D = {
      id: `sobj-${def.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "builtin",
      assetId: def.id,
      name: def.name,
      depth: def.defaultDepth,
      x: Math.round(SCENE2D_W / 2 + (Math.random() - 0.5) * 120),
      y: Math.round(SCENE2D_H / 2 + (Math.random() - 0.5) * 80),
      width: def.defaultW,
      height: def.defaultH,
      rotation: 0,
      skewX: 0,
      skewY: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      primaryColor: def.defaultPrimary,
      accentColor: def.defaultAccent,
      tintEnabled: false,
      shadow: true,
      locked: false,
      visible: true,
    };
    commitScene((s) => ({ ...s, objects: [...s.objects, inst] }));
    setSelectedObjId(inst.id);
    setTool("select");
  };

  const addCustomObjectToScene = (asset: SceneObjectAsset2D) => {
    const scale = Math.min(340 / Math.max(1, asset.width), 340 / Math.max(1, asset.height), 1.4);
    const inst: SceneObjectInstance2D = {
      id: `sobj-cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "custom",
      assetId: asset.id,
      name: asset.name,
      depth: "midground",
      x: SCENE2D_W / 2,
      y: SCENE2D_H / 2,
      width: Math.max(40, Math.round(asset.width * scale)),
      height: Math.max(40, Math.round(asset.height * scale)),
      rotation: 0,
      skewX: 0,
      skewY: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      primaryColor: "#2563eb",
      accentColor: "#ffffff",
      tintEnabled: false,
      shadow: true,
      locked: false,
      visible: true,
    };
    commitScene((s) => ({ ...s, objects: [...s.objects, inst] }));
    setSelectedObjId(inst.id);
    setTool("select");
  };

  const updateSelectedObject = (patch: Partial<SceneObjectInstance2D>, pushUndo = false) => {
    if (!selectedObjId) return;
    commitScene(
      (s) => ({
        ...s,
        objects: s.objects.map((o) => (o.id === selectedObjId ? { ...o, ...patch } : o)),
      }),
      pushUndo,
    );
  };

  const handleUploadPick = async (file: File | undefined) => {
    if (!file) return;
    setUploadBusy(true);
    setUploadErr(null);
    try {
      const img = await loadImageFile(file);
      const items = prepareSceneObjectImages(img, uploadMode, uploadRemoveBg);
      if (items.length === 0) throw new Error("No opaque object pixels found inside image.");
      setUploadPreviews(items);
      if (!uploadName.trim()) setUploadName(file.name.replace(/\.[^.]+$/, ""));
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Failed to prepare scene object.");
    } finally {
      setUploadBusy(false);
    }
  };

  const handleCommitUploadedObjects = async () => {
    if (uploadPreviews.length === 0) return;
    setUploadBusy(true);
    try {
      const base = uploadName.trim() || "Custom Object";
      const created: SceneObjectAsset2D[] = [];
      for (let i = 0; i < uploadPreviews.length; i++) {
        const item = uploadPreviews[i]!;
        const saved = await saveUploadedSceneObject2D({
          name: uploadPreviews.length > 1 ? `${base} #${i + 1}` : base,
          category: uploadCategory,
          kind: uploadMode === "single" ? "single" : "sheet",
          rawSrc: item.src,
          width: item.width,
          height: item.height,
        });
        created.push(saved);
      }
      setCustomObjects((prev) => [...created.reverse(), ...prev]);
      if (created[0]) addCustomObjectToScene(created[0]);
      setUploadPreviews([]);
      setUploadName("");
      setInspectorTab("objects");
    } finally {
      setUploadBusy(false);
    }
  };

  const handleStamp = async () => {
    setExportBusy(true);
    try {
      const png = await exportScene2DPng(activeScene, customObjects, 1.5);
      if (!png) return;
      const meta: SourceScene2DMetadata = {
        sceneId: activeScene.id,
        sceneName: activeScene.name,
        renderMode: activeScene.renderMode,
        snapshot: activeScene,
      };
      if (editingTarget) {
        onUpdatePanelElement(editingTarget.elementId, png, meta);
      } else {
        onStampToPanel(targetPanelId || panels[0]?.id || "p1", png, meta);
      }
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportPng = async () => {
    setExportBusy(true);
    try {
      const png = await exportScene2DPng(activeScene, customObjects, 1.5);
      if (!png) return;
      const a = document.createElement("a");
      a.href = png;
      a.download = `${(activeScene.name || "scene").replace(/[^a-z0-9-_]+/gi, "_")}_${activeScene.renderMode}.png`;
      a.click();
    } finally {
      setExportBusy(false);
    }
  };

  const filteredBuiltin = useMemo(() => {
    const q = objSearch.trim().toLowerCase();
    return BUILTIN_SCENE_OBJECTS.filter((o) => {
      if (objCat !== "all" && o.category !== objCat) return false;
      if (q && !o.name.toLowerCase().includes(q) && !o.category.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [objCat, objSearch]);

  const filteredCustom = useMemo(() => {
    const q = objSearch.trim().toLowerCase();
    return customObjects.filter((o) => {
      if (objCat !== "all" && o.category !== objCat) return false;
      if (q && !o.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [customObjects, objCat, objSearch]);

  return (
    <div
      className="flex h-dvh flex-col bg-background text-foreground select-none overflow-hidden"
      data-testid="scene2d-studio"
    >
      {/* Unified Top Nav Bar */}
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b-2 border-foreground px-2.5 sm:px-4 py-1.5 sm:py-2 bg-card safe-pt shrink-0">
        <h1 className="font-display text-base sm:text-xl tracking-wide shrink-0">
          MANGAKA<span className="text-primary">DESK</span>
        </h1>

        <nav
          aria-label="Workspace views"
          className="flex items-center gap-1 text-xs sm:text-sm overflow-x-auto max-w-full"
        >
          <button
            type="button"
            onClick={() => onGoTab("panels")}
            className="whitespace-nowrap rounded-sm px-2 sm:px-3 py-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Manga Panels {elementCount > 0 && `(${elementCount})`}
          </button>
          <button
            type="button"
            onClick={() => onGoTab("create")}
            className="whitespace-nowrap rounded-sm px-2 sm:px-3 py-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Create Character
          </button>
          <button
            type="button"
            onClick={() => onGoTab("scenes")}
            aria-pressed={true}
            data-testid="nav-scenes-tab"
            className="whitespace-nowrap rounded-sm px-2 sm:px-3 py-1 font-semibold bg-foreground text-background transition-colors"
          >
            Scenes
          </button>
          <button
            type="button"
            onClick={() => onGoTab("pose")}
            className="whitespace-nowrap rounded-sm px-2 sm:px-3 py-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Pose &amp; Stage
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <FeedbackButton compact area="Scene Builder" />
          <AccountMenu compact />
        </div>
      </header>

      {/* Secondary Scene Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/25 px-2.5 sm:px-4 py-1.5 text-xs shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          {renaming ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (nameDraft.trim()) commitScene((s) => ({ ...s, name: nameDraft.trim() }));
                setRenaming(false);
              }}
            >
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus
                className="w-32 rounded-xs border border-primary bg-background px-1.5 py-0.5 text-xs"
              />
              <button
                type="submit"
                className="rounded-xs bg-primary px-1.5 py-0.5 text-primary-foreground font-semibold"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <select
              aria-label="Active 2D Scene"
              data-testid="scene2d-select"
              value={activeScene.id}
              onChange={(e) => {
                setActiveId(e.target.value);
                setSelectedObjId(null);
              }}
              className="max-w-[160px] rounded-xs border border-input bg-background px-2 py-1 font-semibold"
            >
              {scenes.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              const tpl = createScene2DFromTemplate("cozy-bedroom", `Scene ${scenes.length + 1}`);
              setScenes((prev) => upsertScene2D(prev, tpl));
              setActiveId(tpl.id);
              setSelectedObjId(null);
            }}
            title="New Scene"
            className="rounded-xs border border-border bg-background p-1 hover:border-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const copy: Scene2D = {
                ...activeScene,
                id: `scene2d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                name: `${activeScene.name} Copy`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              setScenes((prev) => upsertScene2D(prev, copy));
              setActiveId(copy.id);
            }}
            title="Duplicate Scene"
            className="rounded-xs border border-border bg-background p-1 hover:border-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setNameDraft(activeScene.name);
              setRenaming(true);
            }}
            title="Rename Scene"
            className="rounded-xs border border-border bg-background px-1.5 py-0.5 text-[11px] font-semibold hover:border-foreground"
          >
            Rename
          </button>
          {scenes.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const rest = removeScene2D(scenes, activeScene.id);
                setScenes(rest);
                setActiveId(rest[0]?.id ?? "");
                setSelectedObjId(null);
              }}
              title="Delete Scene"
              className="rounded-xs border border-border bg-background p-1 text-destructive hover:border-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Color vs Manga Ink Lines Toggle */}
        <div
          className="flex items-center rounded-sm border-2 border-foreground bg-background p-0.5 font-bold"
          role="group"
          aria-label="Scene Render Mode"
        >
          <button
            type="button"
            data-testid="scene2d-mode-color"
            onClick={() => commitScene((s) => ({ ...s, renderMode: "color" }))}
            className={`inline-flex items-center gap-1 rounded-xs px-2 py-0.5 transition-colors ${activeScene.renderMode === "color" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Color</span>
          </button>
          <button
            type="button"
            data-testid="scene2d-mode-manga"
            onClick={() => commitScene((s) => ({ ...s, renderMode: "manga" }))}
            className={`inline-flex items-center gap-1 rounded-xs px-2 py-0.5 transition-colors ${activeScene.renderMode === "manga" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            <PenTool className="h-3.5 w-3.5" />
            <span>Manga Ink (Lines Only)</span>
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl+Z)"
            className="rounded-xs border border-border bg-background p-1 hover:border-foreground disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Y)"
            className="rounded-xs border border-border bg-background p-1 hover:border-foreground disabled:opacity-40"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowGuidesOverlay((v) => !v)}
            title="Toggle perspective guides & grid preview"
            className={`inline-flex items-center gap-1 rounded-xs border px-2 py-1 text-[11px] font-semibold ${showGuidesOverlay ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Guides</span>
          </button>
        </div>

        {/* Panel Stamp & Export */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!editingTarget && panels.length > 0 && (
            <select
              aria-label="Target Manga Panel"
              value={targetPanelId}
              onChange={(e) => setTargetPanelId(e.target.value)}
              className="rounded-xs border border-input bg-background px-1.5 py-1 text-xs font-semibold"
            >
              {panels.map((p, i) => (
                <option key={p.id} value={p.id}>
                  Panel #{i + 1}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={exportBusy}
            data-testid="scene2d-stamp-panel-btn"
            onClick={handleStamp}
            className="inline-flex items-center gap-1 rounded-xs border-2 border-foreground bg-primary px-2.5 py-1 font-bold text-primary-foreground shadow-ink hover:opacity-95 disabled:opacity-50"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>{editingTarget ? "Update Panel Scene" : "Stamp to Panel"}</span>
          </button>
          {editingTarget && onCancelEditingTarget && (
            <button
              type="button"
              onClick={onCancelEditingTarget}
              className="rounded-xs border border-border bg-background px-2 py-1 font-semibold hover:border-foreground"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={exportBusy}
            onClick={handleExportPng}
            title="Download high-res 1920x1200 Scene PNG"
            className="inline-flex items-center gap-1 rounded-xs border border-border bg-background px-2 py-1 font-semibold hover:border-foreground disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PNG</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Left Art Toolbar + Center Canvas + Right Inspector */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Manual Artwork Tool Strip */}
        <div className="flex md:flex-col items-center gap-1 border-b md:border-b-0 md:border-r-2 border-foreground bg-card p-1.5 overflow-x-auto shrink-0">
          {(
            [
              { id: "select", label: "Select / Move", icon: MousePointer },
              { id: "ink", label: "Ink G-Pen", icon: PenTool },
              { id: "marker", label: "Marker Wash", icon: Highlighter },
              { id: "tone", label: "Screentone Brush", icon: Grid },
              { id: "erase", label: "Eraser", icon: Eraser },
              { id: "line", label: "Straight Line", icon: Minus },
              { id: "rect", label: "Rectangle", icon: Square },
              { id: "ellipse", label: "Ellipse / Circle", icon: Circle },
              { id: "text", label: "Signage Text", icon: Type },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                title={t.label}
                aria-label={t.label}
                aria-pressed={active}
                data-testid={`scene2d-tool-${t.id}`}
                onClick={() => setTool(t.id)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xs border transition-colors ${active ? "border-foreground bg-primary text-primary-foreground shadow-xs" : "border-transparent bg-background text-muted-foreground hover:border-border hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        {/* Center Stage */}
        <section className="relative flex flex-1 flex-col min-w-0 min-h-0 bg-slate-200 dark:bg-slate-900">
          {/* Context Tool Options Bar (visible whenever drawing tool active) */}
          {tool !== "select" && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/95 px-3 py-1.5 text-[11px] shrink-0">
              <span className="font-bold text-primary capitalize">{tool} Tool</span>
              {tool !== "erase" && (
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    aria-label="Manual Brush Color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="h-5 w-6 cursor-pointer rounded-xs border border-border bg-transparent p-0"
                  />
                  {BRUSH_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setBrushColor(hex)}
                      style={{ backgroundColor: hex }}
                      className={`h-4 w-4 rounded-full border ${brushColor.toLowerCase() === hex.toLowerCase() ? "ring-2 ring-primary border-white" : "border-foreground/50"}`}
                    />
                  ))}
                </div>
              )}

              <label className="flex items-center gap-1">
                <span>Size</span>
                <input
                  type="range"
                  min={1}
                  max={28}
                  value={brushSize}
                  onChange={(e) => setBrushSize(+e.target.value)}
                  className="w-16 accent-primary"
                />
                <span className="font-mono w-5">{brushSize}</span>
              </label>

              <label className="flex items-center gap-1">
                <span>Opacity</span>
                <input
                  type="range"
                  min={0.15}
                  max={1}
                  step={0.05}
                  value={brushOpacity}
                  onChange={(e) => setBrushOpacity(+e.target.value)}
                  className="w-16 accent-primary"
                />
              </label>

              {tool === "tone" && (
                <select
                  aria-label="Screentone Pattern"
                  value={tonePattern}
                  onChange={(e) => setTonePattern(e.target.value as SceneTonePattern)}
                  className="rounded-xs border border-input bg-background px-1.5 py-0.5 font-semibold"
                >
                  <option value="dots-light">Light Dots</option>
                  <option value="dots-med">Medium Dots</option>
                  <option value="dots-dark">Dense Dots</option>
                  <option value="hatch">Crosshatch</option>
                </select>
              )}

              {(tool === "rect" || tool === "ellipse") && (
                <label className="flex items-center gap-1 font-semibold">
                  <input
                    type="checkbox"
                    checked={shapeFilled}
                    onChange={(e) => setShapeFilled(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Filled</span>
                </label>
              )}

              {tool === "line" && activeScene.guides.mode !== "off" && (
                <label className="flex items-center gap-1 font-semibold text-primary">
                  <input
                    type="checkbox"
                    checked={activeScene.guides.aimLinesToVp}
                    onChange={(e) =>
                      commitScene((s) => ({
                        ...s,
                        guides: { ...s.guides, aimLinesToVp: e.target.checked },
                      }))
                    }
                    className="accent-primary"
                  />
                  <span>Snap to Vanishing Pt</span>
                </label>
              )}

              {tool === "text" && (
                <input
                  type="text"
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  placeholder="Sign text (click canvas)…"
                  className="w-36 rounded-xs border border-input bg-background px-1.5 py-0.5"
                />
              )}

              <select
                aria-label="Manual ink layer depth"
                value={strokeLayer}
                onChange={(e) => setStrokeLayer(e.target.value as "front" | "behind")}
                className="rounded-xs border border-input bg-background px-1.5 py-0.5 font-semibold"
              >
                <option value="front">Draw Over Objects</option>
                <option value="behind">Draw Behind Objects</option>
              </select>

              {activeScene.strokes.length > 0 && (
                <button
                  type="button"
                  onClick={() => commitScene((s) => ({ ...s, strokes: [] }))}
                  className="ml-auto rounded-xs border border-destructive/50 px-2 py-0.5 font-semibold text-destructive hover:bg-destructive/10"
                >
                  Clear Manual Ink ({activeScene.strokes.length})
                </button>
              )}
            </div>
          )}

          {/* Scene Canvas Container */}
          <div className="flex flex-1 items-center justify-center p-2 sm:p-4 overflow-auto min-h-0">
            <canvas
              ref={canvasRef}
              data-testid="scene2d-canvas"
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              style={{ touchAction: "none" }}
              className={`max-h-full max-w-full aspect-[16/10] bg-white shadow-xl border-2 border-foreground ${tool === "select" ? "cursor-move" : tool === "text" ? "cursor-text" : "cursor-crosshair"}`}
            />
          </div>

          <div className="border-t border-border bg-card/90 px-3 py-1 text-[10px] text-muted-foreground flex items-center justify-between">
            <span>
              {activeScene.objects.length} objects · {activeScene.strokes.length} manual ink strokes
              · {activeScene.backdropId.replace("_", " ")} ({activeScene.lighting})
            </span>
            <span>
              {tool === "select"
                ? "Click object to select · Drag to move · Drag bottom-right corner to resize"
                : "Drag on scene to draw manually · Ctrl+Z to undo"}
            </span>
          </div>
        </section>

        {/* Right / Bottom Inspector Panel */}
        <aside className="flex w-full md:w-[370px] lg:w-[410px] max-h-[46dvh] md:max-h-none flex-col border-t-2 md:border-t-0 md:border-l-2 border-foreground bg-card min-h-0">
          <div className="grid grid-cols-5 border-b border-border bg-muted/40 text-[11px] font-bold shrink-0">
            {(
              [
                { id: "objects", label: "Objects", icon: Sparkles },
                { id: "backdrop", label: "Room/Sky", icon: Sun },
                { id: "presets", label: "Presets", icon: ImageIcon },
                { id: "layers", label: "Layers", icon: Layers },
                { id: "upload", label: "Upload", icon: Upload },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const on = inspectorTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`scene2d-tab-${t.id}`}
                  onClick={() => setInspectorTab(t.id)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 border-b-2 py-2 transition-colors ${on ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 text-xs">
            {inspectorTab === "objects" && (
              <>
                {/* Selected Object Transform & Recolor Controls */}
                {selectedObj && (
                  <div className="rounded-sm border-2 border-primary/60 bg-primary/5 p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold truncate">Selected: {selectedObj.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateSelectedObject({ flipX: !selectedObj.flipX }, true)}
                          title="Flip Horizontally"
                          className="rounded-xs border border-border bg-background p-1 hover:border-foreground"
                        >
                          <FlipHorizontal className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedObject({ flipY: !selectedObj.flipY }, true)}
                          title="Flip Vertically"
                          className="rounded-xs border border-border bg-background p-1 hover:border-foreground"
                        >
                          <FlipVertical className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const dup: SceneObjectInstance2D = {
                              ...selectedObj,
                              id: `sobj-dup-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                              x: selectedObj.x + 28,
                              y: selectedObj.y + 24,
                            };
                            commitScene((s) => ({ ...s, objects: [...s.objects, dup] }));
                            setSelectedObjId(dup.id);
                          }}
                          title="Duplicate Object"
                          className="rounded-xs border border-border bg-background p-1 hover:border-foreground"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            commitScene((s) => ({
                              ...s,
                              objects: s.objects.filter((o) => o.id !== selectedObj.id),
                            }));
                            setSelectedObjId(null);
                          }}
                          title="Delete Object"
                          className="rounded-xs border border-border bg-background p-1 text-destructive hover:border-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Depth Layer Selector */}
                    <div className="grid grid-cols-3 gap-1">
                      {(["background", "midground", "foreground"] as SceneDepthLayer[]).map(
                        (dp) => (
                          <button
                            key={dp}
                            type="button"
                            onClick={() => updateSelectedObject({ depth: dp }, true)}
                            className={`rounded-xs border py-1 text-[10px] font-bold capitalize ${selectedObj.depth === dp ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                          >
                            {dp}
                          </button>
                        ),
                      )}
                    </div>

                    {/* Colors & Options */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <label className="flex items-center gap-1.5 font-semibold">
                        <input
                          type="color"
                          value={selectedObj.primaryColor}
                          onChange={(e) =>
                            updateSelectedObject({
                              primaryColor: e.target.value,
                              tintEnabled: true,
                            })
                          }
                          className="h-6 w-7 cursor-pointer rounded-xs border border-foreground/40 p-0"
                        />
                        <span>Main Color</span>
                      </label>
                      {selectedObj.kind === "builtin" ? (
                        <label className="flex items-center gap-1.5 font-semibold">
                          <input
                            type="color"
                            value={selectedObj.accentColor}
                            onChange={(e) => updateSelectedObject({ accentColor: e.target.value })}
                            className="h-6 w-7 cursor-pointer rounded-xs border border-foreground/40 p-0"
                          />
                          <span>Accent</span>
                        </label>
                      ) : (
                        <label className="flex items-center gap-1 font-semibold">
                          <input
                            type="checkbox"
                            checked={selectedObj.tintEnabled}
                            onChange={(e) =>
                              updateSelectedObject({ tintEnabled: e.target.checked }, true)
                            }
                            className="accent-primary"
                          />
                          <span>Apply RGB Tint</span>
                        </label>
                      )}
                      <label className="flex items-center gap-1 font-semibold">
                        <input
                          type="checkbox"
                          checked={selectedObj.shadow}
                          onChange={(e) => updateSelectedObject({ shadow: e.target.checked }, true)}
                          className="accent-primary"
                        />
                        <span>Shadow</span>
                      </label>
                    </div>

                    {/* Size, Rotation, Skew X/Y & Opacity Sliders */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <label>
                        <span className="flex justify-between">
                          <span>Width</span>
                          <span className="font-mono">{Math.round(selectedObj.width)}</span>
                        </span>
                        <input
                          type="range"
                          min={28}
                          max={900}
                          value={selectedObj.width}
                          onChange={(e) => updateSelectedObject({ width: +e.target.value })}
                          className="w-full accent-primary"
                        />
                      </label>
                      <label>
                        <span className="flex justify-between">
                          <span>Height</span>
                          <span className="font-mono">{Math.round(selectedObj.height)}</span>
                        </span>
                        <input
                          type="range"
                          min={28}
                          max={760}
                          value={selectedObj.height}
                          onChange={(e) => updateSelectedObject({ height: +e.target.value })}
                          className="w-full accent-primary"
                        />
                      </label>
                      <label>
                        <span className="flex justify-between">
                          <span>Rotate</span>
                          <span className="font-mono">{selectedObj.rotation}°</span>
                        </span>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={selectedObj.rotation}
                          onChange={(e) => updateSelectedObject({ rotation: +e.target.value })}
                          className="w-full accent-primary"
                        />
                      </label>
                      <label>
                        <span className="flex justify-between">
                          <span>Opacity</span>
                          <span className="font-mono">
                            {Math.round(selectedObj.opacity * 100)}%
                          </span>
                        </span>
                        <input
                          type="range"
                          min={0.1}
                          max={1}
                          step={0.05}
                          value={selectedObj.opacity}
                          onChange={(e) => updateSelectedObject({ opacity: +e.target.value })}
                          className="w-full accent-primary"
                        />
                      </label>
                      <label>
                        <span className="flex justify-between">
                          <span>Perspective Skew X</span>
                          <span className="font-mono">{selectedObj.skewX}°</span>
                        </span>
                        <input
                          type="range"
                          min={-45}
                          max={45}
                          value={selectedObj.skewX}
                          onChange={(e) => updateSelectedObject({ skewX: +e.target.value })}
                          className="w-full accent-primary"
                        />
                      </label>
                      <label>
                        <span className="flex justify-between">
                          <span>Perspective Skew Y</span>
                          <span className="font-mono">{selectedObj.skewY}°</span>
                        </span>
                        <input
                          type="range"
                          min={-45}
                          max={45}
                          value={selectedObj.skewY}
                          onChange={(e) => updateSelectedObject({ skewY: +e.target.value })}
                          className="w-full accent-primary"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Search & Category Tabs */}
                <input
                  type="search"
                  value={objSearch}
                  onChange={(e) => setObjSearch(e.target.value)}
                  placeholder="Search beds, desks, trees, signs, FX…"
                  className="w-full rounded-xs border border-input bg-background px-2 py-1 text-xs"
                />
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setObjCat("all")}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${objCat === "all" ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                  >
                    All ({BUILTIN_SCENE_OBJECTS.length + customObjects.length})
                  </button>
                  {SCENE_OBJECT_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setObjCat(c.id)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${objCat === c.id ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Custom Uploaded Objects */}
                {filteredCustom.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-bold text-[11px] block">
                      My Uploaded Objects ({filteredCustom.length})
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {filteredCustom.map((asset) => (
                        <div key={asset.id} className="relative group">
                          <button
                            type="button"
                            onClick={() => addCustomObjectToScene(asset)}
                            className="w-full rounded-xs border border-border bg-white p-1.5 text-center hover:border-primary"
                          >
                            <CustomObjThumb src={asset.src} alt={asset.name} />
                            <span className="mt-1 block truncate text-[10px] font-bold text-slate-900">
                              {asset.name}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const next = await deleteUploadedSceneObject2D(asset);
                              setCustomObjects(next);
                            }}
                            aria-label={`Delete ${asset.name}`}
                            className="absolute -top-1 -right-1 rounded-full border border-foreground bg-destructive p-0.5 text-white opacity-90 hover:opacity-100"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Built-in Manga Object Catalog */}
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredBuiltin.map((def) => (
                    <button
                      key={def.id}
                      type="button"
                      data-testid={`scene2d-add-${def.id}`}
                      onClick={() => addBuiltinObjectToScene(def.id)}
                      className="rounded-xs border border-border bg-white p-1.5 text-center hover:border-primary transition-colors"
                    >
                      {builtinThumbs[def.id] && (
                        <img
                          src={builtinThumbs[def.id]}
                          alt={def.name}
                          className="mx-auto h-12 w-full object-contain"
                        />
                      )}
                      <span className="mt-1 block truncate text-[10px] font-bold text-slate-900">
                        {def.name}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {inspectorTab === "backdrop" && (
              <>
                <div className="space-y-1.5">
                  <span className="font-bold block">Room / Outdoor Backdrop Shell</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SCENE_BACKDROPS.map((bd) => (
                      <button
                        key={bd.id}
                        type="button"
                        onClick={() =>
                          commitScene((s) => ({
                            ...s,
                            backdropId: bd.id,
                            wallColor: bd.defaultWallColor,
                            floorColor: bd.defaultFloorColor,
                            skyColor: bd.defaultSkyColor,
                            accentColor: bd.defaultAccentColor,
                          }))
                        }
                        className={`rounded-xs border px-2 py-1.5 text-left font-semibold ${activeScene.backdropId === bd.id ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground"}`}
                      >
                        <div className="truncate">{bd.name}</div>
                        <div className="text-[9px] opacity-75 uppercase">{bd.environment}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-border pt-3">
                  <span className="font-bold block">Time of Day / Mood Lighting</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(["day", "sunset", "night", "dramatic"] as SceneLighting2D[]).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => commitScene((s) => ({ ...s, lighting: l }))}
                        className={`rounded-xs border py-1 text-[10px] font-bold capitalize ${activeScene.lighting === l ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px]">
                  <label className="flex items-center justify-between rounded-xs border border-border p-1.5">
                    <span className="font-semibold">Wall / Horizon</span>
                    <input
                      type="color"
                      value={activeScene.wallColor}
                      onChange={(e) => commitScene((s) => ({ ...s, wallColor: e.target.value }))}
                      className="h-5 w-7 cursor-pointer p-0 border border-border"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xs border border-border p-1.5">
                    <span className="font-semibold">Floor / Road</span>
                    <input
                      type="color"
                      value={activeScene.floorColor}
                      onChange={(e) => commitScene((s) => ({ ...s, floorColor: e.target.value }))}
                      className="h-5 w-7 cursor-pointer p-0 border border-border"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xs border border-border p-1.5">
                    <span className="font-semibold">Sky Color</span>
                    <input
                      type="color"
                      value={activeScene.skyColor}
                      onChange={(e) => commitScene((s) => ({ ...s, skyColor: e.target.value }))}
                      className="h-5 w-7 cursor-pointer p-0 border border-border"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xs border border-border p-1.5">
                    <span className="font-semibold">Trim / Accent</span>
                    <input
                      type="color"
                      value={activeScene.accentColor}
                      onChange={(e) => commitScene((s) => ({ ...s, accentColor: e.target.value }))}
                      className="h-5 w-7 cursor-pointer p-0 border border-border"
                    />
                  </label>
                </div>

                {/* Perspective Guides & Snap Grid */}
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Perspective Guide Lines</span>
                    <button
                      type="button"
                      onClick={() =>
                        commitScene((s) => ({
                          ...s,
                          guides: { ...s.guides, horizonY: 360, vp1X: 640, vp2X: 1120 },
                        }))
                      }
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" /> Center VP
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(["off", "1pt", "2pt"] as const).map((gm) => (
                      <button
                        key={gm}
                        type="button"
                        onClick={() =>
                          commitScene((s) => ({ ...s, guides: { ...s.guides, mode: gm } }))
                        }
                        className={`rounded-xs border py-1 text-[10px] font-bold uppercase ${activeScene.guides.mode === gm ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                      >
                        {gm === "off" ? "Off" : gm === "1pt" ? "1-Point VP" : "2-Point VP"}
                      </button>
                    ))}
                  </div>
                  <label className="block text-[10px]">
                    <span className="flex justify-between">
                      <span>Horizon Height (Eye Level)</span>
                      <span className="font-mono">{activeScene.guides.horizonY}px</span>
                    </span>
                    <input
                      type="range"
                      min={140}
                      max={640}
                      value={activeScene.guides.horizonY}
                      onChange={(e) =>
                        commitScene((s) => ({
                          ...s,
                          guides: { ...s.guides, horizonY: +e.target.value },
                        }))
                      }
                      className="w-full accent-primary"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3 text-[11px]">
                    <label className="flex items-center gap-1 font-semibold">
                      <input
                        type="checkbox"
                        checked={activeScene.guides.showGrid}
                        onChange={(e) =>
                          commitScene((s) => ({
                            ...s,
                            guides: { ...s.guides, showGrid: e.target.checked },
                          }))
                        }
                        className="accent-primary"
                      />
                      <span>Show Grid</span>
                    </label>
                    <label className="flex items-center gap-1 font-semibold">
                      <input
                        type="checkbox"
                        checked={activeScene.guides.snapToGrid}
                        onChange={(e) =>
                          commitScene((s) => ({
                            ...s,
                            guides: { ...s.guides, snapToGrid: e.target.checked },
                          }))
                        }
                        className="accent-primary"
                      />
                      <span>Snap Move</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            {inspectorTab === "presets" && (
              <div className="space-y-2">
                <span className="font-bold block">Starter Rooms &amp; Outdoor Sets</span>
                {STARTER_SCENE_TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="rounded-xs border border-border bg-background p-2.5 space-y-1.5"
                  >
                    <div className="font-bold">{tpl.name}</div>
                    <p className="text-[11px] text-muted-foreground">{tpl.description}</p>
                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const fresh = createScene2DFromTemplate(tpl.id, activeScene.name);
                          commitScene(() => ({
                            ...fresh,
                            id: activeScene.id,
                            createdAt: activeScene.createdAt,
                            renderMode: activeScene.renderMode,
                          }));
                          setSelectedObjId(null);
                        }}
                        className="flex-1 rounded-xs border border-border bg-muted/40 py-1 text-[10px] font-bold hover:border-foreground"
                      >
                        Load into Active Scene
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const created = createScene2DFromTemplate(tpl.id);
                          setScenes((prev) => upsertScene2D(prev, created));
                          setActiveId(created.id);
                          setSelectedObjId(null);
                        }}
                        className="flex-1 rounded-xs border border-foreground bg-primary py-1 text-[10px] font-bold text-primary-foreground"
                      >
                        + Save as New Scene
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inspectorTab === "layers" && (
              <div className="space-y-2">
                <span className="font-bold block">
                  Scene Layers ({activeScene.objects.length} objects)
                </span>
                {activeScene.objects.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    No objects in this scene yet. Switch to the Objects or Presets tab to add items.
                  </p>
                ) : (
                  [...activeScene.objects].reverse().map((obj) => {
                    const idx = activeScene.objects.findIndex((o) => o.id === obj.id);
                    const sel = selectedObjId === obj.id;
                    return (
                      <div
                        key={obj.id}
                        className={`flex items-center gap-1 rounded-xs border p-1.5 ${sel ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedObjId(obj.id);
                            setTool("select");
                          }}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="truncate font-bold">{obj.name}</div>
                          <div className="text-[9px] text-muted-foreground capitalize">
                            {obj.depth}
                          </div>
                        </button>
                        <button
                          type="button"
                          disabled={idx >= activeScene.objects.length - 1}
                          onClick={() =>
                            commitScene((s) => {
                              const arr = [...s.objects];
                              const [item] = arr.splice(idx, 1);
                              if (item) arr.splice(idx + 1, 0, item);
                              return { ...s, objects: arr };
                            })
                          }
                          title="Bring Forward"
                          className="p-1 rounded-xs hover:bg-muted disabled:opacity-30"
                        >
                          <MoveUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx <= 0}
                          onClick={() =>
                            commitScene((s) => {
                              const arr = [...s.objects];
                              const [item] = arr.splice(idx, 1);
                              if (item) arr.splice(idx - 1, 0, item);
                              return { ...s, objects: arr };
                            })
                          }
                          title="Send Backward"
                          className="p-1 rounded-xs hover:bg-muted disabled:opacity-30"
                        >
                          <MoveDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            commitScene((s) => ({
                              ...s,
                              objects: s.objects.map((o) =>
                                o.id === obj.id ? { ...o, visible: !o.visible } : o,
                              ),
                            }))
                          }
                          title={obj.visible ? "Hide" : "Show"}
                          className="p-1 rounded-xs hover:bg-muted"
                        >
                          {obj.visible ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            commitScene((s) => ({
                              ...s,
                              objects: s.objects.map((o) =>
                                o.id === obj.id ? { ...o, locked: !o.locked } : o,
                              ),
                            }))
                          }
                          title={obj.locked ? "Unlock" : "Lock"}
                          className="p-1 rounded-xs hover:bg-muted"
                        >
                          {obj.locked ? (
                            <Lock className="h-3 w-3 text-amber-600" />
                          ) : (
                            <Unlock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            commitScene((s) => ({
                              ...s,
                              objects: s.objects.filter((o) => o.id !== obj.id),
                            }));
                            if (selectedObjId === obj.id) setSelectedObjId(null);
                          }}
                          title="Delete"
                          className="p-1 rounded-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {inspectorTab === "upload" && (
              <div className="space-y-2.5 rounded-sm bg-muted/20 p-2.5">
                <span className="font-bold block">Upload Scene Objects / Artwork Packs</span>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: "single", label: "Single PNG" },
                      { id: "grid-4", label: "4-Item Sheet" },
                      { id: "grid-8", label: "8-Item Pack" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setUploadMode(m.id)}
                      className={`rounded-xs border py-1 text-[10px] font-bold ${uploadMode === m.id ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="Scene Object Category"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as SceneObjectCategory)}
                  className="w-full rounded-xs border border-input bg-background px-2 py-1"
                >
                  {SCENE_OBJECT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Object name (e.g. Custom Ramen Cart)"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full rounded-xs border border-input bg-background px-2 py-1"
                />
                <label className="flex items-center gap-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    checked={uploadRemoveBg}
                    onChange={(e) => setUploadRemoveBg(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Auto-remove white paper background</span>
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xs border-2 border-dashed border-foreground/50 bg-background py-2 font-semibold hover:border-primary">
                  <Upload className="h-3.5 w-3.5 text-primary" />
                  <span>{uploadBusy ? "Processing…" : "Choose Object Image / Sheet"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    data-testid="scene2d-upload-input"
                    className="hidden"
                    onChange={(e) => {
                      void handleUploadPick(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {uploadErr && <p className="text-[11px] text-destructive">{uploadErr}</p>}
                {uploadPreviews.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-4 gap-1 rounded-xs border border-border bg-white p-1">
                      {uploadPreviews.map((pv, i) => (
                        <img
                          key={i}
                          src={pv.src}
                          alt={`Object ${i + 1}`}
                          className="mx-auto h-12 object-contain"
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={uploadBusy}
                      onClick={handleCommitUploadedObjects}
                      className="w-full rounded-xs border-2 border-foreground bg-primary py-1.5 font-bold text-primary-foreground"
                    >
                      Save {uploadPreviews.length} Object{uploadPreviews.length > 1 ? "s" : ""}{" "}
                      &amp; Place
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

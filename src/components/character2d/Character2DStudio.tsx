import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Copy,
  Download,
  FlipHorizontal,
  Layers,
  Palette,
  PenTool,
  Plus,
  RotateCcw,
  RotateCw,
  Shirt,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { FeedbackButton } from "@/components/feedback/FeedbackProvider";
import type { PageLayout } from "@/lib/manga-layout";
import {
  ANGLES_2D,
  BROW_STYLE_LABELS_2D,
  BOTTOM_STYLE_LABELS_2D,
  CHAR2D_H,
  CHAR2D_W,
  DEFAULT_CUSTOM_TRANSFORM_2D,
  EXPRESSION_PRESETS_2D,
  EYE_STYLE_LABELS_2D,
  FACE_FX_LABELS_2D,
  FOOTWEAR_STYLE_LABELS_2D,
  HAIR_STYLE_LABELS_2D,
  MOUTH_STYLE_LABELS_2D,
  NOSE_STYLE_LABELS_2D,
  RGB_SWATCHES_2D,
  SKIN_PRESETS_2D,
  TOP_STYLE_LABELS_2D,
  createDefaultCharacter2D,
  isBackFacingAngle2D,
  stepAngle2D,
  type Angle2D,
  type BaseModel2D,
  type BrowStyle2D,
  type BottomStyle2D,
  type Character2D,
  type CustomLayerInstance2D,
  type CustomLayerTransform2D,
  type CustomPartAsset2D,
  type Expression2DId,
  type EyeStyle2D,
  type FaceFx2D,
  type FootwearStyle2D,
  type HairStyle2D,
  type HeadPack2D,
  type MouthStyle2D,
  type NoseStyle2D,
  type RenderMode2D,
  type Source2DMetadata,
  type TopStyle2D,
} from "@/lib/character2d-types";
import {
  BUILTIN_HEAD_PACKS_2D,
  resolveHeadPack2D,
} from "@/lib/character2d-heads";
import { BUILTIN_MODEL_MALE_ATHLETIC_V1 } from "@/lib/character2d-model1";
import {
  deleteUploadedBaseModel2D,
  deleteUploadedCustomPart2D,
  deleteUploadedHeadPack2D,
  ensureCharacters2DInitialized,
  loadCustomBaseModels2D,
  loadCustomHeads2D,
  loadCustomParts2D,
  loadImageElement2D,
  removeCharacter2D,
  resolveBaseModel2D,
  saveUploadedBaseModel2D,
  saveUploadedCustomPart2D,
  saveUploadedHeadPack2D,
  upsertCharacter2D,
} from "@/lib/character2d-store";
import {
  prepareSinglePartImage,
  sliceHeadTurnaroundSheet,
  sliceTurnaroundSheet,
} from "@/lib/character2d-slicer";
import {
  exportCharacter2DPng,
  isUsingSeamlessHeadVariant,
  preloadCharacter2DImages,
  renderCharacter2DSync,
  resolveEffectiveAnchors,
} from "@/lib/character2d-draw";

export interface Character2DStudioProps {
  panels: PageLayout["panels"];
  elementCount: number;
  editingTarget?: { elementId: string; source2d: Source2DMetadata } | null;
  onCancelEditingTarget?: () => void;
  onGoTab: (tab: "panels" | "create" | "pose") => void;
  onSwitchTo3DLegacy: () => void;
  onStampToPanel: (panelId: string, dataUrl: string, source2d: Source2DMetadata) => void;
  onUpdatePanelElement: (elementId: string, dataUrl: string, source2d: Source2DMetadata) => void;
}

type InspectorTab2D = "face" | "hair" | "clothes" | "body" | "parts";

function ColorRgbControl({
  label,
  value,
  onChange,
  swatches = RGB_SWATCHES_2D,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  swatches?: string[];
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-foreground/85">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase text-muted-foreground">{value}</span>
          <input
            type="color"
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded-xs border border-foreground/40 bg-transparent p-0"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {swatches.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            onClick={() => onChange(hex)}
            style={{ backgroundColor: hex }}
            className={`h-4 w-4 rounded-full border transition-transform hover:scale-110 ${value.toLowerCase() === hex.toLowerCase() ? "border-2 border-primary ring-1 ring-primary" : "border-foreground/50"}`}
          />
        ))}
      </div>
    </div>
  );
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

function HeadThumbImg({ src, alt }: { src: string; alt: string }) {
  const [resolved, setResolved] = useState<string>(() =>
    src && !src.startsWith("idb://") ? src : "",
  );
  useEffect(() => {
    if (!src) {
      setResolved("");
      return;
    }
    if (!src.startsWith("idb://")) {
      setResolved(src);
      return;
    }
    let alive = true;
    loadImageElement2D(src).then((img) => {
      if (alive && img?.src) setResolved(img.src);
    });
    return () => {
      alive = false;
    };
  }, [src]);
  if (!resolved) {
    return <div className="h-12 w-12 rounded-xs bg-muted animate-pulse" />;
  }
  return <img src={resolved} alt={alt} className="h-12 w-12 object-contain mx-auto" />;
}

export function Character2DStudio({
  panels,
  elementCount,
  editingTarget,
  onCancelEditingTarget,
  onGoTab,
  onSwitchTo3DLegacy,
  onStampToPanel,
  onUpdatePanelElement,
}: Character2DStudioProps) {
  const [characters, setCharacters] = useState<Character2D[]>(() => ensureCharacters2DInitialized());
  const [activeId, setActiveId] = useState<string>(() => {
    if (editingTarget?.source2d?.characterId) return editingTarget.source2d.characterId;
    return ensureCharacters2DInitialized()[0]?.id ?? "";
  });
  const [customModels, setCustomModels] = useState<BaseModel2D[]>(() => loadCustomBaseModels2D());
  const [customHeads, setCustomHeads] = useState<HeadPack2D[]>(() => loadCustomHeads2D());
  const [customParts, setCustomParts] = useState<CustomPartAsset2D[]>(() => loadCustomParts2D());
  const [inspectorTab, setInspectorTab] = useState<InspectorTab2D>("face");
  const [backdrop, setBackdrop] = useState<"checker" | "paper" | "dark">("checker");
  const [cameraZoom, setCameraZoom] = useState<"full" | "face">("full");
  const [targetPanelId, setTargetPanelId] = useState<string>(() => panels[0]?.id ?? "");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Base Model Upload Wizard State
  const [modelUploadMode, setModelUploadMode] = useState<"sheet-8" | "sheet-5">("sheet-8");
  const [modelUploadName, setModelUploadName] = useState("");
  const [modelRemoveBg, setModelRemoveBg] = useState(true);
  const [modelPreview, setModelPreview] = useState<{
    frames: Record<Angle2D, string>;
    anchors: BaseModel2D["anchors"];
  } | null>(null);
  const [modelUploadBusy, setModelUploadBusy] = useState(false);
  const [modelUploadErr, setModelUploadErr] = useState<string | null>(null);

  // Custom Head Upload Wizard State
  const [headUploadOpen, setHeadUploadOpen] = useState(false);
  const [headUploadMode, setHeadUploadMode] = useState<HeadPack2D["sheetMode"]>("sheet-8");
  const [headUploadName, setHeadUploadName] = useState("");
  const [headUploadRemoveBg, setHeadUploadRemoveBg] = useState(true);
  const [headPreview, setHeadPreview] = useState<ReturnType<typeof sliceHeadTurnaroundSheet> | null>(
    null,
  );
  const [headUploadBusy, setHeadUploadBusy] = useState(false);
  const [headUploadErr, setHeadUploadErr] = useState<string | null>(null);

  // Custom Part Upload Wizard State
  const [partUploadMode, setPartUploadMode] = useState<CustomPartAsset2D["kind"]>("single");
  const [partUploadSlot, setPartUploadSlot] = useState<CustomPartAsset2D["slot"]>("accessory");
  const [partUploadLayer, setPartUploadLayer] = useState<"front" | "behind">("front");
  const [partUploadName, setPartUploadName] = useState("");
  const [partRemoveBg, setPartRemoveBg] = useState(true);
  const [partUploadBusy, setPartUploadBusy] = useState(false);
  const [partUploadErr, setPartUploadErr] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spinDragRef = useRef<{ x: number; startAngle: Angle2D; moved: boolean } | null>(null);
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
    const sig = `${editingTarget.elementId}:${editingTarget.source2d.angle}:${editingTarget.source2d.renderMode}`;
    if (appliedEditTargetRef.current === sig) return;
    appliedEditTargetRef.current = sig;

    const srcMeta = editingTarget.source2d;
    setCharacters((prev) => {
      const existing = prev.find((c) => c.id === srcMeta.characterId);
      if (existing) {
        const updated = { ...existing, angle: srcMeta.angle, renderMode: srcMeta.renderMode };
        setActiveId(existing.id);
        return upsertCharacter2D(prev, updated);
      }
      if (srcMeta.snapshot) {
        const restored: Character2D = {
          ...srcMeta.snapshot,
          angle: srcMeta.angle,
          renderMode: srcMeta.renderMode,
        };
        setActiveId(restored.id);
        return upsertCharacter2D(prev, restored);
      }
      return prev;
    });
  }, [editingTarget]);

  const activeChar = useMemo(() => {
    return characters.find((c) => c.id === activeId) ?? characters[0] ?? createDefaultCharacter2D();
  }, [characters, activeId]);

  const allModels = useMemo(
    () => [BUILTIN_MODEL_MALE_ATHLETIC_V1, ...customModels],
    [customModels],
  );
  const activeBaseModel = useMemo(
    () => resolveBaseModel2D(activeChar.baseModelId, customModels),
    [activeChar.baseModelId, customModels],
  );
  const allHeadPacks = useMemo(
    () => [...BUILTIN_HEAD_PACKS_2D, ...customHeads],
    [customHeads],
  );
  const activeHeadPack = useMemo(
    () => resolveHeadPack2D(activeChar.headShapeId, customHeads),
    [activeChar.headShapeId, customHeads],
  );

  const updateActiveChar = (updater: (cur: Character2D) => Character2D) => {
    setCharacters((prev) => {
      const base = prev.find((c) => c.id === activeChar.id) ?? activeChar;
      return upsertCharacter2D(prev, updater(base));
    });
  };

  // Render preview canvas whenever character/model/head/parts/zoom change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const imageMap = await preloadCharacter2DImages(
        activeChar,
        activeBaseModel,
        customParts,
        activeHeadPack,
      );
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const outW = CHAR2D_W * dpr;
      const outH = CHAR2D_H * dpr;
      if (canvas.width !== outW || canvas.height !== outH) {
        canvas.width = outW;
        canvas.height = outH;
      }

      ctx.save();
      ctx.clearRect(0, 0, outW, outH);
      ctx.scale(dpr, dpr);

      if (cameraZoom === "face") {
        const anchors = resolveEffectiveAnchors(
          activeBaseModel,
          activeChar,
          activeChar.angle,
          activeHeadPack,
        );
        const z = 2.65;
        ctx.translate(CHAR2D_W / 2, CHAR2D_H * 0.44);
        ctx.scale(z, z);
        ctx.translate(-anchors.headCx, -(anchors.headCy + 28));
      }

      renderCharacter2DSync(
        ctx,
        activeChar,
        activeBaseModel,
        customParts,
        imageMap,
        activeHeadPack,
      );
      ctx.restore();
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChar, activeBaseModel, activeHeadPack, customParts, cameraZoom]);

  const handleCreateCharacter = () => {
    const fresh = createDefaultCharacter2D(`Character ${characters.length + 1}`);
    const next = upsertCharacter2D(characters, fresh);
    setCharacters(next);
    setActiveId(fresh.id);
  };

  const handleDuplicateCharacter = () => {
    const copy: Character2D = {
      ...activeChar,
      id: `char2d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${activeChar.name} Copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      customLayers: activeChar.customLayers.map((l) => ({
        ...l,
        defaultTransform: { ...l.defaultTransform },
        perAngle: { ...l.perAngle },
      })),
    };
    const next = upsertCharacter2D(characters, copy);
    setCharacters(next);
    setActiveId(copy.id);
  };

  const handleDeleteCharacter = () => {
    const remaining = removeCharacter2D(characters, activeChar.id);
    if (remaining.length === 0) {
      const starter = createDefaultCharacter2D("Hero #1");
      const seeded = upsertCharacter2D([], starter);
      setCharacters(seeded);
      setActiveId(starter.id);
    } else {
      setCharacters(remaining);
      setActiveId(remaining[0]!.id);
    }
  };

  const buildSourceMetadata = (): Source2DMetadata => ({
    characterId: activeChar.id,
    characterName: activeChar.name,
    angle: activeChar.angle,
    renderMode: activeChar.renderMode,
    snapshot: activeChar,
  });

  const handleStamp = async () => {
    setExportBusy(true);
    try {
      const png = await exportCharacter2DPng(
        activeChar,
        activeBaseModel,
        customParts,
        2,
        activeHeadPack,
      );
      if (!png) return;
      if (editingTarget) {
        onUpdatePanelElement(editingTarget.elementId, png, buildSourceMetadata());
      } else {
        onStampToPanel(targetPanelId || panels[0]?.id || "p1", png, buildSourceMetadata());
      }
    } finally {
      setExportBusy(false);
    }
  };

  const handleDownloadPng = async () => {
    setExportBusy(true);
    try {
      const png = await exportCharacter2DPng(
        activeChar,
        activeBaseModel,
        customParts,
        2,
        activeHeadPack,
      );
      if (!png) return;
      const a = document.createElement("a");
      a.href = png;
      const safe = (activeChar.name || "character").replace(/[^a-z0-9-_]+/gi, "_");
      a.download = `${safe}_${activeChar.angle}deg_${activeChar.renderMode}.png`;
      a.click();
    } finally {
      setExportBusy(false);
    }
  };

  const handleBaseModelFilePick = async (file: File | undefined) => {
    if (!file) return;
    setModelUploadBusy(true);
    setModelUploadErr(null);
    try {
      const img = await loadImageFile(file);
      const sliced = sliceTurnaroundSheet(img, modelUploadMode, modelRemoveBg);
      setModelPreview(sliced);
      if (!modelUploadName.trim()) {
        setModelUploadName(file.name.replace(/\.[^.]+$/, ""));
      }
    } catch (err) {
      setModelUploadErr(err instanceof Error ? err.message : "Failed to slice spritesheet.");
    } finally {
      setModelUploadBusy(false);
    }
  };

  const handleCommitBaseModel = async () => {
    if (!modelPreview) return;
    setModelUploadBusy(true);
    try {
      const saved = await saveUploadedBaseModel2D(
        modelUploadName || `Custom Model ${customModels.length + 1}`,
        modelUploadMode,
        modelPreview.frames,
        modelPreview.anchors,
      );
      setCustomModels((prev) => [...prev, saved]);
      updateActiveChar((c) => ({ ...c, baseModelId: saved.id }));
      setModelPreview(null);
      setModelUploadName("");
    } finally {
      setModelUploadBusy(false);
    }
  };

  const handleHeadFilePick = async (file: File | undefined) => {
    if (!file) return;
    setHeadUploadBusy(true);
    setHeadUploadErr(null);
    try {
      const img = await loadImageFile(file);
      const sliced = sliceHeadTurnaroundSheet(
        img,
        headUploadMode,
        headUploadRemoveBg,
        activeBaseModel.id,
      );
      setHeadPreview(sliced);
      if (!headUploadName.trim()) {
        setHeadUploadName(file.name.replace(/\.[^.]+$/, ""));
      }
    } catch (err) {
      setHeadUploadErr(err instanceof Error ? err.message : "Failed to slice head sheet.");
    } finally {
      setHeadUploadBusy(false);
    }
  };

  const handleCommitCustomHead = async () => {
    if (!headPreview) return;
    setHeadUploadBusy(true);
    try {
      const saved = await saveUploadedHeadPack2D({
        name: headUploadName || `Custom Head ${customHeads.length + 1}`,
        sheetMode: headUploadMode,
        thumbnail: headPreview.thumbnail,
        overlayFrames: headPreview.overlayFrames,
        bodyVariants: headPreview.bodyVariants,
        anchors: headPreview.anchors,
      });
      setCustomHeads((prev) => [...prev, saved]);
      updateActiveChar((c) => ({
        ...c,
        headShapeId: saved.id,
        headFit: { scale: 1, offsetY: 0 },
      }));
      setHeadPreview(null);
      setHeadUploadName("");
      setHeadUploadOpen(false);
    } finally {
      setHeadUploadBusy(false);
    }
  };

  const handleCustomPartFilePick = async (file: File | undefined) => {
    if (!file) return;
    setPartUploadBusy(true);
    setPartUploadErr(null);
    try {
      const img = await loadImageFile(file);
      const name = partUploadName.trim() || file.name.replace(/\.[^.]+$/, "");
      let asset: CustomPartAsset2D;
      if (partUploadMode === "single") {
        const prepared = prepareSinglePartImage(img, partRemoveBg);
        asset = await saveUploadedCustomPart2D({
          name,
          kind: "single",
          slot: partUploadSlot,
          rawSingle: prepared,
        });
      } else {
        const sliced = sliceTurnaroundSheet(img, partUploadMode, partRemoveBg);
        asset = await saveUploadedCustomPart2D({
          name,
          kind: partUploadMode,
          slot: partUploadSlot,
          rawFrames: sliced.frames,
        });
      }
      setCustomParts((prev) => [asset, ...prev]);
      const layerInstance: CustomLayerInstance2D = {
        id: `layer2d-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        assetId: asset.id,
        name: asset.name,
        zLayer: partUploadLayer,
        tintEnabled: false,
        tintColor: "#2563eb",
        perAngle: {},
        defaultTransform: { ...DEFAULT_CUSTOM_TRANSFORM_2D },
      };
      updateActiveChar((c) => ({
        ...c,
        customLayers: [...c.customLayers, layerInstance],
      }));
      setSelectedLayerId(layerInstance.id);
      setPartUploadName("");
    } catch (err) {
      setPartUploadErr(err instanceof Error ? err.message : "Failed to prepare part image.");
    } finally {
      setPartUploadBusy(false);
    }
  };

  const handleEquipExistingPart = (asset: CustomPartAsset2D) => {
    const inst: CustomLayerInstance2D = {
      id: `layer2d-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      assetId: asset.id,
      name: asset.name,
      zLayer: asset.slot === "hair" ? "front" : "front",
      tintEnabled: false,
      tintColor: "#2563eb",
      perAngle: {},
      defaultTransform: { ...DEFAULT_CUSTOM_TRANSFORM_2D },
    };
    updateActiveChar((c) => ({ ...c, customLayers: [...c.customLayers, inst] }));
    setSelectedLayerId(inst.id);
  };

  const updateLayerTransform = (
    layerId: string,
    patch: Partial<CustomLayerTransform2D>,
    applyAllAngles = false,
  ) => {
    updateActiveChar((c) => ({
      ...c,
      customLayers: c.customLayers.map((l) => {
        if (l.id !== layerId) return l;
        if (applyAllAngles) {
          const nextAngles = { ...l.perAngle };
          for (const ang of ANGLES_2D) {
            nextAngles[ang] = { ...(nextAngles[ang] ?? {}), ...patch };
          }
          return { ...l, perAngle: nextAngles };
        }
        return {
          ...l,
          perAngle: {
            ...l.perAngle,
            [c.angle]: { ...(l.perAngle[c.angle] ?? l.perAngle[0] ?? {}), ...patch },
          },
        };
      }),
    }));
  };

  const stageBgClass =
    backdrop === "paper"
      ? "bg-white"
      : backdrop === "dark"
        ? "bg-slate-900"
        : "bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] bg-slate-100";

  const isRearAngle = isBackFacingAngle2D(activeChar.angle);
  const currentAnchors = resolveEffectiveAnchors(
    activeBaseModel,
    activeChar,
    activeChar.angle,
    activeHeadPack,
  );
  const isSeamlessHeadMode = isUsingSeamlessHeadVariant(
    activeBaseModel,
    activeChar,
    activeChar.angle,
    activeHeadPack,
  );
  const headFitScale = activeChar.headFit?.scale ?? 1;
  const headFitOffsetY = activeChar.headFit?.offsetY ?? 0;

  return (
    <div
      className="flex h-dvh flex-col bg-background text-foreground select-none overflow-hidden"
      data-testid="character2d-studio"
    >
      {/* Top Bar */}
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
            aria-pressed={true}
            className="whitespace-nowrap rounded-sm px-2 sm:px-3 py-1 font-semibold bg-foreground text-background transition-colors"
          >
            Create Character
          </button>
          <button
            type="button"
            onClick={() => onGoTab("pose")}
            className="whitespace-nowrap rounded-sm px-2 sm:px-3 py-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            3D Pose Studio
          </button>
        </nav>

        <div className="flex items-center rounded-sm border border-border bg-background p-0.5 text-[11px] font-semibold shrink-0">
          <span className="rounded-xs bg-primary px-2 py-0.5 text-primary-foreground">2D</span>
          <button
            type="button"
            onClick={onSwitchTo3DLegacy}
            data-testid="switch-to-3d-legacy-btn"
            title="Open original 3D character creator"
            className="rounded-xs px-2 py-0.5 text-muted-foreground hover:text-foreground"
          >
            3D Legacy
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <FeedbackButton compact area="Create Character (2D)" />
          <AccountMenu compact />
        </div>
      </header>

      {/* Secondary Toolbar: Saved Character, Color/Manga Mode, Stamp to Panel */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/25 px-2.5 sm:px-4 py-1.5 text-xs shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          {renaming ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (nameDraft.trim()) updateActiveChar((c) => ({ ...c, name: nameDraft.trim() }));
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
              aria-label="Active 2D character"
              data-testid="char2d-select"
              value={activeChar.id}
              onChange={(e) => setActiveId(e.target.value)}
              className="max-w-[140px] sm:max-w-[180px] rounded-xs border border-input bg-background px-2 py-1 font-semibold"
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleCreateCharacter}
            title="New 2D Character"
            className="rounded-xs border border-border bg-background p-1 hover:border-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setNameDraft(activeChar.name);
              setRenaming(true);
            }}
            title="Rename Character"
            className="rounded-xs border border-border bg-background p-1 hover:border-foreground"
          >
            <PenTool className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDuplicateCharacter}
            title="Duplicate Character"
            className="rounded-xs border border-border bg-background p-1 hover:border-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDeleteCharacter}
            title="Delete Character"
            className="rounded-xs border border-border bg-background p-1 text-destructive hover:border-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Color Mode vs Pure-Line Manga Mode */}
        <div
          className="flex items-center rounded-sm border-2 border-foreground bg-background p-0.5"
          role="group"
          aria-label="Render mode"
        >
          <button
            type="button"
            data-testid="char2d-mode-color"
            onClick={() => updateActiveChar((c) => ({ ...c, renderMode: "color" }))}
            className={`rounded-xs px-2 py-0.5 font-bold transition-colors ${activeChar.renderMode === "color" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Color
          </button>
          <button
            type="button"
            data-testid="char2d-mode-manga"
            onClick={() => updateActiveChar((c) => ({ ...c, renderMode: "manga" }))}
            className={`rounded-xs px-2 py-0.5 font-bold transition-colors ${activeChar.renderMode === "manga" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            Manga Ink (Lines Only)
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCameraZoom((z) => (z === "full" ? "face" : "full"))}
          className={`inline-flex items-center gap-1 rounded-xs border px-2 py-1 font-semibold ${cameraZoom === "face" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-foreground"}`}
        >
          <Camera className="h-3.5 w-3.5" />
          <span>{cameraZoom === "face" ? "Face Zoom" : "Full Body"}</span>
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={exportBusy}
            onClick={handleDownloadPng}
            className="inline-flex items-center gap-1 rounded-xs border border-border bg-background px-2 py-1 font-semibold hover:border-foreground disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PNG</span>
          </button>

          {editingTarget ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={exportBusy}
                data-testid="char2d-update-panel-btn"
                onClick={handleStamp}
                className="inline-flex items-center gap-1 rounded-xs border-2 border-foreground bg-emerald-600 px-2.5 py-1 font-bold text-white shadow-ink hover:bg-emerald-500 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{exportBusy ? "Updating…" : "Update Panel Character"}</span>
              </button>
              {onCancelEditingTarget && (
                <button
                  type="button"
                  onClick={onCancelEditingTarget}
                  className="rounded-xs border border-border bg-background px-2 py-1 font-semibold hover:border-foreground"
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {panels.length > 0 && (
                <select
                  aria-label="Target manga panel"
                  value={targetPanelId}
                  onChange={(e) => setTargetPanelId(e.target.value)}
                  className="rounded-xs border border-input bg-background px-1.5 py-1 font-semibold"
                >
                  {panels.map((p, idx) => (
                    <option key={p.id} value={p.id}>
                      Panel {idx + 1}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                disabled={exportBusy}
                data-testid="char2d-stamp-btn"
                onClick={handleStamp}
                className="inline-flex items-center gap-1 rounded-xs border-2 border-foreground bg-primary px-2.5 py-1 font-bold text-primary-foreground shadow-ink hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{exportBusy ? "Rendering…" : "Stamp to Panel"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Split */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
        {/* Left/Center: 2D Character Turntable Canvas */}
        <section className={`relative flex flex-1 min-h-[250px] flex-col items-center justify-between overflow-hidden ${stageBgClass}`}>
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-sm border border-border bg-card/90 p-1 text-[10px] font-semibold backdrop-blur-xs">
            {(["checker", "paper", "dark"] as const).map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setBackdrop(bg)}
                className={`rounded-xs px-1.5 py-0.5 capitalize ${backdrop === bg ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              >
                {bg}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 w-full flex items-center justify-center p-2 sm:p-4">
            <canvas
              ref={canvasRef}
              data-testid="char2d-canvas"
              style={{ touchAction: "pan-y" }}
              className="max-h-full max-w-full cursor-ew-resize object-contain"
              title="Drag horizontally to spin character in 45° steps"
              onPointerDown={(e) => {
                spinDragRef.current = { x: e.clientX, startAngle: activeChar.angle, moved: false };
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const st = spinDragRef.current;
                if (!st) return;
                const steps = Math.round((e.clientX - st.x) / 48);
                if (steps !== 0) st.moved = true;
                const nextAngle = stepAngle2D(st.startAngle, steps);
                if (nextAngle !== activeChar.angle) {
                  updateActiveChar((c) => ({ ...c, angle: nextAngle }));
                }
              }}
              onPointerUp={(e) => {
                spinDragRef.current = null;
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                } catch {
                  /* already released */
                }
              }}
            />
          </div>

          {/* 8-Angle 45° Turntable Bar */}
          <div className="z-10 flex w-full items-center justify-center gap-1 border-t border-border bg-card/95 px-2 py-1.5 text-[11px] backdrop-blur-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => updateActiveChar((c) => ({ ...c, angle: stepAngle2D(c.angle, -1) }))}
              title="Rotate -45°"
              className="inline-flex shrink-0 items-center gap-0.5 rounded-xs border border-border bg-background px-2 py-1 font-bold hover:border-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              <span>45°</span>
            </button>
            <div className="flex items-center gap-1 shrink-0">
              {ANGLES_2D.map((deg) => {
                const active = activeChar.angle === deg;
                return (
                  <button
                    key={deg}
                    type="button"
                    data-testid={`char2d-angle-${deg}`}
                    onClick={() => updateActiveChar((c) => ({ ...c, angle: deg }))}
                    className={`min-w-[40px] rounded-xs border px-1.5 py-1 font-mono font-bold transition-colors ${active ? "border-foreground bg-primary text-primary-foreground shadow-xs" : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground"}`}
                  >
                    {deg}°
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => updateActiveChar((c) => ({ ...c, angle: stepAngle2D(c.angle, 1) }))}
              title="Rotate +45°"
              className="inline-flex shrink-0 items-center gap-0.5 rounded-xs border border-border bg-background px-2 py-1 font-bold hover:border-foreground"
            >
              <span>45°</span>
              <RotateCw className="h-3 w-3" />
            </button>
          </div>
        </section>

        {/* Right / Bottom Layered Parts Inspector */}
        <aside className="flex w-full md:w-[360px] lg:w-[400px] max-h-[45dvh] md:max-h-none flex-col border-t-2 md:border-t-0 md:border-l-2 border-foreground bg-card min-h-0">
          {/* Inspector Tabs */}
          <div className="grid grid-cols-5 border-b border-border bg-muted/40 text-[11px] font-bold shrink-0">
            {(
              [
                { id: "face", label: "Face", icon: Smile },
                { id: "hair", label: "Hair", icon: Sparkles },
                { id: "clothes", label: "Clothes", icon: Shirt },
                { id: "body", label: "Body", icon: User },
                { id: "parts", label: "Custom", icon: Layers },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const isActive = inspectorTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`char2d-tab-${t.id}`}
                  onClick={() => setInspectorTab(t.id)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 border-b-2 py-2 transition-colors ${isActive ? "border-primary bg-card text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 text-xs">
            {inspectorTab === "face" && (
              <>
                {isRearAngle && (
                  <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">
                    Rear view ({activeChar.angle}°) hides facial features. Rotate to 0°, 45°, 90°, 270°, or 315° to preview edits.
                  </div>
                )}

                {/* Head & Neck Shape Picker */}
                <div className="space-y-2 border-b border-border pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">Head &amp; Neck Shape ({allHeadPacks.length})</span>
                    <span
                      className={`rounded-xs border px-1.5 py-0.5 text-[10px] font-bold ${isSeamlessHeadMode ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"}`}
                      title={
                        isSeamlessHeadMode
                          ? "Using full body-matched variant for this body"
                          : "Compositing Head+Neck unit cleanly onto active body collarbone"
                      }
                    >
                      {isSeamlessHeadMode ? "Seamless Body Fit" : "Head+Neck Attached"}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {allHeadPacks.map((head) => {
                      const sel = activeHeadPack.id === head.id;
                      return (
                        <div key={head.id} className="relative group">
                          <button
                            type="button"
                            data-testid={`char2d-head-${head.id}`}
                            onClick={() =>
                              updateActiveChar((c) => ({
                                ...c,
                                headShapeId: head.id,
                              }))
                            }
                            title={`${head.name}${head.subtitle ? ` — ${head.subtitle}` : ""}`}
                            className={`w-full rounded-xs border p-1 text-center transition-colors ${sel ? "border-primary bg-primary/15 ring-1 ring-primary" : "border-border bg-white/95 hover:border-foreground dark:bg-slate-900/90"}`}
                          >
                            <div className="rounded-xs bg-white p-0.5">
                              <HeadThumbImg src={head.thumbnail} alt={head.name} />
                            </div>
                            <span className="mt-1 block truncate text-[10px] font-bold text-foreground">
                              {head.name}
                            </span>
                          </button>
                          {!head.builtIn && (
                            <button
                              type="button"
                              aria-label={`Delete ${head.name}`}
                              onClick={async () => {
                                const next = await deleteUploadedHeadPack2D(head);
                                setCustomHeads(next);
                                if (activeChar.headShapeId === head.id) {
                                  updateActiveChar((c) => ({
                                    ...c,
                                    headShapeId: "classic-oval",
                                  }));
                                }
                              }}
                              className="absolute -top-1 -right-1 rounded-full border border-foreground bg-destructive p-0.5 text-white opacity-90 hover:opacity-100"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Cross-body Head+Neck Fit Adjustment Sliders */}
                  <div className="rounded-xs border border-border bg-muted/25 p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span>Head+Neck Fit (For Other Bodies)</span>
                      {(headFitScale !== 1 || headFitOffsetY !== 0) && (
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveChar((c) => ({
                              ...c,
                              headFit: { scale: 1, offsetY: 0 },
                            }))
                          }
                          className="text-primary hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <label>
                        <span className="flex justify-between">
                          <span>Head Size</span>
                          <span className="font-mono">{Math.round(headFitScale * 100)}%</span>
                        </span>
                        <input
                          type="range"
                          min={0.85}
                          max={1.15}
                          step={0.01}
                          value={headFitScale}
                          onChange={(e) =>
                            updateActiveChar((c) => ({
                              ...c,
                              headFit: {
                                scale: +e.target.value,
                                offsetY: c.headFit?.offsetY ?? 0,
                              },
                            }))
                          }
                          className="w-full accent-primary"
                        />
                      </label>
                      <label>
                        <span className="flex justify-between">
                          <span>Neck Height</span>
                          <span className="font-mono">{headFitOffsetY}px</span>
                        </span>
                        <input
                          type="range"
                          min={-16}
                          max={16}
                          step={1}
                          value={headFitOffsetY}
                          onChange={(e) =>
                            updateActiveChar((c) => ({
                              ...c,
                              headFit: {
                                scale: c.headFit?.scale ?? 1,
                                offsetY: +e.target.value,
                              },
                            }))
                          }
                          className="w-full accent-primary"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Custom Head Uploader */}
                  <div className="rounded-xs border border-border bg-background">
                    <button
                      type="button"
                      onClick={() => setHeadUploadOpen((v) => !v)}
                      className="flex w-full items-center justify-between px-2.5 py-1.5 text-[11px] font-bold hover:bg-muted/40"
                    >
                      <span className="flex items-center gap-1.5">
                        <Upload className="h-3.5 w-3.5 text-primary" />
                        <span>Upload Custom Head + Neck</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {headUploadOpen ? "Hide" : "1×8 / 1×5 / Single"}
                      </span>
                    </button>
                    {headUploadOpen && (
                      <div className="space-y-2 border-t border-border p-2.5">
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              { id: "sheet-8", label: "1×8 Sheet" },
                              { id: "sheet-5", label: "1×5 Mirror" },
                              { id: "single", label: "Single Head" },
                            ] as const
                          ).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setHeadUploadMode(m.id)}
                              className={`rounded-xs border py-1 text-[10px] font-bold ${headUploadMode === m.id ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Head name (e.g. Demon Jaw / Stoic)"
                          value={headUploadName}
                          onChange={(e) => setHeadUploadName(e.target.value)}
                          className="w-full rounded-xs border border-input bg-background px-2 py-1 text-[11px]"
                        />
                        <label className="flex items-center gap-1.5 text-[10px]">
                          <input
                            type="checkbox"
                            checked={headUploadRemoveBg}
                            onChange={(e) => setHeadUploadRemoveBg(e.target.checked)}
                            className="accent-primary"
                          />
                          <span>Auto-remove white paper background</span>
                        </label>
                        <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xs border-2 border-dashed border-foreground/50 bg-muted/20 py-1.5 text-[11px] font-semibold hover:border-primary">
                          <Upload className="h-3.5 w-3.5 text-primary" />
                          <span>
                            {headUploadBusy
                              ? "Extracting Head+Neck…"
                              : "Choose Head+Neck or Turnaround Image"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            data-testid="char2d-upload-head-input"
                            className="hidden"
                            onChange={(e) => {
                              void handleHeadFilePick(e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {headUploadErr && (
                          <p className="text-[10px] text-destructive">{headUploadErr}</p>
                        )}
                        {headPreview && (
                          <div className="space-y-1.5 pt-1">
                            <div className="grid grid-cols-4 gap-1 rounded-xs border border-border bg-white p-1">
                              {ANGLES_2D.map((ang) => (
                                <div key={ang} className="text-center">
                                  <img
                                    src={headPreview.overlayFrames[ang]}
                                    alt={`${ang}° head`}
                                    className="mx-auto h-12 object-contain"
                                  />
                                  <span className="font-mono text-[9px] text-slate-600">
                                    {ang}°
                                  </span>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              disabled={headUploadBusy}
                              onClick={handleCommitCustomHead}
                              className="w-full rounded-xs border-2 border-foreground bg-primary py-1.5 text-[11px] font-bold text-primary-foreground"
                            >
                              Save &amp; Equip Head
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold block">Expression Presets</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(Object.keys(EXPRESSION_PRESETS_2D) as Expression2DId[]).map((exId) => (
                      <button
                        key={exId}
                        type="button"
                        onClick={() =>
                          updateActiveChar((c) => ({
                            ...c,
                            face: { ...c.face, expression: exId },
                          }))
                        }
                        className={`rounded-xs border px-1.5 py-1 text-[11px] font-semibold ${activeChar.face.expression === exId ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground"}`}
                      >
                        {EXPRESSION_PRESETS_2D[exId].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="font-semibold block">Eyes</span>
                    <select
                      value={activeChar.face.eyeStyle}
                      onChange={(e) =>
                        updateActiveChar((c) => ({
                          ...c,
                          face: { ...c.face, eyeStyle: e.target.value as EyeStyle2D },
                        }))
                      }
                      className="w-full rounded-xs border border-input bg-background px-2 py-1"
                    >
                      {(Object.keys(EYE_STYLE_LABELS_2D) as EyeStyle2D[]).map((k) => (
                        <option key={k} value={k}>
                          {EYE_STYLE_LABELS_2D[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold block">Eyebrows</span>
                    <select
                      value={activeChar.face.browStyle}
                      onChange={(e) =>
                        updateActiveChar((c) => ({
                          ...c,
                          face: { ...c.face, browStyle: e.target.value as BrowStyle2D },
                        }))
                      }
                      className="w-full rounded-xs border border-input bg-background px-2 py-1"
                    >
                      {(Object.keys(BROW_STYLE_LABELS_2D) as BrowStyle2D[]).map((k) => (
                        <option key={k} value={k}>
                          {BROW_STYLE_LABELS_2D[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold block">Nose</span>
                    <select
                      value={activeChar.face.noseStyle}
                      onChange={(e) =>
                        updateActiveChar((c) => ({
                          ...c,
                          face: { ...c.face, noseStyle: e.target.value as NoseStyle2D },
                        }))
                      }
                      className="w-full rounded-xs border border-input bg-background px-2 py-1"
                    >
                      {(Object.keys(NOSE_STYLE_LABELS_2D) as NoseStyle2D[]).map((k) => (
                        <option key={k} value={k}>
                          {NOSE_STYLE_LABELS_2D[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="font-semibold block">Mouth</span>
                    <select
                      value={activeChar.face.mouthStyle}
                      onChange={(e) =>
                        updateActiveChar((c) => ({
                          ...c,
                          face: { ...c.face, mouthStyle: e.target.value as MouthStyle2D },
                        }))
                      }
                      className="w-full rounded-xs border border-input bg-background px-2 py-1"
                    >
                      {(Object.keys(MOUTH_STYLE_LABELS_2D) as MouthStyle2D[]).map((k) => (
                        <option key={k} value={k}>
                          {MOUTH_STYLE_LABELS_2D[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold block">Manga Emotion FX</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(FACE_FX_LABELS_2D) as FaceFx2D[]).map((fxId) => {
                      const on = activeChar.face.fx.includes(fxId);
                      return (
                        <button
                          key={fxId}
                          type="button"
                          onClick={() =>
                            updateActiveChar((c) => ({
                              ...c,
                              face: {
                                ...c.face,
                                fx: on ? c.face.fx.filter((x) => x !== fxId) : [...c.face.fx, fxId],
                              },
                            }))
                          }
                          className={`rounded-xs border px-2 py-1 text-[11px] font-semibold ${on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground"}`}
                        >
                          {FACE_FX_LABELS_2D[fxId]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2.5 border-t border-border pt-2.5">
                  <ColorRgbControl
                    label="Eye Color (RGB)"
                    value={activeChar.face.eyeColor}
                    onChange={(hex) =>
                      updateActiveChar((c) => ({ ...c, face: { ...c.face, eyeColor: hex } }))
                    }
                  />
                  <ColorRgbControl
                    label="Eyebrow Color (RGB)"
                    value={activeChar.face.browColor}
                    onChange={(hex) =>
                      updateActiveChar((c) => ({ ...c, face: { ...c.face, browColor: hex } }))
                    }
                  />
                  <ColorRgbControl
                    label="Mouth / Tongue Accent"
                    value={activeChar.face.mouthColor}
                    onChange={(hex) =>
                      updateActiveChar((c) => ({ ...c, face: { ...c.face, mouthColor: hex } }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-border pt-2.5">
                  <label className="space-y-1">
                    <span className="flex justify-between text-[11px]">
                      <span>Face Scale</span>
                      <span className="font-mono">{activeChar.face.scale.toFixed(2)}x</span>
                    </span>
                    <input
                      type="range"
                      min={0.8}
                      max={1.25}
                      step={0.02}
                      value={activeChar.face.scale}
                      onChange={(e) =>
                        updateActiveChar((c) => ({
                          ...c,
                          face: { ...c.face, scale: +e.target.value },
                        }))
                      }
                      className="w-full accent-primary"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="flex justify-between text-[11px]">
                      <span>Vertical Offset</span>
                      <span className="font-mono">{activeChar.face.offsetY}px</span>
                    </span>
                    <input
                      type="range"
                      min={-14}
                      max={14}
                      step={1}
                      value={activeChar.face.offsetY}
                      onChange={(e) =>
                        updateActiveChar((c) => ({
                          ...c,
                          face: { ...c.face, offsetY: +e.target.value },
                        }))
                      }
                      className="w-full accent-primary"
                    />
                  </label>
                </div>
              </>
            )}

            {inspectorTab === "hair" && (
              <>
                <div className="space-y-1.5">
                  <span className="font-bold block">Anime Hairstyle (8-Angle Aware)</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(HAIR_STYLE_LABELS_2D) as HairStyle2D[]).map((styleId) => (
                      <button
                        key={styleId}
                        type="button"
                        onClick={() =>
                          updateActiveChar((c) => ({
                            ...c,
                            hair: { ...c.hair, style: styleId },
                          }))
                        }
                        className={`rounded-xs border px-2 py-2 text-left font-semibold ${activeChar.hair.style === styleId ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground"}`}
                      >
                        {HAIR_STYLE_LABELS_2D[styleId]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <ColorRgbControl
                    label="Hair Color (Full RGB)"
                    value={activeChar.hair.color}
                    swatches={[
                      "#1e2433",
                      "#4b2c20",
                      "#9a3412",
                      "#eab308",
                      "#e2e8f0",
                      "#dc2626",
                      "#2563eb",
                      "#7e22ce",
                      "#0d9488",
                      "#db2777",
                    ]}
                    onChange={(hex) =>
                      updateActiveChar((c) => ({ ...c, hair: { ...c.hair, color: hex } }))
                    }
                  />
                </div>
              </>
            )}

            {inspectorTab === "clothes" && (
              <>
                <div className="space-y-2">
                  <span className="font-bold block">Tops &amp; Outerwear (8 Angles)</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(TOP_STYLE_LABELS_2D) as TopStyle2D[]).map((topId) => (
                      <button
                        key={topId}
                        type="button"
                        onClick={() =>
                          updateActiveChar((c) => ({
                            ...c,
                            clothes: { ...c.clothes, top: topId },
                          }))
                        }
                        className={`rounded-xs border px-2 py-1.5 text-left font-semibold ${activeChar.clothes.top === topId ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground"}`}
                      >
                        {TOP_STYLE_LABELS_2D[topId]}
                      </button>
                    ))}
                  </div>
                  {activeChar.clothes.top !== "none" && (
                    <div className="space-y-2 rounded-sm border border-border bg-background p-2.5">
                      <ColorRgbControl
                        label="Top Color (RGB)"
                        value={activeChar.clothes.topColor}
                        onChange={(hex) =>
                          updateActiveChar((c) => ({
                            ...c,
                            clothes: { ...c.clothes, topColor: hex },
                          }))
                        }
                      />
                      <ColorRgbControl
                        label="Top Accent / Trim"
                        value={activeChar.clothes.topAccentColor}
                        onChange={(hex) =>
                          updateActiveChar((c) => ({
                            ...c,
                            clothes: { ...c.clothes, topAccentColor: hex },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-border pt-3">
                  <span className="font-bold block">Bottoms</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(BOTTOM_STYLE_LABELS_2D) as BottomStyle2D[]).map((botId) => (
                      <button
                        key={botId}
                        type="button"
                        onClick={() =>
                          updateActiveChar((c) => ({
                            ...c,
                            clothes: { ...c.clothes, bottom: botId },
                          }))
                        }
                        className={`rounded-xs border px-2 py-1.5 text-left font-semibold ${activeChar.clothes.bottom === botId ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground"}`}
                      >
                        {BOTTOM_STYLE_LABELS_2D[botId]}
                      </button>
                    ))}
                  </div>
                  {activeChar.clothes.bottom !== "none" && (
                    <div className="space-y-2 rounded-sm border border-border bg-background p-2.5">
                      <ColorRgbControl
                        label="Bottoms Color (RGB)"
                        value={activeChar.clothes.bottomColor}
                        onChange={(hex) =>
                          updateActiveChar((c) => ({
                            ...c,
                            clothes: { ...c.clothes, bottomColor: hex },
                          }))
                        }
                      />
                      <ColorRgbControl
                        label="Trim / Cuff Accent"
                        value={activeChar.clothes.bottomAccentColor}
                        onChange={(hex) =>
                          updateActiveChar((c) => ({
                            ...c,
                            clothes: { ...c.clothes, bottomAccentColor: hex },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-border pt-3">
                  <span className="font-bold block">Footwear</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(FOOTWEAR_STYLE_LABELS_2D) as FootwearStyle2D[]).map((fwId) => (
                      <button
                        key={fwId}
                        type="button"
                        onClick={() =>
                          updateActiveChar((c) => ({
                            ...c,
                            clothes: { ...c.clothes, footwear: fwId },
                          }))
                        }
                        className={`rounded-xs border px-2 py-1.5 font-semibold ${activeChar.clothes.footwear === fwId ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground"}`}
                      >
                        {FOOTWEAR_STYLE_LABELS_2D[fwId]}
                      </button>
                    ))}
                  </div>
                  {activeChar.clothes.footwear !== "none" && (
                    <div className="space-y-2 rounded-sm border border-border bg-background p-2.5">
                      <ColorRgbControl
                        label="Shoe Color (RGB)"
                        value={activeChar.clothes.footwearColor}
                        onChange={(hex) =>
                          updateActiveChar((c) => ({
                            ...c,
                            clothes: { ...c.clothes, footwearColor: hex },
                          }))
                        }
                      />
                      <ColorRgbControl
                        label="Sole / Trim Accent"
                        value={activeChar.clothes.footwearAccentColor}
                        onChange={(hex) =>
                          updateActiveChar((c) => ({
                            ...c,
                            clothes: { ...c.clothes, footwearAccentColor: hex },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {inspectorTab === "body" && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Skin Tone (Color Mode)</span>
                    <input
                      type="color"
                      aria-label="Custom RGB Skin Tone"
                      value={activeChar.skinTone ?? "#f6cbb1"}
                      onChange={(e) =>
                        updateActiveChar((c) => ({ ...c, skinTone: e.target.value }))
                      }
                      className="h-6 w-8 cursor-pointer rounded-xs border border-foreground/40 bg-transparent p-0"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SKIN_PRESETS_2D.map((preset) => {
                      const active = (activeChar.skinTone ?? null) === preset.color;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            updateActiveChar((c) => ({ ...c, skinTone: preset.color }))
                          }
                          className={`flex flex-col items-center gap-1 rounded-xs border p-1.5 text-[10px] font-semibold ${active ? "border-foreground bg-primary/15 ring-1 ring-primary" : "border-border bg-background hover:border-foreground"}`}
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-foreground/50"
                            style={{ backgroundColor: preset.color ?? "#f7cdb1" }}
                          />
                          <span className="truncate w-full text-center">{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xs border border-border bg-muted/25 px-2.5 py-1.5 text-[11px]">
                  <div className="min-w-0">
                    <span className="text-muted-foreground block text-[10px]">Active Head Shape</span>
                    <span className="font-bold truncate block">{activeHeadPack.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectorTab("face")}
                    className="shrink-0 rounded-xs border border-foreground bg-background px-2 py-1 text-[10px] font-bold hover:border-primary"
                  >
                    Change Head Shape →
                  </button>
                </div>

                <div className="space-y-1.5 border-t border-border pt-3">
                  <span className="font-bold block">Active 8-Angle Base Body</span>
                  <div className="space-y-1">
                    {allModels.map((m) => {
                      const sel = activeBaseModel.id === m.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center justify-between gap-2 rounded-xs border px-2 py-1.5 ${sel ? "border-foreground bg-primary/10 font-bold" : "border-border bg-background"}`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveChar((c) => ({ ...c, baseModelId: m.id }))
                            }
                            className="flex-1 text-left truncate"
                          >
                            {m.name} {m.builtIn ? "(Built-In)" : ""}
                          </button>
                          {!m.builtIn && (
                            <button
                              type="button"
                              onClick={async () => {
                                const next = await deleteUploadedBaseModel2D(m);
                                setCustomModels(next);
                                if (activeChar.baseModelId === m.id) {
                                  updateActiveChar((c) => ({
                                    ...c,
                                    baseModelId: BUILTIN_MODEL_MALE_ATHLETIC_V1.id,
                                  }));
                                }
                              }}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded-xs"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 border-t border-border pt-3 rounded-sm bg-muted/20 p-2.5">
                  <span className="font-bold block">Upload New 1×8 or 1×5 Base Body</span>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setModelUploadMode("sheet-8")}
                      className={`rounded-xs border py-1 text-[11px] font-semibold ${modelUploadMode === "sheet-8" ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                    >
                      1×8 Full Turnaround
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelUploadMode("sheet-5")}
                      className={`rounded-xs border py-1 text-[11px] font-semibold ${modelUploadMode === "sheet-5" ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                    >
                      1×5 + Auto-Mirror
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Base model name (e.g. Hero Female)"
                    value={modelUploadName}
                    onChange={(e) => setModelUploadName(e.target.value)}
                    className="w-full rounded-xs border border-input bg-background px-2 py-1"
                  />
                  <label className="flex items-center gap-1.5 text-[11px]">
                    <input
                      type="checkbox"
                      checked={modelRemoveBg}
                      onChange={(e) => setModelRemoveBg(e.target.checked)}
                      className="accent-primary"
                    />
                    <span>Auto-remove white paper background</span>
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xs border-2 border-dashed border-foreground/50 bg-background py-2 font-semibold hover:border-primary">
                    <Upload className="h-3.5 w-3.5 text-primary" />
                    <span>{modelUploadBusy ? "Slicing Sheet…" : "Choose Turnaround Image"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      data-testid="char2d-upload-model-input"
                      className="hidden"
                      onChange={(e) => {
                        void handleBaseModelFilePick(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {modelUploadErr && <p className="text-[11px] text-destructive">{modelUploadErr}</p>}

                  {modelPreview && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-4 gap-1 rounded-xs border border-border bg-white p-1">
                        {ANGLES_2D.map((ang) => (
                          <div key={ang} className="text-center">
                            <img
                              src={modelPreview.frames[ang]}
                              alt={`${ang}° preview`}
                              className="mx-auto h-16 object-contain"
                            />
                            <span className="font-mono text-[9px] text-slate-600">{ang}°</span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={modelUploadBusy}
                        onClick={handleCommitBaseModel}
                        className="w-full rounded-xs border-2 border-foreground bg-primary py-1.5 font-bold text-primary-foreground"
                      >
                        Save &amp; Equip Base Model
                      </button>
                    </div>
                  )}
                </div>

                {/* Per-Angle Anchor Calibration */}
                <details className="border-t border-border pt-2">
                  <summary className="cursor-pointer font-bold flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Calibrate Current Angle ({activeChar.angle}°) Anchors</span>
                  </summary>
                  <div className="mt-2 space-y-2 rounded-xs border border-border bg-background p-2">
                    <label className="block text-[11px]">
                      <span className="flex justify-between">
                        <span>Head X</span>
                        <span className="font-mono">{Math.round(currentAnchors.headCx)}</span>
                      </span>
                      <input
                        type="range"
                        min={160}
                        max={320}
                        value={currentAnchors.headCx}
                        onChange={(e) =>
                          updateActiveChar((c) => ({
                            ...c,
                            anchorOverrides: {
                              ...c.anchorOverrides,
                              [c.angle]: {
                                ...(c.anchorOverrides?.[c.angle] ?? {}),
                                headCx: +e.target.value,
                              },
                            },
                          }))
                        }
                        className="w-full accent-primary"
                      />
                    </label>
                    <label className="block text-[11px]">
                      <span className="flex justify-between">
                        <span>Shoulder L / R</span>
                        <span className="font-mono">
                          {Math.round(currentAnchors.shoulderL)}..{Math.round(currentAnchors.shoulderR)}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={-25}
                        max={25}
                        value={Math.round(
                          (currentAnchors.shoulderR - currentAnchors.shoulderL) / 2 -
                            (activeBaseModel.anchors[activeChar.angle].shoulderR -
                              activeBaseModel.anchors[activeChar.angle].shoulderL) /
                              2,
                        )}
                        onChange={(e) => {
                          const d = +e.target.value;
                          const orig = activeBaseModel.anchors[activeChar.angle];
                          updateActiveChar((c) => ({
                            ...c,
                            anchorOverrides: {
                              ...c.anchorOverrides,
                              [c.angle]: {
                                ...(c.anchorOverrides?.[c.angle] ?? {}),
                                shoulderL: orig.shoulderL - d,
                                shoulderR: orig.shoulderR + d,
                                torsoL: orig.torsoL - d,
                                torsoR: orig.torsoR + d,
                              },
                            },
                          }));
                        }}
                        className="w-full accent-primary"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveChar((c) => {
                          const next = { ...(c.anchorOverrides ?? {}) };
                          delete next[c.angle];
                          return { ...c, anchorOverrides: next };
                        })
                      }
                      className="w-full rounded-xs border border-border py-1 text-[11px] font-semibold hover:border-foreground"
                    >
                      Reset {activeChar.angle}° Anchors
                    </button>
                  </div>
                </details>
              </>
            )}

            {inspectorTab === "parts" && (
              <>
                <div className="space-y-2 rounded-sm border border-border bg-muted/20 p-2.5">
                  <span className="font-bold block">Upload Custom Part / Clothing PNG</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: "single", label: "Single Fit" },
                        { id: "sheet-8", label: "1×8 Sheet" },
                        { id: "sheet-5", label: "1×5 Mirror" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPartUploadMode(m.id)}
                        className={`rounded-xs border py-1 text-[10px] font-bold ${partUploadMode === m.id ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      aria-label="Custom part category"
                      value={partUploadSlot}
                      onChange={(e) => setPartUploadSlot(e.target.value as CustomPartAsset2D["slot"])}
                      className="rounded-xs border border-input bg-background px-1.5 py-1"
                    >
                      <option value="accessory">Accessory / Prop</option>
                      <option value="top">Top / Jacket</option>
                      <option value="bottom">Pants / Skirt</option>
                      <option value="hair">Hair / Hat</option>
                      <option value="face">Face / Glasses / Scar</option>
                      <option value="footwear">Footwear</option>
                    </select>
                    <select
                      aria-label="Layer order"
                      value={partUploadLayer}
                      onChange={(e) => setPartUploadLayer(e.target.value as "front" | "behind")}
                      className="rounded-xs border border-input bg-background px-1.5 py-1"
                    >
                      <option value="front">Front Layer</option>
                      <option value="behind">Behind Body</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Part name (e.g. Scarf, Glasses)"
                    value={partUploadName}
                    onChange={(e) => setPartUploadName(e.target.value)}
                    className="w-full rounded-xs border border-input bg-background px-2 py-1"
                  />
                  <label className="flex items-center gap-1.5 text-[11px]">
                    <input
                      type="checkbox"
                      checked={partRemoveBg}
                      onChange={(e) => setPartRemoveBg(e.target.checked)}
                      className="accent-primary"
                    />
                    <span>Remove white background automatically</span>
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xs border-2 border-dashed border-foreground/50 bg-background py-2 font-semibold hover:border-primary">
                    <Upload className="h-3.5 w-3.5 text-primary" />
                    <span>{partUploadBusy ? "Processing…" : "Upload Image & Add Layer"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      data-testid="char2d-upload-part-input"
                      className="hidden"
                      onChange={(e) => {
                        void handleCustomPartFilePick(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {partUploadErr && <p className="text-[11px] text-destructive">{partUploadErr}</p>}
                </div>

                {/* Active Custom Layers on this Character */}
                <div className="space-y-2 border-t border-border pt-2">
                  <span className="font-bold block">
                    Equipped Custom Layers ({activeChar.customLayers.length})
                  </span>
                  {activeChar.customLayers.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      No custom PNG layers equipped yet. Upload a part above or pick from your saved parts library below.
                    </p>
                  ) : (
                    activeChar.customLayers.map((layer) => {
                      const tr = {
                        ...DEFAULT_CUSTOM_TRANSFORM_2D,
                        ...layer.defaultTransform,
                        ...(layer.perAngle[activeChar.angle] ?? layer.perAngle[0] ?? {}),
                      };
                      const expanded = selectedLayerId === layer.id;
                      return (
                        <div
                          key={layer.id}
                          className="rounded-xs border border-border bg-background p-2 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedLayerId(expanded ? null : layer.id)}
                              className="flex-1 text-left font-bold truncate"
                            >
                              {layer.name} ({layer.zLayer})
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateLayerTransform(layer.id, { visible: !tr.visible })
                              }
                              className={`rounded-xs border px-1.5 py-0.5 text-[10px] font-semibold ${tr.visible ? "border-foreground bg-accent" : "border-border text-muted-foreground"}`}
                            >
                              {tr.visible ? "Shown" : "Hidden"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateActiveChar((c) => ({
                                  ...c,
                                  customLayers: c.customLayers.map((item) =>
                                    item.id === layer.id
                                      ? {
                                          ...item,
                                          zLayer: item.zLayer === "front" ? "behind" : "front",
                                        }
                                      : item,
                                  ),
                                }))
                              }
                              title="Toggle Front / Behind body"
                              className="rounded-xs border border-border p-1 hover:border-foreground"
                            >
                              <Palette className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateActiveChar((c) => ({
                                  ...c,
                                  customLayers: c.customLayers.filter((item) => item.id !== layer.id),
                                }))
                              }
                              className="rounded-xs p-1 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="space-y-1.5 border-t border-border/60 pt-1.5">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <label className="flex items-center gap-1.5 font-semibold">
                                <input
                                  type="checkbox"
                                  checked={layer.tintEnabled}
                                  onChange={(e) =>
                                    updateActiveChar((c) => ({
                                      ...c,
                                      customLayers: c.customLayers.map((item) =>
                                        item.id === layer.id
                                          ? { ...item, tintEnabled: e.target.checked }
                                          : item,
                                      ),
                                    }))
                                  }
                                  className="accent-primary"
                                />
                                <span>RGB Color Tint</span>
                              </label>
                              <input
                                type="color"
                                value={layer.tintColor}
                                disabled={!layer.tintEnabled}
                                onChange={(e) =>
                                  updateActiveChar((c) => ({
                                    ...c,
                                    customLayers: c.customLayers.map((item) =>
                                      item.id === layer.id
                                        ? { ...item, tintColor: e.target.value, tintEnabled: true }
                                        : item,
                                    ),
                                  }))
                                }
                                className="h-5 w-7 cursor-pointer rounded-xs border border-border"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                              <label>
                                <span className="flex justify-between">
                                  <span>X</span>
                                  <span className="font-mono">{Math.round(tr.x)}</span>
                                </span>
                                <input
                                  type="range"
                                  min={-220}
                                  max={220}
                                  value={tr.x}
                                  onChange={(e) =>
                                    updateLayerTransform(layer.id, { x: +e.target.value })
                                  }
                                  className="w-full accent-primary"
                                />
                              </label>
                              <label>
                                <span className="flex justify-between">
                                  <span>Y</span>
                                  <span className="font-mono">{Math.round(tr.y)}</span>
                                </span>
                                <input
                                  type="range"
                                  min={-420}
                                  max={420}
                                  value={tr.y}
                                  onChange={(e) =>
                                    updateLayerTransform(layer.id, { y: +e.target.value })
                                  }
                                  className="w-full accent-primary"
                                />
                              </label>
                              <label>
                                <span className="flex justify-between">
                                  <span>Scale X</span>
                                  <span className="font-mono">{tr.scaleX.toFixed(2)}</span>
                                </span>
                                <input
                                  type="range"
                                  min={0.2}
                                  max={2}
                                  step={0.02}
                                  value={tr.scaleX}
                                  onChange={(e) =>
                                    updateLayerTransform(layer.id, { scaleX: +e.target.value })
                                  }
                                  className="w-full accent-primary"
                                />
                              </label>
                              <label>
                                <span className="flex justify-between">
                                  <span>Scale Y</span>
                                  <span className="font-mono">{tr.scaleY.toFixed(2)}</span>
                                </span>
                                <input
                                  type="range"
                                  min={0.2}
                                  max={2}
                                  step={0.02}
                                  value={tr.scaleY}
                                  onChange={(e) =>
                                    updateLayerTransform(layer.id, { scaleY: +e.target.value })
                                  }
                                  className="w-full accent-primary"
                                />
                              </label>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  updateLayerTransform(layer.id, { flipX: !tr.flipX })
                                }
                                className="inline-flex items-center gap-1 rounded-xs border border-border px-2 py-0.5 text-[10px] font-semibold hover:border-foreground"
                              >
                                <FlipHorizontal className="h-3 w-3" />
                                <span>Flip H</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => updateLayerTransform(layer.id, tr, true)}
                                className="flex-1 rounded-xs border border-border px-2 py-0.5 text-[10px] font-semibold hover:border-foreground"
                              >
                                Apply {activeChar.angle}° Fit to All Angles
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reusable Saved Parts Library */}
                {customParts.length > 0 && (
                  <div className="space-y-1.5 border-t border-border pt-2">
                    <span className="font-bold block">Saved Parts Library ({customParts.length})</span>
                    <div className="space-y-1">
                      {customParts.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center justify-between gap-2 rounded-xs border border-border bg-background px-2 py-1"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{asset.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {asset.slot} · {asset.kind}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEquipExistingPart(asset)}
                              className="rounded-xs border border-foreground bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"
                            >
                              Equip
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const next = await deleteUploadedCustomPart2D(asset);
                                setCustomParts(next);
                              }}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded-xs"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

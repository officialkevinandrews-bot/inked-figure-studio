import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Anchor,
  ArrowDownToLine,
  Camera,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal,
  Focus,
  Image as ImageIcon,
  Layers,
  Move,
  Palette,
  PenTool,
  Plus,
  Redo2,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { FeedbackButton } from "@/components/feedback/FeedbackProvider";
import type { PageLayout } from "@/lib/manga-layout";
import {
  ANGLES_2D,
  EXPRESSION_PRESETS_2D,
  FACE_FX_LABELS_2D,
  type Angle2D,
  type Character2D,
  type Expression2DId,
  type FaceFx2D,
} from "@/lib/character2d-types";
import {
  ensureCharacters2DInitialized,
  loadCustomBaseModels2D,
  loadCustomHeads2D,
  loadCustomParts2D,
} from "@/lib/character2d-store";
import { ensureScenes2DInitialized, loadCustomSceneObjects2D } from "@/lib/scene2d-store";
import type { Scene2D, SceneDepthLayer } from "@/lib/scene2d-types";
import {
  BUILTIN_POSE_PRESETS_2D,
  BUILTIN_STAGE_COMPOSITIONS_2D,
  DEFAULT_POSE_2D,
  DEFAULT_STAGE_FX_2D,
  JOINT_IDS_2D,
  JOINT_LABELS_2D,
  STAGE2D_H,
  STAGE2D_W,
  clonePose2D,
  createDefaultStage2D,
  mirrorPose2D,
  type JointId2D,
  type Pose2DCategory,
  type Pose2DState,
  type SourceStage2DMetadata,
  type Stage2D,
  type Stage2DActor,
  type Stage2DCompositionPreset,
  type Stage2DFxOverlay,
} from "@/lib/pose2d-types";
import {
  cameraCanvasToStageWorldPoint,
  computeActorLocalBounds2D,
  computeForwardKinematics2D,
  computeFrameActorCamera2D,
  computeSnapFeetToFloorOffsetY,
  degToRad,
  solvePinnedFeetHipDrag2D,
  solveSingleBoneRotationDeg,
  solveTwoBoneIK2D,
  stageToCharacterPoint,
  type SkeletonWorld2D,
} from "@/lib/pose2d-rig";
import { resolveBaseModel2D, resolveCharacterHeadPack2D } from "@/lib/character2d-store";
import { resolveEffectiveAnchors } from "@/lib/character2d-draw";
import {
  exportActor2DPng,
  exportStage2DPng,
  getActorOverlayHandles,
  preloadStage2DImages,
  renderStage2DSync,
  type RigHandleKind2D,
} from "@/lib/pose2d-draw";
import {
  ensureStages2DInitialized,
  loadCustomPoses2D,
  removeCustomPose2D,
  removeStage2D,
  upsertCustomPose2D,
  upsertStage2D,
} from "@/lib/pose2d-store";

export interface Pose2DStudioProps {
  panels: PageLayout["panels"];
  elementCount: number;
  editingTarget?: { elementId: string; sourceStage2d: SourceStage2DMetadata } | null;
  onCancelEditingTarget?: () => void;
  onGoTab: (tab: "panels" | "create" | "scenes" | "pose") => void;
  onSwitchTo3DLegacy: () => void;
  onStampStageToPanel: (
    panelId: string,
    dataUrl: string,
    sourceStage2d: SourceStage2DMetadata,
  ) => void;
  onStampActorToPanel: (
    panelId: string,
    dataUrl: string,
    sourceStage2d: SourceStage2DMetadata,
  ) => void;
  onUpdatePanelElement: (
    elementId: string,
    dataUrl: string,
    sourceStage2d: SourceStage2DMetadata,
  ) => void;
}

type InspectorTab = "cast" | "poses" | "joints" | "scene" | "camera";

const MAX_UNDO = 40;

export function Pose2DStudio({
  panels,
  elementCount,
  editingTarget,
  onCancelEditingTarget,
  onGoTab,
  onSwitchTo3DLegacy,
  onStampStageToPanel,
  onStampActorToPanel,
  onUpdatePanelElement,
}: Pose2DStudioProps) {
  const [characters, setCharacters] = useState<Character2D[]>(() =>
    ensureCharacters2DInitialized(),
  );
  const [scenes, setScenes] = useState<Scene2D[]>(() => ensureScenes2DInitialized());
  const [customModels, setCustomModels] = useState(() => loadCustomBaseModels2D());
  const [customParts, setCustomParts] = useState(() => loadCustomParts2D());
  const [customHeads, setCustomHeads] = useState(() => loadCustomHeads2D());
  const [customSceneObjects, setCustomSceneObjects] = useState(() => loadCustomSceneObjects2D());

  const [stages, setStages] = useState<Stage2D[]>(() => {
    const ch = characters[0];
    const sc = scenes[0];
    return ensureStages2DInitialized(ch?.id ?? "", ch?.name ?? "Hero #1", sc?.id ?? null);
  });
  const [activeId, setActiveId] = useState<string>(() => stages[0]?.id ?? "");
  const [selectedActorId, setSelectedActorId] = useState<string | null>(
    () => stages[0]?.actors[0]?.id ?? null,
  );
  const [customPoses, setCustomPoses] = useState(() => loadCustomPoses2D());

  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("poses");
  const [poseCategory, setPoseCategory] = useState<"all" | Pose2DCategory>("all");
  const [showRig, setShowRig] = useState(true);
  const [controlMode, setControlMode] = useState<"ik" | "fk">("ik");
  const [pinFeet, setPinFeet] = useState(false);
  const [spacePanHeld, setSpacePanHeld] = useState(false);
  const [targetPanelId, setTargetPanelId] = useState<string>(panels[0]?.id ?? "");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [customPoseName, setCustomPoseName] = useState("");
  const [undoStack, setUndoStack] = useState<Stage2D[]>([]);
  const [redoStack, setRedoStack] = useState<Stage2D[]>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [activeHandleId, setActiveHandleId] = useState<string | null>(null);

  const [preloadedAssets, setPreloadedAssets] = useState<{
    sceneImages: Map<string, HTMLImageElement>;
    charImages: Map<string, HTMLImageElement>;
  }>({ sceneImages: new Map(), charImages: new Map() });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const skeletonsRef = useRef<Map<string, SkeletonWorld2D>>(new Map());
  const dragRef = useRef<{
    kind: RigHandleKind2D | { type: "camera_pan" } | { type: "actor_move" };
    actorId: string;
    startCanvasPt: { x: number; y: number };
    startWorldPt: { x: number; y: number };
    startActorX: number;
    startActorY: number;
    startScale: number;
    startPose?: Pose2DState;
    startPanX: number;
    startPanY: number;
    pushedUndo: boolean;
  } | null>(null);

  // Refresh saved characters, scenes & custom assets when tab mounts or window regains focus
  useEffect(() => {
    const refresh = () => {
      setCharacters(ensureCharacters2DInitialized());
      setScenes(ensureScenes2DInitialized());
      setCustomModels(loadCustomBaseModels2D());
      setCustomParts(loadCustomParts2D());
      setCustomHeads(loadCustomHeads2D());
      setCustomSceneObjects(loadCustomSceneObjects2D());
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    if (panels.length > 0 && !panels.some((p) => p.id === targetPanelId)) {
      setTargetPanelId(panels[0].id);
    }
  }, [panels, targetPanelId]);

  const activeStage = useMemo(
    () => stages.find((s) => s.id === activeId) ?? stages[0],
    [stages, activeId],
  );

  // When PanelStudio opens a stamped stage for re-posing, load or hydrate its snapshot cleanly
  useEffect(() => {
    const src = editingTarget?.sourceStage2d;
    if (!src) return;
    if (src.snapshot) {
      setStages((prev) => upsertStage2D(prev, src.snapshot!));
      setActiveId(src.snapshot.id);
      setSelectedActorId(src.actorId ?? src.snapshot.actors[0]?.id ?? null);
    } else {
      setActiveId((cur) => src.stageId || cur);
    }
  }, [editingTarget]);

  const activeScene = useMemo(() => {
    if (!activeStage?.sceneId) return null;
    return scenes.find((sc) => sc.id === activeStage.sceneId) ?? null;
  }, [activeStage?.sceneId, scenes]);

  const selectedActor = useMemo(() => {
    if (!activeStage) return null;
    return (
      activeStage.actors.find((a) => a.id === selectedActorId) ?? activeStage.actors[0] ?? null
    );
  }, [activeStage, selectedActorId]);

  const commitStage = useCallback(
    (updater: (cur: Stage2D) => Stage2D, pushUndo = true) => {
      if (!activeStage) return;
      if (pushUndo) {
        const snapshot = structuredClone(activeStage);
        setUndoStack((u) => [...u.slice(-(MAX_UNDO - 1)), snapshot]);
        setRedoStack([]);
      }
      const nextStage = updater(activeStage);
      setStages((prev) => upsertStage2D(prev, nextStage));
    },
    [activeStage],
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !activeStage) return;
    const prev = undoStack[undoStack.length - 1]!;
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, structuredClone(activeStage)]);
    setStages((s) => upsertStage2D(s, prev));
  }, [undoStack, activeStage]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !activeStage) return;
    const next = redoStack[redoStack.length - 1]!;
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, structuredClone(activeStage)]);
    setStages((s) => upsertStage2D(s, next));
  }, [redoStack, activeStage]);

  const pushUndoSnapshot = useCallback(() => {
    if (!activeStage) return;
    const snapshot = structuredClone(activeStage);
    setUndoStack((u) => [...u.slice(-(MAX_UNDO - 1)), snapshot]);
    setRedoStack([]);
  }, [activeStage]);

  const handleSnapFeetToFloor = useCallback(() => {
    if (!activeStage || !selectedActor) return;
    const ch = characters.find((c) => c.id === selectedActor.characterId) ?? characters[0];
    if (!ch) return;
    const model = resolveBaseModel2D(ch.baseModelId, customModels);
    const head = resolveCharacterHeadPack2D(ch.headShapeId, customHeads);
    const anchors = resolveEffectiveAnchors(
      model,
      { ...ch, angle: selectedActor.angle },
      selectedActor.angle,
      head,
    );
    const nextRootY = computeSnapFeetToFloorOffsetY(anchors, selectedActor.pose);
    commitStage(
      (s) => ({
        ...s,
        actors: s.actors.map((a) =>
          a.id === selectedActor.id ? { ...a, pose: { ...a.pose, rootOffsetY: nextRootY } } : a,
        ),
      }),
      true,
    );
  }, [activeStage, selectedActor, characters, customModels, customHeads, commitStage]);

  const handleFrameSelectedActor = useCallback(() => {
    if (!activeStage || !selectedActor) return;
    const sk = skeletonsRef.current.get(selectedActor.id);
    if (!sk) return;
    const nextCam = computeFrameActorCamera2D(selectedActor, sk);
    commitStage((s) => ({ ...s, camera: nextCam }), true);
  }, [activeStage, selectedActor, commitStage]);

  const handleApplyComposition = useCallback(
    (comp: Stage2DCompositionPreset) => {
      if (!activeStage) return;
      const charA = characters[0];
      if (!charA) return;
      const charB = characters[1] ?? characters[0];
      const now = Date.now();
      const buildActor = (slotIdx: 0 | 1): Stage2DActor => {
        const slot = comp.slots[slotIdx];
        const ch = slotIdx === 0 ? charA : charB;
        const preset =
          BUILTIN_POSE_PRESETS_2D.find((p) => p.id === slot.poseId)?.pose ?? DEFAULT_POSE_2D;
        return {
          id: `actor2d-${now}-${slotIdx + 1}`,
          characterId: ch.id,
          name: slotIdx === 1 && charB.id === charA.id ? `${ch.name} (Rival)` : ch.name,
          x: slot.x,
          y: slot.y,
          scale: slot.scale,
          angle: slot.angle,
          flipX: slot.flipX,
          depth: slot.depth,
          shadow: true,
          visible: true,
          expressionOverride: slot.expression,
          fxOverride: slot.fx ? [...slot.fx] : undefined,
          pose: clonePose2D(preset),
        };
      };
      const nextActors: Stage2DActor[] = [buildActor(0), buildActor(1)];
      commitStage(
        (s) => ({
          ...s,
          actors: nextActors,
          camera: { ...comp.camera },
          fx: { ...comp.stageFx },
        }),
        true,
      );
      setSelectedActorId(nextActors[0]!.id);
    },
    [activeStage, characters, commitStage],
  );

  const handleDuplicateActor = useCallback(
    (actor: Stage2DActor) => {
      if (!activeStage) return;
      const copy: Stage2DActor = {
        ...structuredClone(actor),
        id: `actor2d-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: `${actor.name} Copy`,
        x: Math.min(STAGE2D_W - 100, actor.x + 110),
      };
      commitStage((s) => ({ ...s, actors: [...s.actors, copy] }), true);
      setSelectedActorId(copy.id);
    },
    [activeStage, commitStage],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setSpacePanHeld(true);
        return;
      }
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && k === "y") {
        e.preventDefault();
        handleRedo();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (k === "r") {
          setShowRig((v) => !v);
        } else if (k === "i") {
          setControlMode("ik");
        } else if (k === "k") {
          setControlMode("fk");
        } else if (k === "h" && selectedActor) {
          commitStage(
            (s) => ({
              ...s,
              actors: s.actors.map((a) =>
                a.id === selectedActor.id ? { ...a, flipX: !a.flipX } : a,
              ),
            }),
            true,
          );
        } else if (k === "g") {
          handleSnapFeetToFloor();
        } else if (k === "f") {
          handleFrameSelectedActor();
        } else if ((e.key === "Delete" || e.key === "Backspace") && selectedActor) {
          e.preventDefault();
          commitStage(
            (s) => ({ ...s, actors: s.actors.filter((a) => a.id !== selectedActor.id) }),
            true,
          );
          setSelectedActorId(null);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePanHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    handleUndo,
    handleRedo,
    handleSnapFeetToFloor,
    handleFrameSelectedActor,
    selectedActor,
    commitStage,
  ]);

  // Preload all scene custom sprites & staged character sprites ONLY when asset dependencies actually change
  // (NEVER on every pointer-move pose drag frame!).
  const activeStageRef = useRef(activeStage);
  activeStageRef.current = activeStage;
  const activeSceneRef = useRef(activeScene);
  activeSceneRef.current = activeScene;

  const stageId = activeStage?.id ?? "";
  const stageRenderMode = activeStage?.renderMode ?? "color";
  const stageSceneId = activeStage?.sceneId ?? "none";
  const stageActors = activeStage?.actors;
  const activeSceneUpdatedAt = activeScene?.updatedAt ?? 0;

  const assetKey = useMemo(() => {
    if (!stageId || !stageActors) return "";
    const charSigs = stageActors
      .map((a) => {
        const ch = characters.find((c) => c.id === a.characterId) ?? characters[0];
        return `${a.characterId}:${a.angle}:${ch?.updatedAt ?? 0}:${ch?.headShapeId ?? ""}:${ch?.hair.style ?? ""}:${ch?.clothes.top ?? ""}:${ch?.clothes.bottom ?? ""}:${ch?.clothes.footwear ?? ""}`;
      })
      .join(",");
    return [
      stageId,
      stageRenderMode,
      stageSceneId,
      activeSceneUpdatedAt,
      charSigs,
      customModels.length,
      customParts.length,
      customHeads.length,
      customSceneObjects.length,
    ].join("|");
  }, [
    stageId,
    stageRenderMode,
    stageSceneId,
    stageActors,
    activeSceneUpdatedAt,
    characters,
    customModels.length,
    customParts.length,
    customHeads.length,
    customSceneObjects.length,
  ]);

  useEffect(() => {
    const st = activeStageRef.current;
    if (!st) return;
    let alive = true;
    void preloadStage2DImages(
      st,
      activeSceneRef.current,
      customSceneObjects,
      characters,
      customModels,
      customParts,
      customHeads,
    ).then((loaded) => {
      if (alive) setPreloadedAssets(loaded);
    });
    return () => {
      alive = false;
    };
  }, [assetKey, characters, customModels, customParts, customHeads, customSceneObjects]);

  // Non-passive mouse-wheel zoom directly on the stage viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      const st = activeStageRef.current;
      if (!st) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      const nextZoom = Math.max(
        0.55,
        Math.min(2.6, Math.round(((st.camera.zoom || 1) + delta) * 20) / 20),
      );
      if (nextZoom === st.camera.zoom) return;
      setStages((prev) => upsertStage2D(prev, { ...st, camera: { ...st.camera, zoom: nextZoom } }));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // Paint stage canvas whenever state or preloaded images change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeStage) return;
    if (canvas.width !== STAGE2D_W || canvas.height !== STAGE2D_H) {
      canvas.width = STAGE2D_W;
      canvas.height = STAGE2D_H;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    skeletonsRef.current = renderStage2DSync(
      ctx,
      activeStage,
      activeScene,
      {
        customSceneObjects,
        sceneImages: preloadedAssets.sceneImages,
        characters,
        customModels,
        customParts,
        customHeads,
        charImages: preloadedAssets.charImages,
      },
      {
        showRig,
        selectedActorId: selectedActor?.id ?? null,
        controlMode,
        activeHandleId,
      },
    );
  }, [
    activeStage,
    activeScene,
    customSceneObjects,
    characters,
    customModels,
    customParts,
    customHeads,
    preloadedAssets,
    showRig,
    selectedActor?.id,
    controlMode,
    activeHandleId,
  ]);

  const updateActor = useCallback(
    (actorId: string, patch: Partial<Stage2DActor>, pushUndo = true) => {
      commitStage(
        (s) => ({
          ...s,
          actors: s.actors.map((a) => (a.id === actorId ? { ...a, ...patch } : a)),
        }),
        pushUndo,
      );
    },
    [commitStage],
  );

  const updateSelectedPose = useCallback(
    (updater: (cur: Pose2DState) => Pose2DState, pushUndo = true) => {
      if (!selectedActor) return;
      updateActor(selectedActor.id, { pose: updater(selectedActor.pose) }, pushUndo);
    },
    [selectedActor, updateActor],
  );

  const clientToCanvasPt = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * STAGE2D_W,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * STAGE2D_H,
    };
  };

  const applyJointTargetDrag = (
    actor: Stage2DActor,
    kind: RigHandleKind2D,
    canvasPt: { x: number; y: number },
    pushUndo: boolean,
  ) => {
    if (!activeStage) return;
    const ch = characters.find((c) => c.id === actor.characterId) ?? characters[0];
    if (!ch) return;
    const model = resolveBaseModel2D(ch.baseModelId, customModels);
    const head = resolveCharacterHeadPack2D(ch.headShapeId, customHeads);
    const anchors = resolveEffectiveAnchors(
      model,
      { ...ch, angle: actor.angle },
      actor.angle,
      head,
    );
    const sk = computeForwardKinematics2D(anchors, actor.pose);
    const localTarget = stageToCharacterPoint(canvasPt, actor, activeStage.camera);

    const nextPose = clonePose2D(actor.pose);
    const clampDeg = (d: number) => Math.max(-165, Math.min(165, Math.round(d * 10) / 10));

    if (kind.type === "ik_hand_L") {
      const sol = solveTwoBoneIK2D(
        sk.shoulderL,
        sk.lengths.upperArmL,
        sk.lengths.forearmL,
        sk.restAnglesRad.upperArmL,
        sk.restAnglesRad.forearmL,
        localTarget,
        nextPose.elbowBendL,
        degToRad(sk.anglesDeg.chest),
      );
      nextPose.joints.upperArmL = clampDeg(sol.upperDeg);
      nextPose.joints.forearmL = clampDeg(sol.lowerDeg);
    } else if (kind.type === "ik_hand_R") {
      const sol = solveTwoBoneIK2D(
        sk.shoulderR,
        sk.lengths.upperArmR,
        sk.lengths.forearmR,
        sk.restAnglesRad.upperArmR,
        sk.restAnglesRad.forearmR,
        localTarget,
        nextPose.elbowBendR,
        degToRad(sk.anglesDeg.chest),
      );
      nextPose.joints.upperArmR = clampDeg(sol.upperDeg);
      nextPose.joints.forearmR = clampDeg(sol.lowerDeg);
    } else if (kind.type === "ik_foot_L") {
      const sol = solveTwoBoneIK2D(
        sk.hipL,
        sk.lengths.thighL,
        sk.lengths.shinL,
        sk.restAnglesRad.thighL,
        sk.restAnglesRad.shinL,
        localTarget,
        nextPose.kneeBendL,
        degToRad(sk.anglesDeg.hips),
      );
      nextPose.joints.thighL = clampDeg(sol.upperDeg);
      nextPose.joints.shinL = clampDeg(sol.lowerDeg);
    } else if (kind.type === "ik_foot_R") {
      const sol = solveTwoBoneIK2D(
        sk.hipR,
        sk.lengths.thighR,
        sk.lengths.shinR,
        sk.restAnglesRad.thighR,
        sk.restAnglesRad.shinR,
        localTarget,
        nextPose.kneeBendR,
        degToRad(sk.anglesDeg.hips),
      );
      nextPose.joints.thighR = clampDeg(sol.upperDeg);
      nextPose.joints.shinR = clampDeg(sol.lowerDeg);
    } else if (kind.type === "joint") {
      const jid = kind.jointId;
      if (jid === "upperArmL") {
        nextPose.joints.upperArmL = clampDeg(
          solveSingleBoneRotationDeg(
            sk.shoulderL,
            sk.restAnglesRad.upperArmL,
            degToRad(sk.anglesDeg.chest),
            localTarget,
          ),
        );
      } else if (jid === "forearmL") {
        nextPose.joints.forearmL = clampDeg(
          solveSingleBoneRotationDeg(
            sk.elbowL,
            sk.restAnglesRad.forearmL,
            degToRad(sk.anglesDeg.upperArmL),
            localTarget,
          ),
        );
      } else if (jid === "handL") {
        nextPose.joints.handL = clampDeg(
          solveSingleBoneRotationDeg(
            sk.wristL,
            sk.restAnglesRad.handL,
            degToRad(sk.anglesDeg.forearmL),
            localTarget,
          ),
        );
      } else if (jid === "upperArmR") {
        nextPose.joints.upperArmR = clampDeg(
          solveSingleBoneRotationDeg(
            sk.shoulderR,
            sk.restAnglesRad.upperArmR,
            degToRad(sk.anglesDeg.chest),
            localTarget,
          ),
        );
      } else if (jid === "forearmR") {
        nextPose.joints.forearmR = clampDeg(
          solveSingleBoneRotationDeg(
            sk.elbowR,
            sk.restAnglesRad.forearmR,
            degToRad(sk.anglesDeg.upperArmR),
            localTarget,
          ),
        );
      } else if (jid === "handR") {
        nextPose.joints.handR = clampDeg(
          solveSingleBoneRotationDeg(
            sk.wristR,
            sk.restAnglesRad.handR,
            degToRad(sk.anglesDeg.forearmR),
            localTarget,
          ),
        );
      } else if (jid === "thighL") {
        nextPose.joints.thighL = clampDeg(
          solveSingleBoneRotationDeg(
            sk.hipL,
            sk.restAnglesRad.thighL,
            degToRad(sk.anglesDeg.hips),
            localTarget,
          ),
        );
      } else if (jid === "shinL") {
        nextPose.joints.shinL = clampDeg(
          solveSingleBoneRotationDeg(
            sk.kneeL,
            sk.restAnglesRad.shinL,
            degToRad(sk.anglesDeg.thighL),
            localTarget,
          ),
        );
      } else if (jid === "footL") {
        nextPose.joints.footL = clampDeg(
          solveSingleBoneRotationDeg(
            sk.ankleL,
            sk.restAnglesRad.footL,
            degToRad(sk.anglesDeg.shinL),
            localTarget,
          ),
        );
      } else if (jid === "thighR") {
        nextPose.joints.thighR = clampDeg(
          solveSingleBoneRotationDeg(
            sk.hipR,
            sk.restAnglesRad.thighR,
            degToRad(sk.anglesDeg.hips),
            localTarget,
          ),
        );
      } else if (jid === "shinR") {
        nextPose.joints.shinR = clampDeg(
          solveSingleBoneRotationDeg(
            sk.kneeR,
            sk.restAnglesRad.shinR,
            degToRad(sk.anglesDeg.thighR),
            localTarget,
          ),
        );
      } else if (jid === "footR") {
        nextPose.joints.footR = clampDeg(
          solveSingleBoneRotationDeg(
            sk.ankleR,
            sk.restAnglesRad.footR,
            degToRad(sk.anglesDeg.shinR),
            localTarget,
          ),
        );
      } else if (jid === "head") {
        const neckUp = Math.atan2(sk.rest.head.y - sk.rest.neck.y, sk.rest.head.x - sk.rest.neck.x);
        nextPose.joints.head = Math.max(
          -55,
          Math.min(
            55,
            solveSingleBoneRotationDeg(sk.neck, neckUp, degToRad(sk.anglesDeg.chest), localTarget),
          ),
        );
      } else if (jid === "chest") {
        const spineUp = Math.atan2(
          sk.rest.chest.y - sk.rest.spine.y,
          sk.rest.chest.x - sk.rest.spine.x,
        );
        nextPose.joints.chest = Math.max(
          -45,
          Math.min(
            45,
            solveSingleBoneRotationDeg(
              sk.spine,
              spineUp,
              degToRad(sk.anglesDeg.spine),
              localTarget,
            ),
          ),
        );
      } else if (jid === "spine") {
        const waistUp = Math.atan2(
          sk.rest.spine.y - sk.rest.hips.y,
          sk.rest.spine.x - sk.rest.hips.x,
        );
        nextPose.joints.spine = Math.max(
          -50,
          Math.min(
            50,
            solveSingleBoneRotationDeg(sk.hips, waistUp, degToRad(sk.anglesDeg.hips), localTarget),
          ),
        );
      }
    }

    updateActor(actor.id, { pose: nextPose }, pushUndo);
  };

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStage) return;
    const pt = clientToCanvasPt(e);
    const worldPt = cameraCanvasToStageWorldPoint(pt, activeStage.camera);

    // 0. Middle-mouse or Space-held -> smooth camera pan
    if (e.button === 1 || spacePanHeld) {
      e.preventDefault();
      dragRef.current = {
        kind: { type: "camera_pan" },
        actorId: "",
        startCanvasPt: pt,
        startWorldPt: worldPt,
        startActorX: 0,
        startActorY: 0,
        startScale: 1,
        startPanX: activeStage.camera.panX || 0,
        startPanY: activeStage.camera.panY || 0,
        pushedUndo: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // 1. Check overlay rig handles on currently selected actor
    if (showRig && selectedActor) {
      const sk = skeletonsRef.current.get(selectedActor.id);
      if (sk) {
        const { handles } = getActorOverlayHandles(selectedActor, sk, activeStage, controlMode);
        let bestHandle: (typeof handles)[number] | null = null;
        let bestDist = 20;
        for (const h of handles) {
          const d = Math.hypot(pt.x - h.screenPt.x, pt.y - h.screenPt.y);
          if (d <= bestDist) {
            bestDist = d;
            bestHandle = h;
          }
        }
        if (bestHandle) {
          setActiveHandleId(bestHandle.id);
          dragRef.current = {
            kind: bestHandle.kind,
            actorId: selectedActor.id,
            startCanvasPt: pt,
            startWorldPt: worldPt,
            startActorX: selectedActor.x,
            startActorY: selectedActor.y,
            startScale: selectedActor.scale,
            startPose: clonePose2D(selectedActor.pose),
            startPanX: activeStage.camera.panX || 0,
            startPanY: activeStage.camera.panY || 0,
            pushedUndo: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // 2. Otherwise hit-test actors front-to-back using posed FK skeleton bounds (tilt/crouch-accurate!)
    const revActors = [...activeStage.actors].reverse();
    for (const a of revActors) {
      if (!a.visible) continue;
      const localPt = stageToCharacterPoint(pt, a, activeStage.camera);
      const sk = skeletonsRef.current.get(a.id);
      const bounds = sk
        ? computeActorLocalBounds2D(sk)
        : { minX: 110, maxX: 370, minY: 40, maxY: 980 };
      if (
        localPt.x >= bounds.minX &&
        localPt.x <= bounds.maxX &&
        localPt.y >= bounds.minY &&
        localPt.y <= bounds.maxY
      ) {
        setSelectedActorId(a.id);
        setActiveHandleId("root");
        dragRef.current = {
          kind: { type: "actor_move" },
          actorId: a.id,
          startCanvasPt: pt,
          startWorldPt: worldPt,
          startActorX: a.x,
          startActorY: a.y,
          startScale: a.scale,
          startPose: clonePose2D(a.pose),
          startPanX: activeStage.camera.panX || 0,
          startPanY: activeStage.camera.panY || 0,
          pushedUndo: false,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 3. Dragging empty backdrop smoothly pans the stage camera
    dragRef.current = {
      kind: { type: "camera_pan" },
      actorId: "",
      startCanvasPt: pt,
      startWorldPt: worldPt,
      startActorX: 0,
      startActorY: 0,
      startScale: 1,
      startPanX: activeStage.camera.panX || 0,
      startPanY: activeStage.camera.panY || 0,
      pushedUndo: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d || !activeStage) return;
    const pt = clientToCanvasPt(e);
    const shouldPushUndo = !d.pushedUndo;
    d.pushedUndo = true;

    if (d.kind.type === "camera_pan") {
      const tiltRad = -degToRad(activeStage.camera.tilt || 0);
      const rawDx = pt.x - d.startCanvasPt.x;
      const rawDy = pt.y - d.startCanvasPt.y;
      const panDx = rawDx * Math.cos(tiltRad) - rawDy * Math.sin(tiltRad);
      const panDy = rawDx * Math.sin(tiltRad) + rawDy * Math.cos(tiltRad);
      commitStage(
        (s) => ({
          ...s,
          camera: {
            ...s.camera,
            panX: Math.max(-480, Math.min(480, Math.round(d.startPanX + panDx))),
            panY: Math.max(-340, Math.min(420, Math.round(d.startPanY + panDy))),
          },
        }),
        shouldPushUndo,
      );
      return;
    }

    const actor = activeStage.actors.find((a) => a.id === d.actorId);
    if (!actor) return;
    const worldPt = cameraCanvasToStageWorldPoint(pt, activeStage.camera);
    const worldDx = worldPt.x - d.startWorldPt.x;
    const worldDy = worldPt.y - d.startWorldPt.y;

    // When Pin Feet is ON and dragging the red hip pin (`root`), solve 2-bone leg IK for natural squat/crouch!
    if (d.kind.type === "root" && pinFeet && d.startPose) {
      const ch = characters.find((c) => c.id === actor.characterId) ?? characters[0];
      if (ch) {
        const model = resolveBaseModel2D(ch.baseModelId, customModels);
        const head = resolveCharacterHeadPack2D(ch.headShapeId, customHeads);
        const anchors = resolveEffectiveAnchors(
          model,
          { ...ch, angle: actor.angle },
          actor.angle,
          head,
        );
        const localDy = worldDy / Math.max(0.2, actor.scale);
        const nextPose = solvePinnedFeetHipDrag2D(
          anchors,
          d.startPose,
          (d.startPose.rootOffsetY || 0) + localDy,
        );
        updateActor(actor.id, { pose: nextPose }, shouldPushUndo);
        return;
      }
    }

    if (d.kind.type === "root" || d.kind.type === "actor_move") {
      updateActor(
        actor.id,
        {
          x: Math.round(d.startActorX + worldDx),
          y: Math.round(d.startActorY + worldDy),
        },
        shouldPushUndo,
      );
      return;
    }

    if (d.kind.type === "scale") {
      const nextScale = Math.max(
        0.2,
        Math.min(2.2, Math.round((d.startScale + worldDy / 380) * 100) / 100),
      );
      updateActor(actor.id, { scale: nextScale }, shouldPushUndo);
      return;
    }

    applyJointTargetDrag(actor, d.kind, pt, shouldPushUndo);
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    setActiveHandleId(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleAddActorToStage = (char: Character2D) => {
    if (!activeStage) return;
    const offsetIdx = activeStage.actors.length;
    const newActor: Stage2DActor = {
      id: `actor2d-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      characterId: char.id,
      name: char.name,
      x: Math.round(STAGE2D_W * (0.35 + ((offsetIdx * 0.22) % 0.45))),
      y: Math.round(STAGE2D_H * 0.88),
      scale: 0.62,
      angle: char.angle,
      flipX: false,
      depth: "midground",
      shadow: true,
      visible: true,
      pose: clonePose2D(DEFAULT_POSE_2D),
    };
    commitStage((s) => ({ ...s, actors: [...s.actors, newActor] }));
    setSelectedActorId(newActor.id);
  };

  const handleStampStage = async () => {
    if (!activeStage) return;
    setExportBusy(true);
    try {
      const png = await exportStage2DPng(
        activeStage,
        activeScene,
        {
          customSceneObjects,
          characters,
          customModels,
          customParts,
          customHeads,
        },
        1.5,
      );
      if (!png) return;
      const meta: SourceStage2DMetadata = {
        stageId: activeStage.id,
        stageName: activeStage.name,
        actorId: selectedActor?.id,
        renderMode: activeStage.renderMode,
        snapshot: activeStage,
      };
      if (editingTarget) {
        onUpdatePanelElement(editingTarget.elementId, png, meta);
      } else {
        onStampStageToPanel(targetPanelId || panels[0]?.id || "p1", png, meta);
      }
    } finally {
      setExportBusy(false);
    }
  };

  const handleStampSelectedActor = async () => {
    if (!activeStage || !selectedActor) return;
    setExportBusy(true);
    try {
      const png = await exportActor2DPng(
        selectedActor,
        activeStage.renderMode,
        { characters, customModels, customParts, customHeads },
        2,
      );
      if (!png) return;
      const meta: SourceStage2DMetadata = {
        stageId: activeStage.id,
        stageName: activeStage.name,
        actorId: selectedActor.id,
        renderMode: activeStage.renderMode,
        snapshot: activeStage,
      };
      onStampActorToPanel(targetPanelId || panels[0]?.id || "p1", png, meta);
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportPng = async () => {
    if (!activeStage) return;
    setExportBusy(true);
    try {
      const png = await exportStage2DPng(
        activeStage,
        activeScene,
        { customSceneObjects, characters, customModels, customParts, customHeads },
        1.5,
      );
      if (!png) return;
      const a = document.createElement("a");
      a.href = png;
      a.download = `${(activeStage.name || "stage").replace(/[^a-z0-9-_]+/gi, "_")}_${activeStage.renderMode}.png`;
      a.click();
    } finally {
      setExportBusy(false);
    }
  };

  const filteredPoses = useMemo(() => {
    const all = [...customPoses, ...BUILTIN_POSE_PRESETS_2D];
    if (poseCategory === "all") return all;
    return all.filter((p) => p.category === poseCategory);
  }, [customPoses, poseCategory]);

  if (!activeStage) return null;

  return (
    <div
      className="flex h-dvh flex-col bg-background text-foreground select-none overflow-hidden"
      data-testid="pose2d-studio"
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
            className="whitespace-nowrap rounded-sm px-2 sm:px-3 py-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Scenes
          </button>
          <button
            type="button"
            onClick={() => onGoTab("pose")}
            aria-pressed={true}
            data-testid="nav-pose-tab"
            className="whitespace-nowrap rounded-sm px-2 sm:px-3 py-1 font-semibold bg-foreground text-background transition-colors"
          >
            Pose &amp; Stage
          </button>
        </nav>

        <div className="flex items-center rounded-sm border border-border bg-background p-0.5 text-[11px] font-semibold shrink-0">
          <span className="rounded-xs bg-primary px-2 py-0.5 text-primary-foreground">
            2D Stage
          </span>
          <button
            type="button"
            onClick={onSwitchTo3DLegacy}
            data-testid="pose2d-switch-3d-btn"
            title="Open original 3D mannequin pose studio"
            className="rounded-xs px-2 py-0.5 text-muted-foreground hover:text-foreground"
          >
            3D Legacy
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <FeedbackButton compact area="Pose & Stage (2D)" />
          <AccountMenu compact />
        </div>
      </header>

      {/* Secondary Stage Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/25 px-2.5 sm:px-4 py-1.5 text-xs shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          {renaming ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (nameDraft.trim()) commitStage((s) => ({ ...s, name: nameDraft.trim() }));
                setRenaming(false);
              }}
            >
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus
                className="w-32 rounded-xs border border-foreground bg-background px-1.5 py-0.5 text-xs font-semibold"
              />
              <button
                type="submit"
                className="rounded-xs bg-primary px-2 py-0.5 font-semibold text-primary-foreground"
              >
                OK
              </button>
            </form>
          ) : (
            <select
              aria-label="Saved Stage"
              value={activeStage.id}
              onChange={(e) => {
                const nextId = e.target.value;
                setActiveId(nextId);
                const next = stages.find((st) => st.id === nextId);
                setSelectedActorId(next?.actors[0]?.id ?? null);
              }}
              className="max-w-[140px] rounded-xs border border-border bg-background px-2 py-1 font-semibold"
            >
              {stages.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              const ch = characters[0];
              const created = createDefaultStage2D(
                `Stage #${stages.length + 1}`,
                activeStage.sceneId,
                ch?.id ?? "",
                ch?.name ?? "Hero #1",
              );
              setStages((prev) => upsertStage2D(prev, created));
              setActiveId(created.id);
              setSelectedActorId(created.actors[0]?.id ?? null);
            }}
            title="New Stage"
            className="rounded-xs border border-border bg-background p-1 hover:border-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const copy: Stage2D = {
                ...structuredClone(activeStage),
                id: `stage2d-${Date.now()}`,
                name: `${activeStage.name} Copy`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              setStages((prev) => upsertStage2D(prev, copy));
              setActiveId(copy.id);
            }}
            title="Duplicate Stage"
            className="rounded-xs border border-border bg-background p-1 hover:border-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setNameDraft(activeStage.name);
              setRenaming(true);
            }}
            className="rounded-xs border border-border bg-background px-1.5 py-0.5 text-[11px] font-semibold hover:border-foreground"
          >
            Rename
          </button>
          {stages.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const rest = removeStage2D(stages, activeStage.id);
                setStages(rest);
                setActiveId(rest[0]?.id ?? "");
                setSelectedActorId(rest[0]?.actors[0]?.id ?? null);
              }}
              title="Delete Stage"
              className="rounded-xs border border-border bg-background p-1 text-destructive hover:border-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Color vs Pure Manga Ink */}
        <div
          className="flex items-center rounded-sm border-2 border-foreground bg-background p-0.5 font-bold"
          role="group"
          aria-label="Stage Render Mode"
        >
          <button
            type="button"
            data-testid="pose2d-mode-color"
            onClick={() => commitStage((s) => ({ ...s, renderMode: "color" }))}
            className={`inline-flex items-center gap-1 rounded-xs px-2 py-0.5 transition-colors ${activeStage.renderMode === "color" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Color</span>
          </button>
          <button
            type="button"
            data-testid="pose2d-mode-manga"
            onClick={() => commitStage((s) => ({ ...s, renderMode: "manga" }))}
            className={`inline-flex items-center gap-1 rounded-xs px-2 py-0.5 transition-colors ${activeStage.renderMode === "manga" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            <PenTool className="h-3.5 w-3.5" />
            <span>Manga Ink</span>
          </button>
        </div>

        {/* IK vs FK Mode + Rig Toggle */}
        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-xs border border-border bg-background p-0.5 font-semibold">
            <button
              type="button"
              data-testid="pose2d-mode-ik"
              onClick={() => setControlMode("ik")}
              className={`rounded-xs px-2 py-0.5 ${controlMode === "ik" ? "bg-amber-500 text-black font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              IK Drag
            </button>
            <button
              type="button"
              data-testid="pose2d-mode-fk"
              onClick={() => setControlMode("fk")}
              className={`rounded-xs px-2 py-0.5 ${controlMode === "fk" ? "bg-foreground text-background font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              FK Rotate
            </button>
          </div>
          <button
            type="button"
            data-testid="pose2d-toggle-rig"
            onClick={() => setShowRig((v) => !v)}
            title="Show/Hide Rig Skeleton (R)"
            className={`inline-flex items-center gap-1 rounded-xs border px-2 py-1 font-semibold ${showRig ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}
          >
            {showRig ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>Rig</span>
          </button>
          <button
            type="button"
            data-testid="pose2d-pin-feet"
            onClick={() => setPinFeet((v) => !v)}
            title="Pin Feet on floor — dragging the red hip pin bends both knees naturally"
            className={`inline-flex items-center gap-1 rounded-xs border px-2 py-1 font-semibold ${pinFeet ? "border-emerald-600 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
          >
            <Anchor className="h-3.5 w-3.5" />
            <span>Pin Feet</span>
          </button>
          <button
            type="button"
            data-testid="pose2d-frame-actor"
            disabled={!selectedActor}
            onClick={handleFrameSelectedActor}
            title="Frame Selected Character (F)"
            className="inline-flex items-center gap-1 rounded-xs border border-border bg-background px-2 py-1 font-semibold text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-40"
          >
            <Focus className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Frame</span>
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl+Z)"
            className="rounded-xs border border-border bg-background p-1 disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Y)"
            className="rounded-xs border border-border bg-background p-1 disabled:opacity-40"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Stamp & Export Actions */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {!editingTarget && panels.length > 0 && (
            <select
              aria-label="Target Manga Panel"
              value={targetPanelId}
              onChange={(e) => setTargetPanelId(e.target.value)}
              className="rounded-xs border border-border bg-background px-1.5 py-1 font-semibold"
            >
              {panels.map((p, idx) => (
                <option key={p.id} value={p.id}>
                  Panel #{idx + 1}
                </option>
              ))}
            </select>
          )}
          {editingTarget && onCancelEditingTarget && (
            <button
              type="button"
              onClick={onCancelEditingTarget}
              className="rounded-xs border border-border bg-background px-2 py-1 font-semibold hover:bg-accent"
            >
              Cancel Edit
            </button>
          )}
          <button
            type="button"
            disabled={exportBusy}
            data-testid="pose2d-stamp-stage-btn"
            onClick={() => void handleStampStage()}
            className="inline-flex items-center gap-1 rounded-xs border-2 border-foreground bg-primary px-2.5 py-1 font-bold text-primary-foreground shadow-xs hover:opacity-95 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{editingTarget ? "Update Panel" : "Stamp Full Stage"}</span>
          </button>
          {selectedActor && !editingTarget && (
            <button
              type="button"
              disabled={exportBusy}
              data-testid="pose2d-stamp-actor-btn"
              onClick={() => void handleStampSelectedActor()}
              className="inline-flex items-center gap-1 rounded-xs border border-foreground bg-card px-2 py-1 font-bold hover:bg-accent disabled:opacity-50"
              title="Stamp transparent posed character cutout only"
            >
              <Move className="h-3.5 w-3.5 text-primary" />
              <span>Stamp Char Only</span>
            </button>
          )}
          <button
            type="button"
            disabled={exportBusy}
            onClick={() => void handleExportPng()}
            className="inline-flex items-center gap-1 rounded-xs border border-border bg-background px-2 py-1 font-semibold hover:border-foreground disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PNG</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Stage Interactive Viewport */}
        <section className="relative flex flex-1 flex-col min-w-0 min-h-0 bg-slate-200 dark:bg-slate-900">
          <div className="flex flex-1 items-center justify-center p-2 sm:p-4 overflow-auto min-h-0">
            <canvas
              ref={canvasRef}
              data-testid="pose2d-canvas"
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
              style={{ touchAction: "none" }}
              className={`max-h-full max-w-full aspect-[16/10] bg-white shadow-xl border-2 border-foreground ${spacePanHeld ? "cursor-grab" : "cursor-crosshair"}`}
            />
          </div>

          {/* Quick Actor Bar: 8-Angle Turnaround + Expression + Ground Snap without leaving Poses tab */}
          {selectedActor && (
            <div className="border-t border-border bg-card/95 px-2.5 py-1.5 text-[11px] flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {ANGLES_2D.map((ang: Angle2D) => (
                  <button
                    key={ang}
                    type="button"
                    data-testid={`pose2d-quick-angle-${ang}`}
                    onClick={() => updateActor(selectedActor.id, { angle: ang })}
                    className={`rounded-xs border px-1.5 py-0.5 font-mono font-bold transition-colors ${selectedActor.angle === ang ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground"}`}
                  >
                    {ang}°
                  </button>
                ))}
              </div>
              <select
                aria-label="Quick Shot Expression"
                data-testid="pose2d-quick-expression"
                value={selectedActor.expressionOverride ?? ""}
                onChange={(e) =>
                  updateActor(selectedActor.id, {
                    expressionOverride: (e.target.value || undefined) as Expression2DId | undefined,
                  })
                }
                className="rounded-xs border border-border bg-background px-1.5 py-0.5 text-[11px] font-semibold"
              >
                <option value="">Expr: Default</option>
                {(Object.keys(EXPRESSION_PRESETS_2D) as Expression2DId[]).map((ex) => (
                  <option key={ex} value={ex}>
                    {EXPRESSION_PRESETS_2D[ex].label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => updateActor(selectedActor.id, { flipX: !selectedActor.flipX })}
                title="Flip Character Horizontally (H)"
                className={`inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 font-semibold ${selectedActor.flipX ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground"}`}
              >
                <FlipHorizontal className="h-3 w-3" />
                <span>Flip</span>
              </button>
              <button
                type="button"
                data-testid="pose2d-snap-floor-btn"
                onClick={handleSnapFeetToFloor}
                title="Plant lowest foot onto ground shadow (G)"
                className="inline-flex items-center gap-1 rounded-xs border border-border bg-background px-1.5 py-0.5 font-semibold hover:border-foreground"
              >
                <ArrowDownToLine className="h-3 w-3 text-primary" />
                <span>Snap Feet</span>
              </button>
            </div>
          )}

          <div className="border-t border-border bg-card/90 px-3 py-1 text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>
              {activeStage.actors.length} cast ·{" "}
              {activeScene ? activeScene.name : "Transparent Backdrop"} · Camera{" "}
              {(activeStage.camera.zoom * 100).toFixed(0)}%
              {activeStage.camera.tilt ? ` · Tilt ${activeStage.camera.tilt}°` : ""}
            </span>
            <span>
              Wheel = Zoom · Drag BG / Space = Pan · R = Rig · G = Snap Feet · F = Frame ·{" "}
              {pinFeet ? "Red Pin = Squat (Feet Pinned)" : "Red Pin = Move"}
            </span>
          </div>
        </section>

        {/* Right / Bottom Inspector */}
        <aside className="flex w-full md:w-[375px] lg:w-[410px] max-h-[46dvh] md:max-h-none flex-col border-t-2 md:border-t-0 md:border-l-2 border-foreground bg-card min-h-0">
          <div className="grid grid-cols-5 border-b border-border bg-muted/40 text-[11px] font-bold shrink-0">
            {(
              [
                { id: "poses", label: "Poses", icon: Sparkles },
                { id: "joints", label: "Joints", icon: Sliders },
                { id: "cast", label: "Cast", icon: Users },
                { id: "scene", label: "Scene", icon: ImageIcon },
                { id: "camera", label: "Camera", icon: Camera },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const on = inspectorTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`pose2d-tab-${t.id}`}
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
            {/* TAB 1: POSE PRESETS */}
            {inspectorTab === "poses" && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    data-testid="pose2d-mirror-btn"
                    disabled={!selectedActor}
                    onClick={() => updateSelectedPose((p) => mirrorPose2D(p), true)}
                    className="inline-flex items-center gap-1 rounded-xs border border-foreground bg-background px-2 py-1 font-bold hover:bg-accent disabled:opacity-40"
                  >
                    <FlipHorizontal className="h-3.5 w-3.5 text-primary" />
                    Mirror L ↔ R
                  </button>
                  <button
                    type="button"
                    data-testid="pose2d-reset-btn"
                    disabled={!selectedActor}
                    onClick={() => updateSelectedPose(() => clonePose2D(DEFAULT_POSE_2D), true)}
                    className="inline-flex items-center gap-1 rounded-xs border border-border bg-background px-2 py-1 font-semibold hover:border-foreground disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Pose
                  </button>
                  <button
                    type="button"
                    disabled={!selectedActor}
                    onClick={handleSnapFeetToFloor}
                    className="inline-flex items-center gap-1 rounded-xs border border-border bg-background px-2 py-1 font-semibold hover:border-foreground disabled:opacity-40"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />
                    Snap Feet
                  </button>
                </div>

                {/* 1-Click 2-Character Manga Panel Setups */}
                <div className="rounded-xs border border-border bg-muted/20 p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      2-Character Manga Setups
                    </span>
                    <span className="text-[10px] text-muted-foreground">Instant 2-cast shot</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {BUILTIN_STAGE_COMPOSITIONS_2D.map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        data-testid={`pose2d-comp-${comp.id}`}
                        onClick={() => handleApplyComposition(comp)}
                        className="rounded-xs border border-border bg-background px-2 py-1.5 text-left hover:border-primary hover:bg-primary/5 transition-colors"
                      >
                        <div className="font-bold text-[11px] truncate">{comp.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {comp.subtitle}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save Custom Pose */}
                {selectedActor && (
                  <form
                    className="flex gap-1.5 rounded-xs border border-border bg-muted/20 p-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const nm = customPoseName.trim() || `Custom Pose ${customPoses.length + 1}`;
                      const created = {
                        id: `pose2d-${Date.now()}`,
                        name: nm,
                        category: "custom" as const,
                        builtIn: false,
                        createdAt: Date.now(),
                        pose: clonePose2D(selectedActor.pose),
                      };
                      setCustomPoses((prev) => upsertCustomPose2D(prev, created));
                      setCustomPoseName("");
                    }}
                  >
                    <input
                      type="text"
                      value={customPoseName}
                      onChange={(e) => setCustomPoseName(e.target.value)}
                      placeholder="Save current pose as..."
                      className="flex-1 rounded-xs border border-border bg-background px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-xs bg-foreground px-2.5 py-1 font-bold text-background"
                    >
                      Save
                    </button>
                  </form>
                )}

                {/* Category Filter */}
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      {
                        id: "all",
                        label: `All (${BUILTIN_POSE_PRESETS_2D.length + customPoses.length})`,
                      },
                      { id: "everyday", label: "Everyday" },
                      { id: "action", label: "Action" },
                      { id: "drama", label: "Drama" },
                      { id: "custom", label: `My Poses (${customPoses.length})` },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setPoseCategory(cat.id)}
                      className={`rounded-xs px-2 py-0.5 text-[11px] font-semibold ${poseCategory === cat.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Preset Grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredPoses.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between gap-1 rounded-xs border border-border bg-background p-1.5 hover:border-foreground"
                    >
                      <button
                        type="button"
                        disabled={!selectedActor}
                        data-testid={`pose2d-preset-${preset.id}`}
                        onClick={() => updateSelectedPose(() => clonePose2D(preset.pose), true)}
                        className="flex-1 text-left font-semibold truncate hover:text-primary disabled:opacity-40"
                      >
                        <div>{preset.name}</div>
                        <div className="text-[10px] font-normal uppercase text-muted-foreground">
                          {preset.category}
                        </div>
                      </button>
                      {!preset.builtIn && (
                        <button
                          type="button"
                          onClick={() =>
                            setCustomPoses((prev) => removeCustomPose2D(prev, preset.id))
                          }
                          title="Delete Custom Pose"
                          className="p-1 text-destructive hover:bg-destructive/10 rounded-xs"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* TAB 2: FINE JOINT SLIDERS & POLE FLIPS */}
            {inspectorTab === "joints" &&
              (selectedActor ? (
                <div className="space-y-3">
                  {/* IK Bend Direction Flips */}
                  <div className="rounded-xs border border-border bg-muted/20 p-2 space-y-1.5">
                    <div className="font-bold text-[11px]">IK Elbow / Knee Bend Direction</div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedPose(
                            (p) => ({ ...p, elbowBendL: p.elbowBendL === 1 ? -1 : 1 }),
                            true,
                          )
                        }
                        className="rounded-xs border border-border bg-background py-1 font-semibold hover:border-foreground"
                      >
                        Flip L Elbow ({selectedActor.pose.elbowBendL > 0 ? "+" : "-"})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedPose(
                            (p) => ({ ...p, elbowBendR: p.elbowBendR === 1 ? -1 : 1 }),
                            true,
                          )
                        }
                        className="rounded-xs border border-border bg-background py-1 font-semibold hover:border-foreground"
                      >
                        Flip R Elbow ({selectedActor.pose.elbowBendR > 0 ? "+" : "-"})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedPose(
                            (p) => ({ ...p, kneeBendL: p.kneeBendL === 1 ? -1 : 1 }),
                            true,
                          )
                        }
                        className="rounded-xs border border-border bg-background py-1 font-semibold hover:border-foreground"
                      >
                        Flip L Knee ({selectedActor.pose.kneeBendL > 0 ? "+" : "-"})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedPose(
                            (p) => ({ ...p, kneeBendR: p.kneeBendR === 1 ? -1 : 1 }),
                            true,
                          )
                        }
                        className="rounded-xs border border-border bg-background py-1 font-semibold hover:border-foreground"
                      >
                        Flip R Knee ({selectedActor.pose.kneeBendR > 0 ? "+" : "-"})
                      </button>
                    </div>
                  </div>

                  {/* Pelvis Vertical Offset (Jump / Crouch) */}
                  <label className="block space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span>Crouch / Jump Height Offset</span>
                      <span className="font-mono">{selectedActor.pose.rootOffsetY}px</span>
                    </div>
                    <input
                      type="range"
                      min={-160}
                      max={220}
                      value={selectedActor.pose.rootOffsetY}
                      onPointerDown={pushUndoSnapshot}
                      onKeyDown={pushUndoSnapshot}
                      onChange={(e) =>
                        updateSelectedPose((p) => ({ ...p, rootOffsetY: +e.target.value }), false)
                      }
                      className="w-full accent-primary"
                    />
                  </label>

                  {/* 16 Joint Angle Sliders */}
                  <div className="space-y-1.5 border-t border-border pt-2">
                    {JOINT_IDS_2D.map((jid) => (
                      <label key={jid} className="block">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-semibold">{JOINT_LABELS_2D[jid]}</span>
                          <span className="font-mono">{selectedActor.pose.joints[jid] ?? 0}°</span>
                        </div>
                        <input
                          type="range"
                          min={-165}
                          max={165}
                          step={1}
                          value={selectedActor.pose.joints[jid] ?? 0}
                          onPointerDown={pushUndoSnapshot}
                          onKeyDown={pushUndoSnapshot}
                          onChange={(e) =>
                            updateSelectedPose(
                              (p) => ({
                                ...p,
                                joints: { ...p.joints, [jid]: +e.target.value },
                              }),
                              false,
                            )
                          }
                          className="w-full accent-primary"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Add a character in the Cast tab to edit joints.
                </p>
              ))}

            {/* TAB 3: CAST & ANGLE TURNAROUND */}
            {inspectorTab === "cast" && (
              <div className="space-y-3">
                {/* Add Saved 2D Character to Stage */}
                <div className="rounded-xs border border-border bg-muted/20 p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1">
                      <UserPlus className="h-3.5 w-3.5 text-primary" />
                      Add 2D Character to Stage
                    </span>
                    <button
                      type="button"
                      onClick={() => onGoTab("create")}
                      className="text-[11px] font-semibold text-primary underline"
                    >
                      New Character
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto">
                    {characters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleAddActorToStage(c)}
                        className="truncate rounded-xs border border-border bg-background px-2 py-1 text-left font-semibold hover:border-foreground hover:bg-accent"
                      >
                        + {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Staged Actors List */}
                <div className="space-y-1">
                  <span className="font-bold block">Staged Cast ({activeStage.actors.length})</span>
                  {activeStage.actors.map((a) => {
                    const active = selectedActor?.id === a.id;
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center justify-between gap-1 rounded-xs border px-2 py-1 ${active ? "border-primary bg-primary/10" : "border-border bg-background"}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedActorId(a.id)}
                          className="flex-1 text-left font-semibold truncate"
                        >
                          {a.name} ({a.angle}° · {a.depth})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateActor(a)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Duplicate Actor"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateActor(a.id, { visible: !a.visible })}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title={a.visible ? "Hide" : "Show"}
                        >
                          {a.visible ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            commitStage((s) => ({
                              ...s,
                              actors: s.actors.filter((x) => x.id !== a.id),
                            }));
                            if (selectedActorId === a.id) setSelectedActorId(null);
                          }}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded-xs"
                          title="Remove from Stage"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Actor Controls */}
                {selectedActor && (
                  <div className="space-y-2.5 border-t border-border pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{selectedActor.name} Settings</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateActor(selectedActor.id, { flipX: !selectedActor.flipX })
                        }
                        className={`inline-flex items-center gap-1 rounded-xs border px-2 py-0.5 font-semibold ${selectedActor.flipX ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                      >
                        <FlipHorizontal className="h-3 w-3" /> Flip X
                      </button>
                    </div>

                    {/* 8-Angle Turnaround Picker */}
                    <div>
                      <span className="font-semibold text-[11px] block mb-1">
                        View Angle (8-Dir)
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        {ANGLES_2D.map((ang: Angle2D) => (
                          <button
                            key={ang}
                            type="button"
                            onClick={() => updateActor(selectedActor.id, { angle: ang })}
                            className={`rounded-xs border py-1 text-[11px] font-bold ${selectedActor.angle === ang ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-foreground"}`}
                          >
                            {ang}°
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Scene Depth Layer Interleaving */}
                    <div>
                      <span className="font-semibold text-[11px] block mb-1">
                        Scene Depth Layer
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {(["background", "midground", "foreground"] as SceneDepthLayer[]).map(
                          (depth) => (
                            <button
                              key={depth}
                              type="button"
                              onClick={() => updateActor(selectedActor.id, { depth })}
                              className={`rounded-xs border py-1 text-[11px] font-semibold capitalize ${selectedActor.depth === depth ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                            >
                              {depth}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Scale */}
                    <label className="block">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold">Character Scale</span>
                        <span className="font-mono">{selectedActor.scale.toFixed(2)}×</span>
                      </div>
                      <input
                        type="range"
                        min={0.25}
                        max={2.0}
                        step={0.02}
                        value={selectedActor.scale}
                        onPointerDown={pushUndoSnapshot}
                        onKeyDown={pushUndoSnapshot}
                        onChange={(e) =>
                          updateActor(selectedActor.id, { scale: +e.target.value }, false)
                        }
                        className="w-full accent-primary"
                      />
                    </label>

                    {/* Expression & FX Override for this Panel Shot */}
                    <div>
                      <span className="font-semibold text-[11px] block mb-1">
                        Shot Expression Override
                      </span>
                      <select
                        aria-label="Expression Override"
                        value={selectedActor.expressionOverride ?? ""}
                        onChange={(e) =>
                          updateActor(selectedActor.id, {
                            expressionOverride: (e.target.value || undefined) as
                              Expression2DId | undefined,
                          })
                        }
                        className="w-full rounded-xs border border-border bg-background px-2 py-1 text-xs"
                      >
                        <option value="">Use Character Default</option>
                        {(Object.keys(EXPRESSION_PRESETS_2D) as Expression2DId[]).map((ex) => (
                          <option key={ex} value={ex}>
                            {EXPRESSION_PRESETS_2D[ex].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="font-semibold text-[11px] block mb-1">Face FX Overlay</span>
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(FACE_FX_LABELS_2D) as FaceFx2D[]).map((fx) => {
                          const list = selectedActor.fxOverride ?? [];
                          const active = list.includes(fx);
                          return (
                            <button
                              key={fx}
                              type="button"
                              onClick={() => {
                                const next = active ? list.filter((x) => x !== fx) : [...list, fx];
                                updateActor(selectedActor.id, { fxOverride: next });
                              }}
                              className={`rounded-xs border px-1.5 py-0.5 text-[10px] font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
                            >
                              {FACE_FX_LABELS_2D[fx]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Limb Front/Back Overrides */}
                    <div>
                      <span className="font-semibold text-[11px] block mb-1">
                        Tuck Limb Behind Torso
                      </span>
                      <div className="grid grid-cols-2 gap-1">
                        {(
                          [
                            ["armL", "L Arm Back"],
                            ["armR", "R Arm Back"],
                            ["legL", "L Leg Back"],
                            ["legR", "R Leg Back"],
                          ] as const
                        ).map(([k, lbl]) => {
                          const isBack = Boolean(selectedActor.pose.limbBehind?.[k]);
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() =>
                                updateSelectedPose(
                                  (p) => ({
                                    ...p,
                                    limbBehind: { ...(p.limbBehind ?? {}), [k]: !isBack },
                                  }),
                                  true,
                                )
                              }
                              className={`rounded-xs border py-1 text-[10px] font-semibold ${isBack ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={selectedActor.shadow}
                        onChange={(e) =>
                          updateActor(selectedActor.id, { shadow: e.target.checked })
                        }
                      />
                      <span>Ground Contact Shadow</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: SCENE PICKER */}
            {inspectorTab === "scene" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Background Scene</span>
                  <button
                    type="button"
                    onClick={() => onGoTab("scenes")}
                    className="inline-flex items-center gap-1 rounded-xs border border-primary bg-primary/10 px-2 py-0.5 font-semibold text-primary hover:bg-primary/20"
                  >
                    <Layers className="h-3 w-3" /> Edit in Scene Builder
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => commitStage((s) => ({ ...s, sceneId: null }))}
                  className={`w-full rounded-xs border px-2.5 py-2 text-left font-semibold ${activeStage.sceneId === null ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-foreground"}`}
                >
                  Transparent Cutout Stage (No Background)
                </button>

                <div className="space-y-1">
                  {scenes.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => commitStage((s) => ({ ...s, sceneId: sc.id }))}
                      className={`w-full flex items-center justify-between rounded-xs border px-2.5 py-2 text-left ${activeStage.sceneId === sc.id ? "border-primary bg-primary/10 font-bold" : "border-border bg-background hover:border-foreground"}`}
                    >
                      <span className="truncate">{sc.name}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {sc.objects.length} objs
                      </span>
                    </button>
                  ))}
                </div>

                {/* Manga Action FX Overlay Controls */}
                <div className="rounded-xs border border-border bg-muted/20 p-2.5 space-y-2 border-t">
                  <div className="font-bold flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>Manga Action FX Overlay</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { key: "speedlines", label: "Speedlines" },
                        { key: "impactBurst", label: "Impact Burst" },
                        { key: "groundDust", label: "Ground Dust" },
                      ] as const
                    ).map((item) => {
                      const curFx: Stage2DFxOverlay = activeStage.fx ?? DEFAULT_STAGE_FX_2D;
                      const on = Boolean(curFx[item.key]);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          data-testid={`pose2d-fx-${item.key}`}
                          onClick={() =>
                            commitStage(
                              (s) => ({
                                ...s,
                                fx: {
                                  ...(s.fx ?? DEFAULT_STAGE_FX_2D),
                                  [item.key]: !on,
                                },
                              }),
                              true,
                            )
                          }
                          className={`rounded-xs border px-2 py-1.5 text-[11px] font-bold transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground"}`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: CAMERA FRAMING */}
            {inspectorTab === "camera" && (
              <div className="space-y-3">
                <div>
                  <span className="font-bold block mb-1.5">Quick Manga Shot Presets</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { label: "Wide Shot", cam: { zoom: 1, panX: 0, panY: 0, tilt: 0 } },
                        { label: "Medium Shot", cam: { zoom: 1.45, panX: 0, panY: 95, tilt: 0 } },
                        { label: "Close-Up", cam: { zoom: 2.05, panX: 0, panY: 245, tilt: 0 } },
                        {
                          label: "Dutch Action",
                          cam: { zoom: 1.35, panX: -20, panY: 75, tilt: -10 },
                        },
                      ] as const
                    ).map((shot) => (
                      <button
                        key={shot.label}
                        type="button"
                        onClick={() =>
                          commitStage((s) => ({ ...s, camera: { ...shot.cam } }), true)
                        }
                        className="rounded-xs border border-border bg-background py-1.5 font-semibold hover:border-foreground"
                      >
                        {shot.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={!selectedActor}
                      onClick={handleFrameSelectedActor}
                      className="col-span-2 inline-flex items-center justify-center gap-1 rounded-xs border border-primary bg-primary/10 py-1.5 font-bold text-primary hover:bg-primary/20 disabled:opacity-40"
                    >
                      <Focus className="h-3.5 w-3.5" />
                      Frame Selected Character
                    </button>
                  </div>
                </div>

                <label className="block">
                  <div className="flex justify-between font-semibold">
                    <span>Camera Zoom</span>
                    <span className="font-mono">{activeStage.camera.zoom.toFixed(2)}×</span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={2.5}
                    step={0.05}
                    value={activeStage.camera.zoom}
                    onPointerDown={pushUndoSnapshot}
                    onKeyDown={pushUndoSnapshot}
                    onChange={(e) =>
                      commitStage(
                        (s) => ({ ...s, camera: { ...s.camera, zoom: +e.target.value } }),
                        false,
                      )
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between font-semibold">
                    <span>Pan Horizontal (X)</span>
                    <span className="font-mono">{activeStage.camera.panX}px</span>
                  </div>
                  <input
                    type="range"
                    min={-480}
                    max={480}
                    step={5}
                    value={activeStage.camera.panX}
                    onPointerDown={pushUndoSnapshot}
                    onKeyDown={pushUndoSnapshot}
                    onChange={(e) =>
                      commitStage(
                        (s) => ({ ...s, camera: { ...s.camera, panX: +e.target.value } }),
                        false,
                      )
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between font-semibold">
                    <span>Pan Vertical (Y)</span>
                    <span className="font-mono">{activeStage.camera.panY}px</span>
                  </div>
                  <input
                    type="range"
                    min={-340}
                    max={420}
                    step={5}
                    value={activeStage.camera.panY}
                    onPointerDown={pushUndoSnapshot}
                    onKeyDown={pushUndoSnapshot}
                    onChange={(e) =>
                      commitStage(
                        (s) => ({ ...s, camera: { ...s.camera, panY: +e.target.value } }),
                        false,
                      )
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between font-semibold">
                    <span>Dutch Angle Tilt</span>
                    <span className="font-mono">{activeStage.camera.tilt}°</span>
                  </div>
                  <input
                    type="range"
                    min={-20}
                    max={20}
                    step={1}
                    value={activeStage.camera.tilt}
                    onPointerDown={pushUndoSnapshot}
                    onKeyDown={pushUndoSnapshot}
                    onChange={(e) =>
                      commitStage(
                        (s) => ({ ...s, camera: { ...s.camera, tilt: +e.target.value } }),
                        false,
                      )
                    }
                    className="w-full accent-primary"
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    commitStage(
                      (s) => ({ ...s, camera: { zoom: 1, panX: 0, panY: 0, tilt: 0 } }),
                      true,
                    )
                  }
                  className="w-full rounded-xs border border-border bg-background py-1.5 font-semibold hover:border-foreground"
                >
                  Reset Camera
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

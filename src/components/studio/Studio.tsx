import { FacePanel } from "./FacePanel";
import { loadPacks, savePacks, type FacePack } from "@/lib/face-parts";
import { ExtractOutfitModal } from "./ExtractOutfitModal";
import { WardrobePanel } from "./WardrobePanel";
import { CharacterPanel } from "./CharacterPanel";
import {
  DUMMY_MODEL, activeOutfitOf, addOutfit, customItemIds, deleteOutfit, duplicateCharacter, loadCharacters, newCharacter,
  renameOutfit, saveCharacters, updateActiveOutfit, upsertCharacter, type Character,
} from "@/lib/characters";
import type { VRM } from "@pixiv/three-vrm";
import { getFile, putFile } from "@/lib/file-store";
import { builtinModel, uploadedBodies } from "@/lib/base-models";
import { b64ToBlob, blobToB64, mergeById, parseBackup, referencedFileIds, type StudioBackup } from "@/lib/backup";
import {
  createDefaultPages,
  externalizePageAssets,
  hydratePageAssets,
  loadChapterState,
  saveChapterState,
} from "@/lib/chapter-storage";
import {
  createHistory,
  pushHistory,
  redoHistory,
  resetHistory,
  undoHistory,
  type HistoryState,
} from "@/lib/history";
import { generateAiPose } from "@/lib/ai-pose.functions";
import { loadWardrobeAsset } from "./WardrobeRig";
import type { CustomAsset } from "./WardrobeRig";
import { equip, loadOutfit, saveOutfit, type Outfit } from "@/lib/wardrobe";
import { DEFAULT_FACE, loadFace, saveFace, type FaceConfig } from "@/lib/face-library";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  applyPose,
  groundedHipsDrop,
  mirrorBoneName,
  mirrorPose,
  offsetFromBone,
  type Pose,
  type PoseData,
  type Rig,
  type Rot,
} from "@/lib/rig";
import { CATEGORIES, POSES } from "@/lib/poses";
import { applyHandPresetToPose, HAND_PRESETS, type HandSide } from "@/lib/hand-poses";
import {
  LIGHT_PRESETS,
  OUTLINE_SWATCHES,
  lightCartesianToSpherical,
  lightSphericalToCartesian,
} from "@/lib/lighting";
import {
  Viewport,
  toonify,
  type ViewSettings,
  type CameraPose,
  CAMERA_PRESETS,
  type ViewportHandle,
} from "./Viewport";
import { loadCharacterModel, type LoadedCharacter } from "@/lib/model-loader";
import {
  loadCustomPoses,
  saveCustomPose,
  deleteCustomPose,
  type CustomPose,
} from "@/lib/pose-storage";
import { SnapshotModal } from "./SnapshotModal";
import { SavePoseModal } from "./SavePoseModal";
import type { SnapshotResult } from "@/lib/snapshot";
import {
  Camera,
  BookmarkPlus,
  Sparkles,
  Trash2,
  RotateCw,
  Eye,
  EyeOff,
  Copy,
  Plus,
  Sword,
  Package,
  Undo2,
  Redo2,
} from "lucide-react";
const PanelStudio = lazy(() =>
  import("@/components/panels/PanelStudio").then((m) => ({ default: m.PanelStudio })),
);
import {
  type PageLayout,
  type PlacedElement,
  PAGE_FORMATS,
  getPresetPanels,
  getPanelPixelBounds,
} from "@/lib/manga-layout";
import {
  BUILTIN_PROPS,
  createActiveProp,
  ATTACHABLE_BONES,
  type ActiveProp,
  type PropTransform,
  type PropCategory,
} from "@/lib/props";
import { saveRosterItem } from "@/lib/character-roster";
import { solveCCD, chainOffsets, pinFeet } from "@/lib/ik";
import {
  nextStagePosition,
  serializeCastForSnapshot,
  type StagedActor,
} from "@/lib/scene-cast";
import { snapPropToHand } from "@/lib/prop-grips";
import {
  deleteCustomPropMeta,
  detectPropExtension,
  loadCustomPropObject,
  loadCustomPropsMeta,
  saveCustomPropsMeta,
  upsertCustomPropMeta,
  type CustomPropMeta,
} from "@/lib/custom-props";

const AXES = ["X", "Y", "Z"] as const;

export function Studio() {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [rig, setRig] = useState<Rig | null>(null);
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [modelName, setModelName] = useState("");
  const [modelType, setModelType] = useState<string>("glb");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Pose state + Undo/Redo history
  const [poseHist, setPoseHist] = useState<HistoryState<{ pose: PoseData; hipsDrop: number }>>(() =>
    createHistory({ pose: {}, hipsDrop: 0 }),
  );
  const pose = poseHist.present.pose;
  const hipsDrop = poseHist.present.hipsDrop;
  const canUndoPose = poseHist.past.length > 0;
  const canRedoPose = poseHist.future.length > 0;
  const setPoseAndDrop = useCallback(
    (
      updater: (cur: { pose: PoseData; hipsDrop: number }) => { pose: PoseData; hipsDrop: number },
      coalesceMs = 0,
    ) => {
      setPoseHist((h) => pushHistory(h, updater(h.present), { coalesceMs }));
    },
    [],
  );
  const setPose = useCallback(
    (valOrFn: PoseData | ((cur: PoseData) => PoseData), coalesceMs = 0) => {
      setPoseAndDrop(
        (cur) => ({
          ...cur,
          pose: typeof valOrFn === "function" ? valOrFn(cur.pose) : valOrFn,
        }),
        coalesceMs,
      );
    },
    [setPoseAndDrop],
  );
  const setHipsDrop = useCallback(
    (valOrFn: number | ((cur: number) => number), coalesceMs = 0) => {
      setPoseAndDrop(
        (cur) => ({
          ...cur,
          hipsDrop: typeof valOrFn === "function" ? valOrFn(cur.hipsDrop) : valOrFn,
        }),
        coalesceMs,
      );
    },
    [setPoseAndDrop],
  );
  const undoPose = useCallback(() => setPoseHist((h) => undoHistory(h)), []);
  const redoPose = useCallback(() => setPoseHist((h) => redoHistory(h)), []);
  const [activePose, setActivePose] = useState<string | null>(null);
  const [customPoses, setCustomPoses] = useState<CustomPose[]>([]);
  const [category, setCategory] = useState<string>("Standing");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // 3D Props & Multi-Actor Scene Cast state
  const [propsList, setPropsList] = useState<ActiveProp[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [customPropsMeta, setCustomPropsMeta] = useState<CustomPropMeta[]>([]);
  const [customPropObjects, setCustomPropObjects] = useState<Record<string, THREE.Object3D>>({});
  const customPropFileRef = useRef<HTMLInputElement>(null);

  const [activeActorMeta, setActiveActorMeta] = useState<{
    id: string;
    modelKey: string;
    position: [number, number, number];
    rotationY: number;
    visible: boolean;
  }>({
    id: "actor-primary",
    modelKey: DUMMY_MODEL,
    position: [0, 0, 0],
    rotationY: 0,
    visible: true,
  });
  const [coActors, setCoActors] = useState<StagedActor[]>([]);
  const [stageCharPick, setStageCharPick] = useState<string>("__demo__");
  const [stagingBusy, setStagingBusy] = useState(false);

  const [leftTab, setLeftTab] = useState<"poses" | "props" | "cast" | "face" | "outfit">("poses");
  const [propCategory, setPropCategory] = useState<PropCategory>("weapons");

  // Camera & Rendering Settings
  const [cameraPose, setCameraPose] = useState<CameraPose | null>(null);
  const [handSide, setHandSide] = useState<HandSide>("Both");
  const [settings, setSettings] = useState<ViewSettings>({
    outline: 3,
    outlineColor: "#0d0d0d",
    mono: false,
    tones: 3,
    shadowHatch: false,
    showJoints: true,
    fov: 35,
    lightIntensity: 2.2,
    rimIntensity: 0.5,
    fillIntensity: 0.6,
    lightAngle: lightSphericalToCartesian(40, 46),
  });

  // VRM Expression sliders
  const [vrmExpressions, setVrmExpressions] = useState<Record<string, number>>({
    happy: 0,
    angry: 0,
    sad: 0,
    relaxed: 0,
    surprised: 0,
    blink: 0,
  });

  // Navigation & Multi-Page Chapter State
  const [face, setFace] = useState<FaceConfig>(DEFAULT_FACE);
  const [faceFitRequest, setFaceFitRequest] = useState(0);
  const [facePacks, setFacePacks] = useState<FacePack[]>([]);
  useEffect(() => { setFacePacks(loadPacks()); }, []);
  const updateFacePacks = (p: FacePack[]) => { setFacePacks(p); if (!savePacks(p)) alert("Browser storage is full; this face pack will only last until you reload."); };
  const activeFacePack = facePacks.find((p) => p.id === face.pack) ?? null;
  const [extractOpen, setExtractOpen] = useState(false);
  const faceModelRef = useRef<string>("");
  // When a saved character is loaded its own face/outfit win over the per-model defaults.
  const charRef = useRef<string | null>(null);
  useEffect(() => {
    if (!modelName || charRef.current) return;
    faceModelRef.current = modelName;
    setFace(loadFace(modelName));
  }, [modelName]);
  useEffect(() => {
    if (faceModelRef.current === modelName && modelName && !charRef.current) saveFace(modelName, face);
  }, [face, modelName]);
  // First time a model is seen, line the face up with its skin automatically.
  useEffect(() => {
    if (rig && !face.fitted && faceModelRef.current === modelName) setFaceFitRequest((n) => n + 1);
  }, [rig, face.fitted, modelName]);
  // Outfit (hair, clothes, accessories) saved per model; imported files stay in memory.
  const [outfit, setOutfit] = useState<Outfit>({});
  const [wardrobeAssets, setWardrobeAssets] = useState<Record<string, CustomAsset>>({});
  const outfitModelRef = useRef<string>("");
  useEffect(() => {
    if (!modelName || charRef.current) return;
    outfitModelRef.current = modelName;
    setOutfit(loadOutfit(modelName));
  }, [modelName]);
  useEffect(() => {
    if (outfitModelRef.current === modelName && modelName && !charRef.current) saveOutfit(modelName, outfit);
  }, [outfit, modelName]);
  const [activeTab, setActiveTab] = useState<"create" | "pose" | "panels">("create");
  const [chapterHist, setChapterHist] = useState<HistoryState<{ pages: PageLayout[]; activePageIndex: number }>>(() =>
    createHistory({ pages: createDefaultPages(), activePageIndex: 0 }),
  );
  const [chapterHydrated, setChapterHydrated] = useState(false);
  const pages = chapterHist.present.pages;
  const activePageIndex = chapterHist.present.activePageIndex;
  const canUndoChapter = chapterHist.past.length > 0;
  const canRedoChapter = chapterHist.future.length > 0;
  const currentPageLayout = pages[activePageIndex] || pages[0];

  const commitChapter = useCallback(
    (
      updater: (cur: { pages: PageLayout[]; activePageIndex: number }) => {
        pages: PageLayout[];
        activePageIndex: number;
      },
      coalesceMs = 0,
    ) => {
      setChapterHist((h) => pushHistory(h, updater(h.present), { coalesceMs }));
    },
    [],
  );
  const undoChapter = useCallback(() => setChapterHist((h) => undoHistory(h)), []);
  const redoChapter = useCallback(() => setChapterHist((h) => redoHistory(h)), []);

  // Load persisted manga chapter pages from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    loadChapterState()
      .then((saved) => {
        if (!mounted) return;
        if (saved) setChapterHist(resetHistory(saved));
      })
      .finally(() => {
        if (mounted) setChapterHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Persist chapter changes continuously after initial hydration
  useEffect(() => {
    if (!chapterHydrated) return;
    const t = setTimeout(() => {
      void saveChapterState(pages, activePageIndex);
    }, 150);
    return () => clearTimeout(t);
  }, [pages, activePageIndex, chapterHydrated]);

  // Global keyboard shortcuts for Undo / Redo across Pose Studio and Manga Panels
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (activeTab === "panels") undoChapter();
        else if (activeTab === "pose") undoPose();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        if (activeTab === "panels") redoChapter();
        else if (activeTab === "pose") redoPose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, undoChapter, redoChapter, undoPose, redoPose]);

  // Snapshot & Save modals
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [currentSnapshot, setCurrentSnapshot] = useState<SnapshotResult | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [poseThumbnail, setPoseThumbnail] = useState<string | undefined>(undefined);

  const fileRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<ViewportHandle>(null);

  // Load custom poses & custom 3D props on mount
  useEffect(() => {
    setCustomPoses(loadCustomPoses());
    const metas = loadCustomPropsMeta();
    setCustomPropsMeta(metas);
    metas.forEach(async (m) => {
      const f = await getFile(m.fileId).catch(() => null);
      if (!f) return;
      try {
        const obj = await loadCustomPropObject(f.blob, f.name);
        toonify(obj, settings.tones, settings.mono, Boolean(settings.shadowHatch));
        setCustomPropObjects((cur) => ({ ...cur, [m.id]: obj }));
      } catch {
        /* skip unreadable prop asset */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (url: string, ext: string, name: string) => {
    setLoading(true);
    setError("");
    try {
      const char: LoadedCharacter = await loadCharacterModel(url, ext, name);
      setModel(char.object);
      setRig(char.rig);
      setVrm(char.vrm ?? null);
      setModelName(name);
      setModelType(char.type);
      setSelected(null);
      setPoseHist(resetHistory({ pose: {}, hipsDrop: 0 }));
      setActivePose(null);
      return true;
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not load 3D model.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Default demo model
  const loadedModelKey = useRef<string>("");
  useEffect(() => {
    loadedModelKey.current = DUMMY_MODEL;
    load("/models/xbot.glb", "glb", "X Bot (demo)");
  }, [load]);

  // ---------- Characters ----------
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const [charLoaded, setCharLoaded] = useState<string | null>(null);
  useEffect(() => { setCharacters(loadCharacters()); }, []);
  const activeChar = characters.find((c) => c.id === activeCharId) ?? null;
  const commitChars = (fn: (list: Character[]) => Character[]) =>
    setCharacters((list) => { const n = fn(list); if (!saveCharacters(n)) alert("Browser storage is full; recent character changes may not be saved."); return n; });
  const patchChar = (id: string, fn: (c: Character) => Character) =>
    commitChars((list) => list.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c)));

  /** Loads a character's body (only if different), its saved clothing files, face, and the chosen outfit. */
  const showCharacter = useCallback(async (c: Character | null, outfitId?: string) => {
    charRef.current = c?.id ?? null;
    setCharLoaded(null);
    setActiveCharId(c?.id ?? null);
    const key = c?.model ?? DUMMY_MODEL;
    setActiveActorMeta((m) => ({ ...m, modelKey: key }));
    if (loadedModelKey.current !== key) {
      let ok = false;
      const bm = builtinModel(key);
      if (bm) ok = await load(bm.url, bm.ext, bm.name);
      else {
        const f = await getFile(key).catch(() => null);
        if (f) ok = await load(URL.createObjectURL(f.blob), f.name.split(".").pop()?.toLowerCase() ?? "glb", f.name);
        else setError("This character's body file is missing from this browser. Upload it again in Create Character.");
      }
      if (ok) loadedModelKey.current = key;
    }
    if (!c) {
      // Back to the plain test dummy with its own saved face/outfit.
      faceModelRef.current = ""; outfitModelRef.current = "";
      setFace(loadFace("X Bot (demo)")); setOutfit(loadOutfit("X Bot (demo)")); setPropsList([]);
      faceModelRef.current = "X Bot (demo)"; outfitModelRef.current = "X Bot (demo)";
      return;
    }
    const needed = customItemIds(c);
    const found: Record<string, CustomAsset> = {};
    await Promise.all(needed.map(async (id) => {
      const f = await getFile(id).catch(() => null);
      if (!f) return;
      try {
        const a = await loadWardrobeAsset(new File([f.blob], f.name), (f.slot ?? "top") as CustomAsset["slot"]);
        found[id] = { ...a, id, name: f.name.replace(/\.[^.]+$/, "") };
      } catch { /* skip broken file */ }
    }));
    setWardrobeAssets((m) => ({ ...found, ...m }));
    const o = c.outfits.find((x) => x.id === (outfitId ?? c.activeOutfit)) ?? activeOutfitOf(c);
    const outfitClean = Object.fromEntries(Object.entries(o.outfit).filter(([, v]) => v && (!v.itemId.startsWith("custom:") || found[v.itemId])));
    setFace(c.face);
    setOutfit(outfitClean);
    setPropsList(o.props.map((p) => ({ ...p })));
    setSelectedPropId(null);
    setCharLoaded(c.id);
  }, [load]);

  // Create tab: every face / outfit / prop edit saves straight into the character.
  useEffect(() => {
    if (activeTab !== "create" || !activeCharId || charLoaded !== activeCharId) return;
    patchChar(activeCharId, (c) => updateActiveOutfit({ ...c, face: { ...face, expression: "Neutral", overrides: {}, fx: [] } }, { outfit, props: propsList }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [face, outfit, propsList]);

  useEffect(() => {
    if (activeTab === "create" && leftTab === "poses") setLeftTab("outfit");
    if (activeTab === "pose" && activeChar && leftTab === "outfit") setLeftTab("poses");
  }, [activeTab, leftTab, activeChar]);

  const goTab = (t: "create" | "pose" | "panels") => {
    // Returning to the creator restores the character's saved master look (pose-only tweaks are dropped).
    if (t === "create" && activeTab !== "create" && activeChar) showCharacter(activeChar);
    setActiveTab(t);
  };

  const createCharacter = () => {
    const c = newCharacter(`Character ${characters.length + 1}`);
    // Start from whatever is on the dummy now so nothing is lost.
    const seeded = loadedModelKey.current === DUMMY_MODEL && !activeChar
      ? updateActiveOutfit({ ...c, face: { ...face, expression: "Neutral", overrides: {}, fx: [] } }, { outfit, props: propsList })
      : c;
    commitChars((l) => upsertCharacter(l, seeded));
    showCharacter(seeded);
  };

  const setCharacterBody = async (f: File | string | null) => {
    if (!activeChar) return;
    let model = DUMMY_MODEL, modelName = "X Bot (demo)";
    if (typeof f === "string") {
      model = f;
      modelName = builtinModel(f)?.name ?? characters.find((c) => c.model === f)?.modelName ?? f;
    } else if (f) {
      model = `file:${crypto.randomUUID()}`; modelName = f.name;
      try { await putFile(model, f, f.name); } catch { setError("Could not save that file in this browser."); return; }
    }
    // A new body needs the face lined up again.
    const updated: Character = { ...activeChar, model, modelName, face: { ...activeChar.face, fitted: false } };
    commitChars((l) => upsertCharacter(l, updated));
    showCharacter(updated);
  };

  const storeAssetFile = (a: CustomAsset, file?: File) => {
    if (file) putFile(a.id, file, file.name, a.slot).catch(() => {});
  };

  // Toon shading & co-actor sync updates
  useEffect(() => {
    if (model) toonify(model, settings.tones, settings.mono, Boolean(settings.shadowHatch), activeChar?.skinColor);
    for (const co of coActors) {
      if (co.model) toonify(co.model, settings.tones, settings.mono, Boolean(settings.shadowHatch));
    }
    for (const propObj of Object.values(customPropObjects)) {
      toonify(propObj, settings.tones, settings.mono, Boolean(settings.shadowHatch));
    }
  }, [model, coActors, customPropObjects, settings.tones, settings.mono, settings.shadowHatch, activeChar?.skinColor]);

  // Apply pose to rig (active actor + co-actors)
  useEffect(() => {
    if (rig) applyPose(rig, activeTab === "create" ? {} : pose, activeTab === "create" ? 0 : hipsDrop);
  }, [rig, pose, hipsDrop, activeTab]);

  useEffect(() => {
    for (const co of coActors) {
      if (co.rig) applyPose(co.rig, co.pose, co.hipsDrop);
    }
  }, [coActors]);

  // Update VRM expressions
  useEffect(() => {
    const em = vrm?.expressionManager;
    if (em) {
      Object.entries(vrmExpressions).forEach(([name, val]) => {
        em.setValue(name, val);
      });
      em.update();
    }
  }, [vrm, vrmExpressions]);

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["glb", "gltf", "fbx", "vrm", "obj"].includes(ext)) {
      setError("Supported formats: .fbx (Mixamo), .vrm, .glb, .gltf, or .obj");
      return;
    }
    load(URL.createObjectURL(f), ext, f.name);
  };

  const allAvailablePoses = useMemo(() => {
    return [...POSES, ...customPoses];
  }, [customPoses]);

  const allCategories = useMemo(() => {
    const cats = new Set(allAvailablePoses.map((p) => p.category));
    if (customPoses.length > 0) cats.add("Custom");
    return Array.from(cats);
  }, [allAvailablePoses, customPoses]);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [aiFromCurrent, setAiFromCurrent] = useState(false);
  const [aiGround, setAiGround] = useState(true);
  const [aiVariations, setAiVariations] = useState<{ bones: PoseData; hipsDrop: number; note: string }[]>([]);
  const [aiPick, setAiPick] = useState(0);
  const applyAiVariation = (v: { bones: PoseData; hipsDrop: number; note: string }, i: number) => {
    let hd = v.hipsDrop;
    if (aiGround && rig && hd >= 0) hd = Math.max(-0.6, Math.min(1.2, groundedHipsDrop(rig, v.bones, hd)));
    setPoseAndDrop(() => ({ pose: { ...v.bones }, hipsDrop: +hd.toFixed(3) }));
    setActivePose(null); setAiPick(i);
    setAiNote(v.note || "Pose applied — fine-tune with the joint controls.");
  };
  const runAiPose = async () => {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true); setAiNote("");
    try {
      const r = await generateAiPose({ data: { prompt: aiPrompt, current: aiFromCurrent ? { bones: pose, hipsDrop } : null } });
      if ("error" in r) { setAiNote(r.error); return; }
      setAiVariations(r.variations);
      applyAiVariation(r.variations[0], 0);
    } catch { setAiNote("Couldn't reach the AI. Try again."); } finally { setAiBusy(false); }
  };

  const exportBackup = async () => {
    const externalPages = await externalizePageAssets(pages);
    const files = [];
    for (const id of referencedFileIds(
      characters,
      externalPages,
      customPropsMeta.map((p) => p.fileId),
    )) {
      const f = await getFile(id).catch(() => null);
      if (f) files.push({ id, name: f.name, slot: f.slot, type: f.blob.type || "application/octet-stream", data: await blobToB64(f.blob) });
    }
    const b: StudioBackup = {
      app: "koma-studio",
      version: 1,
      exported: Date.now(),
      characters,
      facePacks,
      files,
      pages: externalPages,
      activePageIndex,
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: "application/json" }));
    a.download = `manga-studio-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const importBackup = async (file: File) => {
    try {
      const b = parseBackup(await file.text());
      for (const f of b.files) await putFile(f.id, b64ToBlob(f.data, f.type), f.name, f.slot);
      commitChars((l) => mergeById(l, b.characters));
      updateFacePacks(mergeById(facePacks, b.facePacks));
      if (b.pages && b.pages.length > 0) {
        const hydrated = await hydratePageAssets(b.pages);
        await saveChapterState(hydrated, b.activePageIndex ?? 0);
      }
      const pageCount = b.pages?.length ?? 0;
      alert(`Restored ${b.characters.length} character(s), ${b.facePacks.length} face pack(s), ${pageCount} page(s), and ${b.files.length} file(s). The page will reload to load them.`);
      location.reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Couldn't read that backup."); }
  };

  const applyPreset = (preset: Pose | CustomPose) => {
    setActivePose(preset.id);
    if (preset.partial) {
      setPose((cur) => ({ ...cur, ...preset.bones }));
    } else {
      setPoseAndDrop(() => ({ pose: { ...preset.bones }, hipsDrop: preset.hipsDrop ?? 0 }));
    }
  };

  const setRot = (bone: string, axis: number, v: number) =>
    setPose(
      (cur) => {
        const r: Rot = [...(cur[bone] ?? [0, 0, 0])] as Rot;
        r[axis] = v;
        return { ...cur, [bone]: r };
      },
      350,
    );

  const [ikMode, setIkMode] = useState(true);
  const [pinFeetOn, setPinFeetOn] = useState(true);
  const [cameraLocked, setCameraLocked] = useState(false);
  const onIkDrag = (effector: string, world: THREE.Vector3) => {
    if (!rig) return;
    if (effector === "Hips") {
      if (!rig.hipsRestWorld) return;
      const feet = pinFeetOn
        ? {
            LeftFoot: rig.bones.get("LeftFoot")?.getWorldPosition(new THREE.Vector3()),
            RightFoot: rig.bones.get("RightFoot")?.getWorldPosition(new THREE.Vector3()),
          }
        : {};
      const drop = Math.max(-0.3, Math.min(1.2, (rig.hipsRestWorld.y - world.y) / rig.scale));
      applyPose(rig, pose, drop);
      const legs = pinFeet(rig, feet as Record<string, THREE.Vector3>);
      setPoseAndDrop((cur) => ({ pose: { ...cur.pose, ...legs }, hipsDrop: drop }), 350);
      return;
    }
    solveCCD(rig, effector, world);
    const offs = chainOffsets(rig, effector);
    setPose((cur) => ({ ...cur, ...offs }), 350);
  };

  const onBoneDrag = () => {
    if (!rig || !selected) return;
    const r = offsetFromBone(rig, selected);
    setPose((cur) => ({ ...cur, [selected]: r }), 350);
  };

  // 3D Props Handlers
  const handleAddProp = (propDefId: string) => {
    const newProp = createActiveProp(propDefId);
    setPropsList((cur) => [...cur, newProp]);
    setSelectedPropId(newProp.id);
  };

  const handleUpdateProp = (id: string, updated: Partial<ActiveProp>) => {
    setPropsList((cur) => cur.map((p) => (p.id === id ? { ...p, ...updated } : p)));
  };

  const handleDeleteProp = (id: string) => {
    setPropsList((cur) => cur.filter((p) => p.id !== id));
    if (selectedPropId === id) setSelectedPropId(null);
  };

  const handleDuplicateProp = (id: string) => {
    const source = propsList.find((p) => p.id === id);
    if (!source) return;
    const dup: ActiveProp = {
      ...source,
      id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${source.name} (Copy)`,
      transform: {
        position: [
          source.transform.position[0] + 0.1,
          source.transform.position[1],
          source.transform.position[2] + 0.1,
        ],
        rotation: [...source.transform.rotation],
        scale: [...source.transform.scale],
      },
    };
    setPropsList((cur) => [...cur, dup]);
    setSelectedPropId(dup.id);
  };

  const handleSnapPropToHand = (hand: "RightHand" | "LeftHand") => {
    if (!selectedProp) return;
    const { propPatch, posePatch } = snapPropToHand(selectedProp, hand);
    handleUpdateProp(selectedProp.id, propPatch);
    setPose((cur) => ({ ...cur, ...posePatch }));
  };

  const handleImportCustomProp = async (file: File | undefined) => {
    if (!file) return;
    const ext = detectPropExtension(file.name);
    if (!ext) {
      alert("Unsupported prop format. Please upload .glb, .gltf, .fbx, or .obj.");
      return;
    }
    try {
      const fileId = `propfile:${crypto.randomUUID()}`;
      await putFile(fileId, file, file.name, "prop");
      const obj = await loadCustomPropObject(file, file.name);
      toonify(obj, settings.tones, settings.mono, Boolean(settings.shadowHatch));
      const cleanName = file.name.replace(/\.[^.]+$/, "");
      const meta: CustomPropMeta = {
        id: `customprop:${crypto.randomUUID()}`,
        name: cleanName,
        fileId,
        ext,
        defaultBone: "RightHand",
      };
      setCustomPropObjects((cur) => ({ ...cur, [meta.id]: obj }));
      setCustomPropsMeta((cur) => {
        const next = upsertCustomPropMeta(cur, meta);
        saveCustomPropsMeta(next);
        return next;
      });
      const spawned: ActiveProp = {
        id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        propDefId: meta.id,
        name: cleanName,
        attachedBone: meta.defaultBone,
        transform: { position: [0.01, -0.01, 0.03], rotation: [85, 0, 0], scale: [1, 1, 1] },
        visible: true,
      };
      setPropsList((cur) => [...cur, spawned]);
      setSelectedPropId(spawned.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not load custom prop file.");
    }
  };

  const handleSpawnCustomProp = (meta: CustomPropMeta) => {
    const spawned: ActiveProp = {
      id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      propDefId: meta.id,
      name: meta.name,
      attachedBone: meta.defaultBone,
      transform: { position: [0.01, -0.01, 0.03], rotation: [85, 0, 0], scale: [1, 1, 1] },
      visible: true,
    };
    setPropsList((cur) => [...cur, spawned]);
    setSelectedPropId(spawned.id);
  };

  const handleRemoveCustomProp = (id: string) => {
    setCustomPropsMeta((cur) => {
      const next = deleteCustomPropMeta(cur, id);
      saveCustomPropsMeta(next);
      return next;
    });
  };

  // Multi-actor Scene Cast helpers
  const buildStagedActorFromChar = useCallback(
    async (
      charOrNull: Character | null,
      position: [number, number, number],
      rotationY = 0,
      poseInit: PoseData = {},
      hipsInit = 0,
      actorId = `actor-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    ): Promise<StagedActor | null> => {
      const key = charOrNull?.model ?? DUMMY_MODEL;
      let loaded: LoadedCharacter;
      const bm = builtinModel(key);
      if (bm) {
        loaded = await loadCharacterModel(bm.url, bm.ext, bm.name);
      } else {
        const f = await getFile(key).catch(() => null);
        if (!f) return null;
        const url = URL.createObjectURL(f.blob);
        try {
          loaded = await loadCharacterModel(url, f.name.split(".").pop()?.toLowerCase() ?? "glb", f.name);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      const wAssets: Record<string, CustomAsset> = {};
      if (charOrNull) {
        await Promise.all(
          customItemIds(charOrNull).map(async (id) => {
            const f = await getFile(id).catch(() => null);
            if (!f) return;
            try {
              const a = await loadWardrobeAsset(new File([f.blob], f.name), (f.slot ?? "top") as CustomAsset["slot"]);
              wAssets[id] = { ...a, id, name: f.name.replace(/\.[^.]+$/, "") };
            } catch {
              /* skip broken item */
            }
          }),
        );
      }
      toonify(loaded.object, settings.tones, settings.mono, Boolean(settings.shadowHatch));
      if (loaded.rig) applyPose(loaded.rig, poseInit, hipsInit);
      const activeOutfit = charOrNull ? activeOutfitOf(charOrNull) : null;
      return {
        id: actorId,
        characterId: charOrNull?.id ?? null,
        name: charOrNull?.name ?? "X Bot (demo)",
        modelKey: key,
        position,
        rotationY,
        pose: { ...poseInit },
        hipsDrop: hipsInit,
        face: charOrNull ? charOrNull.face : loadFace("X Bot (demo)"),
        outfit: activeOutfit ? { ...activeOutfit.outfit } : loadOutfit("X Bot (demo)"),
        props: activeOutfit ? activeOutfit.props.map((p) => ({ ...p })) : [],
        vrmExpressions: { happy: 0, angry: 0, sad: 0, relaxed: 0, surprised: 0, blink: 0 },
        visible: true,
        model: loaded.object,
        rig: loaded.rig,
        vrm: loaded.vrm ?? null,
        wardrobeAssets: wAssets,
      };
    },
    [settings.tones, settings.mono, settings.shadowHatch],
  );

  const handleStageCharacter = async () => {
    if (stagingBusy) return;
    setStagingBusy(true);
    try {
      const targetChar =
        stageCharPick === "__demo__"
          ? null
          : characters.find((c) => c.id === stageCharPick) ?? null;
      const slotPos = nextStagePosition(1 + coActors.length);
      const staged = await buildStagedActorFromChar(targetChar, slotPos, 0);
      if (staged) setCoActors((cur) => [...cur, staged]);
      else setError("Selected character's model file is missing from browser storage.");
    } finally {
      setStagingBusy(false);
    }
  };

  const switchActiveActor = (targetId: string) => {
    if (targetId === activeActorMeta.id) return;
    const target = coActors.find((a) => a.id === targetId);
    if (!target) return;
    const currentSnapshotActor: StagedActor = {
      id: activeActorMeta.id,
      characterId: activeCharId,
      name: activeChar?.name ?? (modelName || "Primary Figure"),
      modelKey: activeActorMeta.modelKey,
      position: [...activeActorMeta.position],
      rotationY: activeActorMeta.rotationY,
      pose: { ...pose },
      hipsDrop,
      face,
      outfit,
      props: propsList.map((p) => ({ ...p })),
      vrmExpressions: { ...vrmExpressions },
      visible: activeActorMeta.visible,
      model,
      rig,
      vrm,
      wardrobeAssets,
    };
    setCoActors((cur) => cur.map((a) => (a.id === targetId ? currentSnapshotActor : a)));
    charRef.current = target.characterId;
    loadedModelKey.current = target.modelKey;
    setActiveCharId(target.characterId);
    setCharLoaded(target.characterId);
    setActiveActorMeta({
      id: target.id,
      modelKey: target.modelKey,
      position: [...target.position],
      rotationY: target.rotationY,
      visible: target.visible,
    });
    setModel(target.model);
    setRig(target.rig);
    setVrm(target.vrm);
    setModelName(target.name);
    setPoseHist(resetHistory({ pose: { ...target.pose }, hipsDrop: target.hipsDrop }));
    setFace(target.face);
    setOutfit(target.outfit);
    setPropsList(target.props);
    setWardrobeAssets(target.wardrobeAssets);
    setVrmExpressions(target.vrmExpressions);
    setSelected(null);
    setSelectedPropId(null);
  };

  const handleToggleActorVisibility = (actorId: string) => {
    if (actorId === activeActorMeta.id) {
      setActiveActorMeta((m) => ({ ...m, visible: !m.visible }));
      return;
    }
    setCoActors((cur) => cur.map((a) => (a.id === actorId ? { ...a, visible: !a.visible } : a)));
  };

  const handleRemoveStagedActor = (actorId: string) => {
    if (coActors.length === 0) return;
    if (actorId === activeActorMeta.id) {
      const nextPrimary = coActors[0];
      switchActiveActor(nextPrimary.id);
      setCoActors((cur) => cur.filter((a) => a.id !== activeActorMeta.id));
      return;
    }
    setCoActors((cur) => cur.filter((a) => a.id !== actorId));
  };

  const selectedProp = propsList.find((p) => p.id === selectedPropId);

  // Snapshot triggers
  const handleCaptureSnapshot = (pixelRatio = 2) => {
    if (!viewportRef.current) return;
    const result = viewportRef.current.captureSnapshot({
      pixelRatio,
      outlineThickness: settings.outline,
      outlineColor: settings.outlineColor,
    });
    if (result) {
      setCurrentSnapshot(result);
      setSnapshotModalOpen(true);
    }
  };

  // Save custom pose
  const handleOpenSavePose = () => {
    if (!viewportRef.current) return;
    const thumb = viewportRef.current.captureSnapshot({ pixelRatio: 1 });
    setPoseThumbnail(thumb?.dataUrl);
    setSaveModalOpen(true);
  };

  const handleSavePose = (name: string, cat: string) => {
    const saved = saveCustomPose(name, cat, pose, hipsDrop, poseThumbnail);
    setCustomPoses(loadCustomPoses());
    setCategory(cat);
    setActivePose(saved.id);
  };

  const handleDeleteCustomPose = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteCustomPose(id);
    setCustomPoses(updated);
    if (activePose === id) setActivePose(null);
  };

  const visiblePoses = useMemo(() => {
    return allAvailablePoses.filter((p) =>
      search ? p.name.toLowerCase().includes(search.toLowerCase()) : p.category === category
    );
  }, [allAvailablePoses, search, category]);

  const sel = selected ? pose[selected] ?? [0, 0, 0] : null;

  // Multi-Page Management Handlers (backed by undo/redo + IndexedDB persistence)
  const handleUpdateCurrentPage = (updated: PageLayout) => {
    commitChapter(
      (cur) => ({
        ...cur,
        pages: cur.pages.map((p, idx) => (idx === cur.activePageIndex ? updated : p)),
      }),
      350,
    );
  };

  const handleSelectPage = (index: number) => {
    commitChapter((cur) => ({
      ...cur,
      activePageIndex: Math.max(0, Math.min(index, cur.pages.length - 1)),
    }));
  };

  const handleAddPage = () => {
    commitChapter((cur) => {
      const fmt = (cur.pages[cur.activePageIndex] || cur.pages[0]).format;
      const newPage: PageLayout = {
        id: `page-${Date.now()}`,
        pageNumber: cur.pages.length + 1,
        format: fmt,
        panels: getPresetPanels("classic-6"),
        elements: [],
        balloons: [],
        comicMarks: [],
        speedLines: [],
        sfxStamps: [],
      };
      return {
        pages: [...cur.pages, newPage],
        activePageIndex: cur.pages.length,
      };
    });
  };

  const handleDuplicatePage = (index: number) => {
    commitChapter((cur) => {
      const target = cur.pages[index];
      if (!target) return cur;
      const copy: PageLayout = {
        ...target,
        id: `page-${Date.now()}`,
        pageNumber: index + 2,
        elements: target.elements.map((el) => ({
          ...el,
          id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        })),
      };
      const updated = [...cur.pages];
      updated.splice(index + 1, 0, copy);
      return { pages: updated, activePageIndex: index + 1 };
    });
  };

  const handleDeletePage = (index: number) => {
    commitChapter((cur) => {
      if (cur.pages.length <= 1) return cur;
      const updated = cur.pages.filter((_, idx) => idx !== index);
      return {
        pages: updated,
        activePageIndex: Math.min(cur.activePageIndex, updated.length - 1),
      };
    });
  };

  const handleMovePage = (fromIndex: number, toIndex: number) => {
    commitChapter((cur) => {
      if (toIndex < 0 || toIndex >= cur.pages.length) return cur;
      const updated = [...cur.pages];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return { pages: updated, activePageIndex: toIndex };
    });
  };

  const handleUpdatePageAt = (index: number, updatedPage: PageLayout) => {
    commitChapter(
      (cur) => ({
        pages: cur.pages.map((p, idx) => (idx === index ? updatedPage : p)),
        activePageIndex: cur.activePageIndex,
      }),
      350,
    );
  };

  const handleInsertPageAt = (index: number, newPage: PageLayout) => {
    commitChapter((cur) => {
      const updated = [...cur.pages];
      const clamped = Math.max(0, Math.min(index, updated.length));
      updated.splice(clamped, 0, newPage);
      return { pages: updated, activePageIndex: clamped };
    });
  };

  // If in 2D Panels Studio mode, render full Manga Studio (code-split)
  const panelsView = activeTab === "panels" && (
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm font-semibold">Loading Manga Panel Studio...</div>}>
      <PanelStudio
        layout={currentPageLayout}
        onUpdateLayout={handleUpdateCurrentPage}
        onOpen3dStudio={() => setActiveTab("pose")}
        onRePoseIn3D={(source3d) => {
          if (source3d.cast && source3d.cast.length > 0) {
            const targetActiveId = source3d.activeActorId ?? source3d.cast[0].id;
            const primarySpec =
              source3d.cast.find((c) => c.id === targetActiveId) ?? source3d.cast[0];
            const otherSpecs = source3d.cast.filter((c) => c.id !== primarySpec.id);
            setPoseAndDrop(() => ({
              pose: { ...primarySpec.pose },
              hipsDrop: primarySpec.hipsDrop ?? 0,
            }));
            setActiveActorMeta((m) => ({
              ...m,
              id: primarySpec.id,
              position: [...primarySpec.position],
              rotationY: primarySpec.rotationY ?? 0,
            }));
            Promise.all(
              otherSpecs.map((spec) =>
                buildStagedActorFromChar(
                  spec.characterId
                    ? characters.find((ch) => ch.id === spec.characterId) ?? null
                    : null,
                  spec.position,
                  spec.rotationY,
                  spec.pose,
                  spec.hipsDrop,
                  spec.id,
                ),
              ),
            ).then((loadedOthers) => {
              setCoActors(loadedOthers.filter((x): x is StagedActor => x !== null));
            });
          } else {
            setPoseAndDrop(() => ({
              pose: source3d.pose ?? pose,
              hipsDrop: source3d.hipsDrop ?? hipsDrop,
            }));
          }
          if (source3d.cameraPose) setCameraPose(source3d.cameraPose);
          if (source3d.fov) setSettings((s) => ({ ...s, fov: source3d.fov }));
          setActiveTab("pose");
        }}
        allPages={pages}
        activePageIndex={activePageIndex}
        onSelectPage={handleSelectPage}
        onAddPage={handleAddPage}
        onDuplicatePage={handleDuplicatePage}
        onDeletePage={handleDeletePage}
        onMovePage={handleMovePage}
        onUpdatePageAt={handleUpdatePageAt}
        onInsertPageAt={handleInsertPageAt}
        canUndo={canUndoChapter}
        canRedo={canRedoChapter}
        onUndo={undoChapter}
        onRedo={redoChapter}
      />
      </Suspense>
  );

  return (
    <>
    {panelsView}
    <div className={`${activeTab === "panels" ? "hidden" : "flex"} h-screen flex-col bg-background text-foreground select-none`}>
      {/* Top Bar */}
      <header className="flex items-center gap-4 border-b-2 border-foreground px-4 py-2 bg-card">
        <h1 className="font-display text-xl tracking-wide">
          INKED<span className="text-primary">FIGURE</span>
        </h1>

        <nav className="flex items-center gap-1 text-sm">
          {([["create", "Create Character"], ["pose", "3D Pose Studio"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => goTab(t)} aria-pressed={activeTab === t}
              className={`whitespace-nowrap rounded-sm px-3 py-1 font-semibold transition-colors ${activeTab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
          <button
            onClick={() => goTab("panels")}
            className="whitespace-nowrap rounded-sm px-3 py-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Manga Panels {currentPageLayout.elements.length > 0 && `(${currentPageLayout.elements.length})`}
          </button>
        </nav>

        {activeTab === "pose" && (
          <div className="flex items-center gap-1.5 text-xs" data-testid="pose-character-picker">
            <label className="font-semibold">Character
              <select aria-label="Character" value={activeCharId ?? ""} className="ml-1 rounded-sm border border-input bg-background p-1"
                onChange={(e) => showCharacter(characters.find((c) => c.id === e.target.value) ?? null)}>
                <option value="">Test dummy</option>
                {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {activeChar && (
              <label className="font-semibold">Outfit
                <select aria-label="Outfit" key={activeChar.id} defaultValue={activeChar.activeOutfit} className="ml-1 rounded-sm border border-input bg-background p-1"
                  onChange={(e) => showCharacter(activeChar, e.target.value)}>
                  {activeChar.outfits.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground text-xs hidden sm:inline">
            {modelName} ({modelType.toUpperCase()})
            {rig ? ` · ${rig.bones.size} bones mapped` : " · Static Object"}
          </span>

          <button
            onClick={() => handleCaptureSnapshot(2)}
            className="flex items-center gap-1.5 rounded-sm border-2 border-foreground bg-accent px-3 py-1 font-semibold shadow-ink transition-transform hover:-translate-y-0.5 text-xs"
          >
            <Camera className="h-4 w-4 text-primary" />
            Capture 2D Render
          </button>

          <button
            hidden={activeTab === "create" || !!activeChar}
            onClick={() => fileRef.current?.click()}
            className="rounded-sm border-2 border-foreground bg-primary px-3 py-1 font-semibold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5 text-xs"
          >
            Import Model (.fbx/.vrm/.glb)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".glb,.gltf,.fbx,.vrm,.obj"
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Pose Presets OR 3D Props Library */}
        <aside className="flex w-76 flex-col border-r-2 border-foreground bg-card">
          {/* Tabs: Poser vs 3D Props */}
          {activeTab === "create" && (
            <CharacterPanel
              onExport={exportBackup}
              onImport={importBackup}
              characters={characters}
              active={activeChar}
              onSelect={(id) => showCharacter(characters.find((c) => c.id === id) ?? null)}
              onNew={createCharacter}
              onRename={(name) => activeChar && patchChar(activeChar.id, (c) => ({ ...c, name }))}
              onDuplicate={() => { if (!activeChar) return; const d = duplicateCharacter(activeChar); commitChars((l) => upsertCharacter(l, d)); showCharacter(d); }}
              onDelete={() => { if (!activeChar) return; const id = activeChar.id; commitChars((l) => l.filter((c) => c.id !== id)); showCharacter(null); }}
              onModelFile={(f) => setCharacterBody(f)}
              onUseDummy={() => setCharacterBody(null)}
              onPickBody={(key) => setCharacterBody(key)}
              savedBodies={uploadedBodies(characters)}
              onSkin={(hex) => activeChar && patchChar(activeChar.id, (c) => ({ ...c, skinColor: hex }))}
              onSelectOutfit={(id) => { if (!activeChar) return; const u = { ...activeChar, activeOutfit: id }; patchChar(u.id, () => u); showCharacter(u); }}
              onAddOutfit={() => { if (!activeChar) return; const u = addOutfit(activeChar); patchChar(u.id, () => u); showCharacter(u); }}
              onDuplicateOutfit={() => { if (!activeChar) return; const u = addOutfit(activeChar, activeChar.activeOutfit); patchChar(u.id, () => u); showCharacter(u); }}
              onRenameOutfit={(id, name) => activeChar && patchChar(activeChar.id, (c) => renameOutfit(c, id, name))}
              onDeleteOutfit={(id) => { if (!activeChar) return; const u = deleteOutfit(activeChar, id); patchChar(u.id, () => u); showCharacter(u); }}
              onPose={() => goTab("pose")}
            />
          )}
          <div className="flex border-b-2 border-foreground bg-muted text-xs font-semibold">
            <button
              hidden={activeTab === "create"}
              onClick={() => setLeftTab("poses")}
              className={`flex-1 py-2 text-center transition-colors ${
                leftTab === "poses"
                  ? "border-b-2 border-primary bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🥋 Poses
            </button>
            <button
              onClick={() => setLeftTab("props")}
              className={`flex-1 py-2 text-center transition-colors ${
                leftTab === "props"
                  ? "border-b-2 border-primary bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🗡️ Props {propsList.length > 0 && `(${propsList.length})`}
            </button>
            <button
              hidden={activeTab === "create"}
              onClick={() => setLeftTab("cast")}
              className={`flex-1 py-2 text-center transition-colors ${
                leftTab === "cast"
                  ? "border-b-2 border-primary bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              👥 Cast ({1 + coActors.length})
            </button>
            <button
              onClick={() => setLeftTab("face")}
              className={`flex-1 py-2 text-center transition-colors ${
                leftTab === "face"
                  ? "border-b-2 border-primary bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              😠 Face
            </button>
            <button
              hidden={activeTab === "pose" && !!activeChar}
              onClick={() => setLeftTab("outfit")}
              className={`flex-1 py-2 text-center transition-colors ${
                leftTab === "outfit"
                  ? "border-b-2 border-primary bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              👕 Outfit
            </button>
          </div>

          {leftTab === "outfit" ? (
            <WardrobePanel
              outfit={outfit}
              onChange={setOutfit}
              assets={wardrobeAssets}
              onAddAsset={(a, file) => { setWardrobeAssets((m) => ({ ...m, [a.id]: a })); storeAssetFile(a, file); }}
              hasRig={!!rig}
              onOpenExtractor={() => setExtractOpen(true)}
            />
          ) : leftTab === "face" ? (
            <FacePanel
              face={face}
              onChange={setFace}
              hasHead={!!rig?.bones.get("Head")}
              onAutoFit={() => setFaceFitRequest((n) => n + 1)}
              packs={facePacks}
              onPacksChange={updateFacePacks}
              mode={activeTab === "create" ? "create" : activeChar ? "pose" : "all"}
            />
          ) : leftTab === "poses" ? (
            <>
              <div className="border-b border-border p-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg">Pose Library</h2>
                  <button
                    disabled={!rig}
                    onClick={handleOpenSavePose}
                    title="Save current joint angles as a reusable pose preset"
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Save Pose
                  </button>
                </div>

                <input
                  id="pose-search"
                  aria-label="Search poses"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${allAvailablePoses.length} poses…`}
                  className="mt-2 w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-foreground"
                />

                {!search && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {allCategories.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors ${
                          c === category
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        {c} {c === "Custom" && `(${customPoses.length})`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preset Grid */}
              <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3">
                {visiblePoses.map((p) => {
                  const isCustom = "createdAt" in p;
                  return (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p)}
                      disabled={!rig}
                      className={`relative screentone min-h-14 rounded-sm border-2 p-2 text-left text-xs font-semibold leading-tight transition-all disabled:opacity-40 group ${
                        activePose === p.id
                          ? "border-primary bg-primary/10"
                          : "border-foreground hover:-translate-y-0.5 hover:shadow-ink"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="truncate pr-1">{p.name}</span>
                        {isCustom && (
                          <button
                            onClick={(e) => handleDeleteCustomPose(p.id, e)}
                            title="Delete custom pose"
                            className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {p.partial && (
                        <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                          adds to pose
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Posing mode */}
              <div className="space-y-2 border-t border-border p-3 text-sm">
                <div className="flex gap-1">
                  {([["Drag Limbs", true], ["Rotate Joints", false]] as const).map(([label, v]) => (
                    <button
                      key={label}
                      onClick={() => setIkMode(v)}
                      className={`flex-1 rounded-sm border-2 border-foreground py-1 font-semibold ${ikMode === v ? "bg-foreground text-background" : "hover:bg-accent"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {ikMode && (
                  <>
                    <p className="text-[11px] text-muted-foreground">
                      Press on any body part and drag — the arms, legs and spine bend to follow. Drag empty space to turn the camera.
                    </p>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={pinFeetOn} onChange={(e) => setPinFeetOn(e.target.checked)} />
                      Keep feet planted when moving hips
                    </label>
                  </>
                )}

                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={cameraLocked} onChange={(e) => setCameraLocked(e.target.checked)} />
                  Lock camera
                </label>
              </div>
              <div className="space-y-1.5 border-t border-border p-3" data-testid="ai-pose">
                <p className="text-xs font-semibold">✨ Describe a pose (AI)</p>
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={2} aria-label="Pose description"
                  placeholder="e.g. furious hero pointing at the enemy, leaning forward"
                  className="w-full rounded-sm border border-input bg-background px-2 py-1 text-xs outline-none focus:border-foreground" />
                <button disabled={!rig || aiBusy || !aiPrompt.trim()} onClick={runAiPose}
                  className="w-full rounded-sm border-2 border-foreground bg-primary py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40">
                  {aiBusy ? "Posing…" : "Generate pose"}
                </button>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={aiFromCurrent} onChange={(e) => setAiFromCurrent(e.target.checked)} />
                  Edit current pose (keep what's already there)
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={aiGround} onChange={(e) => setAiGround(e.target.checked)} />
                  Keep feet on the floor
                </label>
                {aiVariations.length > 1 && (
                  <div className="flex gap-1" aria-label="AI variations">
                    {aiVariations.map((v, i) => (
                      <button key={i} onClick={() => applyAiVariation(v, i)}
                        className={`flex-1 rounded-sm border-2 py-1 text-xs font-semibold ${aiPick === i ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                        {"ABC"[i]}
                      </button>
                    ))}
                  </div>
                )}
                {aiVariations.length > 0 && (
                  <button onClick={handleOpenSavePose} className="w-full rounded-sm border border-foreground py-1 text-xs font-semibold">
                    💾 Save to Custom poses
                  </button>
                )}
                {aiNote && <p className="text-[10px] text-muted-foreground">{aiNote}</p>}
              </div>
              {/* Undo / Redo, Mirror & Reset Tools */}
              <div className="flex gap-1.5 border-t border-border p-3">
                <button
                  disabled={!rig || !canUndoPose}
                  onClick={undoPose}
                  title="Undo Pose (Ctrl+Z)"
                  aria-label="Undo Pose"
                  className="rounded-sm border-2 border-foreground px-2 py-1.5 hover:bg-accent disabled:opacity-35"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  disabled={!rig || !canRedoPose}
                  onClick={redoPose}
                  title="Redo Pose (Ctrl+Y)"
                  aria-label="Redo Pose"
                  className="rounded-sm border-2 border-foreground px-2 py-1.5 hover:bg-accent disabled:opacity-35"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
                <button
                  disabled={!rig}
                  onClick={() => {
                    setPose((c) => mirrorPose(c));
                    setSelected((s) => (s ? mirrorBoneName(s) : s));
                  }}
                  className="flex-1 rounded-sm border-2 border-foreground py-1.5 text-sm font-semibold hover:bg-accent transition-transform hover:-translate-y-0.5"
                >
                  ⇋ Mirror
                </button>
                <button
                  disabled={!rig}
                  onClick={() => {
                    setPoseAndDrop(() => ({ pose: {}, hipsDrop: 0 }));
                    setActivePose(null);
                  }}
                  className="flex-1 rounded-sm border-2 border-foreground py-1.5 text-sm font-semibold hover:bg-accent transition-transform hover:-translate-y-0.5"
                >
                  Reset
                </button>
              </div>
            </>
          ) : leftTab === "cast" ? (
            /* Multi-Character Scene Cast Panel */
            <div className="flex flex-1 flex-col overflow-y-auto p-3 space-y-3 text-xs">
              <div className="space-y-1.5 border-b border-border pb-3">
                <h2 className="font-display text-base">Stage Scene Cast</h2>
                <p className="text-[11px] text-muted-foreground">
                  Pose up to 4+ characters together with shared lighting, shadows, and transparent 2D cutout export.
                </p>
                <div className="flex gap-1.5 pt-1">
                  <select
                    aria-label="Character to stage"
                    value={stageCharPick}
                    onChange={(e) => setStageCharPick(e.target.value)}
                    className="flex-1 rounded border border-input bg-background p-1.5 text-xs"
                  >
                    <option value="__demo__">X Bot (demo)</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={stagingBusy}
                    onClick={handleStageCharacter}
                    className="rounded border-2 border-foreground bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {stagingBusy ? "…" : "+ Add"}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-display text-xs uppercase tracking-wider text-muted-foreground">
                  Active Stage Roster ({1 + coActors.length})
                </span>
                {[
                  {
                    id: activeActorMeta.id,
                    name: activeChar?.name ?? (modelName || "X Bot (demo)"),
                    visible: activeActorMeta.visible,
                    isActive: true,
                    pos: activeActorMeta.position,
                  },
                  ...coActors.map((co) => ({
                    id: co.id,
                    name: co.name,
                    visible: co.visible,
                    isActive: false,
                    pos: co.position,
                  })),
                ].map((actor) => (
                  <div
                    key={actor.id}
                    onClick={() => !actor.isActive && switchActiveActor(actor.id)}
                    className={`flex items-center justify-between rounded border p-2 cursor-pointer transition-colors ${
                      actor.isActive
                        ? "border-primary bg-primary/10 font-bold"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{actor.name}</span>
                        {actor.isActive && (
                          <span className="rounded bg-primary px-1 py-0.2 text-[9px] text-primary-foreground">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        x:{actor.pos[0].toFixed(2)}m z:{actor.pos[2].toFixed(2)}m
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="Toggle Visibility"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActorVisibility(actor.id);
                        }}
                        className="p-1 hover:text-primary"
                      >
                        {actor.visible ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </button>
                      {coActors.length > 0 && (
                        <button
                          type="button"
                          title="Remove from Scene"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveStagedActor(actor.id);
                          }}
                          className="p-1 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Selected Character Floor Placement</span>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveActorMeta((m) => ({ ...m, position: [0, 0, 0], rotationY: 0 }))
                    }
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent"
                  >
                    Center
                  </button>
                </div>
                <label className="block text-[11px]">
                  <span className="flex justify-between">
                    <span>Floor Left / Right (X)</span>
                    <span className="font-mono">{activeActorMeta.position[0].toFixed(2)}m</span>
                  </span>
                  <input
                    type="range"
                    aria-label="Actor Floor X"
                    min={-2.5}
                    max={2.5}
                    step={0.05}
                    value={activeActorMeta.position[0]}
                    onChange={(e) =>
                      setActiveActorMeta((m) => ({
                        ...m,
                        position: [+e.target.value, m.position[1], m.position[2]],
                      }))
                    }
                    className="w-full accent-primary"
                  />
                </label>
                <label className="block text-[11px]">
                  <span className="flex justify-between">
                    <span>Floor Depth (Z)</span>
                    <span className="font-mono">{activeActorMeta.position[2].toFixed(2)}m</span>
                  </span>
                  <input
                    type="range"
                    aria-label="Actor Floor Z"
                    min={-2.5}
                    max={2.5}
                    step={0.05}
                    value={activeActorMeta.position[2]}
                    onChange={(e) =>
                      setActiveActorMeta((m) => ({
                        ...m,
                        position: [m.position[0], m.position[1], +e.target.value],
                      }))
                    }
                    className="w-full accent-primary"
                  />
                </label>
                <label className="block text-[11px]">
                  <span className="flex justify-between">
                    <span>Facing Angle (Yaw)</span>
                    <span className="font-mono">{activeActorMeta.rotationY}°</span>
                  </span>
                  <input
                    type="range"
                    aria-label="Actor Facing Yaw"
                    min={-180}
                    max={180}
                    step={5}
                    value={activeActorMeta.rotationY}
                    onChange={(e) =>
                      setActiveActorMeta((m) => ({ ...m, rotationY: +e.target.value }))
                    }
                    className="w-full accent-primary"
                  />
                </label>
              </div>
            </div>
          ) : (
            /* 3D Props Panel */
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="border-b border-border p-3 space-y-2">
                <h2 className="font-display text-base">Add Prop to Character</h2>
                <div className="flex gap-1">
                  {(["weapons", "items", "furniture", "primitives"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setPropCategory(cat)}
                      className={`flex-1 rounded border py-1 text-center text-[11px] font-semibold capitalize ${
                        propCategory === cat
                          ? "border-foreground bg-primary text-primary-foreground font-bold"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Built-in Catalog Grid */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {BUILTIN_PROPS.filter((p) => p.category === propCategory).map((propDef) => (
                    <button
                      key={propDef.id}
                      onClick={() => handleAddProp(propDef.id)}
                      className="flex items-center gap-1.5 rounded border border-border p-1.5 text-xs font-semibold hover:border-foreground hover:bg-accent transition-colors text-left"
                    >
                      <span className="text-base">{propDef.icon}</span>
                      <span className="truncate">{propDef.name}</span>
                    </button>
                  ))}
                </div>

                {/* Custom 3D Prop Import */}
                <div className="border-t border-border pt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground">Custom 3D Props</span>
                    <button
                      type="button"
                      onClick={() => customPropFileRef.current?.click()}
                      className="rounded border border-foreground px-2 py-0.5 text-[10px] font-bold hover:bg-accent"
                    >
                      + Import .glb / .fbx / .obj
                    </button>
                    <input
                      ref={customPropFileRef}
                      type="file"
                      accept=".glb,.gltf,.fbx,.obj"
                      className="hidden"
                      onChange={(e) => {
                        void handleImportCustomProp(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {customPropsMeta.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {customPropsMeta.map((cp) => (
                        <div key={cp.id} className="flex items-center rounded border border-border bg-muted/40 text-[10px]">
                          <button
                            type="button"
                            onClick={() => handleSpawnCustomProp(cp)}
                            className="px-1.5 py-0.5 font-semibold hover:bg-accent"
                          >
                            + {cp.name}
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${cp.name}`}
                            onClick={() => handleRemoveCustomProp(cp.id)}
                            className="px-1 py-0.5 text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Spawned Props List */}
              <div className="p-3 border-b border-border space-y-2">
                <span className="font-display text-xs text-muted-foreground uppercase tracking-wider block">
                  Spawned Props ({propsList.length})
                </span>
                {propsList.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">
                    No props added yet. Click an item above to attach it to the character!
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {propsList.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPropId(p.id)}
                        className={`flex items-center justify-between rounded border p-2 text-xs transition-colors cursor-pointer ${
                          selectedPropId === p.id
                            ? "border-primary bg-primary/10 font-bold"
                            : "border-border hover:border-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span>{p.name}</span>
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground font-normal">
                            {p.attachedBone}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateProp(p.id, { visible: !p.visible });
                            }}
                            className="p-1 hover:text-primary"
                          >
                            {p.visible ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 opacity-50" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateProp(p.id);
                            }}
                            className="p-1 hover:text-primary"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProp(p.id);
                            }}
                            className="p-1 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Prop Inspector */}
              {selectedProp && (
                <div className="p-3 space-y-3 text-xs flex-1">
                  <h3 className="font-display text-sm flex items-center justify-between">
                    <span>Prop Settings</span>
                    <span className="text-[11px] font-mono text-primary">{selectedProp.name}</span>
                  </h3>

                  {/* Bone Attachment + 1-Click Smart Hand Grip Snap */}
                  <div>
                    <label className="font-semibold block mb-1">Attached Bone</label>
                    <select
                      aria-label="Attached Bone"
                      value={selectedProp.attachedBone}
                      onChange={(e) =>
                        handleUpdateProp(selectedProp.id, { attachedBone: e.target.value })
                      }
                      className="w-full rounded border border-input bg-background p-1.5 text-xs font-medium"
                    >
                      {ATTACHABLE_BONES.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-1 pt-1.5">
                      <button
                        type="button"
                        onClick={() => handleSnapPropToHand("LeftHand")}
                        className="rounded border border-border bg-muted/40 py-1 text-[10px] font-semibold hover:border-foreground hover:bg-accent"
                      >
                        🤚 Snap Left Grip
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSnapPropToHand("RightHand")}
                        className="rounded border border-border bg-muted/40 py-1 text-[10px] font-semibold hover:border-foreground hover:bg-accent"
                      >
                        ✋ Snap Right Grip
                      </button>
                    </div>
                  </div>

                  {/* Translation Sliders */}
                  <div className="space-y-1.5 border-t border-border pt-2">
                    <span className="font-semibold block">Position Offset</span>
                    {AXES.map((axis, i) => (
                      <label key={axis} className="block text-[11px]">
                        <span className="flex justify-between">
                          <span>{axis} Offset</span>
                          <span className="font-mono">
                            {selectedProp.transform.position[i].toFixed(2)}m
                          </span>
                        </span>
                        <input
                          type="range"
                          min={-1}
                          max={1}
                          step={0.01}
                          value={selectedProp.transform.position[i]}
                          onChange={(e) => {
                            const pos = [...selectedProp.transform.position] as [
                              number,
                              number,
                              number,
                            ];
                            pos[i] = +e.target.value;
                            handleUpdateProp(selectedProp.id, {
                              transform: { ...selectedProp.transform, position: pos },
                            });
                          }}
                          className="w-full accent-primary"
                        />
                      </label>
                    ))}
                  </div>

                  {/* Rotation Sliders */}
                  <div className="space-y-1.5 border-t border-border pt-2">
                    <span className="font-semibold block">Rotation Offset</span>
                    {AXES.map((axis, i) => (
                      <label key={axis} className="block text-[11px]">
                        <span className="flex justify-between">
                          <span>R{axis} Angle</span>
                          <span className="font-mono">{selectedProp.transform.rotation[i]}°</span>
                        </span>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          step={5}
                          value={selectedProp.transform.rotation[i]}
                          onChange={(e) => {
                            const rot = [...selectedProp.transform.rotation] as [
                              number,
                              number,
                              number,
                            ];
                            rot[i] = +e.target.value;
                            handleUpdateProp(selectedProp.id, {
                              transform: { ...selectedProp.transform, rotation: rot },
                            });
                          }}
                          className="w-full accent-primary"
                        />
                      </label>
                    ))}
                  </div>

                  {/* Scale Slider */}
                  <div className="border-t border-border pt-2">
                    <label className="block text-[11px]">
                      <span className="flex justify-between">
                        <span>Scale</span>
                        <span className="font-mono">
                          {selectedProp.transform.scale[0].toFixed(2)}x
                        </span>
                      </span>
                      <input
                        type="range"
                        min={0.2}
                        max={3}
                        step={0.05}
                        value={selectedProp.transform.scale[0]}
                        onChange={(e) => {
                          const s = +e.target.value;
                          handleUpdateProp(selectedProp.id, {
                            transform: { ...selectedProp.transform, scale: [s, s, s] },
                          });
                        }}
                        className="w-full accent-primary"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Center: 3D Viewport with Quick Camera Angles */}
        <main
          className="relative min-w-0 flex-1 flex flex-col"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
        >
          {/* Camera Angles Toolbar */}
          <div className="flex items-center gap-1.5 border-b border-border bg-card/90 px-4 py-1.5 text-xs overflow-x-auto">
            <span className="font-semibold text-muted-foreground flex items-center gap-1 mr-2">
              <Camera className="h-3.5 w-3.5" /> Angles:
            </span>
            {Object.keys(CAMERA_PRESETS).map((name) => (
              <button
                key={name}
                onClick={() => setCameraPose(CAMERA_PRESETS[name])}
                className="rounded-sm border border-border px-2 py-1 text-xs hover:border-foreground hover:bg-accent transition-colors"
              >
                {name}
              </button>
            ))}
          </div>

          <div
            className="relative flex-1 m-4 border-[3px] border-foreground bg-card shadow-ink overflow-hidden"
            data-scene-ready={rig ? "" : undefined}
          >
            <Viewport
              ref={viewportRef}
              model={model}
              rig={rig}
              selected={selected}
              onSelect={setSelected}
              onBoneDrag={onBoneDrag}
              ikMode={ikMode}
              onIkDrag={onIkDrag}
              cameraLocked={cameraLocked}
              settings={settings}
              cameraPose={cameraPose}
              propsList={propsList}
              selectedPropId={selectedPropId}
              onSelectProp={setSelectedPropId}
              customPropObjects={customPropObjects}
              face={activeTab === "create" ? { ...face, expression: "Neutral", overrides: {}, fx: [] } : face}
              facePack={activeFacePack}
              faceFitRequest={faceFitRequest}
              outfit={outfit}
              wardrobeAssets={wardrobeAssets}
              primaryStageTransform={
                activeTab === "create"
                  ? { position: [0, 0, 0], rotationY: 0 }
                  : { position: activeActorMeta.position, rotationY: activeActorMeta.rotationY }
              }
              primaryVisible={activeTab === "create" ? true : activeActorMeta.visible}
              coActors={activeTab === "create" ? [] : coActors}
              onSelectActor={switchActiveActor}
              onFaceFit={(offsetZ, offsetY) => setFace((f) => ({ ...f, fitted: true, calib: { ...f.calib, offsetZ, offsetY } }))}
            />
          </div>

          {extractOpen && (
            <ExtractOutfitModal
              onClose={() => setExtractOpen(false)}
              onExtract={(items) => {
                setWardrobeAssets((m) => { const n = { ...m }; items.forEach((a) => { n[a.id] = a; }); return n; });
                // Keep extracted pieces as files so saved characters can bring them back after a reload.
                (async () => {
                  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
                  for (const a of items) {
                    try {
                      const buf = (await new GLTFExporter().parseAsync(a.object, { binary: true })) as ArrayBuffer;
                      await putFile(a.id, new Blob([buf], { type: "model/gltf-binary" }), `${a.name}.glb`, a.slot);
                    } catch (e) { console.warn("Could not store extracted piece", a.name, e); }
                  }
                })();
                setOutfit((o) => { let n = { ...o }; items.forEach((a) => { n = equip(n, a.slot, a.id); }); return n; });
                setExtractOpen(false);
              }}
            />
          )}
          {(dragOver || loading || error) && (
            <div className="pointer-events-none absolute inset-4 flex items-center justify-center bg-background/85 backdrop-blur-xs">
              <p className={`font-display text-2xl ${error ? "text-destructive" : ""}`}>
                {loading
                  ? "Loading 3D Model…"
                  : error || "Drop a Mixamo .fbx, .vrm, or .glb model here"}
              </p>
            </div>
          )}

          <div className="absolute bottom-6 left-8 flex items-center gap-4 text-xs text-muted-foreground pointer-events-none">
            {ikMode ? (
              <>
                <span>✋ Drag any limb or joint to bend with IK</span>
                <span>· Drag empty space to orbit</span>
                <span>· Right drag to pan</span>
              </>
            ) : (
              <>
                <span>🖱️ Click joint sphere to rotate</span>
                <span>· Drag gizmo ring to articulate</span>
                <span>· Left drag empty space to orbit</span>
                <span>· Right drag to pan</span>
              </>
            )}
          </div>
        </main>

        {/* Right: Inspector & Controls */}
        <aside className={`${activeTab === "create" ? "hidden" : "flex"} w-76 flex-col overflow-y-auto border-l-2 border-foreground bg-card`}>
          {/* Quick Capture Panel Card */}
          <section className="border-b border-border p-3 bg-accent/40">
            <h2 className="font-display text-base mb-1 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> 2D Panel Snapshot
            </h2>
            <p className="text-[11px] text-muted-foreground mb-2">
              Snap this posed character with transparent background to put onto a manga panel.
            </p>
            <button
              onClick={() => handleCaptureSnapshot(2)}
              className="w-full flex items-center justify-center gap-2 rounded-sm border-2 border-foreground bg-primary py-2 text-xs font-bold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5"
            >
              <Camera className="h-4 w-4" />
              Capture Transparent 2D Render
            </button>
          </section>

          {/* Bone Rotation Gizmo Sliders */}
          <section className="border-b border-border p-3">
            <h2 className="font-display text-base">Joint Rotation</h2>
            <p className="text-xs text-muted-foreground">
              {selected ? (
                <>
                  Selected: <span className="font-semibold text-foreground">{selected}</span>
                </>
              ) : ikMode ? (
                "Drag a limb in the viewport, or click a joint sphere for fine sliders"
              ) : (
                "Click a joint sphere in the viewport"
              )}
            </p>

            {selected && sel && (
              <div className="mt-3 space-y-2">
                {AXES.map((a, i) => (
                  <label key={a} className="block text-xs">
                    <span className="flex justify-between">
                      <span className="font-semibold">{a} Axis</span>
                      <span className="tabular-nums">{sel[i]}°</span>
                    </span>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={sel[i]}
                      onChange={(e) => setRot(selected, i, +e.target.value)}
                      className="w-full accent-primary"
                    />
                  </label>
                ))}
                <button
                  onClick={() =>
                    setPose((c) => {
                      const n = { ...c };
                      delete n[selected];
                      return n;
                    })
                  }
                  className="w-full rounded-sm border border-foreground py-1 text-xs hover:bg-accent"
                >
                  Reset joint
                </button>
              </div>
            )}
          </section>

          {/* Body height & translation */}
          <section className="border-b border-border p-3">
            <h2 className="font-display text-base">Body Height</h2>
            <label className="block text-xs">
              <span className="flex justify-between">
                <span>Hips Drop</span>
                <span className="tabular-nums font-semibold">{hipsDrop.toFixed(2)} m</span>
              </span>
              <input
                type="range"
                min={-0.5}
                max={1}
                step={0.01}
                value={hipsDrop}
                onChange={(e) => setHipsDrop(+e.target.value, 350)}
                className="w-full accent-primary"
              />
            </label>
          </section>

          {/* 1-Click Left / Right / Both Hand Pose Presets */}
          <section className="border-b border-border p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base">Hand Poses</h2>
              <div className="flex rounded-sm border border-border overflow-hidden text-[10px] font-semibold">
                {(["Left", "Right", "Both"] as HandSide[]).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setHandSide(side)}
                    className={`px-1.5 py-0.5 ${
                      handSide === side ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                    }`}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {HAND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPose((cur) => applyHandPresetToPose(cur, handSide, preset.id))}
                  className="rounded-sm border border-border px-1.5 py-1 text-[11px] font-medium hover:bg-accent"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          {/* VRM Blendshape Facial Expressions (if VRM avatar loaded) */}
          {vrm && (
            <section className="border-b border-border p-3 space-y-2">
              <h2 className="font-display text-base">VRM Facial Expressions</h2>
              {["happy", "angry", "sad", "relaxed", "surprised", "blink"].map((exp) => (
                <label key={exp} className="block text-xs">
                  <span className="flex justify-between capitalize">
                    <span>{exp}</span>
                    <span className="tabular-nums font-semibold">
                      {Math.round((vrmExpressions[exp] ?? 0) * 100)}%
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={vrmExpressions[exp] ?? 0}
                    onChange={(e) =>
                      setVrmExpressions((cur) => ({ ...cur, [exp]: +e.target.value }))
                    }
                    className="w-full accent-primary"
                  />
                </label>
              ))}
            </section>
          )}

          {/* Manga Cel-Shading & Studio Lighting */}
          <section className="space-y-3 p-3 text-xs">
            <h2 className="font-display text-base">Manga Cel-Shading & Light</h2>
            {(() => {
              const curLight = lightCartesianToSpherical(settings.lightAngle ?? [2.5, 4, 3]);
              const setSpherical = (az: number, el: number) =>
                setSettings((s) => ({
                  ...s,
                  lightAngle: lightSphericalToCartesian(az, el),
                }));
              const dialX = 44 + Math.sin((curLight.azimuth * Math.PI) / 180) * 32;
              const dialY = 44 - (curLight.elevation / 85) * 32;
              const updateDialFromPointer = (e: React.PointerEvent<SVGSVGElement>) => {
                const r = e.currentTarget.getBoundingClientRect();
                const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
                const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
                const az = Math.round(nx * 180);
                const el = Math.round(-ny * 85);
                setSpherical(az, el);
              };
              return (
                <div className="space-y-2 rounded-sm border border-border bg-muted/30 p-2">
                  <div className="flex flex-wrap gap-1">
                    {LIGHT_PRESETS.map((lp) => (
                      <button
                        key={lp.id}
                        type="button"
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            lightAngle: lightSphericalToCartesian(lp.azimuth, lp.elevation),
                            lightIntensity: lp.lightIntensity,
                            rimIntensity: lp.rimIntensity,
                            fillIntensity: lp.fillIntensity,
                          }))
                        }
                        className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium hover:bg-accent"
                      >
                        {lp.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <svg
                      width={88}
                      height={88}
                      viewBox="0 0 88 88"
                      role="slider"
                      aria-label="Key light direction pad"
                      aria-valuetext={`Azimuth ${curLight.azimuth}°, Elevation ${curLight.elevation}°`}
                      className="shrink-0 cursor-crosshair rounded-full border border-border bg-card"
                      onPointerDown={(e) => {
                        (e.currentTarget as Element).setPointerCapture(e.pointerId);
                        updateDialFromPointer(e);
                      }}
                      onPointerMove={(e) => {
                        if (e.buttons === 1) updateDialFromPointer(e);
                      }}
                    >
                      <circle cx={44} cy={44} r={34} fill="none" stroke="#999" strokeDasharray="3,3" strokeWidth={1} />
                      <line x1={44} y1={6} x2={44} y2={82} stroke="#bbb" strokeWidth={0.75} />
                      <line x1={6} y1={44} x2={82} y2={44} stroke="#bbb" strokeWidth={0.75} />
                      <line x1={44} y1={44} x2={dialX} y2={dialY} stroke="#e11d2e" strokeWidth={1.5} />
                      <circle cx={dialX} cy={dialY} r={5.5} fill="#e11d2e" stroke="#111" strokeWidth={1.5} />
                    </svg>
                    <div className="flex-1 space-y-1.5">
                      <label className="block">
                        <span className="flex justify-between text-[11px]">
                          <span>Azimuth</span>
                          <span className="tabular-nums">{curLight.azimuth}°</span>
                        </span>
                        <input
                          type="range"
                          aria-label="Key Light Azimuth"
                          min={-180}
                          max={180}
                          value={curLight.azimuth}
                          onChange={(e) => setSpherical(+e.target.value, curLight.elevation)}
                          className="w-full accent-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="flex justify-between text-[11px]">
                          <span>Elevation</span>
                          <span className="tabular-nums">{curLight.elevation}°</span>
                        </span>
                        <input
                          type="range"
                          aria-label="Key Light Elevation"
                          min={-60}
                          max={85}
                          value={curLight.elevation}
                          onChange={(e) => setSpherical(curLight.azimuth, +e.target.value)}
                          className="w-full accent-primary"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <label className="block">
                      <span className="flex justify-between text-[10px]">
                        <span>Key</span>
                        <span>{(settings.lightIntensity ?? 2.2).toFixed(1)}</span>
                      </span>
                      <input
                        type="range"
                        aria-label="Key Light Intensity"
                        min={0}
                        max={4.5}
                        step={0.1}
                        value={settings.lightIntensity ?? 2.2}
                        onChange={(e) => setSettings((s) => ({ ...s, lightIntensity: +e.target.value }))}
                        className="w-full accent-primary"
                      />
                    </label>
                    <label className="block">
                      <span className="flex justify-between text-[10px]">
                        <span>Rim</span>
                        <span>{(settings.rimIntensity ?? 0.5).toFixed(1)}</span>
                      </span>
                      <input
                        type="range"
                        aria-label="Rim Light Intensity"
                        min={0}
                        max={3}
                        step={0.1}
                        value={settings.rimIntensity ?? 0.5}
                        onChange={(e) => setSettings((s) => ({ ...s, rimIntensity: +e.target.value }))}
                        className="w-full accent-primary"
                      />
                    </label>
                    <label className="block">
                      <span className="flex justify-between text-[10px]">
                        <span>Fill</span>
                        <span>{(settings.fillIntensity ?? 0.6).toFixed(1)}</span>
                      </span>
                      <input
                        type="range"
                        aria-label="Fill Light Intensity"
                        min={0}
                        max={1.5}
                        step={0.05}
                        value={settings.fillIntensity ?? 0.6}
                        onChange={(e) => setSettings((s) => ({ ...s, fillIntensity: +e.target.value }))}
                        className="w-full accent-primary"
                      />
                    </label>
                  </div>
                </div>
              );
            })()}
            <label className="block">
              <span className="flex justify-between">
                <span>Ink Outline Width</span>
                <span>{settings.outline}</span>
              </span>
              <input
                type="range"
                min={0}
                max={8}
                step={0.5}
                value={settings.outline}
                onChange={(e) => setSettings((s) => ({ ...s, outline: +e.target.value }))}
                className="w-full accent-primary"
              />
            </label>
            <div className="flex items-center justify-between gap-2">
              <span>Ink Color</span>
              <div className="flex items-center gap-1">
                {OUTLINE_SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    title={sw.label}
                    aria-label={`Ink Color ${sw.label}`}
                    onClick={() => setSettings((s) => ({ ...s, outlineColor: sw.hex }))}
                    style={{ backgroundColor: sw.hex }}
                    className={`h-5 w-5 rounded-full border ${
                      (settings.outlineColor ?? "#0d0d0d") === sw.hex
                        ? "ring-2 ring-primary ring-offset-1 border-white"
                        : "border-border"
                    }`}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Custom Ink Outline Color"
                  value={settings.outlineColor ?? "#0d0d0d"}
                  onChange={(e) => setSettings((s) => ({ ...s, outlineColor: e.target.value }))}
                  className="h-5 w-6 cursor-pointer rounded-sm border border-border bg-transparent p-0"
                />
              </div>
            </div>
            <label className="block">
              <span className="flex justify-between">
                <span>Shading Tone Steps</span>
                <span>{settings.tones}</span>
              </span>
              <input
                type="range"
                min={2}
                max={6}
                value={settings.tones}
                onChange={(e) => setSettings((s) => ({ ...s, tones: +e.target.value }))}
                className="w-full accent-primary"
              />
            </label>
            <label className="block">
              <span className="flex justify-between">
                <span>Camera FOV (Foreshortening)</span>
                <span>{settings.fov ?? 35}°</span>
              </span>
              <input
                type="range"
                min={15}
                max={90}
                value={settings.fov ?? 35}
                onChange={(e) => setSettings((s) => ({ ...s, fov: +e.target.value }))}
                className="w-full accent-primary"
              />
            </label>
            <div className="flex flex-wrap gap-3 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.mono}
                  onChange={(e) => setSettings((s) => ({ ...s, mono: e.target.checked }))}
                  className="accent-primary"
                />
                <span>Manga Monochrome</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.shadowHatch)}
                  onChange={(e) => setSettings((s) => ({ ...s, shadowHatch: e.target.checked }))}
                  className="accent-primary"
                />
                <span>Print Hatching</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showJoints}
                  onChange={(e) => setSettings((s) => ({ ...s, showJoints: e.target.checked }))}
                  className="accent-primary"
                />
                <span>Show Rig Joints</span>
              </label>
            </div>
          </section>
        </aside>
      </div>

      {/* Snapshot Modal */}
      <SnapshotModal
        isOpen={snapshotModalOpen}
        onClose={() => setSnapshotModalOpen(false)}
        snapshot={currentSnapshot}
        onReRender={(pixelRatio) => {
          if (!viewportRef.current) return;
          const res = viewportRef.current.captureSnapshot({
            pixelRatio,
            outlineThickness: settings.outline,
            outlineColor: settings.outlineColor,
          });
          if (res) setCurrentSnapshot(res);
        }}
        panels={currentPageLayout.panels}
        onAddToPanel={(panelId, dataUrl) => {
          const targetPanel =
            currentPageLayout.panels.find((p) => p.id === panelId) || currentPageLayout.panels[0];
          const bounds = getPanelPixelBounds(
            targetPanel,
            currentPageLayout.format.width,
            currentPageLayout.format.height,
            currentPageLayout.format.margin,
            currentPageLayout.format.gutter
          );
          const newEl: PlacedElement = {
            id: `el-${Date.now()}`,
            panelId: targetPanel.id,
            type: "character",
            imageUrl: dataUrl,
            x: bounds.minX + 30,
            y: bounds.minY + 30,
            width: Math.min(bounds.width * 0.75, 320),
            height: Math.min(bounds.height * 0.75, 420),
            rotation: 0,
            flipX: false,
            flipY: false,
            zIndex: currentPageLayout.elements.length + 1,
            breakout: false,
            source3d: {
              modelName,
              pose: { ...pose },
              hipsDrop,
              cameraPose,
              fov: settings.fov,
              activeActorId: activeActorMeta.id,
              cast: serializeCastForSnapshot([
                {
                  id: activeActorMeta.id,
                  characterId: activeCharId,
                  name: activeChar?.name ?? (modelName || "Figure"),
                  modelKey: activeActorMeta.modelKey,
                  position: activeActorMeta.position,
                  rotationY: activeActorMeta.rotationY,
                  pose,
                  hipsDrop,
                  face,
                  outfit,
                  props: propsList,
                  vrmExpressions,
                  visible: activeActorMeta.visible,
                  model,
                  rig,
                  vrm,
                  wardrobeAssets,
                },
                ...coActors,
              ]),
            },
          };
          saveRosterItem({
            id: `roster-${Date.now()}`,
            name: `${modelName || "Figure"} Pose`,
            role: "Posed Figure",
            previewUrl: dataUrl,
            source3d: {
              modelName,
              pose: { ...pose },
              hipsDrop,
              fov: settings.fov,
            },
          });
          handleUpdateCurrentPage({
            ...currentPageLayout,
            elements: [...currentPageLayout.elements, newEl],
          });
          setActiveTab("panels");
        }}
      />

      {/* Save Pose Preset Modal */}
      <SavePoseModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        thumbnail={poseThumbnail}
        onSave={handleSavePose}
      />
    </div>
    </>
  );
}

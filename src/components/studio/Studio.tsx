import { FacePanel } from "./FacePanel";
import { loadPacks, savePacks, type FacePack } from "@/lib/face-parts";
import { ExtractOutfitModal } from "./ExtractOutfitModal";
import { WardrobePanel } from "./WardrobePanel";
import { CharacterPanel } from "./CharacterPanel";
import {
  DUMMY_MODEL, activeOutfitOf, addOutfit, customItemIds, deleteOutfit, duplicateCharacter, loadCharacters, newCharacter,
  renameOutfit, saveCharacters, updateActiveOutfit, upsertCharacter, type Character,
} from "@/lib/characters";
import { getFile, putFile } from "@/lib/file-store";
import { loadWardrobeAsset } from "./WardrobeRig";
import type { CustomAsset } from "./WardrobeRig";
import { equip, loadOutfit, saveOutfit, type Outfit } from "@/lib/wardrobe";
import { DEFAULT_FACE, loadFace, saveFace, type FaceConfig } from "@/lib/face-library";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  applyPose,
  mirrorBoneName,
  mirrorPose,
  offsetFromBone,
  type Pose,
  type PoseData,
  type Rig,
  type Rot,
} from "@/lib/rig";
import { CATEGORIES, POSES } from "@/lib/poses";
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
} from "lucide-react";
import { PanelStudio } from "@/components/panels/PanelStudio";
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

const AXES = ["X", "Y", "Z"] as const;

export function Studio() {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [rig, setRig] = useState<Rig | null>(null);
  const [vrm, setVrm] = useState<any | null>(null);
  const [modelName, setModelName] = useState("");
  const [modelType, setModelType] = useState<string>("glb");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Pose state
  const [pose, setPose] = useState<PoseData>({});
  const [hipsDrop, setHipsDrop] = useState(0);
  const [activePose, setActivePose] = useState<string | null>(null);
  const [customPoses, setCustomPoses] = useState<CustomPose[]>([]);
  const [category, setCategory] = useState<string>("Standing");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // 3D Props state
  const [propsList, setPropsList] = useState<ActiveProp[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<"poses" | "props" | "face" | "outfit">("poses");
  const [propCategory, setPropCategory] = useState<PropCategory>("weapons");

  // Camera & Rendering Settings
  const [cameraPose, setCameraPose] = useState<CameraPose | null>(null);
  const [settings, setSettings] = useState<ViewSettings>({
    outline: 3,
    mono: false,
    tones: 3,
    showJoints: true,
    fov: 35,
    lightIntensity: 2.2,
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
  const [pages, setPages] = useState<PageLayout[]>([
    {
      id: "page-1",
      pageNumber: 1,
      format: PAGE_FORMATS[0],
      panels: getPresetPanels("classic-6"),
      elements: [],
      balloons: [],
      comicMarks: [],
      speedLines: [],
      sfxStamps: [],
    },
  ]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const currentPageLayout = pages[activePageIndex] || pages[0];

  // Snapshot & Save modals
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [currentSnapshot, setCurrentSnapshot] = useState<SnapshotResult | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [poseThumbnail, setPoseThumbnail] = useState<string | undefined>(undefined);

  const fileRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<ViewportHandle>(null);

  // Load custom poses on mount
  useEffect(() => {
    setCustomPoses(loadCustomPoses());
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
      setPose({});
      setHipsDrop(0);
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
    if (loadedModelKey.current !== key) {
      let ok = false;
      if (key === DUMMY_MODEL) ok = await load("/models/xbot.glb", "glb", "X Bot (demo)");
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

  const setCharacterBody = async (f: File | null) => {
    if (!activeChar) return;
    let model = DUMMY_MODEL, modelName = "X Bot (demo)";
    if (f) {
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

  // Toon shading updates
  useEffect(() => {
    if (model) toonify(model, settings.tones, settings.mono);
  }, [model, settings.tones, settings.mono]);

  // Apply pose to rig
  useEffect(() => {
    if (rig) applyPose(rig, activeTab === "create" ? {} : pose, activeTab === "create" ? 0 : hipsDrop);
  }, [rig, pose, hipsDrop, activeTab]);

  // Update VRM expressions
  useEffect(() => {
    if (vrm?.expressionManager) {
      Object.entries(vrmExpressions).forEach(([name, val]) => {
        vrm.expressionManager.setValue(name, val);
      });
      vrm.expressionManager.update();
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

  const applyPreset = (preset: Pose | CustomPose) => {
    setActivePose(preset.id);
    if (preset.partial) {
      setPose((cur) => ({ ...cur, ...preset.bones }));
    } else {
      setPose({ ...preset.bones });
      setHipsDrop(preset.hipsDrop ?? 0);
    }
  };

  const setRot = (bone: string, axis: number, v: number) =>
    setPose((cur) => {
      const r: Rot = [...(cur[bone] ?? [0, 0, 0])] as Rot;
      r[axis] = v;
      return { ...cur, [bone]: r };
    });

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
      setHipsDrop(drop);
      setPose((cur) => ({ ...cur, ...legs }));
      return;
    }
    solveCCD(rig, effector, world);
    const offs = chainOffsets(rig, effector);
    setPose((cur) => ({ ...cur, ...offs }));
  };

  const onBoneDrag = () => {
    if (!rig || !selected) return;
    const r = offsetFromBone(rig, selected);
    setPose((cur) => ({ ...cur, [selected]: r }));
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

  const selectedProp = propsList.find((p) => p.id === selectedPropId);

  // Snapshot triggers
  const handleCaptureSnapshot = (pixelRatio = 2) => {
    if (!viewportRef.current) return;
    const result = viewportRef.current.captureSnapshot({
      pixelRatio,
      outlineThickness: settings.outline,
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

  // Multi-Page Management Handlers
  const handleUpdateCurrentPage = (updated: PageLayout) => {
    setPages((cur) => cur.map((p, idx) => (idx === activePageIndex ? updated : p)));
  };

  const handleAddPage = () => {
    const newPage: PageLayout = {
      id: `page-${Date.now()}`,
      pageNumber: pages.length + 1,
      format: currentPageLayout.format,
      panels: getPresetPanels("classic-6"),
      elements: [],
      balloons: [],
      comicMarks: [],
      speedLines: [],
      sfxStamps: [],
    };
    setPages((cur) => [...cur, newPage]);
    setActivePageIndex(pages.length);
  };

  const handleDuplicatePage = (index: number) => {
    const target = pages[index];
    if (!target) return;
    const copy: PageLayout = {
      ...target,
      id: `page-${Date.now()}`,
      pageNumber: index + 2,
      elements: target.elements.map((el) => ({
        ...el,
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    };
    const updated = [...pages];
    updated.splice(index + 1, 0, copy);
    setPages(updated);
    setActivePageIndex(index + 1);
  };

  const handleDeletePage = (index: number) => {
    if (pages.length <= 1) return;
    const updated = pages.filter((_, idx) => idx !== index);
    setPages(updated);
    setActivePageIndex((cur) => Math.min(cur, updated.length - 1));
  };

  const handleMovePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return;
    const updated = [...pages];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setPages(updated);
    setActivePageIndex(toIndex);
  };

  // If in 2D Panels Studio mode, render full Manga Studio
  const panelsView = activeTab === "panels" && (
      <PanelStudio
        layout={currentPageLayout}
        onUpdateLayout={handleUpdateCurrentPage}
        onOpen3dStudio={() => setActiveTab("pose")}
        onRePoseIn3D={(source3d) => {
          if (source3d.pose) setPose(source3d.pose);
          if (source3d.hipsDrop !== undefined) setHipsDrop(source3d.hipsDrop);
          if (source3d.cameraPose) setCameraPose(source3d.cameraPose);
          if (source3d.fov) setSettings((s) => ({ ...s, fov: source3d.fov }));
          setActiveTab("pose");
        }}
        allPages={pages}
        activePageIndex={activePageIndex}
        onSelectPage={setActivePageIndex}
        onAddPage={handleAddPage}
        onDuplicatePage={handleDuplicatePage}
        onDeletePage={handleDeletePage}
        onMovePage={handleMovePage}
      />
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
              className={`rounded-sm px-3 py-1 font-semibold transition-colors ${activeTab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
          <button
            onClick={() => goTab("panels")}
            className="rounded-sm px-3 py-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
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
              characters={characters}
              active={activeChar}
              onSelect={(id) => showCharacter(characters.find((c) => c.id === id) ?? null)}
              onNew={createCharacter}
              onRename={(name) => activeChar && patchChar(activeChar.id, (c) => ({ ...c, name }))}
              onDuplicate={() => { if (!activeChar) return; const d = duplicateCharacter(activeChar); commitChars((l) => upsertCharacter(l, d)); showCharacter(d); }}
              onDelete={() => { if (!activeChar) return; const id = activeChar.id; commitChars((l) => l.filter((c) => c.id !== id)); showCharacter(null); }}
              onModelFile={(f) => setCharacterBody(f)}
              onUseDummy={() => setCharacterBody(null)}
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
              {/* Quick Mirror & Reset Tools */}
              <div className="flex gap-2 border-t border-border p-3">
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
                    setPose({});
                    setHipsDrop(0);
                    setActivePose(null);
                  }}
                  className="flex-1 rounded-sm border-2 border-foreground py-1.5 text-sm font-semibold hover:bg-accent transition-transform hover:-translate-y-0.5"
                >
                  Reset
                </button>
              </div>
            </>
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

                  {/* Bone Attachment */}
                  <div>
                    <label className="font-semibold block mb-1">Attached Bone</label>
                    <select
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
              face={activeTab === "create" ? { ...face, expression: "Neutral", overrides: {}, fx: [] } : face}
              facePack={activeFacePack}
              faceFitRequest={faceFitRequest}
              outfit={outfit}
              wardrobeAssets={wardrobeAssets}
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
            <span>🖱️ Click joint sphere to rotate</span>
            <span>· Drag gizmo ring to articulate</span>
            <span>· Left drag empty space to orbit</span>
            <span>· Right drag to pan</span>
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
                onChange={(e) => setHipsDrop(+e.target.value)}
                className="w-full accent-primary"
              />
            </label>
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

          {/* Manga Cel-Shading & Inking */}
          <section className="space-y-3 p-3 text-xs">
            <h2 className="font-display text-base">Manga Cel-Shading</h2>
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
            <div className="flex gap-4 pt-1">
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

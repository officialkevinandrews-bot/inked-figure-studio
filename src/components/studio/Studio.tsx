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
import { Camera, BookmarkPlus, Sparkles, Trash2, RotateCw } from "lucide-react";
import { PanelStudio } from "@/components/panels/PanelStudio";
import {
  type PageLayout,
  type PlacedElement,
  PAGE_FORMATS,
  getPresetPanels,
  getPanelPixelBounds,
} from "@/lib/manga-layout";

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

  // Camera & Rendering Settings
  const [cameraPose, setCameraPose] = useState<CameraPose | null>(null);
  const [settings, setSettings] = useState<ViewSettings>({
    outline: 3,
    mono: true,
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

  // Navigation & Page Layout State
  const [activeTab, setActiveTab] = useState<"pose" | "panels">("pose");
  const [pageLayout, setPageLayout] = useState<PageLayout>({
    id: "page-1",
    pageNumber: 1,
    format: PAGE_FORMATS[0],
    panels: getPresetPanels("classic-6"),
    elements: [],
  });

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
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not load 3D model.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Default demo model
  useEffect(() => {
    load("/models/xbot.glb", "glb", "X Bot (demo)");
  }, [load]);

  // Toon shading updates
  useEffect(() => {
    if (model) toonify(model, settings.tones, settings.mono);
  }, [model, settings.tones, settings.mono]);

  // Apply pose to rig
  useEffect(() => {
    if (rig) applyPose(rig, pose, hipsDrop);
  }, [rig, pose, hipsDrop]);

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

  const onBoneDrag = () => {
    if (!rig || !selected) return;
    const r = offsetFromBone(rig, selected);
    setPose((cur) => ({ ...cur, [selected]: r }));
  };

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
  }, [allAvailablePoses, category, search]);

  const boneList = rig
    ? Array.from(rig.bones.keys()).filter((b) => !/Hand(Thumb|Index|Middle|Ring|Pinky)[23]|ToeBase/.test(b))
    : [];
  const sel = selected ? pose[selected] ?? [0, 0, 0] : null;

  if (activeTab === "panels") {
    return (
      <PanelStudio
        layout={pageLayout}
        onUpdateLayout={setPageLayout}
        onOpen3dStudio={() => setActiveTab("pose")}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground select-none">
      {/* Top bar */}
      <header className="flex items-center gap-6 border-b-2 border-foreground px-4 py-2">
        <h1 className="font-display text-2xl tracking-wide flex items-center gap-1.5">
          <span>INKED</span>
          <span className="text-primary">FIGURE</span>
        </h1>

        <nav className="flex gap-1 text-sm">
          <button
            onClick={() => setActiveTab("pose")}
            className="rounded-sm bg-foreground px-3 py-1 font-semibold text-background transition-colors"
          >
            3D Pose Studio
          </button>
          <button
            onClick={() => setActiveTab("panels")}
            className="rounded-sm px-3 py-1 font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Manga Panels {pageLayout.elements.length > 0 && `(${pageLayout.elements.length})`}
          </button>
          {["Speech Balloons", "Export"].map((t) => (
            <span
              key={t}
              title="Coming in Phase 3 & 5"
              className="cursor-not-allowed px-3 py-1 text-muted-foreground/60"
            >
              {t}
            </span>
          ))}
        </nav>

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
        {/* Left: Pose Library */}
        <aside className="flex w-76 flex-col border-r-2 border-foreground bg-card">
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
              settings={settings}
              cameraPose={cameraPose}
            />
          </div>

          {(dragOver || loading || error) && (
            <div className="pointer-events-none absolute inset-4 flex items-center justify-center bg-background/85 backdrop-blur-xs">
              <p className={`font-display text-2xl ${error ? "text-destructive" : ""}`}>
                {loading ? "Loading 3D Model…" : error || "Drop a Mixamo .fbx, .vrm, or .glb model here"}
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
        <aside className="flex w-76 flex-col overflow-y-auto border-l-2 border-foreground bg-card">
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
              className="w-full flex items-center justify-center gap-2 rounded-sm border-2 border-foreground bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5"
            >
              <Camera className="h-4 w-4" />
              Capture Transparent Render
            </button>
          </section>

          {/* Camera & Perspective */}
          <section className="border-b border-border p-3 space-y-2">
            <h2 className="font-display text-base">Manga Perspective</h2>
            <label className="block text-xs">
              <span className="flex justify-between">
                <span>Field of View (FOV)</span>
                <span className="tabular-nums font-semibold">{settings.fov}°</span>
              </span>
              <input
                type="range"
                min={15}
                max={90}
                value={settings.fov}
                onChange={(e) => setSettings((s) => ({ ...s, fov: +e.target.value }))}
                className="w-full accent-primary"
              />
              <span className="text-[10px] text-muted-foreground">
                High FOV creates dramatic anime foreshortening.
              </span>
            </label>
          </section>

          {/* Joint Articulation */}
          <section className="border-b border-border p-3">
            <h2 className="font-display text-base">Joint Rotation</h2>
            <select
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value || null)}
              className="mt-2 w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="">— select a joint bone —</option>
              {boneList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

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
                max={5}
                value={settings.tones}
                onChange={(e) => setSettings((s) => ({ ...s, tones: +e.target.value }))}
                className="w-full accent-primary"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.mono}
                onChange={(e) => setSettings((s) => ({ ...s, mono: e.target.checked }))}
                className="accent-primary"
              />
              Monochrome Manga Ink
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showJoints}
                onChange={(e) => setSettings((s) => ({ ...s, showJoints: e.target.checked }))}
                className="accent-primary"
              />
              Show Joint Spheres
            </label>
          </section>
        </aside>
      </div>

      {/* Snapshot Preview Modal */}
      <SnapshotModal
        isOpen={snapshotModalOpen}
        onClose={() => setSnapshotModalOpen(false)}
        snapshot={currentSnapshot}
        onRecapture={(r) => handleCaptureSnapshot(r)}
        onSendToPanel={(dataUrl) => {
          const targetPanel = pageLayout.panels[0];
          const bounds = getPanelPixelBounds(
            targetPanel,
            pageLayout.format.width,
            pageLayout.format.height,
            pageLayout.format.margin,
            pageLayout.format.gutter
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
            zIndex: pageLayout.elements.length + 1,
            breakout: false,
            source3d: {
              modelName,
              pose: { ...pose },
              hipsDrop,
              cameraPose,
              fov: settings.fov,
            },
          };
          setPageLayout((cur) => ({
            ...cur,
            elements: [...cur.elements, newEl],
          }));
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
  );
}

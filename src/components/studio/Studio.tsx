import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { applyPose, buildRig, mirrorBoneName, mirrorPose, offsetFromBone, type PoseData, type Rig, type Rot } from "@/lib/rig";
import { CATEGORIES, POSES } from "@/lib/poses";
import { Viewport, toonify, type ViewSettings } from "./Viewport";

async function loadModel(url: string, ext: string): Promise<THREE.Object3D> {
  if (ext === "fbx") return new FBXLoader().loadAsync(url);
  const g = await new GLTFLoader().loadAsync(url);
  return g.scene;
}

/** Normalise to ~1.8 units tall with feet at y=0. Returns the applied scale factor. */
function normalise(obj: THREE.Object3D) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const h = box.max.y - box.min.y || 1;
  const s = 1.8 / h;
  obj.scale.multiplyScalar(s);
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  obj.updateMatrixWorld(true);
  return 1;
}

const AXES = ["X", "Y", "Z"] as const;

export function Studio() {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const [rig, setRig] = useState<Rig | null>(null);
  const [modelName, setModelName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pose, setPose] = useState<PoseData>({});
  const [hipsDrop, setHipsDrop] = useState(0);
  const [activePose, setActivePose] = useState<string | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [settings, setSettings] = useState<ViewSettings>({ outline: 3, mono: true, tones: 3, showJoints: true });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (url: string, ext: string, name: string) => {
    setLoading(true); setError("");
    try {
      const obj = await loadModel(url, ext);
      const s = normalise(obj);
      const r = buildRig(obj, s);
      if (!r.bones.has("Hips") || r.bones.size < 15) throw new Error("No Mixamo humanoid skeleton found in this file.");
      setModel(obj); setRig(r); setModelName(name); setSelected(null); setPose({}); setHipsDrop(0); setActivePose(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load model");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load("/models/xbot.glb", "glb", "X Bot (demo)"); }, [load]);
  useEffect(() => { if (model) toonify(model, settings.tones, settings.mono); }, [model, settings.tones, settings.mono]);
  useEffect(() => { if (rig) applyPose(rig, pose, hipsDrop); }, [rig, pose, hipsDrop]);

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["glb", "gltf", "fbx"].includes(ext)) { setError("Please drop a .glb, .gltf or .fbx file."); return; }
    load(URL.createObjectURL(f), ext, f.name);
  };

  const applyPreset = (id: string) => {
    const p = POSES.find((x) => x.id === id)!;
    setActivePose(id);
    if (p.partial) setPose((cur) => ({ ...cur, ...p.bones }));
    else { setPose({ ...p.bones }); setHipsDrop(p.hipsDrop ?? 0); }
  };

  const setRot = (bone: string, axis: number, v: number) =>
    setPose((cur) => { const r: Rot = [...(cur[bone] ?? [0, 0, 0])] as Rot; r[axis] = v; return { ...cur, [bone]: r }; });

  const onBoneDrag = () => {
    if (!rig || !selected) return;
    const r = offsetFromBone(rig, selected);
    setPose((cur) => ({ ...cur, [selected]: r }));
  };

  const visiblePoses = useMemo(
    () => POSES.filter((p) => (search ? p.name.toLowerCase().includes(search.toLowerCase()) : p.category === category)),
    [category, search],
  );
  const boneList = rig ? Array.from(rig.bones.keys()).filter((b) => !/Hand(Thumb|Index|Middle|Ring|Pinky)[23]|ToeBase/.test(b)) : [];
  const sel = selected ? pose[selected] ?? [0, 0, 0] : null;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex items-center gap-6 border-b-2 border-foreground px-4 py-2">
        <h1 className="font-display text-2xl tracking-wide">KOMA<span className="text-primary">STUDIO</span></h1>
        <nav className="flex gap-1 text-sm">
          <span className="rounded-sm bg-foreground px-3 py-1 text-background">Pose</span>
          {["Panels", "Pages", "Balloons", "Export"].map((t) => (
            <span key={t} title="Coming in a later phase" className="cursor-not-allowed px-3 py-1 text-muted-foreground">{t}</span>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{modelName}{rig && ` · ${rig.bones.size} bones mapped`}</span>
          <button onClick={() => fileRef.current?.click()} className="rounded-sm border-2 border-foreground bg-primary px-3 py-1 font-semibold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5">
            Import model
          </button>
          <input ref={fileRef} type="file" accept=".glb,.gltf,.fbx" hidden onChange={(e) => onFiles(e.target.files)} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Pose library */}
        <aside className="flex w-72 flex-col border-r-2 border-foreground">
          <div className="border-b border-border p-3">
            <h2 className="font-display text-lg">Pose Library</h2>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${POSES.length} poses…`}
              className="mt-2 w-full rounded-sm border border-input bg-card px-2 py-1.5 text-sm outline-none focus:border-foreground" />
            {!search && (
              <div className="mt-2 flex flex-wrap gap-1">
                {CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`rounded-sm border px-2 py-0.5 text-xs ${c === category ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3">
            {visiblePoses.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p.id)} disabled={!rig}
                className={`screentone min-h-14 rounded-sm border-2 px-2 py-2 text-left text-xs font-semibold leading-tight transition-all disabled:opacity-40 ${activePose === p.id ? "border-primary bg-primary/10" : "border-foreground hover:-translate-y-0.5 hover:shadow-ink"}`}>
                {p.name}
                {p.partial && <span className="mt-1 block text-[10px] font-normal text-muted-foreground">adds to pose</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <button disabled={!rig} onClick={() => { setPose((c) => mirrorPose(c)); setSelected((s) => (s ? mirrorBoneName(s) : s)); }}
              className="flex-1 rounded-sm border-2 border-foreground py-1.5 text-sm font-semibold hover:bg-accent">⇋ Mirror</button>
            <button disabled={!rig} onClick={() => { setPose({}); setHipsDrop(0); setActivePose(null); }}
              className="flex-1 rounded-sm border-2 border-foreground py-1.5 text-sm font-semibold hover:bg-accent">Reset</button>
          </div>
        </aside>

        {/* Viewport */}
        <main
          className="relative min-w-0 flex-1"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
        >
          <div className="absolute inset-4 border-[3px] border-foreground bg-card shadow-ink" data-scene-ready={rig ? "" : undefined}>
            <Viewport model={model} rig={rig} selected={selected} onSelect={setSelected} onBoneDrag={onBoneDrag} settings={settings} />
          </div>
          {(dragOver || loading || error) && (
            <div className="pointer-events-none absolute inset-4 flex items-center justify-center bg-background/80">
              <p className={`font-display text-2xl ${error ? "text-destructive" : ""}`}>
                {loading ? "Loading model…" : error || "Drop your Mixamo .glb / .fbx here"}
              </p>
            </div>
          )}
          <p className="pointer-events-none absolute bottom-6 left-8 text-xs text-muted-foreground">
            Drag & drop a Mixamo model · Click a blue joint to rotate it · Drag empty space to orbit
          </p>
        </main>

        {/* Inspector */}
        <aside className="flex w-72 flex-col overflow-y-auto border-l-2 border-foreground">
          <section className="border-b border-border p-3">
            <h2 className="font-display text-lg">Joint</h2>
            <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value || null)}
              className="mt-2 w-full rounded-sm border border-input bg-card px-2 py-1.5 text-sm">
              <option value="">— select a bone —</option>
              {boneList.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            {selected && sel && (
              <div className="mt-3 space-y-2">
                {AXES.map((a, i) => (
                  <label key={a} className="block text-xs">
                    <span className="flex justify-between"><span className="font-semibold">{a}</span><span className="tabular-nums">{sel[i]}°</span></span>
                    <input type="range" min={-180} max={180} value={sel[i]} onChange={(e) => setRot(selected, i, +e.target.value)} className="w-full accent-primary" />
                  </label>
                ))}
                <button onClick={() => setPose((c) => { const n = { ...c }; delete n[selected]; return n; })}
                  className="w-full rounded-sm border border-foreground py-1 text-xs hover:bg-accent">Reset joint</button>
              </div>
            )}
          </section>
          <section className="border-b border-border p-3">
            <h2 className="font-display text-lg">Body height</h2>
            <label className="block text-xs">
              <span className="flex justify-between"><span>Hips drop</span><span className="tabular-nums">{hipsDrop.toFixed(2)} m</span></span>
              <input type="range" min={-0.5} max={1} step={0.01} value={hipsDrop} onChange={(e) => setHipsDrop(+e.target.value)} className="w-full accent-primary" />
            </label>
          </section>
          <section className="space-y-3 p-3 text-xs">
            <h2 className="font-display text-lg">Manga render</h2>
            <label className="block">
              <span className="flex justify-between"><span>Ink outline</span><span>{settings.outline}</span></span>
              <input type="range" min={0} max={8} step={0.5} value={settings.outline} onChange={(e) => setSettings((s) => ({ ...s, outline: +e.target.value }))} className="w-full accent-primary" />
            </label>
            <label className="block">
              <span className="flex justify-between"><span>Shading tones</span><span>{settings.tones}</span></span>
              <input type="range" min={2} max={5} value={settings.tones} onChange={(e) => setSettings((s) => ({ ...s, tones: +e.target.value }))} className="w-full accent-primary" />
            </label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.mono} onChange={(e) => setSettings((s) => ({ ...s, mono: e.target.checked }))} className="accent-primary" /> Monochrome (manga)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showJoints} onChange={(e) => setSettings((s) => ({ ...s, showJoints: e.target.checked }))} className="accent-primary" /> Show joints</label>
          </section>
        </aside>
      </div>
    </div>
  );
}

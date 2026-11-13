import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { analyseOutfit, buildPiece, makeSampleDressed, worldVertex, type Island, type Target } from "@/lib/outfit-extract";
import { BUILTIN_MODELS } from "@/lib/base-models";
import { SLOTS, slotDef, type SlotId } from "@/lib/wardrobe";
import type { CustomAsset } from "./WardrobeRig";

const TARGETS: { id: Target; label: string }[] = [
  ...SLOTS.map((s) => ({ id: s.id as Target, label: `${s.icon} ${s.label}` })),
  { id: "body", label: "🧍 Body (remove)" },
  { id: "skip", label: "— Ignore" },
];

async function loadAny(file: File): Promise<THREE.Object3D> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const url = URL.createObjectURL(file);
  try {
    if (ext === "fbx") { const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js"); return await new FBXLoader().loadAsync(url); }
    if (ext === "glb" || ext === "gltf") { const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js"); return (await new GLTFLoader().loadAsync(url)).scene; }
    throw new Error("Use a .glb or .fbx file.");
  } finally { setTimeout(() => URL.revokeObjectURL(url), 10000); }
}

export function ExtractOutfitModal({ onClose, onExtract }: { onClose: () => void; onExtract: (items: CustomAsset[]) => void }) {
  const [root, setRoot] = useState<THREE.Object3D | null>(null);
  const [base, setBase] = useState<THREE.Object3D | null>(null);
  const [baseName, setBaseName] = useState("");
  const baseRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"islands" | "regions">("islands");
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [hover, setHover] = useState<string | null>(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);

  const islands = useMemo<Island[]>(() => (root ? analyseOutfit(root, mode, base) : []), [root, mode, base]);
  useEffect(() => { setTargets(Object.fromEntries(islands.map((i) => [i.id, i.suggested]))); }, [islands]);
  const target = (i: Island) => targets[i.id] ?? i.suggested;

  // front-view silhouette, coloured per piece
  useEffect(() => {
    const c = cv.current?.getContext("2d"); if (!c || !root) return;
    const W = 280, H = 420; c.clearRect(0, 0, W, H);
    // robust bounds (ignores stray vertices far from the body)
    const xs: number[] = [], ys: number[] = []; const tv = new THREE.Vector3();
    const meshes = [...new Set(islands.map((i) => i.mesh))];
    for (const m of meshes) { const n = m.geometry.getAttribute("position").count; const st = Math.max(1, Math.floor(n / 3000)); for (let i = 0; i < n; i += st) { worldVertex(m, i, tv); if (Number.isFinite(tv.x + tv.y)) { xs.push(tv.x); ys.push(tv.y); } } }
    xs.sort((p, q) => p - q); ys.sort((p, q) => p - q);
    const pct = (a: number[], f: number) => a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * f)))] ?? 0;
    const box = new THREE.Box3(new THREE.Vector3(pct(xs, 0.005), pct(ys, 0.005), 0), new THREE.Vector3(pct(xs, 0.995), pct(ys, 0.995), 0));
    const size = box.getSize(new THREE.Vector3());
    const k = Math.min((W - 20) / (size.x || 1), (H - 20) / (size.y || 1));
    const px = (x: number) => W / 2 + (x - (box.min.x + box.max.x) / 2) * k, py = (y: number) => H - 10 - (y - box.min.y) * k;
    const a = new THREE.Vector3();
    const order = [...islands].sort((p, q) => (target(p) === "body" ? -1 : 0) - (target(q) === "body" ? -1 : 0));
    for (const is of order) {
      const t = target(is); if (t === "skip") continue;
      const idx = is.mesh.geometry.getIndex();
      const vi = (tri: number, n: number) => (idx ? idx.getX(tri * 3 + n) : tri * 3 + n);
      c.fillStyle = t === "body" ? "rgba(140,140,140,0.25)" : hover === is.id ? "#111" : is.colour;
      const step = Math.max(1, Math.floor(is.tris.length / 5000));
      for (let n = 0; n < is.tris.length; n += step) {
        const tri = is.tris[n]!;
        for (let q = 0; q < 3; q++) { worldVertex(is.mesh, vi(tri, q), a); c.fillRect(px(a.x) - 1, py(a.y) - 1, 2.5, 2.5); }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, islands, targets, hover]);

  const load = async (f: File) => {
    setErr(""); setBusy(`Reading ${f.name}…`);
    try { setRoot(await loadAny(f)); setName(f.name.replace(/\.[^.]+$/, "")); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't read that file."); } finally { setBusy(""); }
  };
  const loadSample = async () => {
    setErr(""); setBusy("Dressing the sample character…");
    try {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const scene = (await new GLTFLoader().loadAsync("/models/xbot.glb")).scene;
      const plain = (await new GLTFLoader().loadAsync("/models/xbot.glb")).scene;
      setBase(plain); setBaseName("Demo character (undressed)");
      setRoot(makeSampleDressed(scene)); setName("Sample outfit");
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't build the sample."); } finally { setBusy(""); }
  };

  const chosen = new Map<SlotId, Island[]>();
  for (const is of islands) { const t = target(is); if (t !== "body" && t !== "skip") chosen.set(t, [...(chosen.get(t) ?? []), is]); }
  const extract = () => {
    const items: CustomAsset[] = [];
    for (const [slot, list] of chosen) {
      const { object, skinned } = buildPiece(list);
      items.push({ id: `custom:${crypto.randomUUID()}`, name: `${name || "Outfit"} — ${slotDef(slot).label}`, object, skinned, slot });
    }
    onExtract(items);
  };
  const shown = islands.slice(0, 80);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-label="Clothing from outfit">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-sm border-2 border-foreground bg-card shadow-xl">
        <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
          <h2 className="font-display text-lg uppercase tracking-wide">Clothing from outfit</h2>
          <button onClick={onClose} aria-label="Close outfit extractor" className="text-xl">×</button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:flex-row">
          <div className="space-y-2">
            <div className="flex items-center justify-center border border-border bg-muted/30" style={{ width: 280, height: 420 }}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void load(f); }}>
              {root ? <canvas ref={cv} width={280} height={420} data-testid="outfit-silhouette" /> : <p className="p-6 text-center text-sm text-muted-foreground">{busy || "Drop your dressed, Mixamo-rigged character here (.glb / .fbx)"}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => fileRef.current?.click()} className="rounded-sm border-2 border-foreground bg-foreground px-2 py-1 text-xs font-semibold text-background">Choose dressed model</button>
              <input ref={fileRef} type="file" accept=".glb,.gltf,.fbx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ""; }} />
              <button onClick={() => void loadSample()} className="rounded-sm border-2 border-border px-2 py-1 text-xs font-semibold hover:border-foreground">Use sample dressed character</button>
            </div>
            <div className="max-w-[280px] rounded-sm border border-border p-2 text-[11px]">
              <p className="font-semibold">Undressed version (optional, recommended)</p>
              <p className="text-muted-foreground">{baseName ? `Using: ${baseName}` : "Add your plain base model so bare skin is recognised and removed exactly."}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button onClick={() => baseRef.current?.click()} className="underline">{base ? "Upload other" : "Upload base"}</button>
                {BUILTIN_MODELS.map((bm) => (
                  <button
                    key={bm.key}
                    onClick={async () => {
                      setErr(""); setBusy(`Loading ${bm.name}…`);
                      try {
                        const { loadCharacterModel } = await import("@/lib/model-loader");
                        const loaded = await loadCharacterModel(bm.url, bm.ext, bm.name, bm.fallbackUrl);
                        setBase(loaded.object); setBaseName(bm.name);
                      } catch (er) {
                        setErr(er instanceof Error ? er.message : "Couldn't load base model.");
                      } finally { setBusy(""); }
                    }}
                    className="underline"
                  >
                    Use {bm.name.replace(" (demo)", "")}
                  </button>
                ))}
                {base && <button onClick={() => { setBase(null); setBaseName(""); }} className="underline">Remove</button>}
              </div>
              <input ref={baseRef} type="file" accept=".glb,.gltf,.fbx" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setBase(await loadAny(f)); setBaseName(f.name); } catch (er) { setErr(er instanceof Error ? er.message : "Couldn't read that base model."); } }} />
            </div>
            {busy && root && <p className="text-xs">{busy}</p>}
            {err && <p className="text-xs text-destructive">{err}</p>}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {!root ? (
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Make your character fully dressed in Meshy, rig it in Mixamo, and drop it here. The app finds each separate piece — hair, jacket, trousers, shoes, gloves — and suggests a slot for each from the bones it follows.</p>
                <p>Grey pieces are the body and are thrown away. Everything else becomes clothing that bends with any character using the same Mixamo skeleton.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold">Split by:</span>
                  <button onClick={() => setMode("islands")} aria-pressed={mode === "islands"} className={`rounded-sm border-2 px-2 py-0.5 ${mode === "islands" ? "border-foreground bg-accent font-semibold" : "border-border"}`}>Separate pieces</button>
                  <button onClick={() => setMode("regions")} aria-pressed={mode === "regions"} className={`rounded-sm border-2 px-2 py-0.5 ${mode === "regions" ? "border-foreground bg-accent font-semibold" : "border-border"}`}>Body regions</button>
                  <span className="text-muted-foreground">{islands.length} found</span>
                </div>
                {mode === "regions" && <p className="text-[11px] text-muted-foreground">Use this when the clothes are fused to the body in one piece. Each region is cut along the bones it follows.</p>}
                <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1" data-testid="outfit-pieces">
                  {shown.map((is) => (
                    <div key={is.id} onMouseEnter={() => setHover(is.id)} onMouseLeave={() => setHover(null)} className="flex items-center gap-2 rounded-sm border border-border px-2 py-1 text-xs">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: target(is) === "body" ? "#999" : is.colour }} />
                      <span className="flex-1 truncate">{is.label} <span className="text-muted-foreground">· {is.stats.tris.toLocaleString()} tris</span></span>
                      <select aria-label={`${is.label} slot`} value={target(is)} onChange={(e) => setTargets((t) => ({ ...t, [is.id]: e.target.value as Target }))} className="rounded border border-input bg-background p-0.5 text-xs">
                        {TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                  ))}
                  {islands.length > shown.length && <p className="text-[11px] text-muted-foreground">+{islands.length - shown.length} tiny pieces, kept with their suggested slot.</p>}
                </div>
                <label className="block text-xs font-semibold">Outfit name
                  <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-input bg-background p-1 text-sm" />
                </label>
                <div className="flex flex-wrap gap-1 text-[11px]" data-testid="outfit-summary">
                  {[...chosen.entries()].map(([slot, list]) => <span key={slot} className="rounded-sm bg-accent px-1.5 py-0.5">{slotDef(slot).icon} {slotDef(slot).label} ({list.length})</span>)}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t-2 border-foreground px-4 py-2">
          <button onClick={onClose} className="rounded-sm border-2 border-border px-3 py-1 text-sm">Cancel</button>
          <button disabled={!chosen.size} onClick={extract} className="rounded-sm border-2 border-foreground bg-foreground px-3 py-1 text-sm font-semibold text-background disabled:opacity-40">
            Extract & wear {chosen.size} item{chosen.size === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}

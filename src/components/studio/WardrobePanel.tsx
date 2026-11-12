import { useRef, useState } from "react";
import {
  DEFAULT_FIT, OUTFIT_PRESETS, SLOTS, SWATCHES, applyPreset, equip, itemById, itemsForSlot, setSlotColor, setSlotFit, slotDef, unequip,
  type Outfit, type SlotFit, type SlotId,
} from "@/lib/wardrobe";
import { ColorPicker } from "./ColorPicker";
import { loadWardrobeAsset, type CustomAsset } from "./WardrobeRig";

const FIT: [keyof SlotFit, string, number, number, number][] = [
  ["x", "Left / right", -0.2, 0.2, 0.002], ["y", "Up / down", -0.2, 0.2, 0.002], ["z", "Forward / back", -0.2, 0.2, 0.002],
  ["rx", "Tilt", -90, 90, 1], ["ry", "Turn", -180, 180, 1], ["rz", "Roll", -90, 90, 1],
  ["scale", "Size", 0.5, 2, 0.01], ["inflate", "Looser / tighter", 0.7, 1.6, 0.01],
];

export function WardrobePanel({ outfit, onChange, assets, onAddAsset, hasRig }: {
  outfit: Outfit; onChange: (o: Outfit) => void; assets: Record<string, CustomAsset>;
  onAddAsset: (a: CustomAsset) => void; hasRig: boolean;
}) {
  const [slot, setSlot] = useState<SlotId>("hair");
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const def = slotDef(slot); const cur = outfit[slot];
  const curItem = cur ? itemById(cur.itemId) : undefined;
  const customs = Object.values(assets).filter((a) => a.slot === slot);

  if (!hasRig) return <p className="p-4 text-sm text-muted-foreground">Load a rigged model to dress it.</p>;

  const importFile = async (f: File) => {
    setErr(""); setBusy(f.name);
    try {
      const a = await loadWardrobeAsset(f, slot);
      onAddAsset(a); onChange(equip(outfit, slot, a.id));
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not load that file."); }
    finally { setBusy(""); }
  };

  return (
    <div className="flex-1 overflow-y-auto text-sm" data-testid="wardrobe-panel">
      <div className="space-y-2 border-b border-border p-3">
        <h3 className="font-display text-sm uppercase tracking-wide">Full outfits</h3>
        <div className="flex flex-wrap gap-1.5">
          {OUTFIT_PRESETS.map((p) => (
            <button key={p.name} onClick={() => onChange(applyPreset(p))} className="rounded-sm border-2 border-border px-1.5 py-1 text-[11px] font-semibold hover:border-foreground hover:bg-accent">{p.name}</button>
          ))}
          <button onClick={() => onChange({})} className="rounded-sm border-2 border-destructive/60 px-1.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/10">Undress all</button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1 border-b border-border p-2">
        {SLOTS.map((s) => (
          <button key={s.id} onClick={() => setSlot(s.id)} aria-label={`${s.label} slot`} aria-pressed={slot === s.id}
            className={`relative rounded-sm border-2 px-0.5 py-1 text-center text-[10px] font-semibold leading-tight ${slot === s.id ? "border-foreground bg-accent" : "border-border hover:border-foreground"}`}>
            <span className="block text-base">{s.icon}</span>{s.label}
            {outfit[s.id] && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <div className="space-y-2 border-b border-border p-3">
        <h3 className="font-display text-sm uppercase tracking-wide">{def.icon} {def.label}</h3>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => onChange(unequip(outfit, slot))}
            className={`rounded-sm border-2 px-2 py-1.5 text-left text-[11px] font-semibold ${!cur ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>None</button>
          {itemsForSlot(slot).map((i) => (
            <button key={i.id} onClick={() => onChange(equip(outfit, slot, i.id))}
              className={`flex items-center gap-1.5 rounded-sm border-2 px-2 py-1.5 text-left text-[11px] font-semibold ${cur?.itemId === i.id ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>
              <span className="h-3 w-3 shrink-0 rounded-full border border-foreground/40" style={{ background: cur?.itemId === i.id ? cur.colors.p : i.colors.p }} />{i.name}
            </button>
          ))}
          {customs.map((a) => (
            <button key={a.id} onClick={() => onChange(equip(outfit, slot, a.id))}
              className={`rounded-sm border-2 border-dashed px-2 py-1.5 text-left text-[11px] font-semibold ${cur?.itemId === a.id ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>
              📦 {a.name}{a.skinned ? " (rigged)" : ""}
            </button>
          ))}
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) void importFile(f); }}
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-sm border-2 border-dashed border-border p-2 text-center text-[11px] text-muted-foreground hover:border-foreground">
          {busy ? `Loading ${busy}…` : `Drop your own ${def.label.toLowerCase()} file here (.glb / .fbx), or click`}
          <input ref={fileRef} type="file" accept=".glb,.gltf,.fbx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
        </div>
        {err && <p className="text-[11px] text-destructive">{err}</p>}
        <p className="text-[10px] text-muted-foreground">Rigged to the same Mixamo skeleton? It bends with the body. Otherwise it rides on the {def.anchor.bone.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}.</p>
      </div>

      {cur && (
        <>
          <div className="space-y-3 border-b border-border p-3">
            <h3 className="font-display text-sm uppercase tracking-wide">Colours</h3>
            <ColorPicker label={curItem ? "Main" : "Tint"} value={cur.colors.p} swatches={SWATCHES[def.palette]} onChange={(c) => onChange(setSlotColor(outfit, slot, "p", c))} />
            {curItem?.accent && <ColorPicker label="Accent" value={cur.colors.s} swatches={SWATCHES[def.palette]} onChange={(c) => onChange(setSlotColor(outfit, slot, "s", c))} />}
          </div>
          <div className="space-y-1 border-b border-border p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm uppercase tracking-wide">Fit</h3>
              <button onClick={() => onChange(setSlotFit(outfit, slot, DEFAULT_FIT))} className="text-[11px] underline">Reset fit</button>
            </div>
            {FIT.map(([k, label, min, max, step]) => (
              <label key={k} className="block text-xs">
                <span className="flex justify-between"><span>{label}</span><span className="tabular-nums text-muted-foreground">{cur.fit[k].toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0)}</span></span>
                <input type="range" min={min} max={max} step={step} value={cur.fit[k]} aria-label={label}
                  onChange={(e) => onChange(setSlotFit(outfit, slot, { [k]: parseFloat(e.target.value) }))} className="w-full" />
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

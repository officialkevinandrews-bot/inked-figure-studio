import { useRef, useState } from "react";
import { activeOutfitOf, type Character } from "@/lib/characters";

/** Create Character tab: character roster, name, base body and the outfit shelf. */
export function CharacterPanel({ characters, active, onSelect, onNew, onRename, onDuplicate, onDelete, onModelFile, onUseDummy,
  onSelectOutfit, onAddOutfit, onDuplicateOutfit, onRenameOutfit, onDeleteOutfit, onPose }: {
  characters: Character[]; active: Character | null;
  onSelect: (id: string) => void; onNew: () => void; onRename: (name: string) => void; onDuplicate: () => void; onDelete: () => void;
  onModelFile: (f: File) => void; onUseDummy: () => void;
  onSelectOutfit: (id: string) => void; onAddOutfit: () => void; onDuplicateOutfit: () => void; onRenameOutfit: (id: string, name: string) => void; onDeleteOutfit: (id: string) => void;
  onPose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const btn = "rounded-sm border-2 border-border px-1.5 py-1 text-[11px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40";
  const cur = active ? activeOutfitOf(active) : null;

  return (
    <div className="space-y-2 border-b-2 border-foreground p-3 text-sm" data-testid="character-panel">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Characters</h2>
        <button onClick={onNew} className="rounded-sm border-2 border-foreground bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">+ New character</button>
      </div>
      {characters.length > 0 ? (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
          {characters.map((c) => (
            <button key={c.id} onClick={() => onSelect(c.id)} aria-pressed={active?.id === c.id}
              className={`flex items-center gap-1.5 rounded-sm border-2 px-1.5 py-1 text-[11px] font-semibold ${active?.id === c.id ? "border-foreground bg-accent" : "border-border hover:border-foreground"}`}>
              {c.thumbnail ? <img src={c.thumbnail} alt="" className="h-6 w-6 rounded-sm border border-border bg-background object-cover" /> : <span>👤</span>}
              {c.name}
            </button>
          ))}
        </div>
      ) : <p className="text-[11px] text-muted-foreground">No characters yet. Make one to save its face and outfits.</p>}

      {active && cur && (
        <div className="space-y-2 rounded-sm border-2 border-border p-2">
          <label className="block text-xs font-semibold">Name
            <input aria-label="Character name" value={active.name} onChange={(e) => onRename(e.target.value)}
              className="mt-1 w-full rounded-sm border border-input bg-background px-2 py-1 text-sm outline-none focus:border-foreground" />
          </label>
          <div className="text-xs">
            <span className="font-semibold">Body: </span><span className="text-muted-foreground">{active.modelName}</span>
            <div className="mt-1 flex gap-1.5">
              <button className={btn} onClick={() => fileRef.current?.click()}>Upload body (.glb/.fbx)</button>
              <button className={btn} onClick={onUseDummy}>Use test dummy</button>
              <input ref={fileRef} type="file" accept=".glb,.gltf,.fbx,.vrm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onModelFile(f); e.target.value = ""; }} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold">Outfits</p>
            <div className="mt-1 space-y-1" data-testid="outfit-list">
              {active.outfits.map((o) => (
                <div key={o.id} className={`flex items-center gap-1 rounded-sm border-2 px-1.5 py-0.5 ${o.id === cur.id ? "border-foreground bg-accent" : "border-border"}`}>
                  {renaming === o.id ? (
                    <input autoFocus defaultValue={o.name} aria-label="Outfit name" className="flex-1 bg-background px-1 text-xs"
                      onBlur={(e) => { onRenameOutfit(o.id, e.target.value); setRenaming(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                  ) : (
                    <button className="flex-1 text-left text-xs font-semibold" onClick={() => onSelectOutfit(o.id)}>{o.name}
                      <span className="ml-1 font-normal text-muted-foreground">({Object.keys(o.outfit).length} items{o.props.length ? `, ${o.props.length} props` : ""})</span>
                    </button>
                  )}
                  <button aria-label={`Rename ${o.name}`} className="text-[11px]" onClick={() => setRenaming(o.id)}>✏️</button>
                  <button aria-label={`Delete ${o.name}`} disabled={active.outfits.length <= 1} className="text-xs text-destructive disabled:opacity-30"
                    onClick={() => { if (confirm(`Delete "${o.name}"?`)) onDeleteOutfit(o.id); }}>×</button>
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1.5">
              <button className={btn} onClick={onAddOutfit}>+ New outfit</button>
              <button className={btn} onClick={onDuplicateOutfit}>Copy this outfit</button>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button className={btn} onClick={onDuplicate}>Duplicate</button>
            <button className={`${btn} text-destructive`} onClick={() => { if (confirm(`Delete ${active.name}?`)) onDelete(); }}>Delete</button>
            <button onClick={onPose} className="ml-auto rounded-sm border-2 border-foreground bg-foreground px-2 py-1 text-[11px] font-semibold text-background">Pose this character →</button>
          </div>
          <p className="text-[10px] text-muted-foreground">Changes save automatically.</p>
        </div>
      )}
    </div>
  );
}

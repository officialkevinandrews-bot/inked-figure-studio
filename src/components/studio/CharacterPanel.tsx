import { useRef, useState } from "react";
import { activeOutfitOf, type Character } from "@/lib/characters";
import { BUILTIN_MODELS, SKIN_SWATCHES } from "@/lib/base-models";
import { ColorPicker } from "./ColorPicker";

/** Create Character tab: character roster, name, base body and the outfit shelf. */
export function CharacterPanel({
  characters, active, onSelect, onNew, onRename, onDuplicate, onDelete, onModelFile, onUseDummy, onPickBody, savedBodies, onSkin,
  onSelectOutfit, onAddOutfit, onDuplicateOutfit, onRenameOutfit, onDeleteOutfit, onPose, onExport, onImport,
  activeModelKey, rigInfo, materialInfo, onSkinMaterials, onRenameBody, onDeleteBody,
}: {
  onExport: () => void; onImport: (f: File) => void;
  characters: Character[]; active: Character | null;
  onSelect: (id: string) => void; onNew: () => void; onRename: (name: string) => void; onDuplicate: () => void; onDelete: () => void;
  onModelFile: (f: File) => void; onUseDummy: () => void;
  onPickBody: (key: string) => void; savedBodies: { key: string; name: string }[]; onSkin: (hex: string) => void;
  onSelectOutfit: (id: string) => void; onAddOutfit: () => void; onDuplicateOutfit: () => void; onRenameOutfit: (id: string, name: string) => void; onDeleteOutfit: (id: string) => void;
  onPose: () => void;
  activeModelKey?: string;
  rigInfo?: { mapped: number; totalCanonical: number; hasFullHands: boolean } | null;
  materialInfo?: { all: string[]; targets: string[]; isSingleMaterial: boolean } | null;
  onSkinMaterials?: (mats: string[]) => void;
  onRenameBody?: (key: string, name: string) => void;
  onDeleteBody?: (key: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renamingBody, setRenamingBody] = useState(false);
  const [showMatTargets, setShowMatTargets] = useState(false);
  const btn = "rounded-sm border-2 border-border px-1.5 py-1 text-[11px] font-semibold hover:border-foreground hover:bg-accent disabled:opacity-40";
  const cur = active ? activeOutfitOf(active) : null;
  const currentBodyKey = active?.model ?? activeModelKey ?? "builtin:xbot";
  const isCustomBody = currentBodyKey.startsWith("file:");
  const currentBodyEntry = savedBodies.find((b) => b.key === currentBodyKey);
  const effectiveSkinMats = active?.skinMaterials && active.skinMaterials.length > 0
    ? active.skinMaterials
    : materialInfo?.targets ?? [];
  void onUseDummy;

  const baseSelectorBlock = (
    <div className="space-y-1 text-xs">
      <div className="flex items-center justify-between gap-1">
        <span><span className="font-semibold">Base body: </span><span className="text-muted-foreground">{active?.modelName ?? currentBodyEntry?.name ?? BUILTIN_MODELS.find((m) => m.key === currentBodyKey)?.name ?? "X Bot (demo)"}</span></span>
        {isCustomBody && onRenameBody && onDeleteBody && currentBodyEntry && (
          <span className="flex items-center gap-1">
            <button type="button" title="Rename base model" aria-label="Rename base model" onClick={() => setRenamingBody((v) => !v)} className="text-[11px]">✏️</button>
            <button type="button" title="Remove base model" aria-label="Remove base model" onClick={() => { if (confirm(`Remove uploaded base model "${currentBodyEntry.name}" from the library?`)) onDeleteBody(currentBodyKey); }} className="text-xs text-destructive">×</button>
          </span>
        )}
      </div>
      {renamingBody && currentBodyEntry && onRenameBody && (
        <input
          autoFocus
          defaultValue={currentBodyEntry.name}
          aria-label="Base model name"
          className="w-full rounded-sm border border-foreground bg-background px-2 py-0.5 text-xs"
          onBlur={(e) => { onRenameBody(currentBodyKey, e.target.value); setRenamingBody(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
      )}
      <select aria-label="Base model" value={currentBodyKey} onChange={(e) => onPickBody(e.target.value)}
        className="w-full rounded-sm border border-input bg-background px-2 py-1 text-sm">
        <optgroup label="Built-in bases">
          {BUILTIN_MODELS.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
        </optgroup>
        {savedBodies.length > 0 && (
          <optgroup label="My uploaded bodies">
            {savedBodies.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
          </optgroup>
        )}
      </select>
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={btn} onClick={() => fileRef.current?.click()}>Upload body (.fbx/.glb/.vrm)</button>
        <input ref={fileRef} type="file" accept=".glb,.gltf,.fbx,.vrm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onModelFile(f); e.target.value = ""; }} />
        {rigInfo && (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title="Mixamo bone auto-calibration status">
            {rigInfo.mapped}/{rigInfo.totalCanonical} bones{rigInfo.hasFullHands ? " · 5-finger" : ""} · 1.8m
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-2 border-b-2 border-foreground p-3 text-sm" data-testid="character-panel">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Characters</h2>
        <button onClick={onNew} className="rounded-sm border-2 border-foreground bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">+ New character</button>
      </div>
      <div className="flex gap-1.5">
        <button className={btn} onClick={onExport} disabled={!characters.length && !savedBodies.length}>⬇ Back up studio</button>
        <button className={btn} onClick={() => backupRef.current?.click()}>⬆ Restore backup</button>
        <input ref={backupRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
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
      ) : (
        <div className="space-y-2 rounded-sm border border-border p-2">
          <p className="text-[11px] text-muted-foreground">Pick a base model below, or click + New character to save your design.</p>
          {baseSelectorBlock}
        </div>
      )}

      {active && cur && (
        <div className="space-y-2 rounded-sm border-2 border-border p-2">
          <label className="block text-xs font-semibold">Name
            <input aria-label="Character name" value={active.name} onChange={(e) => onRename(e.target.value)}
              className="mt-1 w-full rounded-sm border border-input bg-background px-2 py-1 text-sm outline-none focus:border-foreground" />
          </label>
          {baseSelectorBlock}
          <div className="space-y-1">
            <ColorPicker label="Skin colour" value={active.skinColor ?? "#ffffff"} onChange={onSkin} swatches={SKIN_SWATCHES} />
            {materialInfo && materialInfo.all.length > 1 && onSkinMaterials && (
              <div>
                <button type="button" onClick={() => setShowMatTargets((v) => !v)} className="text-[10px] font-semibold text-muted-foreground underline">
                  {showMatTargets ? "Hide skin materials" : `Tint targets (${effectiveSkinMats.length}/${materialInfo.all.length} materials)`}
                </button>
                {showMatTargets && (
                  <div className="mt-1 flex flex-wrap gap-1 rounded-sm border border-border bg-muted/40 p-1.5">
                    {materialInfo.all.map((matName) => {
                      const checked = effectiveSkinMats.includes(matName);
                      return (
                        <label key={matName} className="flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-[10px]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...new Set([...effectiveSkinMats, matName])]
                                : effectiveSkinMats.filter((x) => x !== matName);
                              onSkinMaterials(next);
                            }}
                          />
                          {matName}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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

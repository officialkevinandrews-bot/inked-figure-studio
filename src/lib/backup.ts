import type { Character } from "./characters";
import { customItemIds } from "./characters";
import type { FacePack } from "./face-parts";

export interface BackupFile { id: string; name: string; slot?: string; type: string; data: string }
export interface StudioBackup { app: "koma-studio"; version: 1; exported: number; characters: Character[]; facePacks: FacePack[]; files: BackupFile[] }

/** Stored-file ids a set of characters needs: uploaded bodies plus custom clothing. */
export function referencedFileIds(chars: Character[]): string[] {
  const s = new Set<string>();
  for (const c of chars) {
    if (!c.model.startsWith("builtin:")) s.add(c.model);
    for (const id of customItemIds(c)) s.add(id);
  }
  return [...s];
}

export function parseBackup(text: string): StudioBackup {
  const b = JSON.parse(text) as StudioBackup;
  if (b?.app !== "koma-studio" || !Array.isArray(b.characters)) throw new Error("This isn't a studio backup file.");
  return { ...b, facePacks: b.facePacks ?? [], files: b.files ?? [] };
}

/** Imported items replace same-id items; everything else is kept. */
export function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const ids = new Set(incoming.map((x) => x.id));
  return [...incoming, ...current.filter((x) => !ids.has(x.id))];
}

export const blobToB64 = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
export function b64ToBlob(data: string, type: string) { const bin = atob(data); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); }

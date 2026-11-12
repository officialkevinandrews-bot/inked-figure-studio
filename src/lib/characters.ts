import { DEFAULT_FACE, DEFAULT_CALIBRATION, DEFAULT_FACE_COLORS, type FaceConfig } from "./face-library";
import type { Outfit } from "./wardrobe";
import type { ActiveProp } from "./props";

/** Built-in demo body; anything else is an uploaded model file kept in the browser's file store. */
export const DUMMY_MODEL = "builtin:xbot";

export interface CharacterOutfit { id: string; name: string; outfit: Outfit; props: ActiveProp[] }
export interface Character {
  id: string;
  name: string;
  model: string; // DUMMY_MODEL or "file:<id>"
  modelName: string; // file name shown to the user
  face: FaceConfig;
  outfits: CharacterOutfit[];
  activeOutfit: string;
  thumbnail?: string;
  updatedAt: number;
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function blankOutfit(n: number): CharacterOutfit {
  return { id: uid("outfit"), name: `Outfit ${n}`, outfit: {}, props: [] };
}

export function newCharacter(name = "New Character"): Character {
  const o = blankOutfit(1);
  return {
    id: uid("char"), name, model: DUMMY_MODEL, modelName: "X Bot (demo)",
    face: { ...DEFAULT_FACE, calib: { ...DEFAULT_CALIBRATION }, colors: { ...DEFAULT_FACE_COLORS } },
    outfits: [o], activeOutfit: o.id, updatedAt: Date.now(),
  };
}

export const activeOutfitOf = (c: Character) => c.outfits.find((o) => o.id === c.activeOutfit) ?? c.outfits[0];

/** Adds the next numbered outfit; copies the given outfit's clothes when `copyFrom` is set. */
export function addOutfit(c: Character, copyFrom?: string): Character {
  const src = copyFrom ? c.outfits.find((o) => o.id === copyFrom) : undefined;
  const used = new Set(c.outfits.map((o) => o.name));
  let n = c.outfits.length + 1;
  while (used.has(`Outfit ${n}`)) n++;
  const o = blankOutfit(n);
  if (src) { o.outfit = clone(src.outfit); o.props = clone(src.props); }
  return { ...c, outfits: [...c.outfits, o], activeOutfit: o.id };
}

export function renameOutfit(c: Character, id: string, name: string): Character {
  return { ...c, outfits: c.outfits.map((o) => (o.id === id ? { ...o, name: name.trim() || o.name } : o)) };
}

/** A character always keeps at least one outfit. */
export function deleteOutfit(c: Character, id: string): Character {
  if (c.outfits.length <= 1) return c;
  const outfits = c.outfits.filter((o) => o.id !== id);
  return { ...c, outfits, activeOutfit: c.activeOutfit === id ? outfits[0].id : c.activeOutfit };
}

export function updateActiveOutfit(c: Character, patch: Partial<Pick<CharacterOutfit, "outfit" | "props">>): Character {
  return { ...c, outfits: c.outfits.map((o) => (o.id === c.activeOutfit ? { ...o, ...patch } : o)) };
}

export function duplicateCharacter(c: Character): Character {
  return { ...clone(c), id: uid("char"), name: `${c.name} (copy)`, updatedAt: Date.now() };
}

/** Custom item ids an outfit list depends on (for loading their saved files). */
export function customItemIds(c: Character): string[] {
  const s = new Set<string>();
  for (const o of c.outfits) for (const v of Object.values(o.outfit)) if (v?.itemId.startsWith("custom:")) s.add(v.itemId);
  return [...s];
}

const KEY = "koma-characters";
export function loadCharacters(): Character[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Character[];
    return list.filter((c) => c && c.id && Array.isArray(c.outfits) && c.outfits.length).map((c) => ({
      ...c,
      face: { ...DEFAULT_FACE, ...c.face, calib: { ...DEFAULT_CALIBRATION, ...(c.face?.calib ?? {}) }, colors: { ...DEFAULT_FACE_COLORS, ...(c.face?.colors ?? {}) }, overrides: c.face?.overrides ?? {}, fx: c.face?.fx ?? [] },
    }));
  } catch { return []; }
}
export function saveCharacters(list: Character[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}
export function upsertCharacter(list: Character[], c: Character): Character[] {
  const n = { ...c, updatedAt: Date.now() };
  return list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? n : x)) : [n, ...list];
}

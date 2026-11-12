/**
 * Custom face packs: a neutral face drawn on the 1024px template is sliced into parts,
 * then the morph engine bends those neutral parts into every expression state.
 * Pure data + canvas helpers; no React / three.js.
 */
import type { BrowState, EyeState, MouthState } from "./face-library";

export type PartId = "eyeR" | "eyeL" | "browR" | "browL" | "nose" | "mouth";
export interface Box { x: number; y: number; w: number; h: number }

/** Template slots on the 1024px sheet. "R" parts sit on the image's left (the character's right). */
export const TEMPLATE_SIZE = 1024;
export const TEMPLATE_BOXES: Record<PartId, Box> = {
  browR: { x: 222, y: 318, w: 260, h: 100 },
  browL: { x: 542, y: 318, w: 260, h: 100 },
  eyeR: { x: 222, y: 425, w: 260, h: 160 },
  eyeL: { x: 542, y: 425, w: 260, h: 160 },
  nose: { x: 452, y: 595, w: 120, h: 105 },
  mouth: { x: 382, y: 710, w: 260, h: 130 },
};
export const PART_LABELS: Record<PartId, string> = { browR: "Right brow", browL: "Left brow", eyeR: "Right eye", eyeL: "Left eye", nose: "Nose", mouth: "Mouth" };
export const PART_IDS = Object.keys(TEMPLATE_BOXES) as PartId[];

/** One sliced part: a tight PNG crop plus where its centre sat relative to its template box centre (1024 px). */
export interface FacePart { src: string; w: number; h: number; dx: number; dy: number }
export interface FacePack { id: string; name: string; created: number; parts: Partial<Record<PartId, FacePart>>; thumb?: string }

export const boxCentre = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Alpha bounding box inside a box of RGBA data (image-wide width `iw`). Returns null when empty. */
export function alphaBounds(data: Uint8ClampedArray, iw: number, b: Box, threshold = 12): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    if (data[(y * iw + x) * 4 + 3]! > threshold) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Uploads without transparency: turn near-white paper (and template guide colours) into alpha. */
export function knockOutPaper(data: Uint8ClampedArray) {
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 250) opaque++;
  if (opaque < data.length / 4 * 0.9) return false; // already has transparency
  for (let i = 0; i < data.length; i += 4) {
    const m = Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
    if (m > 235) data[i + 3] = 0; else if (m > 200) data[i + 3] = Math.round(((235 - m) / 35) * 255);
  }
  return true;
}

export function clampBox(b: Box, size = TEMPLATE_SIZE): Box {
  const w = Math.max(8, Math.min(size, Math.round(b.w))), h = Math.max(8, Math.min(size, Math.round(b.h)));
  return { x: Math.max(0, Math.min(size - w, Math.round(b.x))), y: Math.max(0, Math.min(size - h, Math.round(b.y))), w, h };
}

/* ---------------- Morph engine: neutral part -> expression state ---------------- */

export interface EyeMorph { sx: number; sy: number; rot: number; lid: number; lidSlant: number; replace?: "happy" | "closed"; pupil?: "shock" | "blank"; tears?: boolean; dy: number }
export interface BrowMorph { rot: number; dy: number; sy: number; sx: number }
export interface MouthMorph { mode: "warp" | "open"; curve: number; tilt: number; wave: number; sx: number; sy: number; open?: MouthState }

/** rot / lidSlant are degrees with positive = inner (nose-side) end lower. lid = fraction of the eye hidden by the upper lid. */
export const EYE_MORPH: Record<EyeState, EyeMorph> = {
  open: { sx: 1, sy: 1, rot: 0, lid: 0, lidSlant: 0, dy: 0 },
  happy: { sx: 1, sy: 1, rot: 0, lid: 0, lidSlant: 0, replace: "happy", dy: 0 },
  glare: { sx: 1.02, sy: 0.92, rot: 6, lid: 0.42, lidSlant: 16, dy: 2 },
  shock: { sx: 1.06, sy: 1.12, rot: 0, lid: 0, lidSlant: 0, pupil: "shock", dy: -4 },
  half: { sx: 1, sy: 1, rot: 0, lid: 0.5, lidSlant: -4, dy: 2 },
  intense: { sx: 1.02, sy: 0.95, rot: 5, lid: 0.25, lidSlant: 12, dy: 0 },
  teary: { sx: 1, sy: 1.04, rot: -3, lid: 0, lidSlant: 0, tears: true, dy: 0 },
  closed: { sx: 1, sy: 1, rot: 0, lid: 0, lidSlant: 0, replace: "closed", dy: 6 },
  blank: { sx: 1, sy: 1, rot: 0, lid: 0.08, lidSlant: 0, pupil: "blank", dy: 0 },
};
export const BROW_MORPH: Record<BrowState, BrowMorph> = {
  neutral: { rot: 0, dy: 0, sy: 1, sx: 1 },
  raised: { rot: -4, dy: -16, sy: 1, sx: 1 },
  angry: { rot: 20, dy: 6, sy: 1.1, sx: 1 },
  sad: { rot: -18, dy: -6, sy: 1, sx: 0.96 },
  smug: { rot: -10, dy: -18, sy: 1, sx: 1 }, // applied to the left brow only; the other goes flat
  flat: { rot: 0, dy: 4, sy: 0.75, sx: 1.02 },
};
export const MOUTH_MORPH: Record<MouthState, MouthMorph> = {
  neutral: { mode: "warp", curve: 0, tilt: 0, wave: 0, sx: 1, sy: 1 },
  smile: { mode: "warp", curve: 0.32, tilt: 0, wave: 0, sx: 1.12, sy: 1 },
  grin: { mode: "open", curve: 0, tilt: 0, wave: 0, sx: 1.1, sy: 1, open: "grin" },
  shout: { mode: "open", curve: 0, tilt: 0, wave: 0, sx: 1.05, sy: 1, open: "shout" },
  gasp: { mode: "open", curve: 0, tilt: 0, wave: 0, sx: 0.7, sy: 1, open: "gasp" },
  smirk: { mode: "warp", curve: 0, tilt: -0.28, wave: 0, sx: 1, sy: 1 },
  gritted: { mode: "open", curve: 0, tilt: 0, wave: 0, sx: 1.05, sy: 1, open: "gritted" },
  wavy: { mode: "warp", curve: -0.12, tilt: 0, wave: 0.16, sx: 0.95, sy: 1 },
  flat: { mode: "warp", curve: 0, tilt: 0, wave: 0, sx: 0.85, sy: 0.6 },
};

/** Vertical offset (as a fraction of part width) for a mouth column at normalised x in [-1, 1]. */
export function mouthWarpOffset(m: MouthMorph, x: number) {
  return -m.curve * x * x + m.tilt * (x + 1) * 0.5 * (x > 0 ? 1 : 0.15) + m.wave * Math.sin(x * Math.PI * 2.5);
}

/* ---------------- Library persistence ---------------- */

const LIB_KEY = "koma-face-packs";
export function loadPacks(): FacePack[] {
  try { const raw = localStorage.getItem(LIB_KEY); return raw ? (JSON.parse(raw) as FacePack[]) : []; } catch { return []; }
}
export function savePacks(packs: FacePack[]): boolean {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(packs)); return true; } catch { return false; }
}
export function upsertPack(packs: FacePack[], p: FacePack) { return [...packs.filter((x) => x.id !== p.id), p]; }
export function removePack(packs: FacePack[], id: string) { return packs.filter((x) => x.id !== id); }

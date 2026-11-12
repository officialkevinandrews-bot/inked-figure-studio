/** Browser-side half of custom face packs: slicing uploads, drawing morphed parts, sample sheets. */
import { drawBrow, drawEye, drawMouth, setFacePalette } from "./face-draw";
import { DEFAULT_FACE_COLORS, type FaceCalibration, type ResolvedFace } from "./face-library";
import {
  BROW_MORPH, EYE_MORPH, MOUTH_MORPH, PART_IDS, TEMPLATE_BOXES, TEMPLATE_SIZE,
  alphaBounds, boxCentre, knockOutPaper, mouthWarpOffset,
  type Box, type FacePack, type FacePart, type PartId,
} from "./face-parts";

type C = CanvasRenderingContext2D;
const D = Math.PI / 180;

/* ---------- image cache (sprites are data URLs) ---------- */
interface Sprite { img: HTMLImageElement; ink: string; ready: boolean }
const cache = new Map<string, Sprite>();
const listeners = new Set<() => void>();
export function onSpritesLoaded(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

function sprite(src: string): Sprite {
  let s = cache.get(src);
  if (s) return s;
  const img = new Image();
  s = { img, ink: "#141414", ready: false };
  cache.set(src, s);
  const done = s;
  img.onload = () => { done.ready = true; done.ink = darkest(img); listeners.forEach((f) => f()); };
  img.src = src;
  return s;
}
/** Average colour of the darkest opaque pixels: used to draw lids/lines that match the artist's ink. */
function darkest(img: HTMLImageElement) {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d")!; x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const px: [number, number, number, number][] = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]! > 200) px.push([d[i]! + d[i + 1]! + d[i + 2]!, d[i]!, d[i + 1]!, d[i + 2]!]);
  if (!px.length) return "#141414";
  px.sort((a, b) => a[0] - b[0]);
  const n = Math.max(1, Math.floor(px.length * 0.15)); let r = 0, g = 0, b = 0;
  for (let i = 0; i < n; i++) { r += px[i]![1]; g += px[i]![2]; b += px[i]![3]; }
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}
export function packReady(p: FacePack) { return Object.values(p.parts).every((part) => !part || sprite(part.src).ready); }
export function preloadPack(p: FacePack) { Object.values(p.parts).forEach((part) => part && sprite(part.src)); }

/* ---------- slicing ---------- */
/** Draws any uploaded image into a 1024 square (contained, centred). */
export function toTemplateCanvas(img: CanvasImageSource & { width: number; height: number }) {
  const c = document.createElement("canvas"); c.width = c.height = TEMPLATE_SIZE;
  const x = c.getContext("2d")!; const k = Math.min(TEMPLATE_SIZE / img.width, TEMPLATE_SIZE / img.height);
  const w = img.width * k, h = img.height * k; x.drawImage(img, (TEMPLATE_SIZE - w) / 2, (TEMPLATE_SIZE - h) / 2, w, h);
  return c;
}

export function slicePack(sheet: HTMLCanvasElement, boxes: Record<PartId, Box>, name: string): FacePack {
  const x = sheet.getContext("2d")!;
  const im = x.getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
  knockOutPaper(im.data);
  const clean = document.createElement("canvas"); clean.width = clean.height = TEMPLATE_SIZE;
  clean.getContext("2d")!.putImageData(im, 0, 0);
  const parts: Partial<Record<PartId, FacePart>> = {};
  for (const id of PART_IDS) {
    const b = alphaBounds(im.data, TEMPLATE_SIZE, boxes[id]);
    if (!b) continue;
    const pad = 3, w = b.w + pad * 2, h = b.h + pad * 2;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(clean, b.x - pad, b.y - pad, w, h, 0, 0, w, h);
    const t = boxCentre(TEMPLATE_BOXES[id]), bc = boxCentre(b), tb = TEMPLATE_BOXES[id];
    const cl = (v: number, m: number) => Math.max(-m, Math.min(m, v));
    parts[id] = { src: c.toDataURL("image/png"), w, h, dx: cl(bc.x - t.x, tb.w), dy: cl(bc.y - t.y, tb.h) };
  }
  return { id: `pack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: name.trim() || "My face", created: Date.now(), parts };
}

/* ---------- drawing with the morph engine ---------- */
const tmp = () => { const c = document.createElement("canvas"); return c; };
let scratch: HTMLCanvasElement | null = null;

function anchor(id: PartId, k: FaceCalibration) {
  switch (id) {
    case "eyeR": return { x: 256 - k.eyeSpacing, y: k.eyeY };
    case "eyeL": return { x: 256 + k.eyeSpacing, y: k.eyeY };
    case "browR": return { x: 256 - k.eyeSpacing - 4, y: k.eyeY - k.browGap };
    case "browL": return { x: 256 + k.eyeSpacing + 4, y: k.eyeY - k.browGap };
    case "nose": return { x: 256, y: k.eyeY + (k.mouthY - k.eyeY) * 0.52 };
    case "mouth": return { x: 256, y: k.mouthY };
  }
}

function drawEyePart(c: C, s: Sprite, part: FacePart, inner: 1 | -1, state: ResolvedFace["eye"], scale: number) {
  const m = EYE_MORPH[state]; const w = part.w, h = part.h;
  c.rotate(m.rot * D * inner); c.translate(0, m.dy);
  if (m.replace) {
    const hw = (w * m.sx * scale) / 2 * 0.85; c.strokeStyle = s.ink; c.lineCap = "round";
    c.lineWidth = Math.max(3, Math.min(9, h * scale * 0.09)); c.beginPath();
    if (m.replace === "happy") { c.moveTo(-hw, h * scale * 0.08); c.quadraticCurveTo(0, -h * scale * 0.45, hw, h * scale * 0.08); }
    else { c.moveTo(-hw, 0); c.quadraticCurveTo(0, h * scale * 0.25, hw, 0); }
    c.stroke(); return;
  }
  scratch ??= tmp();
  const W = Math.ceil(w * 1.2) + 8, H = Math.ceil(h * 1.2) + 8;
  scratch.width = W; scratch.height = H;
  const x = scratch.getContext("2d")!;
  x.save(); x.translate(W / 2, H / 2); x.scale(m.sx, m.sy); x.drawImage(s.img, -w / 2, -h / 2); x.restore();
  const top = H / 2 - (h * m.sy) / 2, eh = h * m.sy, lw = Math.max(3, h * 0.07);
  if (m.pupil) {
    x.globalCompositeOperation = "source-atop"; x.fillStyle = "#fff";
    const rx = w * m.sx * (m.pupil === "shock" ? 0.26 : 0.2), ry = eh * (m.pupil === "shock" ? 0.34 : 0.3);
    x.beginPath(); x.ellipse(W / 2, H / 2 + eh * 0.05, rx, ry, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = s.ink; x.strokeStyle = s.ink; x.lineWidth = Math.max(1.5, lw * 0.4);
    if (m.pupil === "shock") { x.beginPath(); x.arc(W / 2, H / 2 + eh * 0.05, Math.max(2.5, w * 0.035), 0, Math.PI * 2); x.fill(); }
    else { x.beginPath(); x.ellipse(W / 2, H / 2 + eh * 0.05, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2); x.stroke(); }
    x.globalCompositeOperation = "source-over";
  }
  if (m.lid > 0) {
    // inner = nose side (+x for the character's right eye, which sits on the image's left)
    const slant = Math.tan(m.lidSlant * D) * (W / 2);
    const yIn = top + eh * m.lid + slant, yOut = top + eh * m.lid - slant;
    const xIn = inner === 1 ? W : 0, xOut = W - xIn;
    x.globalCompositeOperation = "destination-out";
    x.beginPath(); x.moveTo(xOut, 0); x.lineTo(xIn, 0); x.lineTo(xIn, yIn); x.lineTo(xOut, yOut); x.closePath(); x.fill();
    x.globalCompositeOperation = "source-atop"; x.strokeStyle = s.ink; x.lineWidth = lw * 2; x.lineCap = "round";
    x.beginPath(); x.moveTo(xOut, yOut); x.lineTo(xIn, yIn); x.stroke();
    x.globalCompositeOperation = "source-over";
  }
  if (m.tears) {
    x.fillStyle = "rgba(120,190,255,0.55)"; x.beginPath(); x.ellipse(W / 2, top + eh * 0.82, w * 0.36, eh * 0.14, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = "rgba(255,255,255,0.95)"; x.beginPath(); x.arc(W / 2 - w * 0.12, top + eh * 0.72, Math.max(2, w * 0.035), 0, Math.PI * 2); x.fill();
  }
  c.drawImage(scratch, (-W / 2) * scale, (-H / 2) * scale, W * scale, H * scale);
}

function drawBrowPart(c: C, s: Sprite, part: FacePart, inner: 1 | -1, isLeft: boolean, state: ResolvedFace["brow"], scale: number) {
  let m = BROW_MORPH[state];
  if (state === "smug" && !isLeft) m = BROW_MORPH.flat;
  c.translate(0, m.dy); c.rotate(m.rot * D * inner); c.scale(m.sx, m.sy);
  c.drawImage(s.img, (-part.w / 2) * scale, (-part.h / 2) * scale, part.w * scale, part.h * scale);
}

function drawMouthPart(c: C, s: Sprite, part: FacePart, state: ResolvedFace["mouth"], scale: number) {
  const m = MOUTH_MORPH[state];
  if (m.mode === "open" && m.open) {
    const k = (part.w * scale * m.sx) / 44;
    c.scale(k, k); drawMouth(c, "line", m.open); return;
  }
  const w = part.w, h = part.h, step = 3;
  for (let x = 0; x < w; x += step) {
    const sw = Math.min(step, w - x); const nx = ((x + sw / 2) / w) * 2 - 1;
    const off = mouthWarpOffset(m, nx) * w;
    c.drawImage(s.img, x, 0, sw, h, (-w / 2 + x) * m.sx * scale, (-h / 2 + off) * m.sy * scale, sw * m.sx * scale + 0.6, h * m.sy * scale);
  }
}

/** Draws a custom pack's parts (morphed to the resolved expression) onto the 512 face canvas. */
export function drawPackParts(c: C, pack: FacePack, f: ResolvedFace, k: FaceCalibration, mono: boolean) {
  const scale = 0.5 * k.partScale;
  for (const id of PART_IDS) {
    const part = pack.parts[id]; if (!part) continue;
    const s = sprite(part.src); if (!s.ready) continue;
    const a = anchor(id, k);
    c.save(); if (mono) c.filter = "grayscale(1) contrast(1.15)";
    c.translate(a.x + part.dx * scale, a.y + part.dy * scale);
    const inner: 1 | -1 = id.endsWith("R") ? 1 : -1;
    if (id === "eyeR" || id === "eyeL") drawEyePart(c, s, part, inner, f.eye, scale);
    else if (id === "browR" || id === "browL") drawBrowPart(c, s, part, inner, id === "browL", f.brow, scale);
    else if (id === "mouth") drawMouthPart(c, s, part, f.mouth, scale);
    else c.drawImage(s.img, (-part.w / 2) * scale, (-part.h / 2) * scale, part.w * scale, part.h * scale);
    c.restore();
  }
}

/* ---------- sample neutral face sheets (test art) ---------- */
export interface SampleFace { name: string; eye: "sharp" | "round" | "almond" | "shonen"; brow: "thin" | "soft" | "bold" | "arched"; iris: string; lines: string; lips: string; nose: "dash" | "hook" | "dot" }
export const SAMPLE_FACES: SampleFace[] = [
  { name: "Sample: Shonen Hero", eye: "shonen", brow: "bold", iris: "#2f6fb0", lines: "#121212", lips: "#b8545e", nose: "hook" },
  { name: "Sample: Heroine", eye: "round", brow: "soft", iris: "#7a3fb8", lines: "#2a1a1a", lips: "#d4626e", nose: "dot" },
  { name: "Sample: Cool Rival", eye: "almond", brow: "arched", iris: "#b02f3a", lines: "#151515", lips: "#9d5058", nose: "dash" },
];

/** Paints a neutral face onto a transparent 1024 sheet, laid out exactly like the downloadable template. */
export function makeSampleSheet(s: SampleFace): HTMLCanvasElement {
  const cv = document.createElement("canvas"); cv.width = cv.height = TEMPLATE_SIZE;
  const c = cv.getContext("2d")!;
  setFacePalette({ ...DEFAULT_FACE_COLORS, eyes: s.iris, brows: s.lines, lines: s.lines, mouth: s.lips }, false);
  const at = (id: PartId) => boxCentre(TEMPLATE_BOXES[id]);
  for (const [id, side] of [["eyeR", -1], ["eyeL", 1]] as const) {
    const p = at(id); c.save(); c.translate(p.x, p.y); c.scale(side * 2.4, 2.4); drawEye(c, s.eye, "open"); c.restore();
  }
  for (const [id, side] of [["browR", -1], ["browL", 1]] as const) {
    const p = at(id); c.save(); c.translate(p.x, p.y + 12); c.scale(side * 2.4, 2.4); drawBrow(c, s.brow, "neutral", side); c.restore();
  }
  const n = at("nose"); c.save(); c.translate(n.x, n.y); c.strokeStyle = s.lines; c.fillStyle = s.lines; c.lineCap = "round"; c.lineWidth = 5;
  if (s.nose === "hook") { c.beginPath(); c.moveTo(4, -26); c.quadraticCurveTo(14, 10, -8, 18); c.stroke(); }
  else if (s.nose === "dot") { c.beginPath(); c.ellipse(0, 6, 6, 4, 0, 0, Math.PI * 2); c.fill(); }
  else { c.beginPath(); c.moveTo(-10, 14); c.lineTo(8, 10); c.stroke(); }
  c.restore();
  const m = at("mouth"); c.save(); c.translate(m.x, m.y); c.scale(2.6, 2.6); drawMouth(c, s.eye === "round" ? "soft" : "line", "neutral"); c.restore();
  return cv;
}

/** Template guide sheet (same boxes the slicer uses) for download. */
export function drawTemplateGuide(c: C) {
  c.clearRect(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
  c.strokeStyle = "rgba(220,60,40,0.85)"; c.setLineDash([10, 8]); c.lineWidth = 3;
  c.beginPath(); c.ellipse(512, 560, 380, 460, 0, 0, Math.PI * 2); c.stroke();
  c.font = "bold 20px sans-serif"; c.fillStyle = "rgba(220,60,40,0.9)";
  for (const id of PART_IDS) { const b = TEMPLATE_BOXES[id]; c.strokeRect(b.x, b.y, b.w, b.h); c.fillText(id, b.x + 6, b.y + 22); }
  c.setLineDash([]);
}

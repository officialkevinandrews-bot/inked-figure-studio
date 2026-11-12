/**
 * Wardrobe catalog: hair, clothes and accessories as pure data.
 * Each item is a list of "pieces" anchored to canonical Mixamo bones in the character's
 * model frame (Y up, faces +Z, left = +X). `seg` pieces stretch between two bones so
 * sleeves and trouser legs follow every pose; `shape` pieces ride rigidly on one bone.
 * The 3D builder lives in src/components/studio/WardrobeRig.tsx.
 */

export type SlotId = "hair" | "headwear" | "eyewear" | "top" | "bottom" | "shoes" | "neck" | "back" | "waist" | "hands";
export type Channel = "p" | "s";
export type V3 = [number, number, number];

export type Piece =
  | { k: "seg"; from: string; to: string; r0: number; r1: number; t0?: number; t1?: number; depth?: number; ch?: Channel; m?: -1 }
  | {
      k: "shape"; bone: string; geo: "sphere" | "box" | "cyl" | "cone" | "torus";
      args: number[]; pos: V3; rot?: V3; scl?: V3; ch?: Channel; flat?: boolean; m?: -1;
    };

export interface WardrobeItem {
  id: string;
  name: string;
  slot: SlotId;
  pieces: Piece[];
  colors: { p: string; s: string };
  /** true when the item uses the secondary colour */
  accent?: boolean;
}

export type Palette = "hair" | "cloth" | "accessory";
export interface SlotDef {
  id: SlotId; label: string; icon: string; palette: Palette;
  /** where imported rigid items sit (model frame, relative to bone) */
  anchor: { bone: string; pos: V3 };
  /** longest side of an imported rigid item after auto-sizing (metres) */
  targetSize: number;
  /** imported rigid items are duplicated and mirrored onto the right side */
  pair?: boolean;
}

export const SLOTS: SlotDef[] = [
  { id: "hair", label: "Hair", icon: "💇", palette: "hair", anchor: { bone: "Head", pos: [0, 0.09, 0] }, targetSize: 0.3 },
  { id: "headwear", label: "Hats", icon: "🎩", palette: "accessory", anchor: { bone: "Head", pos: [0, 0.16, 0] }, targetSize: 0.3 },
  { id: "eyewear", label: "Eyes & Face", icon: "👓", palette: "accessory", anchor: { bone: "Head", pos: [0, 0.085, 0.14] }, targetSize: 0.17 },
  { id: "top", label: "Tops", icon: "👕", palette: "cloth", anchor: { bone: "Spine1", pos: [0, 0.08, 0.01] }, targetSize: 0.55 },
  { id: "bottom", label: "Bottoms", icon: "👖", palette: "cloth", anchor: { bone: "Hips", pos: [0, -0.3, 0] }, targetSize: 0.9 },
  { id: "shoes", label: "Shoes", icon: "👟", palette: "cloth", anchor: { bone: "LeftFoot", pos: [0, -0.045, 0.07] }, targetSize: 0.27, pair: true },
  { id: "neck", label: "Neck", icon: "🧣", palette: "accessory", anchor: { bone: "Neck", pos: [0, 0, 0.02] }, targetSize: 0.2 },
  { id: "back", label: "Back", icon: "🎒", palette: "accessory", anchor: { bone: "Spine2", pos: [0, -0.05, -0.18] }, targetSize: 0.45 },
  { id: "waist", label: "Waist", icon: "🥋", palette: "accessory", anchor: { bone: "Hips", pos: [0, 0.06, 0] }, targetSize: 0.38 },
  { id: "hands", label: "Hands", icon: "🧤", palette: "accessory", anchor: { bone: "LeftHand", pos: [0.05, 0, 0] }, targetSize: 0.12, pair: true },
];
export const slotDef = (id: SlotId) => SLOTS.find((s) => s.id === id)!;

export const SWATCHES: Record<Palette | "face", string[]> = {
  hair: ["#141414", "#3b2a1e", "#7a4a26", "#e8c25a", "#f4e6b0", "#c8c8d0", "#b3262e", "#e8833a", "#2f6fd6", "#38a86b", "#e88ab8", "#7b4fd0"],
  cloth: ["#1d2a4a", "#141414", "#f4f1ea", "#b3262e", "#6b4a2b", "#c9b48a", "#3d5a3a", "#8a8f99", "#2f6fd6", "#e8b400", "#e88ab8", "#5b3a7a"],
  accessory: ["#141414", "#f4f1ea", "#d4a72c", "#a8adb5", "#b3262e", "#6b4a2b", "#2f6fd6", "#38a86b", "#e88ab8", "#7b4fd0", "#e8833a", "#1d2a4a"],
  face: ["#141414", "#3b2a1e", "#7a4a26", "#2f6fd6", "#38a86b", "#b3262e", "#7b4fd0", "#e8b400", "#8a8f99", "#e88ab8", "#c9636b", "#f06e82"],
};

// ---------- helpers ----------
const PI = Math.PI;
type Side = "Left" | "Right";
/** Builds a left piece list and mirrors it onto the right (x → -x, y/z rotations flipped). */
function lr(fn: (s: Side) => Piece[]): Piece[] {
  const left = fn("Left");
  const right = fn("Right").map((p): Piece => {
    if (p.k === "seg") return { ...p, m: -1 };
    return { ...p, m: -1, pos: [-p.pos[0], p.pos[1], p.pos[2]], rot: p.rot ? [p.rot[0], -p.rot[1], -p.rot[2]] : undefined };
  });
  return [...left, ...right];
}
const seg = (from: string, to: string, r0: number, r1: number, o: Partial<Extract<Piece, { k: "seg" }>> = {}): Piece => ({ k: "seg", from, to, r0, r1, ...o });
const shape = (bone: string, geo: Extract<Piece, { k: "shape" }>["geo"], args: number[], pos: V3, o: Partial<Extract<Piece, { k: "shape" }>> = {}): Piece => ({ k: "shape", bone, geo, args, pos, ...o });

// Head shell measured on the demo figure (head centre ≈ 7.5cm above the Head bone).
const HC: V3 = [0, 0.08, 0.005];
const HS: V3 = [0.108, 0.13, 0.14];
const hairTop = (theta = 0.45): Piece => shape("Head", "sphere", [1, 0, 2 * PI, 0, theta * PI], HC, { scl: HS });
const hairBack = (theta = 0.72, wrap = 1): Piece => shape("Head", "sphere", [1, PI * (1.5 - wrap / 2), PI * wrap, 0, theta * PI], HC, { scl: HS });
/** cone pointing out of the skull at (yaw, pitch) degrees; pitch 0 = straight up, + = toward the face */
function spike(yaw: number, pitch: number, r = 0.034, h = 0.12): Piece {
  const y = (yaw * PI) / 180, p = (pitch * PI) / 180;
  const d: V3 = [Math.sin(y) * Math.sin(p), Math.cos(p), Math.cos(y) * Math.sin(p)];
  return shape("Head", "cone", [r, h, 8], [HC[0] + d[0] * HS[0] * 0.9, HC[1] + d[1] * HS[1] * 0.9, HC[2] + d[2] * HS[2] * 0.9], { rot: [pitch, yaw, 0], flat: true });
}

function torso(o: { sleeves: "none" | "short" | "3q" | "long"; inflate?: number }): Piece[] {
  const k = (o.inflate ?? 1) * 1.07;
  const out: Piece[] = [
    seg("Hips", "Spine", 0.175 * k, 0.145 * k, { depth: 0.82, t0: 0.15 }),
    seg("Spine", "Spine1", 0.135 * k, 0.135 * k, { depth: 0.9 }),
    seg("Spine1", "Spine2", 0.145 * k, 0.16 * k, { depth: 0.98 }),
    seg("Spine2", "Neck", 0.165 * k, 0.085 * k, { depth: 0.95, t1: 0.92 }),
  ];
  if (o.sleeves !== "none") {
    out.push(...lr((s) => {
      const p: Piece[] = [seg(`${s}Shoulder`, `${s}Arm`, 0.07 * k, 0.068 * k, { t0: 0.3 })];
      p.push(seg(`${s}Arm`, `${s}ForeArm`, 0.064 * k, 0.056 * k, { t1: o.sleeves === "short" ? 0.5 : 1.02 }));
      if (o.sleeves === "3q") p.push(seg(`${s}ForeArm`, `${s}Hand`, 0.062 * k, 0.055 * k, { t0: -0.05, t1: 0.55 }));
      if (o.sleeves === "long") p.push(seg(`${s}ForeArm`, `${s}Hand`, 0.06 * k, 0.05 * k, { t0: -0.05, t1: 0.92 }));
      return p;
    }));
  }
  return out;
}
function legs(o: { length: "shorts" | "full"; thigh?: number; shin?: number }): Piece[] {
  const t = o.thigh ?? 1, sh = o.shin ?? 1;
  return [
    seg("Hips", "Spine", 0.178, 0.15, { depth: 0.82, t1: 0.55 }),
    shape("Hips", "sphere", [1, 0, 2 * PI, 0.4 * PI, 0.6 * PI], [0, 0.02, 0.0], { scl: [0.215, 0.18, 0.16] }),
    ...lr((s) => {
      const p: Piece[] = [seg(`${s}UpLeg`, `${s}Leg`, 0.13 * t, 0.088 * t, { t1: o.length === "shorts" ? 0.5 : 1.02 })];
      if (o.length === "full") p.push(seg(`${s}Leg`, `${s}Foot`, 0.082 * sh, 0.06 * sh, { t0: -0.04, t1: 0.93 }));
      return p;
    }),
  ];
}
const shoe = (h = 0.09, sole = true, ch: Channel = "p"): Piece[] => lr((s) => [
  shape(`${s}Foot`, "box", [0.1, h, 0.25], [0, -0.087 + h / 2 + 0.012, 0.07], { ch }),
  ...(sole ? [shape(`${s}Foot`, "box", [0.106, 0.026, 0.265], [0, -0.075, 0.07], { ch: "s" as Channel })] : []),
]);

// ---------- catalog ----------
export const WARDROBE: WardrobeItem[] = [
  // Hair
  { id: "hair-spiky", name: "Shonen Spiky", slot: "hair", colors: { p: "#141414", s: "#141414" }, pieces: [
    hairTop(0.42), hairBack(0.7),
    ...[[0, -10], [40, -35], [-40, -35], [90, -55], [-90, -55], [150, -60], [-150, -60], [180, -40], [180, -85], [120, -90], [-120, -90], [60, -70], [-60, -70]].map(([y, p]) => spike(y!, p!)),
    ...[[0, 62], [25, 70], [-25, 70], [50, 75], [-50, 75]].map(([y, p]) => spike(y!, p!, 0.03, 0.09)),
  ] },
  { id: "hair-bob", name: "Bob Cut", slot: "hair", colors: { p: "#3b2a1e", s: "#3b2a1e" }, pieces: [
    hairTop(0.45), hairBack(0.62, 1.35),
    shape("Head", "sphere", [1, 0.2 * PI, 0.6 * PI, 0.27 * PI, 0.13 * PI], HC, { scl: [HS[0] * 1.04, HS[1] * 1.03, HS[2] * 1.04] }),
  ] },
  { id: "hair-long", name: "Long Straight", slot: "hair", colors: { p: "#141414", s: "#141414" }, pieces: [
    hairTop(0.46), hairBack(0.72, 1.2),
    shape("Head", "box", [0.21, 0.42, 0.05], [0, -0.13, -0.105], { rot: [8, 0, 0] }),
    ...lr(() => [shape("Head", "box", [0.035, 0.24, 0.045], [0.092, -0.04, 0.06])]),
    shape("Head", "sphere", [1, 0.2 * PI, 0.6 * PI, 0.28 * PI, 0.12 * PI], HC, { scl: [HS[0] * 1.04, HS[1] * 1.03, HS[2] * 1.04] }),
  ] },
  { id: "hair-ponytail", name: "Ponytail", slot: "hair", colors: { p: "#7a4a26", s: "#b3262e" }, accent: true, pieces: [
    hairTop(0.45), hairBack(0.6),
    shape("Head", "sphere", [0.032], [0, 0.12, -0.135], { ch: "s" }),
    shape("Head", "cone", [0.055, 0.3, 10], [0, -0.02, -0.19], { rot: [-165, 0, 0], flat: true }),
  ] },
  { id: "hair-twintails", name: "Twin Tails", slot: "hair", colors: { p: "#e88ab8", s: "#f4f1ea" }, accent: true, pieces: [
    hairTop(0.45), hairBack(0.6),
    ...lr(() => [
      shape("Head", "sphere", [0.028], [0.1, 0.13, -0.05], { ch: "s" }),
      shape("Head", "cone", [0.05, 0.34, 10], [0.14, -0.04, -0.07], { rot: [-175, 0, -12], flat: true }),
    ]),
  ] },
  { id: "hair-bun", name: "Top Bun", slot: "hair", colors: { p: "#141414", s: "#141414" }, pieces: [
    hairTop(0.46), hairBack(0.6), shape("Head", "sphere", [0.055], [0, 0.22, -0.03]),
  ] },

  // Headwear
  { id: "hat-cap", name: "Baseball Cap", slot: "headwear", colors: { p: "#b3262e", s: "#f4f1ea" }, accent: true, pieces: [
    shape("Head", "sphere", [1, 0, 2 * PI, 0, 0.5 * PI], [0, 0.1, 0.005], { scl: [0.118, 0.1, 0.15] }),
    shape("Head", "box", [0.17, 0.01, 0.11], [0, 0.105, 0.16], { rot: [-8, 0, 0], ch: "s" }),
  ] },
  { id: "hat-beret", name: "Beret", slot: "headwear", colors: { p: "#1d2a4a", s: "#1d2a4a" }, pieces: [
    shape("Head", "sphere", [1], [0, 0.175, -0.005], { scl: [0.135, 0.05, 0.15], rot: [0, 0, 12] }),
  ] },
  { id: "hat-headband", name: "Headband", slot: "headwear", colors: { p: "#f4f1ea", s: "#b3262e" }, accent: true, pieces: [
    shape("Head", "torus", [0.115, 0.012], [0, 0.115, 0.01], { rot: [90, 0, 0], scl: [1, 1.25, 1.6] }),
    shape("Head", "sphere", [0.02], [0, 0.12, 0.155], { ch: "s" }),
  ] },
  { id: "hat-wizard", name: "Wizard Hat", slot: "headwear", colors: { p: "#5b3a7a", s: "#d4a72c" }, accent: true, pieces: [
    shape("Head", "cyl", [0.24, 0.24, 0.012, 32], [0, 0.15, 0]),
    shape("Head", "cone", [0.14, 0.36, 24], [0, 0.33, -0.02], { rot: [-12, 0, 0] }),
    shape("Head", "cyl", [0.142, 0.142, 0.03, 32, 1], [0, 0.17, 0], { ch: "s" }),
  ] },
  { id: "hat-tophat", name: "Top Hat", slot: "headwear", colors: { p: "#141414", s: "#b3262e" }, accent: true, pieces: [
    shape("Head", "cyl", [0.2, 0.2, 0.012, 32], [0, 0.16, 0]),
    shape("Head", "cyl", [0.105, 0.11, 0.2, 32], [0, 0.26, 0]),
    shape("Head", "cyl", [0.112, 0.112, 0.03, 32, 1], [0, 0.185, 0], { ch: "s" }),
  ] },
  { id: "hat-catears", name: "Cat Ears", slot: "headwear", colors: { p: "#141414", s: "#e88ab8" }, accent: true, pieces: lr(() => [
    shape("Head", "cone", [0.045, 0.09, 4], [0.065, 0.2, -0.01], { rot: [0, 45, -22], flat: true }),
    shape("Head", "cone", [0.026, 0.06, 4], [0.066, 0.2, 0.004], { rot: [0, 45, -22], flat: true, ch: "s" }),
  ]) },

  // Eyewear / face
  { id: "eye-round", name: "Round Glasses", slot: "eyewear", colors: { p: "#141414", s: "#141414" }, pieces: [
    ...lr(() => [
      shape("Head", "torus", [0.03, 0.004], [0.042, 0.085, 0.142]),
      shape("Head", "box", [0.005, 0.005, 0.13], [0.092, 0.088, 0.075]),
    ]),
    shape("Head", "box", [0.026, 0.004, 0.004], [0, 0.088, 0.146]),
  ] },
  { id: "eye-shades", name: "Sunglasses", slot: "eyewear", colors: { p: "#141414", s: "#141414" }, pieces: [
    ...lr(() => [
      shape("Head", "box", [0.062, 0.032, 0.008], [0.042, 0.085, 0.142], { rot: [0, 10, 0] }),
      shape("Head", "box", [0.005, 0.006, 0.13], [0.093, 0.09, 0.075]),
    ]),
    shape("Head", "box", [0.03, 0.006, 0.006], [0, 0.093, 0.147]),
  ] },
  { id: "eye-patch", name: "Eye Patch", slot: "eyewear", colors: { p: "#141414", s: "#141414" }, pieces: [
    shape("Head", "sphere", [1, 0, 2 * PI, 0, 0.5 * PI], [-0.042, 0.085, 0.136], { scl: [0.032, 0.028, 0.012], rot: [90, 0, 0] }),
    shape("Head", "torus", [1, 0.06], [0, 0.1, 0.01], { rot: [90, 0, -12], scl: [0.112, 0.145, 0.1] }),
  ] },
  { id: "eye-mask", name: "Face Mask", slot: "eyewear", colors: { p: "#f4f1ea", s: "#f4f1ea" }, pieces: [
    shape("Head", "sphere", [1, 0.18 * PI, 0.64 * PI, 0.52 * PI, 0.3 * PI], HC, { scl: [HS[0] * 1.06, HS[1] * 1.02, HS[2] * 1.06] }),
  ] },

  // Tops
  { id: "top-tshirt", name: "T-Shirt", slot: "top", colors: { p: "#f4f1ea", s: "#f4f1ea" }, pieces: torso({ sleeves: "short" }) },
  { id: "top-sweater", name: "Long Sleeve", slot: "top", colors: { p: "#2f6fd6", s: "#2f6fd6" }, pieces: torso({ sleeves: "long" }) },
  { id: "top-blazer", name: "School Blazer", slot: "top", colors: { p: "#1d2a4a", s: "#b3262e" }, accent: true, pieces: [
    ...torso({ sleeves: "long", inflate: 1.06 }),
    shape("Spine2", "box", [0.035, 0.16, 0.012], [0, 0.03, 0.155], { ch: "s", rot: [-12, 0, 0] }),
    ...lr(() => [shape("Spine2", "box", [0.05, 0.12, 0.012], [0.05, 0.08, 0.145], { rot: [-15, 0, -25] })]),
  ] },
  { id: "top-gi", name: "Martial Arts Gi", slot: "top", colors: { p: "#f4f1ea", s: "#141414" }, accent: true, pieces: [
    ...torso({ sleeves: "3q", inflate: 1.08 }),
    ...lr(() => [shape("Spine2", "box", [0.04, 0.26, 0.012], [0.035, -0.02, 0.16], { rot: [-10, 0, -30], ch: "p" })]),
  ] },
  { id: "top-tank", name: "Tank Top", slot: "top", colors: { p: "#141414", s: "#141414" }, pieces: torso({ sleeves: "none" }) },
  { id: "top-coat", name: "Long Coat", slot: "top", colors: { p: "#6b4a2b", s: "#d4a72c" }, accent: true, pieces: [
    ...torso({ sleeves: "long", inflate: 1.1 }),
    shape("Hips", "cyl", [0.19, 0.27, 0.55, 18, 1], [0, -0.25, -0.005], { scl: [1, 1, 0.85] }),
    ...[0.12, 0.04, -0.04].map((y): Piece => shape("Spine1", "sphere", [0.012], [0, y, 0.152], { ch: "s" })),
  ] },

  // Bottoms
  { id: "bot-trousers", name: "Trousers", slot: "bottom", colors: { p: "#1d2a4a", s: "#1d2a4a" }, pieces: legs({ length: "full" }) },
  { id: "bot-shorts", name: "Shorts", slot: "bottom", colors: { p: "#c9b48a", s: "#c9b48a" }, pieces: legs({ length: "shorts" }) },
  { id: "bot-skirt", name: "Pleated Skirt", slot: "bottom", colors: { p: "#3d5a3a", s: "#3d5a3a" }, pieces: [
    seg("Hips", "Spine", 0.178, 0.15, { depth: 0.82, t1: 0.55 }),
    shape("Hips", "cyl", [0.18, 0.27, 0.26, 14, 1], [0, -0.1, 0], { scl: [1, 1, 0.88], flat: true }),
  ] },
  { id: "bot-baggy", name: "Baggy Pants", slot: "bottom", colors: { p: "#141414", s: "#141414" }, pieces: legs({ length: "full", thigh: 1.22, shin: 1.35 }) },
  { id: "bot-longskirt", name: "Long Skirt", slot: "bottom", colors: { p: "#5b3a7a", s: "#5b3a7a" }, pieces: [
    seg("Hips", "Spine", 0.178, 0.15, { depth: 0.82, t1: 0.55 }),
    shape("Hips", "cyl", [0.18, 0.33, 0.78, 20, 1], [0, -0.36, 0], { scl: [1, 1, 0.9] }),
  ] },

  // Shoes
  { id: "shoe-sneakers", name: "Sneakers", slot: "shoes", colors: { p: "#f4f1ea", s: "#b3262e" }, accent: true, pieces: shoe(0.09) },
  { id: "shoe-boots", name: "Combat Boots", slot: "shoes", colors: { p: "#141414", s: "#3b2a1e" }, accent: true, pieces: [
    ...shoe(0.1),
    ...lr((s) => [seg(`${s}Leg`, `${s}Foot`, 0.072, 0.066, { t0: 0.55, t1: 1 })]),
  ] },
  { id: "shoe-loafers", name: "Loafers", slot: "shoes", colors: { p: "#3b2a1e", s: "#141414" }, accent: true, pieces: shoe(0.06) },
  { id: "shoe-sandals", name: "Sandals", slot: "shoes", colors: { p: "#6b4a2b", s: "#c9b48a" }, accent: true, pieces: lr((s) => [
    shape(`${s}Foot`, "box", [0.1, 0.022, 0.26], [0, -0.078, 0.07], { ch: "s" }),
    shape(`${s}Foot`, "box", [0.105, 0.012, 0.03], [0, -0.05, 0.1]),
    shape(`${s}Foot`, "box", [0.105, 0.012, 0.03], [0, -0.04, 0.02]),
  ]) },

  // Neck
  { id: "neck-scarf", name: "Scarf", slot: "neck", colors: { p: "#b3262e", s: "#b3262e" }, pieces: [
    shape("Neck", "torus", [0.075, 0.03, 0], [0, -0.02, 0.0], { rot: [90, 0, 0], scl: [1, 1.1, 1] }),
    shape("Spine2", "box", [0.06, 0.24, 0.025], [0.05, 0.06, 0.15], { rot: [-10, 0, 8] }),
  ] },
  { id: "neck-tie", name: "Necktie", slot: "neck", colors: { p: "#b3262e", s: "#f4f1ea" }, accent: true, pieces: [
    shape("Neck", "torus", [0.07, 0.012], [0, -0.03, 0], { rot: [90, 0, 0], ch: "s" }),
    shape("Spine2", "box", [0.035, 0.2, 0.012], [0, 0.04, 0.155], { rot: [-12, 0, 0] }),
  ] },
  { id: "neck-necklace", name: "Pendant", slot: "neck", colors: { p: "#d4a72c", s: "#b3262e" }, accent: true, pieces: [
    shape("Neck", "torus", [0.085, 0.004], [0, -0.06, 0.02], { rot: [70, 0, 0], scl: [1, 1.2, 1] }),
    shape("Spine2", "sphere", [0.016], [0, 0.11, 0.14], { ch: "s" }),
  ] },

  // Back
  { id: "back-cape", name: "Hero Cape", slot: "back", colors: { p: "#b3262e", s: "#d4a72c" }, accent: true, pieces: [
    shape("Spine2", "cyl", [0.17, 0.32, 0.9, 20, 1, PI / 2, PI], [0, -0.32, -0.03], { scl: [1, 1, 0.8] }),
    ...lr(() => [shape("Spine2", "sphere", [0.02], [0.11, 0.13, 0.11], { ch: "s" })]),
  ] },
  { id: "back-backpack", name: "Backpack", slot: "back", colors: { p: "#2f6fd6", s: "#141414" }, accent: true, pieces: [
    shape("Spine1", "box", [0.26, 0.32, 0.12], [0, 0.08, -0.2]),
    ...lr(() => [shape("Spine2", "box", [0.03, 0.26, 0.29], [0.09, 0.02, 0.0], { ch: "s" })]),
  ] },
  { id: "back-sword", name: "Back Sword", slot: "back", colors: { p: "#141414", s: "#d4a72c" }, accent: true, pieces: [
    shape("Spine1", "box", [0.05, 0.85, 0.03], [0, 0.05, -0.16], { rot: [0, 0, 35] }),
    shape("Spine1", "box", [0.14, 0.025, 0.04], [-0.22, 0.38, -0.16], { rot: [0, 0, 35], ch: "s" }),
    shape("Spine1", "cyl", [0.016, 0.016, 0.18, 8], [-0.29, 0.48, -0.16], { rot: [0, 0, 35], ch: "s" }),
  ] },

  // Waist
  { id: "waist-belt", name: "Belt", slot: "waist", colors: { p: "#3b2a1e", s: "#d4a72c" }, accent: true, pieces: [
    shape("Hips", "torus", [0.175, 0.016], [0, 0.07, 0.003], { rot: [90, 0, 0], scl: [1, 0.85, 1.6] }),
    shape("Hips", "box", [0.05, 0.04, 0.015], [0, 0.07, 0.15], { ch: "s" }),
  ] },
  { id: "waist-obi", name: "Martial Belt", slot: "waist", colors: { p: "#141414", s: "#141414" }, pieces: [
    shape("Hips", "torus", [0.18, 0.022], [0, 0.07, 0.003], { rot: [90, 0, 0], scl: [1, 0.85, 1.4] }),
    ...lr(() => [shape("Hips", "box", [0.035, 0.16, 0.012], [0.035, -0.02, 0.155], { rot: [0, 0, 12] })]),
  ] },
  { id: "waist-pouch", name: "Utility Pouch", slot: "waist", colors: { p: "#6b4a2b", s: "#3b2a1e" }, accent: true, pieces: [
    shape("Hips", "torus", [0.175, 0.012], [0, 0.07, 0.003], { rot: [90, 0, 0], scl: [1, 0.85, 1], ch: "s" }),
    shape("Hips", "box", [0.09, 0.09, 0.05], [0.14, 0.03, 0.08], { rot: [0, 40, 0] }),
  ] },

  // Hands
  { id: "hand-gloves", name: "Gloves", slot: "hands", colors: { p: "#f4f1ea", s: "#f4f1ea" }, pieces: lr((s) => [
    seg(`${s}ForeArm`, `${s}Hand`, 0.046, 0.043, { t0: 0.8, t1: 1 }),
    shape(`${s}Hand`, "sphere", [1], [0.05, 0, 0], { scl: [0.06, 0.03, 0.05] }),
  ]) },
  { id: "hand-wrist", name: "Wristbands", slot: "hands", colors: { p: "#b3262e", s: "#b3262e" }, pieces: lr((s) => [
    seg(`${s}ForeArm`, `${s}Hand`, 0.05, 0.048, { t0: 0.72, t1: 0.9 }),
  ]) },
  { id: "hand-gauntlet", name: "Gauntlets", slot: "hands", colors: { p: "#a8adb5", s: "#d4a72c" }, accent: true, pieces: lr((s) => [
    seg(`${s}ForeArm`, `${s}Hand`, 0.055, 0.06, { t0: 0.35, t1: 1 }),
    shape(`${s}Hand`, "box", [0.1, 0.035, 0.07], [0.05, 0.01, 0], { ch: "s" }),
  ]) },
];
// Right-side seg pieces must reference Right bones (lr calls fn("Right") so names are already correct).

export const itemById = (id: string) => WARDROBE.find((i) => i.id === id);
export const itemsForSlot = (slot: SlotId) => WARDROBE.filter((i) => i.slot === slot);

// ---------- equipped state ----------
export interface SlotFit { x: number; y: number; z: number; rx: number; ry: number; rz: number; scale: number; inflate: number }
export const DEFAULT_FIT: SlotFit = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, inflate: 1 };
export interface SlotState { itemId: string; colors: { p: string; s: string }; fit: SlotFit }
export type Outfit = Partial<Record<SlotId, SlotState>>;

/** Custom imported items use ids of the form "custom:<uuid>" and are kept in memory only. */
export const isCustom = (id: string) => id.startsWith("custom:");

export function equip(o: Outfit, slot: SlotId, itemId: string, customColor = "#ffffff"): Outfit {
  const item = itemById(itemId);
  const prev = o[slot];
  const keepFit = prev && prev.itemId === itemId ? prev.fit : { ...DEFAULT_FIT };
  const colors = item ? { ...item.colors } : { p: customColor, s: customColor };
  return { ...o, [slot]: { itemId, colors, fit: keepFit } };
}
export function unequip(o: Outfit, slot: SlotId): Outfit {
  const n = { ...o }; delete n[slot]; return n;
}
export function setSlotColor(o: Outfit, slot: SlotId, ch: Channel, hex: string): Outfit {
  const s = o[slot]; if (!s) return o;
  return { ...o, [slot]: { ...s, colors: { ...s.colors, [ch]: hex } } };
}
export function setSlotFit(o: Outfit, slot: SlotId, patch: Partial<SlotFit>): Outfit {
  const s = o[slot]; if (!s) return o;
  return { ...o, [slot]: { ...s, fit: { ...s.fit, ...patch } } };
}

export interface OutfitPreset { name: string; items: Partial<Record<SlotId, string>>; colors?: Partial<Record<SlotId, { p?: string; s?: string }>> }
export const OUTFIT_PRESETS: OutfitPreset[] = [
  { name: "School Uniform", items: { hair: "hair-bob", top: "top-blazer", bottom: "bot-skirt", shoes: "shoe-loafers", neck: "neck-tie" } },
  { name: "Martial Artist", items: { hair: "hair-spiky", headwear: "hat-headband", top: "top-gi", bottom: "bot-baggy", waist: "waist-obi", hands: "hand-wrist" }, colors: { bottom: { p: "#f4f1ea" } } },
  { name: "Street Casual", items: { hair: "hair-ponytail", headwear: "hat-cap", top: "top-tshirt", bottom: "bot-trousers", shoes: "shoe-sneakers", back: "back-backpack" } },
  { name: "Adventurer", items: { hair: "hair-long", top: "top-coat", bottom: "bot-trousers", shoes: "shoe-boots", waist: "waist-pouch", back: "back-sword", hands: "hand-gloves" }, colors: { bottom: { p: "#3b2a1e" }, hands: { p: "#6b4a2b" } } },
  { name: "Hero", items: { hair: "hair-spiky", top: "top-sweater", bottom: "bot-trousers", shoes: "shoe-boots", back: "back-cape", waist: "waist-belt", hands: "hand-gloves" }, colors: { hair: { p: "#e8c25a" }, top: { p: "#2f6fd6" }, bottom: { p: "#2f6fd6" }, shoes: { p: "#b3262e" } } },
  { name: "Wizard", items: { hair: "hair-long", headwear: "hat-wizard", eyewear: "eye-round", top: "top-coat", bottom: "bot-longskirt", shoes: "shoe-boots", neck: "neck-necklace" }, colors: { hair: { p: "#c8c8d0" }, top: { p: "#5b3a7a" } } },
];
export function applyPreset(p: OutfitPreset): Outfit {
  let o: Outfit = {};
  for (const [slot, id] of Object.entries(p.items) as [SlotId, string][]) {
    o = equip(o, slot, id);
    const c = p.colors?.[slot];
    if (c?.p) o = setSlotColor(o, slot, "p", c.p);
    if (c?.s) o = setSlotColor(o, slot, "s", c.s);
  }
  return o;
}

const KEY = "koma-outfit:";
/** Only built-in items are saved; imported files live in memory for the session. */
export function serializeOutfit(o: Outfit): Outfit {
  const n: Outfit = {};
  for (const [k, v] of Object.entries(o) as [SlotId, SlotState][]) if (v && !isCustom(v.itemId) && itemById(v.itemId)) n[k] = v;
  return n;
}
export function loadOutfit(model: string): Outfit {
  try {
    const raw = localStorage.getItem(KEY + model);
    if (raw) {
      const p = JSON.parse(raw) as Outfit;
      const out: Outfit = {};
      for (const [k, v] of Object.entries(p) as [SlotId, SlotState][]) if (v && itemById(v.itemId)) out[k] = { ...v, fit: { ...DEFAULT_FIT, ...v.fit } };
      return out;
    }
  } catch { /* ignore */ }
  return {};
}
export function saveOutfit(model: string, o: Outfit) {
  try { localStorage.setItem(KEY + model, JSON.stringify(serializeOutfit(o))); } catch { /* ignore */ }
}

export const HEX_RE = /^#[0-9a-f]{6}$/i;

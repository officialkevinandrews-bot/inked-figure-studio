import {
  CHAR2D_H,
  CHAR2D_W,
  isBackFacingAngle2D,
  type Angle2D,
  type BodyAngleAnchors,
  type RenderMode2D,
  type ShadingDepth2D,
} from "./character2d-types";

export type AccessorySlot2D = "eyewear" | "headwear" | "faceMark" | "ears" | "neck" | "back";

export type AccessoryItemId2D =
  | "none"
  // Eyewear
  | "glasses_rect"
  | "glasses_round"
  | "sunglasses"
  | "eyepatch_l"
  | "visor"
  // Headwear
  | "headband"
  | "goggles_forehead"
  | "horns_oni"
  // Face marks & masks
  | "bandage_nose"
  | "bandage_cheek"
  | "scar_eye"
  | "mask_cloth"
  // Ears
  | "studs"
  | "hoops"
  | "tag_drop"
  // Neckwear
  | "necktie"
  | "scarf"
  | "choker"
  | "dogtags"
  | "headphones_neck"
  // Back / Silhouette props
  | "katana_back"
  | "cape_cloak";

export interface AccessorySlotSelection2D {
  id: AccessoryItemId2D;
  color: string;
  accentColor?: string;
  scale?: number; // 0.8..1.25
  offsetY?: number; // -16..16 logical px
}

export type CharacterAccessories2D = Partial<Record<AccessorySlot2D, AccessorySlotSelection2D>>;

export interface AccessoryCatalogItem2D {
  id: Exclude<AccessoryItemId2D, "none">;
  slot: AccessorySlot2D;
  name: string;
  subtitle: string;
  /** Hybrid architecture: built-in manga ink-vector items work immediately; future 2K sprite packs share the same slot! */
  renderKind: "ink-vector" | "illustrated-pack";
  primaryLabel: string;
  accentLabel?: string;
  defaultColor: string;
  defaultAccentColor?: string;
}

export interface AccessorySlotMeta2D {
  id: AccessorySlot2D;
  label: string;
  shortLabel: string;
  defaultZoom: "face" | "full";
}

export const ACCESSORY_SLOTS_2D: AccessorySlotMeta2D[] = [
  { id: "eyewear", label: "Eyewear", shortLabel: "Eyes", defaultZoom: "face" },
  { id: "headwear", label: "Headgear", shortLabel: "Head", defaultZoom: "face" },
  { id: "faceMark", label: "Face & Masks", shortLabel: "Face", defaultZoom: "face" },
  { id: "ears", label: "Earrings", shortLabel: "Ears", defaultZoom: "face" },
  { id: "neck", label: "Neckwear", shortLabel: "Neck", defaultZoom: "full" },
  { id: "back", label: "Back Props", shortLabel: "Back", defaultZoom: "full" },
];

export const ACCESSORY_CATALOG_2D: AccessoryCatalogItem2D[] = [
  // Eyewear
  {
    id: "glasses_rect",
    slot: "eyewear",
    name: "Rectangular Glasses",
    subtitle: "Sleek intellectual manga frames",
    renderKind: "ink-vector",
    primaryLabel: "Frame Color (RGB)",
    accentLabel: "Lens Tint (RGB)",
    defaultColor: "#18181b",
    defaultAccentColor: "#bae6fd",
  },
  {
    id: "glasses_round",
    slot: "eyewear",
    name: "Round Wire Glasses",
    subtitle: "Classic circular retro frames",
    renderKind: "ink-vector",
    primaryLabel: "Frame Color (RGB)",
    accentLabel: "Lens Tint (RGB)",
    defaultColor: "#334155",
    defaultAccentColor: "#e0f2fe",
  },
  {
    id: "sunglasses",
    slot: "eyewear",
    name: "Shonen Shades",
    subtitle: "Dark tinted frames with glare bars",
    renderKind: "ink-vector",
    primaryLabel: "Frame Color (RGB)",
    accentLabel: "Lens Color (RGB)",
    defaultColor: "#111827",
    defaultAccentColor: "#1e293b",
  },
  {
    id: "eyepatch_l",
    slot: "eyewear",
    name: "Tactical Eyepatch",
    subtitle: "Left-eye patch with full wrap strap",
    renderKind: "ink-vector",
    primaryLabel: "Patch Color (RGB)",
    accentLabel: "Strap Color (RGB)",
    defaultColor: "#18181b",
    defaultAccentColor: "#334155",
  },
  {
    id: "visor",
    slot: "eyewear",
    name: "Cyber Visor",
    subtitle: "Angular sci-fi manga eye visor",
    renderKind: "ink-vector",
    primaryLabel: "Visor Lens (RGB)",
    accentLabel: "Side Frame (RGB)",
    defaultColor: "#0ea5e9",
    defaultAccentColor: "#1e293b",
  },

  // Headwear
  {
    id: "headband",
    slot: "headwear",
    name: "Shonen Headband",
    subtitle: "Forehead cloth band + rear knot tails",
    renderKind: "ink-vector",
    primaryLabel: "Band Color (RGB)",
    accentLabel: "Plate / Trim (RGB)",
    defaultColor: "#1e293b",
    defaultAccentColor: "#cbd5e1",
  },
  {
    id: "goggles_forehead",
    slot: "headwear",
    name: "Forehead Goggles",
    subtitle: "Classic adventure shonen goggles",
    renderKind: "ink-vector",
    primaryLabel: "Rim & Strap (RGB)",
    accentLabel: "Lens Glass (RGB)",
    defaultColor: "#7c2d12",
    defaultAccentColor: "#38bdf8",
  },
  {
    id: "horns_oni",
    slot: "headwear",
    name: "Oni / Demon Horns",
    subtitle: "Curved fantasy manga temple horns",
    renderKind: "ink-vector",
    primaryLabel: "Horn Color (RGB)",
    accentLabel: "Base Ridge (RGB)",
    defaultColor: "#b91c1c",
    defaultAccentColor: "#450a0a",
  },

  // Face marks & masks
  {
    id: "bandage_nose",
    slot: "faceMark",
    name: "Nose Bridge Bandage",
    subtitle: "Classic shonen brawler plaster",
    renderKind: "ink-vector",
    primaryLabel: "Bandage Color (RGB)",
    defaultColor: "#f8fafc",
  },
  {
    id: "bandage_cheek",
    slot: "faceMark",
    name: "Cheek Plaster",
    subtitle: "Small angled battle tape",
    renderKind: "ink-vector",
    primaryLabel: "Bandage Color (RGB)",
    defaultColor: "#f8fafc",
  },
  {
    id: "scar_eye",
    slot: "faceMark",
    name: "Vertical Eye Scar",
    subtitle: "Dramatic manga slash across eye",
    renderKind: "ink-vector",
    primaryLabel: "Scar Tint (RGB)",
    defaultColor: "#b4534a",
  },
  {
    id: "mask_cloth",
    slot: "faceMark",
    name: "Street / Ninja Mask",
    subtitle: "Pleated mouth & nose mask",
    renderKind: "ink-vector",
    primaryLabel: "Mask Fabric (RGB)",
    accentLabel: "Trim / Seam (RGB)",
    defaultColor: "#18181b",
    defaultAccentColor: "#475569",
  },

  // Ears
  {
    id: "studs",
    slot: "ears",
    name: "Ear Studs",
    subtitle: "Minimalist metallic studs",
    renderKind: "ink-vector",
    primaryLabel: "Stud Color (RGB)",
    defaultColor: "#e2e8f0",
  },
  {
    id: "hoops",
    slot: "ears",
    name: "Hoop Earrings",
    subtitle: "Sleek ring earrings",
    renderKind: "ink-vector",
    primaryLabel: "Metal Color (RGB)",
    defaultColor: "#eab308",
  },
  {
    id: "tag_drop",
    slot: "ears",
    name: "Shonen Tag Earrings",
    subtitle: "Dangling rectangular charm tags",
    renderKind: "ink-vector",
    primaryLabel: "Tag Base (RGB)",
    accentLabel: "Motif Color (RGB)",
    defaultColor: "#f8fafc",
    defaultAccentColor: "#dc2626",
  },

  // Neckwear
  {
    id: "necktie",
    slot: "neck",
    name: "Tailored Necktie",
    subtitle: "Crisp knotted tie (pairs great with Suit)",
    renderKind: "ink-vector",
    primaryLabel: "Tie Color (RGB)",
    accentLabel: "Stripe / Clip (RGB)",
    defaultColor: "#991b1b",
    defaultAccentColor: "#f8fafc",
  },
  {
    id: "scarf",
    slot: "neck",
    name: "Long Shonen Scarf",
    subtitle: "Layered neck wrap + trailing tail",
    renderKind: "ink-vector",
    primaryLabel: "Scarf Color (RGB)",
    accentLabel: "Stripe Trim (RGB)",
    defaultColor: "#b91c1c",
    defaultAccentColor: "#f8fafc",
  },
  {
    id: "choker",
    slot: "neck",
    name: "Ring Choker",
    subtitle: "Fitted neck band with metal O-ring",
    renderKind: "ink-vector",
    primaryLabel: "Band Color (RGB)",
    accentLabel: "Ring Metal (RGB)",
    defaultColor: "#18181b",
    defaultAccentColor: "#e2e8f0",
  },
  {
    id: "dogtags",
    slot: "neck",
    name: "Chain & Dog Tags",
    subtitle: "Neck chain + twin stamped tags",
    renderKind: "ink-vector",
    primaryLabel: "Tag Metal (RGB)",
    accentLabel: "Chain Color (RGB)",
    defaultColor: "#cbd5e1",
    defaultAccentColor: "#64748b",
  },
  {
    id: "headphones_neck",
    slot: "neck",
    name: "Neck Headphones",
    subtitle: "Studio headphones resting on collar",
    renderKind: "ink-vector",
    primaryLabel: "Shell Color (RGB)",
    accentLabel: "Cushion / Trim (RGB)",
    defaultColor: "#1e293b",
    defaultAccentColor: "#dc2626",
  },

  // Back Props
  {
    id: "katana_back",
    slot: "back",
    name: "Back Katana",
    subtitle: "Diagonal sheathed blade + chest strap",
    renderKind: "ink-vector",
    primaryLabel: "Scabbard & Wrap (RGB)",
    accentLabel: "Guard & Fittings (RGB)",
    defaultColor: "#18181b",
    defaultAccentColor: "#eab308",
  },
  {
    id: "cape_cloak",
    slot: "back",
    name: "Hero Half-Cape",
    subtitle: "Clasped collar mantle + flowing drape",
    renderKind: "ink-vector",
    primaryLabel: "Outer Cloak (RGB)",
    accentLabel: "Inner Lining / Clasp (RGB)",
    defaultColor: "#1e293b",
    defaultAccentColor: "#b91c1c",
  },
];

export function getAccessoriesForSlot2D(slot: AccessorySlot2D): AccessoryCatalogItem2D[] {
  return ACCESSORY_CATALOG_2D.filter((item) => item.slot === slot);
}

export function getAccessoryItem2D(
  id: AccessoryItemId2D | undefined,
): AccessoryCatalogItem2D | null {
  if (!id || id === "none") return null;
  return ACCESSORY_CATALOG_2D.find((item) => item.id === id) ?? null;
}

export function countEquippedAccessories2D(
  accessories: CharacterAccessories2D | undefined,
): number {
  if (!accessories) return 0;
  let count = 0;
  for (const slot of ACCESSORY_SLOTS_2D) {
    const sel = accessories[slot.id];
    if (sel && sel.id !== "none") count++;
  }
  return count;
}

export function serializeAccessoriesSignature2D(
  accessories: CharacterAccessories2D | undefined,
): string {
  if (!accessories) return "";
  return ACCESSORY_SLOTS_2D.map((s) => {
    const sel = accessories[s.id];
    if (!sel || sel.id === "none") return "";
    return `${s.id}:${sel.id}:${sel.color}:${sel.accentColor ?? ""}:${sel.scale ?? 1}:${sel.offsetY ?? 0}`;
  })
    .filter(Boolean)
    .join(";");
}

export interface AccessoryHeadMetrics2D {
  topY: number;
  chinY: number;
  headH: number;
  eyeY: number;
  noseY: number;
  mouthY: number;
  skullL: number;
  skullR: number;
  skullCx: number;
  skullW: number;
  eyeSpan: [number, number];
  noseSpan: [number, number];
  mouthSpan: [number, number];
  collarNeckL: number;
  collarNeckR: number;
  headMaskCanvas?: HTMLCanvasElement;
}

export type AccessoryDrawPass2D =
  "behind_body" | "neck_over_clothes" | "face_under_hair" | "over_hair";

type C = CanvasRenderingContext2D;

const MANGA_INK = "#000000";
const COLOR_INK = "#161a24";

function parseRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0]! + clean[0]!, 16),
      parseInt(clean[1]! + clean[1]!, 16),
      parseInt(clean[2]! + clean[2]!, 16),
    ];
  }
  const n = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(n)) return [60, 70, 88];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shadeRgb(hex: string, amount: number): string {
  const [r, g, b] = parseRgb(hex);
  const mix = (v: number) =>
    amount >= 0 ? Math.round(v + (255 - v) * amount) : Math.round(v * (1 + amount));
  return `rgb(${Math.max(0, Math.min(255, mix(r)))},${Math.max(0, Math.min(255, mix(g)))},${Math.max(0, Math.min(255, mix(b)))})`;
}

function rgbaOf(hex: string, alpha: number): string {
  const [r, g, b] = parseRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function facingDir(angle: Angle2D): number {
  if (angle === 45 || angle === 90 || angle === 135) return 1;
  if (angle === 225 || angle === 270 || angle === 315) return -1;
  return 0;
}

function isProfile(angle: Angle2D): boolean {
  return angle === 90 || angle === 270;
}

function inkColor(mode: RenderMode2D): string {
  return mode === "manga" ? MANGA_INK : COLOR_INK;
}

/**
 * Manga-grade shape helper: crisp G-Pen outer outline, clean cel-shaded 2-tone fill in Color mode,
 * and opaque pure `#FFFFFF` (or solid `#000000` ink accent) interior in Manga Ink (Lines Only) mode.
 */
function paintMangaShape(
  ctx: C,
  trace: () => void,
  fillHex: string,
  mode: RenderMode2D,
  opts: {
    lineWidth?: number;
    shadow?: "bottom" | "right" | "left" | "none";
    highlight?: boolean;
    mangaSolidBlack?: boolean;
    fillAlpha?: number;
    noStroke?: boolean;
  } = {},
) {
  const lw = opts.lineWidth ?? 2.1;
  ctx.save();
  ctx.beginPath();
  trace();
  if (mode === "manga") {
    ctx.fillStyle = opts.mangaSolidBlack ? MANGA_INK : "#ffffff";
    if (opts.fillAlpha !== undefined) ctx.globalAlpha = opts.fillAlpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = opts.fillAlpha !== undefined ? rgbaOf(fillHex, opts.fillAlpha) : fillHex;
    ctx.fill();
    if (opts.shadow && opts.shadow !== "none" && (opts.fillAlpha ?? 1) >= 0.6) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = shadeRgb(fillHex, -0.26);
      const dx = opts.shadow === "right" ? 4 : opts.shadow === "left" ? -4 : 0;
      const dy = opts.shadow === "bottom" ? 4 : 2;
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = 0.42;
      ctx.translate(dx, dy);
      ctx.beginPath();
      trace();
      ctx.fill();
      ctx.restore();
    }
    if (opts.highlight && (opts.fillAlpha ?? 1) >= 0.6) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = shadeRgb(fillHex, 0.42);
      ctx.lineWidth = 1.6;
      ctx.translate(-1, -1.5);
      ctx.beginPath();
      trace();
      ctx.stroke();
      ctx.restore();
    }
  }
  if (!opts.noStroke) {
    ctx.strokeStyle = inkColor(mode);
    ctx.lineWidth = mode === "manga" ? Math.max(1.7, lw * 1.05) : lw;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    trace();
    ctx.stroke();
  }
  ctx.restore();
}

function getEyeCoords(
  a: BodyAngleAnchors,
  sil: AccessoryHeadMetrics2D | null,
  angle: Angle2D,
  faceOffsetY = 0,
) {
  const eyeY = (sil ? sil.eyeY : a.eyeY) + faceOffsetY;
  const noseY = (sil ? sil.noseY : a.noseY) + faceOffsetY;
  const mouthY = (sil ? sil.mouthY : a.mouthY) + faceOffsetY;
  const eyeL = sil ? sil.eyeSpan[0] : a.headCx - a.headRx;
  const eyeR = sil ? sil.eyeSpan[1] : a.headCx + a.headRx;
  const eyeW = Math.max(40, eyeR - eyeL);
  const noseL = sil ? sil.noseSpan[0] : eyeL + 4;
  const noseR = sil ? sil.noseSpan[1] : eyeR - 4;
  const noseW = Math.max(32, noseR - noseL);
  const mouthL = sil ? sil.mouthSpan[0] : eyeL + 10;
  const mouthR = sil ? sil.mouthSpan[1] : eyeR - 10;
  const mouthW = Math.max(26, mouthR - mouthL);
  const skullL = sil ? sil.skullL : a.headCx - a.headRx;
  const skullR = sil ? sil.skullR : a.headCx + a.headRx;
  const skullCx = sil ? sil.skullCx : a.headCx;
  const skullW = sil ? sil.skullW : a.headRx * 2;
  const topY = sil ? sil.topY : a.headCy - a.headRy;
  const chinY = sil ? sil.chinY : a.chinY;

  let leftEyeX = skullCx - eyeW * 0.215;
  let rightEyeX: number | null = skullCx + eyeW * 0.215;
  let noseX = (noseL + noseR) / 2;
  let mouthX = (mouthL + mouthR) / 2;
  let earL: { x: number; y: number } | null = { x: skullL + 3, y: eyeY + 11 };
  let earR: { x: number; y: number } | null = { x: skullR - 3, y: eyeY + 11 };

  if (angle === 45) {
    leftEyeX = eyeR - eyeW * 0.39;
    rightEyeX = eyeR - eyeW * 0.135;
    noseX = noseR - noseW * 0.17;
    mouthX = mouthR - mouthW * 0.2;
    earL = { x: skullL + 6, y: eyeY + 13 };
    earR = null;
  } else if (angle === 315) {
    leftEyeX = eyeL + eyeW * 0.135;
    rightEyeX = eyeL + eyeW * 0.39;
    noseX = noseL + noseW * 0.17;
    mouthX = mouthL + mouthW * 0.2;
    earL = null;
    earR = { x: skullR - 6, y: eyeY + 13 };
  } else if (angle === 90) {
    leftEyeX = eyeR - Math.max(17, eyeW * 0.205);
    rightEyeX = null;
    noseX = eyeR + 1;
    mouthX = mouthR - Math.max(10, mouthW * 0.13);
    earL = { x: skullCx - 11, y: eyeY + 12 };
    earR = null;
  } else if (angle === 270) {
    leftEyeX = eyeL + Math.max(17, eyeW * 0.205);
    rightEyeX = null;
    noseX = eyeL - 1;
    mouthX = mouthL + Math.max(10, mouthW * 0.13);
    earL = null;
    earR = { x: skullCx + 11, y: eyeY + 12 };
  } else if (angle === 135) {
    earL = null;
    earR = { x: skullR - 14, y: eyeY + 12 };
  } else if (angle === 225) {
    earL = { x: skullL + 14, y: eyeY + 12 };
    earR = null;
  } else if (angle === 180) {
    earL = { x: skullL + 3, y: eyeY + 12 };
    earR = { x: skullR - 3, y: eyeY + 12 };
  }

  return {
    eyeY,
    noseY,
    mouthY,
    eyeL,
    eyeR,
    eyeW,
    skullL,
    skullR,
    skullCx,
    skullW,
    topY,
    chinY,
    leftEyeX,
    rightEyeX,
    noseX,
    mouthX,
    earL,
    earR,
  };
}

function drawBackProps(
  ctx: C,
  sel: AccessorySlotSelection2D,
  a: BodyAngleAnchors,
  sil: AccessoryHeadMetrics2D | null,
  angle: Angle2D,
  mode: RenderMode2D,
  pass: "behind_body" | "neck_over_clothes",
) {
  const col = sel.color;
  const acc = sel.accentColor ?? "#eab308";
  const sc = Math.max(0.8, Math.min(1.25, sel.scale ?? 1));
  const dy = sel.offsetY ?? 0;
  const back = isBackFacingAngle2D(angle);
  const prof = isProfile(angle);
  const dir = facingDir(angle);
  const neckL = sil ? sil.collarNeckL : a.neckL;
  const neckR = sil ? sil.collarNeckR : a.neckR;
  const neckCx = (neckL + neckR) / 2;
  const shoulderY = a.shoulderY;

  if (sel.id === "katana_back") {
    // Back-view draws katana on top of back; front/3-4/side draws katana behind body + diagonal strap in front!
    const drawSwordOnThisPass =
      (pass === "behind_body" && !back) || (pass === "neck_over_clothes" && back);
    if (drawSwordOnThisPass) {
      ctx.save();
      const pivotX = neckCx;
      const pivotY = a.chestY + 18 + dy;
      ctx.translate(pivotX, pivotY);
      ctx.scale(sc, sc);
      // Tilt mirrors naturally across facing directions
      const tilt = prof ? (dir > 0 ? -0.46 : 0.46) : dir < 0 ? -0.58 : 0.58;
      ctx.rotate(tilt);

      // Sheathed lacquered scabbard (Saya)
      paintMangaShape(
        ctx,
        () => {
          ctx.moveTo(-7, -142);
          ctx.lineTo(7, -142);
          ctx.lineTo(5.5, 255);
          ctx.quadraticCurveTo(0, 266, -5.5, 255);
          ctx.closePath();
        },
        col,
        mode,
        { lineWidth: 2.2, shadow: "right" },
      );

      // Kojiri end-cap & Kurigata metallic band
      paintMangaShape(
        ctx,
        () => {
          ctx.rect(-6.5, 232, 13, 22);
        },
        acc,
        mode,
        { lineWidth: 1.7 },
      );
      paintMangaShape(
        ctx,
        () => {
          ctx.rect(-7.5, -146, 15, 11);
        },
        acc,
        mode,
        { lineWidth: 1.7 },
      );

      // Tsuba (handguard)
      paintMangaShape(
        ctx,
        () => {
          ctx.roundRect(-21, -155, 42, 9, 3);
        },
        acc,
        mode,
        { lineWidth: 2.0, shadow: "bottom" },
      );

      // Tsuka (wrapped hilt) with classic manga diamond ito wrap
      paintMangaShape(
        ctx,
        () => {
          ctx.roundRect(-7.5, -242, 15, 88, 3);
        },
        col,
        mode,
        { lineWidth: 2.1, shadow: "right" },
      );
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : shadeRgb(acc, 0.35);
      ctx.lineWidth = 1.4;
      for (let ty = -232; ty <= -166; ty += 12) {
        ctx.beginPath();
        ctx.moveTo(-6, ty);
        ctx.lineTo(0, ty + 6);
        ctx.lineTo(6, ty);
        ctx.lineTo(0, ty - 5);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();

      // Kashira pommel cap
      paintMangaShape(
        ctx,
        () => {
          ctx.roundRect(-8, -248, 16, 8, 2);
        },
        acc,
        mode,
        { lineWidth: 1.8 },
      );
      ctx.restore();
    }

    // Diagonal leather chest strap across torso on front & 3/4 views
    if (pass === "neck_over_clothes" && !back) {
      const shNearX =
        angle === 45
          ? a.torsoR - 8
          : angle === 315
            ? a.torsoL + 8
            : dir < 0
              ? a.shoulderL + 14
              : a.shoulderR - 14;
      const hipFarX = dir < 0 ? a.waistR - 4 : a.waistL + 4;
      if (!prof) {
        paintMangaShape(
          ctx,
          () => {
            ctx.moveTo(shNearX - 8, shoulderY - 12 + dy);
            ctx.lineTo(shNearX + 8, shoulderY - 8 + dy);
            ctx.lineTo(hipFarX + 8, a.waistY + 26 + dy);
            ctx.lineTo(hipFarX - 8, a.waistY + 20 + dy);
            ctx.closePath();
          },
          col,
          mode,
          { lineWidth: 1.9, shadow: "bottom" },
        );
        // Metallic strap buckle on chest
        const bx = (shNearX + hipFarX) * 0.5;
        const by = (shoulderY + a.waistY) * 0.5 + dy;
        paintMangaShape(
          ctx,
          () => {
            ctx.roundRect(bx - 8, by - 6, 16, 12, 2);
          },
          acc,
          mode,
          { lineWidth: 1.6 },
        );
      }
    }
    return;
  }

  if (sel.id === "cape_cloak") {
    const capeTopY = shoulderY - 22 + dy;
    const capeHemY = Math.min(CHAR2D_H - 90, a.hipY + 205 * sc + dy);
    const shL = Math.min(a.shoulderL - 12, neckL - 36);
    const shR = Math.max(a.shoulderR + 12, neckR + 36);

    if (pass === "behind_body" && !back) {
      // Flowing cloak lining behind character silhouette
      const hemL = prof ? (dir > 0 ? a.hipL - 78 * sc : a.hipL - 16) : shL - 38 * sc;
      const hemR = prof ? (dir > 0 ? a.hipR + 16 : a.hipR + 78 * sc) : shR + 38 * sc;
      paintMangaShape(
        ctx,
        () => {
          ctx.moveTo(shL + 8, capeTopY);
          ctx.lineTo(shR - 8, capeTopY);
          ctx.quadraticCurveTo(hemR + 8, (capeTopY + capeHemY) * 0.55, hemR, capeHemY);
          ctx.quadraticCurveTo((hemL + hemR) / 2, capeHemY - 18, hemL, capeHemY);
          ctx.quadraticCurveTo(hemL - 8, (capeTopY + capeHemY) * 0.55, shL + 8, capeTopY);
          ctx.closePath();
        },
        acc,
        mode,
        { lineWidth: 2.3, shadow: "bottom" },
      );
      // Manga vertical cloth fold ink lines
      ctx.save();
      ctx.strokeStyle = inkColor(mode);
      ctx.lineWidth = 1.5;
      for (const f of [0.25, 0.5, 0.75]) {
        const tx = shL + (shR - shL) * f;
        const bx = hemL + (hemR - hemL) * f;
        ctx.beginPath();
        ctx.moveTo(tx, capeTopY + 40);
        ctx.quadraticCurveTo((tx + bx) / 2, (capeTopY + capeHemY) / 2, bx, capeHemY - 14);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (pass === "neck_over_clothes") {
      if (back) {
        // Full outer cape draping across back & shoulders
        const hemL = shL - 34 * sc;
        const hemR = shR + 34 * sc;
        paintMangaShape(
          ctx,
          () => {
            ctx.moveTo(neckL - 10, capeTopY - 4);
            ctx.quadraticCurveTo(neckCx, capeTopY + 8, neckR + 10, capeTopY - 4);
            ctx.quadraticCurveTo(shR + 14, capeTopY + 14, hemR, capeHemY);
            ctx.quadraticCurveTo(neckCx, capeHemY + 12, hemL, capeHemY);
            ctx.quadraticCurveTo(shL - 14, capeTopY + 14, neckL - 10, capeTopY - 4);
            ctx.closePath();
          },
          col,
          mode,
          { lineWidth: 2.4, shadow: "bottom", highlight: true },
        );
        ctx.save();
        ctx.strokeStyle = inkColor(mode);
        ctx.lineWidth = 1.6;
        for (const f of [0.22, 0.42, 0.62, 0.8]) {
          const tx = shL + (shR - shL) * f;
          const bx = hemL + (hemR - hemL) * f;
          ctx.beginPath();
          ctx.moveTo(tx, capeTopY + 26);
          ctx.quadraticCurveTo(
            (tx + bx) / 2 + (f - 0.5) * 14,
            (capeTopY + capeHemY) * 0.55,
            bx,
            capeHemY - 10,
          );
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // Mantle collar band & twin metallic clasps resting smoothly on shoulders/collar
        const colY = a.neckY + 2 + dy;
        paintMangaShape(
          ctx,
          () => {
            ctx.moveTo(neckL - 12, colY - 6);
            ctx.quadraticCurveTo(neckCx, colY + 16, neckR + 12, colY - 6);
            ctx.lineTo(neckR + 16, colY + 10);
            ctx.quadraticCurveTo(neckCx, colY + 28, neckL - 16, colY + 10);
            ctx.closePath();
          },
          col,
          mode,
          { lineWidth: 2.0, shadow: "bottom" },
        );
        // Twin clasps + short chain
        if (!prof) {
          for (const cx of [neckL - 3, neckR + 3]) {
            paintMangaShape(
              ctx,
              () => {
                ctx.arc(cx, colY + 6, 5.2, 0, Math.PI * 2);
              },
              acc,
              mode,
              { lineWidth: 1.7 },
            );
          }
          ctx.save();
          ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(neckL + 2, colY + 7);
          ctx.quadraticCurveTo(neckCx, colY + 20, neckR - 2, colY + 7);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }
}

function drawNeckwear(
  ctx: C,
  sel: AccessorySlotSelection2D,
  a: BodyAngleAnchors,
  sil: AccessoryHeadMetrics2D | null,
  angle: Angle2D,
  mode: RenderMode2D,
  pass: "behind_body" | "neck_over_clothes",
) {
  const col = sel.color;
  const acc = sel.accentColor ?? "#f8fafc";
  const sc = Math.max(0.8, Math.min(1.25, sel.scale ?? 1));
  const dy = sel.offsetY ?? 0;
  const back = isBackFacingAngle2D(angle);
  const prof = isProfile(angle);
  const dir = facingDir(angle);
  const neckL = sil ? sil.collarNeckL : a.neckL;
  const neckR = sil ? sil.collarNeckR : a.neckR;
  const neckCx = (neckL + neckR) / 2;
  const neckW = Math.max(36, neckR - neckL);
  const colY = a.neckY + dy;

  if (sel.id === "necktie") {
    if (pass !== "neck_over_clothes" || back) return;
    // On pure side profile (90°/270°), show only the neat collar knot peeking at the front neckline (never cutting across side jacket)
    if (prof) {
      const kx = dir > 0 ? neckR + 1 : neckL - 1;
      const ky = colY + 8;
      paintMangaShape(
        ctx,
        () => {
          ctx.moveTo(kx - dir * 3, ky - 3);
          ctx.lineTo(kx + dir * 6, ky + 1);
          ctx.lineTo(kx + dir * 5, ky + 16);
          ctx.lineTo(kx - dir * 2, ky + 13);
          ctx.closePath();
        },
        col,
        mode,
        { lineWidth: 1.8, shadow: "bottom" },
      );
      return;
    }
    const tieCx = angle === 45 ? neckCx + 10 : angle === 315 ? neckCx - 10 : neckCx;
    const xScale = dir !== 0 ? 0.82 : 1;
    const knotY = colY + 8;
    const len = 148 * sc;

    ctx.save();
    ctx.translate(tieCx, knotY);
    ctx.scale(xScale * sc, sc);

    // Lower tie blade
    paintMangaShape(
      ctx,
      () => {
        ctx.moveTo(-6, 12);
        ctx.lineTo(6, 12);
        ctx.lineTo(14.5, len - 24);
        ctx.lineTo(0, len);
        ctx.lineTo(-14.5, len - 24);
        ctx.closePath();
      },
      col,
      mode,
      { lineWidth: 2.0, shadow: "right", highlight: true },
    );

    // Diagonal manga tie stripe + subtle tie bar
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-6, 12);
    ctx.lineTo(6, 12);
    ctx.lineTo(14.5, len - 24);
    ctx.lineTo(0, len);
    ctx.lineTo(-14.5, len - 24);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
    ctx.lineWidth = 2.6;
    for (let sy = 36; sy < len - 18; sy += 26) {
      ctx.beginPath();
      ctx.moveTo(-16, sy + 10);
      ctx.lineTo(16, sy - 8);
      ctx.stroke();
    }
    ctx.restore();

    // Metallic tie clip
    paintMangaShape(
      ctx,
      () => {
        ctx.roundRect(-10, len * 0.46, 19, 4.5, 1.5);
      },
      acc,
      mode,
      { lineWidth: 1.4 },
    );

    // Crisp Windsor knot
    paintMangaShape(
      ctx,
      () => {
        ctx.moveTo(-11, -3);
        ctx.lineTo(11, -3);
        ctx.lineTo(7, 15);
        ctx.lineTo(-7, 15);
        ctx.closePath();
      },
      col,
      mode,
      { lineWidth: 2.0, shadow: "bottom" },
    );
    // Dimple crease line under knot
    ctx.strokeStyle = inkColor(mode);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.lineTo(0, 32);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (sel.id === "scarf") {
    const padX = Math.max(14, neckW * 0.34) * sc;
    const wrapL = neckL - padX;
    const wrapR = neckR + padX;
    const wrapTop = colY - 22 * sc;
    const wrapBot = colY + 20 * sc;

    // Dramatic trailing scarf tail behind shoulder on front views, or draped down back on rear views
    if (pass === "behind_body" && !back) {
      const tailSide = dir >= 0 ? -1 : 1;
      const sx = tailSide < 0 ? wrapL + 10 : wrapR - 10;
      paintMangaShape(
        ctx,
        () => {
          ctx.moveTo(sx, wrapBot - 8);
          ctx.quadraticCurveTo(sx + tailSide * 38, colY + 75, sx + tailSide * 64, colY + 150 * sc);
          ctx.lineTo(sx + tailSide * 34, colY + 162 * sc);
          ctx.quadraticCurveTo(sx + tailSide * 18, colY + 86, sx - tailSide * 10, wrapBot);
          ctx.closePath();
        },
        col,
        mode,
        { lineWidth: 2.2, shadow: "bottom" },
      );
      // Fringe + accent stripe
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx + tailSide * 58, colY + 132 * sc);
      ctx.lineTo(sx + tailSide * 32, colY + 142 * sc);
      ctx.stroke();
      ctx.restore();
    }

    if (pass === "neck_over_clothes") {
      // Rear long draping tail on back views (135°, 180°, 225°)
      if (back) {
        const tx = angle === 135 ? neckCx - 12 : angle === 225 ? neckCx + 12 : neckCx + 6;
        paintMangaShape(
          ctx,
          () => {
            ctx.moveTo(tx - 16, wrapBot - 6);
            ctx.lineTo(tx + 18, wrapBot - 6);
            ctx.quadraticCurveTo(tx + 26, colY + 92, tx + 20, colY + 172 * sc);
            ctx.lineTo(tx - 18, colY + 166 * sc);
            ctx.quadraticCurveTo(tx - 12, colY + 90, tx - 16, wrapBot - 6);
            ctx.closePath();
          },
          col,
          mode,
          { lineWidth: 2.2, shadow: "right" },
        );
        // Stripe + fringe
        ctx.save();
        ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tx - 16, colY + 148 * sc);
        ctx.lineTo(tx + 19, colY + 152 * sc);
        ctx.stroke();
        ctx.restore();
      } else {
        // Front hanging scarf loop end over chest
        const fx = dir > 0 ? neckCx + 12 : dir < 0 ? neckCx - 12 : neckCx - 18;
        paintMangaShape(
          ctx,
          () => {
            ctx.moveTo(fx - 13, wrapBot - 4);
            ctx.lineTo(fx + 14, wrapBot - 4);
            ctx.quadraticCurveTo(fx + 18, colY + 66, fx + 12, colY + 114 * sc);
            ctx.lineTo(fx - 16, colY + 108 * sc);
            ctx.quadraticCurveTo(fx - 12, colY + 60, fx - 13, wrapBot - 4);
            ctx.closePath();
          },
          col,
          mode,
          { lineWidth: 2.1, shadow: "right" },
        );
        ctx.save();
        ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(fx - 14, colY + 94 * sc);
        ctx.lineTo(fx + 11, colY + 98 * sc);
        ctx.stroke();
        ctx.restore();
      }

      // Main chunky coiled scarf collar hugging exact neck width
      paintMangaShape(
        ctx,
        () => {
          ctx.moveTo(wrapL, wrapTop + 8);
          ctx.quadraticCurveTo(neckCx, wrapTop - 6, wrapR, wrapTop + 8);
          ctx.quadraticCurveTo(wrapR + 8, (wrapTop + wrapBot) / 2, wrapR - 2, wrapBot);
          ctx.quadraticCurveTo(neckCx, wrapBot + 14, wrapL + 2, wrapBot);
          ctx.quadraticCurveTo(wrapL - 8, (wrapTop + wrapBot) / 2, wrapL, wrapTop + 8);
          ctx.closePath();
        },
        col,
        mode,
        { lineWidth: 2.3, shadow: "bottom", highlight: true },
      );

      // Layered manga fold lines across coil
      ctx.save();
      ctx.strokeStyle = inkColor(mode);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(wrapL + 6, colY - 3);
      ctx.quadraticCurveTo(neckCx, colY + 10, wrapR - 6, colY - 5);
      ctx.moveTo(wrapL + 10, colY + 9);
      ctx.quadraticCurveTo(neckCx + 4, colY + 18, wrapR - 12, colY + 6);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  if (pass !== "neck_over_clothes") return;

  if (sel.id === "choker") {
    const chY = colY - 22 + dy;
    const bandH = 8.5 * sc;
    paintMangaShape(
      ctx,
      () => {
        ctx.moveTo(neckL - 1, chY);
        ctx.quadraticCurveTo(neckCx, chY + (back ? 4 : 6), neckR + 1, chY);
        ctx.lineTo(neckR + 1, chY + bandH);
        ctx.quadraticCurveTo(neckCx, chY + bandH + (back ? 4 : 6), neckL - 1, chY + bandH);
        ctx.closePath();
      },
      col,
      mode,
      { lineWidth: 1.8, shadow: "bottom" },
    );
    if (!back) {
      const rx =
        angle === 45
          ? neckCx + 10
          : angle === 315
            ? neckCx - 10
            : angle === 90
              ? neckR - 1
              : angle === 270
                ? neckL + 1
                : neckCx;
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(rx, chY + bandH + 5, prof ? 3 : 6.5 * sc, 6.5 * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = inkColor(mode);
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  if (sel.id === "dogtags") {
    if (back) {
      // Fine chain curving across nape
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
      ctx.lineWidth = 2.0;
      ctx.setLineDash([2.5, 2.5]);
      ctx.beginPath();
      ctx.moveTo(neckL, colY - 12);
      ctx.quadraticCurveTo(neckCx, colY - 4, neckR, colY - 12);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const tagCx =
      angle === 45
        ? neckCx + 10
        : angle === 315
          ? neckCx - 10
          : angle === 90
            ? neckR + 2
            : angle === 270
              ? neckL - 2
              : neckCx;
    const tagY = colY + 34 * sc;
    ctx.save();
    ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
    ctx.lineWidth = 1.9;
    ctx.setLineDash([2.5, 2.2]);
    ctx.beginPath();
    ctx.moveTo(neckL + 1, colY - 12);
    ctx.quadraticCurveTo(tagCx - 6, tagY - 12, tagCx, tagY);
    ctx.quadraticCurveTo(tagCx + 6, tagY - 12, neckR - 1, colY - 12);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Twin layered stamped metal tags
    const wScale = prof ? 0.45 : 1;
    for (const [ox, oy, rot] of [
      [-3 * wScale, 2, -0.14],
      [2 * wScale, 0, 0.12],
    ] as const) {
      ctx.save();
      ctx.translate(tagCx + ox, tagY + oy);
      ctx.rotate(rot);
      ctx.scale(wScale * sc, sc);
      paintMangaShape(
        ctx,
        () => {
          ctx.roundRect(-6.5, 0, 13, 22, 4);
        },
        col,
        mode,
        { lineWidth: 1.6, highlight: true },
      );
      ctx.strokeStyle = inkColor(mode);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3.5, 8);
      ctx.lineTo(3.5, 8);
      ctx.moveTo(-3.5, 13);
      ctx.lineTo(2.5, 13);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  if (sel.id === "headphones_neck") {
    const hpY = colY + 2;
    const cupW = 18 * sc;
    const cupH = 26 * sc;

    // Band curving around neck
    paintMangaShape(
      ctx,
      () => {
        ctx.moveTo(neckL - 18 * sc, hpY - 6);
        ctx.quadraticCurveTo(neckCx, hpY + (back ? -14 : 16), neckR + 18 * sc, hpY - 6);
        ctx.lineTo(neckR + 14 * sc, hpY + 4);
        ctx.quadraticCurveTo(neckCx, hpY + (back ? -4 : 26), neckL - 14 * sc, hpY + 4);
        ctx.closePath();
      },
      col,
      mode,
      { lineWidth: 2.0, shadow: "bottom" },
    );

    const drawCup = (cx: number, cy: number, tilt: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      // Ear cushion
      paintMangaShape(
        ctx,
        () => {
          ctx.ellipse(0, 0, cupW * 0.72, cupH * 0.62, 0, 0, Math.PI * 2);
        },
        acc,
        mode,
        { lineWidth: 1.8 },
      );
      // Outer shell
      paintMangaShape(
        ctx,
        () => {
          ctx.ellipse(tilt > 0 ? -4 : 4, 0, cupW * 0.56, cupH * 0.52, 0, 0, Math.PI * 2);
        },
        col,
        mode,
        { lineWidth: 2.0, highlight: true },
      );
      ctx.restore();
    };

    if (prof) {
      drawCup(neckCx + dir * 16 * sc, hpY + 8, dir * 0.3);
    } else if (back) {
      drawCup(neckL - 16 * sc, hpY + 2, -0.35);
      drawCup(neckR + 16 * sc, hpY + 2, 0.35);
    } else {
      drawCup(neckL - 13 * sc, hpY + 12, -0.38);
      drawCup(neckR + 13 * sc, hpY + 12, 0.38);
    }
  }
}

function drawFaceMarks(
  ctx: C,
  sel: AccessorySlotSelection2D,
  a: BodyAngleAnchors,
  sil: AccessoryHeadMetrics2D | null,
  angle: Angle2D,
  mode: RenderMode2D,
  faceOffsetY: number,
) {
  if (isBackFacingAngle2D(angle)) return;
  const g = getEyeCoords(a, sil, angle, faceOffsetY);
  const col = sel.color;
  const acc = sel.accentColor ?? "#475569";
  const sc = Math.max(0.8, Math.min(1.25, sel.scale ?? 1));
  const dy = sel.offsetY ?? 0;
  const prof = isProfile(angle);
  const dir = facingDir(angle);

  if (sel.id === "bandage_nose") {
    const bx = g.noseX;
    const by = g.eyeY + 9 + dy;
    const bw = (prof ? 14 : dir !== 0 ? 22 : 28) * sc;
    const bh = 8.5 * sc;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(dir * 0.08);
    paintMangaShape(
      ctx,
      () => {
        ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 3);
      },
      col,
      mode,
      { lineWidth: 1.6, shadow: "bottom" },
    );
    // Gauze pad center + ventilation dots
    ctx.strokeStyle = inkColor(mode);
    ctx.lineWidth = 1.0;
    ctx.strokeRect(-bw * 0.22, -bh * 0.34, bw * 0.44, bh * 0.68);
    ctx.fillStyle = inkColor(mode);
    for (const dx of [-bw * 0.36, bw * 0.36]) {
      ctx.beginPath();
      ctx.arc(dx, -1.5, 0.85, 0, Math.PI * 2);
      ctx.arc(dx, 1.8, 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (sel.id === "bandage_cheek") {
    if (angle === 270) return; // left-cheek plaster hidden on opposite pure profile
    const cx =
      angle === 0
        ? g.leftEyeX - 4
        : angle === 45
          ? g.leftEyeX - 3
          : angle === 315
            ? g.rightEyeX! + 3
            : g.leftEyeX - 8;
    const cy = g.noseY + 6 + dy;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.22);
    const bw = (prof ? 13 : 16) * sc;
    const bh = 7.5 * sc;
    paintMangaShape(
      ctx,
      () => {
        ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 2.5);
      },
      col,
      mode,
      { lineWidth: 1.5, shadow: "bottom" },
    );
    ctx.strokeStyle = inkColor(mode);
    ctx.lineWidth = 0.9;
    ctx.strokeRect(-bw * 0.22, -bh * 0.32, bw * 0.44, bh * 0.64);
    ctx.restore();
    return;
  }

  if (sel.id === "scar_eye") {
    if (angle === 270) return; // left-eye scar hidden on opposite pure profile
    const sx = angle === 315 ? (g.rightEyeX ?? g.leftEyeX) : g.leftEyeX;
    const top = g.eyeY - 22 * sc + dy;
    const bot = g.noseY + 14 * sc + dy;
    ctx.save();
    ctx.strokeStyle = mode === "manga" ? MANGA_INK : col;
    ctx.lineCap = "round";
    ctx.lineWidth = 2.2 * sc;
    ctx.beginPath();
    ctx.moveTo(sx - 3, top);
    ctx.quadraticCurveTo(sx + 1, g.eyeY, sx + 4, bot);
    ctx.stroke();

    // Subtle crisp manga cross-hatch scar ridges
    ctx.strokeStyle = mode === "manga" ? MANGA_INK : shadeRgb(col, -0.3);
    ctx.lineWidth = 1.2 * sc;
    for (const t of [0.18, 0.34, 0.72, 0.86]) {
      const py = top + (bot - top) * t;
      const px = sx - 3 + 7 * t;
      ctx.beginPath();
      ctx.moveTo(px - 3.5, py - 1);
      ctx.lineTo(px + 3.5, py + 1.2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (sel.id === "mask_cloth") {
    const topY = g.eyeY + 12 + dy;
    const botY = g.chinY + dy;
    const mL = angle === 90 ? g.leftEyeX - 2 : angle === 315 ? g.eyeL + 3 : g.eyeL + 2;
    const mR = angle === 270 ? g.leftEyeX + 2 : angle === 45 ? g.eyeR - 3 : g.eyeR - 2;
    const midX = prof ? (dir > 0 ? g.eyeR + 2 : g.eyeL - 2) : g.noseX;

    // Ear straps first
    ctx.save();
    ctx.strokeStyle = inkColor(mode);
    ctx.lineWidth = 1.8;
    if (g.earL) {
      ctx.beginPath();
      ctx.moveTo(mL + 4, topY + 6);
      ctx.lineTo(g.earL.x, g.earL.y - 4);
      ctx.moveTo(mL + 6, botY - 12);
      ctx.lineTo(g.earL.x, g.earL.y + 6);
      ctx.stroke();
    }
    if (g.earR) {
      ctx.beginPath();
      ctx.moveTo(mR - 4, topY + 6);
      ctx.lineTo(g.earR.x, g.earR.y - 4);
      ctx.moveTo(mR - 6, botY - 12);
      ctx.lineTo(g.earR.x, g.earR.y + 6);
      ctx.stroke();
    }
    ctx.restore();

    paintMangaShape(
      ctx,
      () => {
        ctx.moveTo(mL, topY + 5);
        ctx.quadraticCurveTo(midX, topY - 4, mR, topY + 5);
        ctx.quadraticCurveTo(
          mR + (prof && dir > 0 ? 3 : -2),
          (topY + botY) * 0.56,
          midX + (mR - midX) * 0.42,
          botY - 3,
        );
        ctx.quadraticCurveTo(midX, botY + 3, midX - (midX - mL) * 0.42, botY - 3);
        ctx.quadraticCurveTo(mL + (prof && dir < 0 ? -3 : 2), (topY + botY) * 0.56, mL, topY + 5);
        ctx.closePath();
      },
      col,
      mode,
      { lineWidth: 2.1, shadow: "bottom" },
    );

    // Center vertical manga seam + subtle cheek pleat lines
    ctx.save();
    ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(midX, topY - 1);
    ctx.lineTo(midX, botY + 1);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEarrings(
  ctx: C,
  sel: AccessorySlotSelection2D,
  a: BodyAngleAnchors,
  sil: AccessoryHeadMetrics2D | null,
  angle: Angle2D,
  mode: RenderMode2D,
  faceOffsetY: number,
) {
  const g = getEyeCoords(a, sil, angle, faceOffsetY);
  const col = sel.color;
  const acc = sel.accentColor ?? "#dc2626";
  const sc = Math.max(0.8, Math.min(1.25, sel.scale ?? 1));
  const dy = sel.offsetY ?? 0;

  const ears: Array<{ x: number; y: number }> = [];
  if (g.earL) ears.push({ x: g.earL.x, y: g.earL.y + 8 + dy });
  if (g.earR) ears.push({ x: g.earR.x, y: g.earR.y + 8 + dy });
  if (!ears.length) return;

  for (const e of ears) {
    if (sel.id === "studs") {
      paintMangaShape(
        ctx,
        () => {
          ctx.arc(e.x, e.y, 2.8 * sc, 0, Math.PI * 2);
        },
        col,
        mode,
        { lineWidth: 1.4, highlight: true },
      );
    } else if (sel.id === "hoops") {
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : col;
      ctx.lineWidth = 2.4 * sc;
      ctx.beginPath();
      ctx.arc(e.x, e.y + 5.5 * sc, 5.5 * sc, -Math.PI * 0.35, Math.PI * 1.35);
      ctx.stroke();
      ctx.strokeStyle = inkColor(mode);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.restore();
    } else if (sel.id === "tag_drop") {
      // Classic shonen manga hanging rectangular tag earring
      ctx.save();
      ctx.strokeStyle = inkColor(mode);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x, e.y + 5 * sc);
      ctx.stroke();
      const tw = 6.5 * sc;
      const th = 15.5 * sc;
      paintMangaShape(
        ctx,
        () => {
          ctx.roundRect(e.x - tw / 2, e.y + 5 * sc, tw, th, 1.5);
        },
        col,
        mode,
        { lineWidth: 1.5 },
      );
      // Rising-sun / diamond accent motif inside tag
      paintMangaShape(
        ctx,
        () => {
          ctx.arc(e.x, e.y + 5 * sc + th * 0.44, 2.2 * sc, 0, Math.PI * 2);
        },
        acc,
        mode,
        { lineWidth: 0.9, mangaSolidBlack: true },
      );
      ctx.restore();
    }
  }
}

function drawEyewear(
  ctx: C,
  sel: AccessorySlotSelection2D,
  a: BodyAngleAnchors,
  sil: AccessoryHeadMetrics2D | null,
  angle: Angle2D,
  mode: RenderMode2D,
  faceOffsetY: number,
) {
  const g = getEyeCoords(a, sil, angle, faceOffsetY);
  const col = sel.color;
  const acc = sel.accentColor ?? "#bae6fd";
  const sc = Math.max(0.8, Math.min(1.25, sel.scale ?? 1));
  const dy = sel.offsetY ?? 0;
  const back = isBackFacingAngle2D(angle);
  const prof = isProfile(angle);
  const dir = facingDir(angle);
  const ey = g.eyeY + dy;

  // Eyepatch strap wraps around the rear skull too on 135°/180°/225°!
  if (sel.id === "eyepatch_l") {
    if (back) {
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
      ctx.lineWidth = 4.2 * sc;
      ctx.beginPath();
      ctx.moveTo(g.skullL + 2, ey + 6);
      ctx.quadraticCurveTo(g.skullCx, ey + 14, g.skullR - 2, ey - 10);
      ctx.stroke();
      ctx.strokeStyle = inkColor(mode);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
      return;
    }
    // Strap across temple & upper forehead
    ctx.save();
    ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
    ctx.lineWidth = 3.8 * sc;
    ctx.lineCap = "round";
    if (angle === 0) {
      ctx.beginPath();
      ctx.moveTo(g.skullL + 2, ey - 2);
      ctx.lineTo(g.leftEyeX, ey);
      ctx.lineTo(g.skullR - 8, g.topY + 34);
      ctx.stroke();
    } else if (angle === 45 || angle === 90) {
      ctx.beginPath();
      ctx.moveTo(g.skullL + 6, ey + 4);
      ctx.lineTo(g.leftEyeX, ey);
      ctx.lineTo(g.eyeR - 4, g.topY + 36);
      ctx.stroke();
    } else {
      // 315°/270°: strap visible sweeping across brow toward temple
      ctx.beginPath();
      ctx.moveTo(g.skullL + 4, g.topY + 38);
      ctx.lineTo(g.skullR - 6, ey + 4);
      ctx.stroke();
    }
    ctx.restore();

    if (angle === 270) return; // left eye hidden on right-facing-left profile
    const px = angle === 315 ? (g.rightEyeX ?? g.leftEyeX) : g.leftEyeX;
    const pw = (prof ? 13 : 19) * sc;
    const ph = 14.5 * sc;
    paintMangaShape(
      ctx,
      () => {
        ctx.moveTo(px - pw * 0.56, ey - ph * 0.45);
        ctx.quadraticCurveTo(px, ey - ph * 0.62, px + pw * 0.56, ey - ph * 0.42);
        ctx.quadraticCurveTo(px + pw * 0.48, ey + ph * 0.62, px, ey + ph * 0.66);
        ctx.quadraticCurveTo(px - pw * 0.52, ey + ph * 0.58, px - pw * 0.56, ey - ph * 0.45);
        ctx.closePath();
      },
      col,
      mode,
      { lineWidth: 2.0, shadow: "bottom", mangaSolidBlack: true },
    );
    return;
  }

  if (back) return;

  if (sel.id === "visor") {
    const vTop = ey - 10 * sc;
    const vBot = ey + 9 * sc;
    const vL = angle === 90 ? g.leftEyeX - 8 : g.eyeL - 2;
    const vR = angle === 270 ? g.leftEyeX + 8 : g.eyeR + 2;

    // Temple band to visible ear
    ctx.save();
    ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
    ctx.lineWidth = 4.2 * sc;
    if (g.earL) {
      ctx.beginPath();
      ctx.moveTo(vL + 2, ey);
      ctx.lineTo(g.earL.x, g.earL.y - 6);
      ctx.stroke();
    }
    if (g.earR) {
      ctx.beginPath();
      ctx.moveTo(vR - 2, ey);
      ctx.lineTo(g.earR.x, g.earR.y - 6);
      ctx.stroke();
    }
    ctx.restore();

    paintMangaShape(
      ctx,
      () => {
        ctx.moveTo(vL, vTop + 2);
        ctx.lineTo(vR, vTop + 2);
        ctx.lineTo(vR - (prof && dir > 0 ? -3 : 3), vBot);
        ctx.quadraticCurveTo(g.noseX, vBot - 5, vL + (prof && dir < 0 ? -3 : 3), vBot);
        ctx.closePath();
      },
      col,
      mode,
      { lineWidth: 2.2, fillAlpha: mode === "manga" ? 1 : 0.78 },
    );
    // Crisp white manga glare diagonal bar across visor
    ctx.save();
    ctx.strokeStyle = mode === "manga" ? MANGA_INK : "#ffffff";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(vL + (vR - vL) * 0.2, vBot - 3);
    ctx.lineTo(vL + (vR - vL) * 0.34, vTop + 4);
    ctx.moveTo(vL + (vR - vL) * 0.42, vBot - 3);
    ctx.lineTo(vL + (vR - vL) * 0.5, vTop + 4);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Glasses (Rectangular, Round, Sunglasses)
  const isRound = sel.id === "glasses_round";
  const isShades = sel.id === "sunglasses";
  const lwL = (prof ? 10 : angle === 315 ? 15.5 : 19.5) * sc;
  const lwR = (angle === 45 ? 15.5 : 19.5) * sc;
  const lh = (isRound ? 16.5 : isShades ? 13.5 : 12.5) * sc;

  const drawLens = (cx: number, w: number) => {
    const traceLens = () => {
      if (isRound) {
        ctx.ellipse(cx, ey + 0.5, w * 0.54, lh * 0.54, 0, 0, Math.PI * 2);
      } else {
        ctx.roundRect(cx - w / 2, ey - lh / 2, w, lh, isShades ? 3.5 : 2.5);
      }
    };
    ctx.save();
    // Lens glass fill
    ctx.beginPath();
    traceLens();
    if (mode === "manga") {
      if (isShades) {
        ctx.fillStyle = MANGA_INK;
        ctx.fill();
      }
    } else {
      ctx.fillStyle = isShades ? rgbaOf(acc, 0.88) : rgbaOf(acc, 0.22);
      ctx.fill();
    }
    // Anime diagonal specular glare slash inside lens
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = isShades
      ? "#ffffff"
      : mode === "manga"
        ? MANGA_INK
        : "rgba(255,255,255,0.82)";
    ctx.lineWidth = isShades ? 2.6 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.28, ey + lh * 0.44);
    ctx.lineTo(cx + w * 0.06, ey - lh * 0.44);
    if (isShades) {
      ctx.moveTo(cx + w * 0.04, ey + lh * 0.44);
      ctx.lineTo(cx + w * 0.24, ey - lh * 0.44);
    }
    ctx.stroke();
    ctx.restore();

    // Crisp outer rim
    ctx.strokeStyle = mode === "manga" ? MANGA_INK : col;
    ctx.lineWidth = isRound ? 1.85 : isShades ? 2.4 : 2.1;
    ctx.beginPath();
    traceLens();
    ctx.stroke();
    ctx.restore();
  };

  // Temple arms wrapping smoothly back to the visible ear
  ctx.save();
  ctx.strokeStyle = mode === "manga" ? MANGA_INK : col;
  ctx.lineWidth = isShades ? 2.6 : 2.0;
  ctx.lineCap = "round";
  if (g.earL) {
    ctx.beginPath();
    ctx.moveTo(g.leftEyeX - lwL / 2, ey - 1);
    ctx.lineTo(g.earL.x + 1, g.earL.y - 9);
    ctx.stroke();
  }
  if (g.earR) {
    const rightAnchor = g.rightEyeX !== null ? g.rightEyeX + lwR / 2 : g.leftEyeX + lwL / 2;
    ctx.beginPath();
    ctx.moveTo(rightAnchor, ey - 1);
    ctx.lineTo(g.earR.x - 1, g.earR.y - 9);
    ctx.stroke();
  }
  ctx.restore();

  drawLens(g.leftEyeX, lwL);
  if (g.rightEyeX !== null) {
    drawLens(g.rightEyeX, lwR);
    // Nose bridge bar connecting both lenses
    ctx.save();
    ctx.strokeStyle = mode === "manga" ? MANGA_INK : col;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(g.leftEyeX + lwL / 2, ey - 1.5);
    ctx.quadraticCurveTo((g.leftEyeX + g.rightEyeX) / 2, ey - 4, g.rightEyeX - lwR / 2, ey - 1.5);
    ctx.stroke();
    ctx.restore();
  }
}

function drawHeadwear(
  ctx: C,
  sel: AccessorySlotSelection2D,
  a: BodyAngleAnchors,
  sil: AccessoryHeadMetrics2D | null,
  angle: Angle2D,
  mode: RenderMode2D,
  pass: "behind_body" | "over_hair",
  faceOffsetY: number,
) {
  const g = getEyeCoords(a, sil, angle, faceOffsetY);
  const col = sel.color;
  const acc = sel.accentColor ?? "#cbd5e1";
  const sc = Math.max(0.8, Math.min(1.25, sel.scale ?? 1));
  const dy = sel.offsetY ?? 0;
  const back = isBackFacingAngle2D(angle);
  const prof = isProfile(angle);
  const dir = facingDir(angle);

  if (sel.id === "headband") {
    const bandY = g.eyeY - 26 + dy;
    const bandH = 14 * sc;
    const padX = 5;
    const bL = g.skullL - padX;
    const bR = g.skullR + padX;

    // Trailing knot cloth ribbons on behind_body (for side/3-4) or over_hair (for rear 135/180/225)
    if ((pass === "behind_body" && !back && angle !== 0) || (pass === "over_hair" && back)) {
      const knotX =
        angle === 180 ? g.skullCx : angle === 135 || angle === 45 || angle === 90 ? bL + 4 : bR - 4;
      const tailDir = angle === 180 ? 0 : angle === 135 || angle === 45 || angle === 90 ? -1 : 1;
      for (const side of [-1, 1]) {
        paintMangaShape(
          ctx,
          () => {
            const tx = knotX + tailDir * 32 * sc + side * 12;
            const ty = bandY + 52 * sc + (side > 0 ? 10 : 0);
            ctx.moveTo(knotX, bandY + bandH * 0.5);
            ctx.quadraticCurveTo(knotX + tailDir * 18 + side * 6, bandY + 26, tx + 7, ty);
            ctx.lineTo(tx - 6, ty - 4);
            ctx.quadraticCurveTo(
              knotX + tailDir * 10 + side * 2,
              bandY + 24,
              knotX,
              bandY + bandH * 0.3,
            );
            ctx.closePath();
          },
          col,
          mode,
          { lineWidth: 1.9, shadow: "bottom" },
        );
      }
      if (back) {
        // Knot center
        paintMangaShape(
          ctx,
          () => {
            ctx.ellipse(knotX, bandY + bandH * 0.5, 8 * sc, 6.5 * sc, 0, 0, Math.PI * 2);
          },
          col,
          mode,
          { lineWidth: 1.9 },
        );
      }
    }

    if (pass !== "over_hair") return;
    // Main forehead cloth band wrapping around skull
    paintMangaShape(
      ctx,
      () => {
        ctx.moveTo(bL, bandY + 3);
        ctx.quadraticCurveTo(g.skullCx, bandY - 5, bR, bandY + 3);
        ctx.lineTo(bR, bandY + bandH + 2);
        ctx.quadraticCurveTo(g.skullCx, bandY + bandH - 4, bL, bandY + bandH + 2);
        ctx.closePath();
      },
      col,
      mode,
      { lineWidth: 2.1, shadow: "bottom", highlight: true },
    );

    // Shonen metal forehead plate on front/3-4/side
    if (!back) {
      const px = prof ? (dir > 0 ? bR - 9 : bL + 9) : g.noseX;
      const pw = (prof ? 16 : dir !== 0 ? 34 : 44) * sc;
      const ph = bandH * 0.88;
      paintMangaShape(
        ctx,
        () => {
          ctx.roundRect(px - pw / 2, bandY + 0.5, pw, ph, 2.5);
        },
        acc,
        mode,
        { lineWidth: 1.8, highlight: true },
      );
      // Corner rivets
      ctx.fillStyle = inkColor(mode);
      for (const rx of [-pw * 0.38, pw * 0.38]) {
        ctx.beginPath();
        ctx.arc(px + rx, bandY + ph * 0.5, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  if (pass !== "over_hair") return;

  if (sel.id === "goggles_forehead") {
    const gy = g.topY + 26 + dy;
    const bL = g.skullL - 5;
    const bR = g.skullR + 5;
    // Strap wrapping around skull
    paintMangaShape(
      ctx,
      () => {
        ctx.moveTo(bL, gy - 4);
        ctx.quadraticCurveTo(g.skullCx, gy - 11, bR, gy - 4);
        ctx.lineTo(bR, gy + 6);
        ctx.quadraticCurveTo(g.skullCx, gy - 1, bL, gy + 6);
        ctx.closePath();
      },
      col,
      mode,
      { lineWidth: 2.0, shadow: "bottom" },
    );
    if (back) return;

    const drawGoggleLens = (cx: number, rx: number) => {
      paintMangaShape(
        ctx,
        () => {
          ctx.ellipse(cx, gy, rx + 3.5, 12.5 * sc, 0, 0, Math.PI * 2);
        },
        col,
        mode,
        { lineWidth: 2.0, shadow: "bottom" },
      );
      paintMangaShape(
        ctx,
        () => {
          ctx.ellipse(cx, gy, rx, 9 * sc, 0, 0, Math.PI * 2);
        },
        acc,
        mode,
        { lineWidth: 1.6, highlight: true },
      );
      // Manga glass glare slash
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : "#ffffff";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.4, gy + 4);
      ctx.lineTo(cx + rx * 0.2, gy - 4);
      ctx.stroke();
      ctx.restore();
    };

    if (prof) {
      drawGoggleLens(dir > 0 ? bR - 8 : bL + 8, 9 * sc);
    } else if (g.rightEyeX !== null) {
      drawGoggleLens(g.leftEyeX, (angle === 315 ? 10.5 : 13.5) * sc);
      drawGoggleLens(g.rightEyeX, (angle === 45 ? 10.5 : 13.5) * sc);
    }
    return;
  }

  if (sel.id === "horns_oni") {
    const hy = g.topY + 12 + dy;
    const drawHorn = (bx: number, side: -1 | 1, scaleW = 1) => {
      const tipX = bx + side * 28 * sc * scaleW;
      const tipY = hy - 46 * sc;
      paintMangaShape(
        ctx,
        () => {
          ctx.moveTo(bx - 9.5 * sc * scaleW, hy + 5);
          ctx.quadraticCurveTo(bx + side * 19 * sc * scaleW, hy - 14 * sc, tipX, tipY);
          ctx.quadraticCurveTo(
            bx + side * 5 * sc * scaleW,
            hy - 22 * sc,
            bx + 9.5 * sc * scaleW,
            hy + 2,
          );
          ctx.quadraticCurveTo(bx, hy + 9, bx - 9.5 * sc * scaleW, hy + 5);
          ctx.closePath();
        },
        col,
        mode,
        { lineWidth: 2.2, shadow: side > 0 ? "right" : "left", highlight: true },
      );
      // Base ridge lines
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : acc;
      ctx.lineWidth = 1.5;
      for (const f of [0.22, 0.42]) {
        const ry = hy - 32 * sc * f;
        const rx = bx + side * 16 * sc * scaleW * f;
        ctx.beginPath();
        ctx.moveTo(rx - 5 * (1 - f), ry + 2);
        ctx.lineTo(rx + 5 * (1 - f), ry - 1);
        ctx.stroke();
      }
      ctx.restore();
    };

    if (prof) {
      drawHorn(g.skullCx + dir * 16, dir > 0 ? 1 : -1, 0.9);
    } else {
      const offL = angle === 45 || angle === 135 ? 20 : 25;
      const offR = angle === 315 || angle === 225 ? 20 : 25;
      drawHorn(g.skullCx - offL, -1, angle === 45 ? 0.95 : 1);
      drawHorn(g.skullCx + offR, 1, angle === 315 ? 0.95 : 1);
    }
  }
}

/**
 * Renders all equipped accessories for a given Z-layer pass cleanly anchored to live head/neck/body geometry.
 */
export function drawCharacterAccessories2D(
  ctx: C,
  accessories: CharacterAccessories2D | undefined,
  a: BodyAngleAnchors,
  sil: AccessoryHeadMetrics2D | null,
  angle: Angle2D,
  mode: RenderMode2D,
  _shadingDepth: ShadingDepth2D,
  pass: AccessoryDrawPass2D,
  faceOffsetY = 0,
) {
  if (!accessories) return;

  if (pass === "behind_body") {
    const backSel = accessories.back;
    if (backSel && backSel.id !== "none") {
      drawBackProps(ctx, backSel, a, sil, angle, mode, "behind_body");
    }
    const neckSel = accessories.neck;
    if (neckSel && neckSel.id !== "none") {
      drawNeckwear(ctx, neckSel, a, sil, angle, mode, "behind_body");
    }
    const headSel = accessories.headwear;
    if (headSel && headSel.id !== "none") {
      drawHeadwear(ctx, headSel, a, sil, angle, mode, "behind_body", faceOffsetY);
    }
    return;
  }

  if (pass === "neck_over_clothes") {
    const backSel = accessories.back;
    if (backSel && backSel.id !== "none") {
      drawBackProps(ctx, backSel, a, sil, angle, mode, "neck_over_clothes");
    }
    const neckSel = accessories.neck;
    if (neckSel && neckSel.id !== "none") {
      drawNeckwear(ctx, neckSel, a, sil, angle, mode, "neck_over_clothes");
    }
    return;
  }

  if (pass === "face_under_hair") {
    const markSel = accessories.faceMark;
    if (markSel && markSel.id !== "none") {
      drawFaceMarks(ctx, markSel, a, sil, angle, mode, faceOffsetY);
    }
    const earSel = accessories.ears;
    if (earSel && earSel.id !== "none") {
      drawEarrings(ctx, earSel, a, sil, angle, mode, faceOffsetY);
    }
    // Draw eyewear here for eyepatches (so bangs drape over strap), while glasses/shades/visors draw crisp over_hair
    const eyeSel = accessories.eyewear;
    if (eyeSel && eyeSel.id === "eyepatch_l") {
      drawEyewear(ctx, eyeSel, a, sil, angle, mode, faceOffsetY);
    }
    return;
  }

  if (pass === "over_hair") {
    const eyeSel = accessories.eyewear;
    if (eyeSel && eyeSel.id !== "none" && eyeSel.id !== "eyepatch_l") {
      drawEyewear(ctx, eyeSel, a, sil, angle, mode, faceOffsetY);
    }
    const headSel = accessories.headwear;
    if (headSel && headSel.id !== "none") {
      drawHeadwear(ctx, headSel, a, sil, angle, mode, "over_hair", faceOffsetY);
    }
  }
}

export const ACCESSORY_CANVAS_BOUNDS_2D = { w: CHAR2D_W, h: CHAR2D_H };

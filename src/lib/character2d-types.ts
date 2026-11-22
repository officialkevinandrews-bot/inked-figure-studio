export const CHAR2D_W = 480;
export const CHAR2D_H = 1000;

export const ANGLES_2D = [0, 45, 90, 135, 180, 225, 270, 315] as const;
export type Angle2D = (typeof ANGLES_2D)[number];

export const ANGLE_LABELS_2D: Record<Angle2D, string> = {
  0: "0° Front",
  45: "45° Front-R",
  90: "90° Right",
  135: "135° Back-R",
  180: "180° Back",
  225: "225° Back-L",
  270: "270° Left",
  315: "315° Front-L",
};

export const MIRROR_PAIRS_2D: ReadonlyArray<readonly [Angle2D, Angle2D]> = [
  [45, 315],
  [90, 270],
  [135, 225],
];

export type RenderMode2D = "color" | "manga";
export type ShadingDepth2D = "flat" | "cel" | "dramatic";

export interface BodyPoint2D {
  x: number;
  y: number;
}

export interface BodyAngleAnchors {
  headCx: number;
  headCy: number;
  headRx: number;
  headRy: number;
  faceShiftX: number; // horizontal facing offset (+right on 45/90, -left on 270/315, 0 on front)
  eyeY: number;
  noseY: number;
  mouthY: number;
  chinY: number;
  neckY: number;
  neckL: number;
  neckR: number;
  shoulderY: number;
  shoulderL: number;
  shoulderR: number;
  chestY: number;
  torsoL: number;
  torsoR: number;
  waistY: number;
  waistL: number;
  waistR: number;
  hipY: number;
  hipL: number;
  hipR: number;
  crotchY: number;
  hemY: number;
  armLeft: [BodyPoint2D, BodyPoint2D, BodyPoint2D]; // shoulder -> elbow -> wrist
  armRight: [BodyPoint2D, BodyPoint2D, BodyPoint2D];
  armWidth: number;
  legLeft: [BodyPoint2D, BodyPoint2D, BodyPoint2D, BodyPoint2D]; // hip -> knee -> ankle -> toe
  legRight: [BodyPoint2D, BodyPoint2D, BodyPoint2D, BodyPoint2D];
  thighWidth: number;
  calfWidth: number;
  footLength: number;
}

export interface HeadAngleAnchors2D {
  headCx: number;
  headCy: number;
  headRx: number;
  headRy: number;
  faceShiftX: number;
  eyeY: number;
  noseY: number;
  mouthY: number;
  chinY: number;
  neckY: number;
  neckL: number;
  neckR: number;
  /** Pivot X/Y inside the standalone 220x280 overlay sprite where the neck meets the body. */
  neckAttachX: number;
  neckAttachY: number;
}

export interface HeadFit2D {
  scale: number; // 0.85..1.15
  offsetY: number; // -16..16 px
}

export interface HeadPack2D {
  id: string;
  name: string;
  subtitle?: string;
  builtIn: boolean;
  sheetMode: "sheet-8" | "sheet-5" | "single";
  createdAt: number;
  thumbnail: string;
  /** Standalone transparent head+neck sprites per 45° angle (for attaching onto ANY body). */
  overlayFrames: Record<Angle2D, string>;
  /** Optional body-matched seamless full-body frames keyed by baseModelId -> angle -> src. */
  bodyVariants?: Record<string, Record<Angle2D, string>>;
  /** Measured 480x1000 head landmarks & overlay neck attach pivot per angle. */
  anchors: Record<Angle2D, HeadAngleAnchors2D>;
}

export interface BaseModel2D {
  id: string;
  name: string;
  builtIn: boolean;
  sheetMode: "sheet-8" | "sheet-5";
  createdAt: number;
  /** URL (built-in) or idb://<blobId> or data URL per 45° angle. */
  frames: Record<Angle2D, string>;
  /** Exact 480x1000 anatomical fit landmarks per angle. */
  anchors: Record<Angle2D, BodyAngleAnchors>;
}

export type EyeStyle2D = "none" | "sharp" | "round" | "almond" | "intense" | "gentle" | "stoic";
export type BrowStyle2D = "none" | "sharp" | "thin" | "bold" | "soft" | "flat";
export type NoseStyle2D = "none" | "sharp" | "subtle" | "wedge" | "classic" | "tall" | "button";
export type MouthStyle2D = "none" | "sharp" | "line" | "grin" | "smile" | "smirk" | "soft" | "wide";

export type Expression2DId =
  "neutral" | "happy" | "angry" | "shocked" | "sad" | "smug" | "serious" | "closed";

export type FaceFx2D = "blush" | "sweat" | "anger" | "tears" | "gloom";

export type HairStyle2D = "none" | "spiky" | "messy" | "short" | "slick" | "curtains" | "long";
export type TopStyle2D =
  "none" | "zip_hoodie_tee" | "hoodie" | "tshirt" | "longsleeve" | "zip_jacket" | "blazer";
export type BottomStyle2D = "none" | "cargo" | "jeans" | "shorts";
export type FootwearStyle2D = "none" | "sneakers" | "boots";

export interface CustomLayerTransform2D {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  flipX: boolean;
  visible: boolean;
  opacity: number;
}

export interface CustomPartAsset2D {
  id: string;
  name: string;
  kind: "sheet-8" | "sheet-5" | "single";
  slot: "face" | "hair" | "top" | "bottom" | "footwear" | "accessory";
  createdAt: number;
  /** Mapped frame URL / idb://<blobId> / dataUrl per angle (single repeats across angles). */
  frames: Partial<Record<Angle2D, string>>;
  singleSrc?: string;
}

export interface CustomLayerInstance2D {
  id: string;
  assetId: string;
  name: string;
  zLayer: "behind" | "front";
  tintEnabled: boolean;
  tintColor: string;
  /** Per-angle placement overrides (falls back cleanly to `0°` or defaults). */
  perAngle: Partial<Record<Angle2D, Partial<CustomLayerTransform2D>>>;
  defaultTransform: CustomLayerTransform2D;
}

export interface Character2D {
  id: string;
  name: string;
  baseModelId: string;
  headShapeId?: string;
  headFit?: HeadFit2D;
  createdAt: number;
  updatedAt: number;
  angle: Angle2D;
  renderMode: RenderMode2D;
  shadingDepth?: ShadingDepth2D;
  skinTone: string | null; // null keeps original base sprite skin color untouched
  face: {
    eyeStyle: EyeStyle2D;
    browStyle: BrowStyle2D;
    noseStyle: NoseStyle2D;
    mouthStyle: MouthStyle2D;
    expression: Expression2DId;
    fx: FaceFx2D[];
    eyeColor: string;
    browColor: string;
    mouthColor: string;
    scale: number;
    offsetY: number;
  };
  hair: {
    style: HairStyle2D;
    color: string;
  };
  clothes: {
    top: TopStyle2D;
    topColor: string;
    topAccentColor: string;
    bottom: BottomStyle2D;
    bottomColor: string;
    bottomAccentColor: string;
    footwear: FootwearStyle2D;
    footwearColor: string;
    footwearAccentColor: string;
  };
  customLayers: CustomLayerInstance2D[];
  /** Optional per-angle offset adjustments on top of the active base model anchors. */
  anchorOverrides?: Partial<Record<Angle2D, Partial<BodyAngleAnchors>>>;
}

export interface Source2DMetadata {
  characterId: string;
  characterName: string;
  angle: Angle2D;
  renderMode: RenderMode2D;
  snapshot?: Character2D;
}

export const EYE_STYLE_LABELS_2D: Partial<Record<EyeStyle2D, string>> = {
  none: "None",
  sharp: "Shonen Sharp",
};

export const BROW_STYLE_LABELS_2D: Partial<Record<BrowStyle2D, string>> = {
  none: "None",
  sharp: "Shonen Sharp",
};

export const NOSE_STYLE_LABELS_2D: Partial<Record<NoseStyle2D, string>> = {
  none: "None",
  sharp: "Shonen Sharp",
};

export const MOUTH_STYLE_LABELS_2D: Partial<Record<MouthStyle2D, string>> = {
  none: "None",
  sharp: "Shonen Sharp",
};

export const EXPRESSION_PRESETS_2D: Record<
  Expression2DId,
  {
    label: string;
    eyeMode: "open" | "happy" | "glare" | "shock" | "sad" | "smug" | "serious" | "closed";
    browTilt: number;
    mouthPose: "neutral" | "smile" | "grin" | "angry" | "gasp" | "sad" | "smirk" | "serious";
  }
> = {
  neutral: { label: "Neutral", eyeMode: "open", browTilt: 0, mouthPose: "neutral" },
  happy: { label: "Happy", eyeMode: "happy", browTilt: -6, mouthPose: "grin" },
  angry: { label: "Angry", eyeMode: "glare", browTilt: 16, mouthPose: "angry" },
  shocked: { label: "Shocked", eyeMode: "shock", browTilt: -10, mouthPose: "gasp" },
  sad: { label: "Sad", eyeMode: "sad", browTilt: -14, mouthPose: "sad" },
  smug: { label: "Smug", eyeMode: "smug", browTilt: -4, mouthPose: "smirk" },
  serious: { label: "Serious", eyeMode: "serious", browTilt: 9, mouthPose: "serious" },
  closed: { label: "Eyes Closed", eyeMode: "closed", browTilt: 0, mouthPose: "neutral" },
};

export const FACE_FX_LABELS_2D: Record<FaceFx2D, string> = {
  blush: "Blush",
  sweat: "Sweat Drop",
  anger: "Vein Mark",
  tears: "Tears",
  gloom: "Gloom Lines",
};

export const HAIR_STYLE_LABELS_2D: Partial<Record<HairStyle2D, string>> = {
  none: "Bald / Base",
  spiky: "Spiky Anime",
};

export const TOP_STYLE_LABELS_2D: Partial<Record<TopStyle2D, string>> = {
  none: "Bare Torso",
  zip_hoodie_tee: "Zip Hoodie + Tee",
};

export const BOTTOM_STYLE_LABELS_2D: Partial<Record<BottomStyle2D, string>> = {
  none: "Base Briefs",
  cargo: "Cargo Joggers",
};

export const FOOTWEAR_STYLE_LABELS_2D: Partial<Record<FootwearStyle2D, string>> = {
  none: "Barefoot",
  sneakers: "High-Top Sneakers",
};

export const SKIN_PRESETS_2D: { label: string; color: string | null }[] = [
  { label: "Original", color: null },
  { label: "Porcelain", color: "#fde3d2" },
  { label: "Warm Fair", color: "#f6cbb1" },
  { label: "Golden Tan", color: "#dfa37b" },
  { label: "Olive", color: "#c98b63" },
  { label: "Rich Brown", color: "#8d583c" },
  { label: "Deep Ebony", color: "#563322" },
  { label: "Demon Slate", color: "#9eb2c4" },
];

export const RGB_SWATCHES_2D: string[] = [
  "#1c1e26",
  "#ffffff",
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#475569",
  "#7c2d12",
  "#0f172a",
];

export const DEFAULT_CUSTOM_TRANSFORM_2D: CustomLayerTransform2D = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  flipX: false,
  visible: true,
  opacity: 1,
};

export function createDefaultCharacter2D(name = "Hero #1"): Character2D {
  const now = Date.now();
  return {
    id: `char2d-${now}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    baseModelId: "male-athletic-v1",
    headShapeId: "classic-oval",
    headFit: { scale: 1, offsetY: 0 },
    createdAt: now,
    updatedAt: now,
    angle: 0,
    renderMode: "color",
    shadingDepth: "cel",
    skinTone: null,
    face: {
      eyeStyle: "sharp",
      browStyle: "sharp",
      noseStyle: "sharp",
      mouthStyle: "sharp",
      expression: "neutral",
      fx: [],
      eyeColor: "#2563eb",
      browColor: "#1f2430",
      mouthColor: "#c25b66",
      scale: 1,
      offsetY: 0,
    },
    hair: {
      style: "spiky",
      color: "#1e2433",
    },
    clothes: {
      top: "zip_hoodie_tee",
      topColor: "#273b5c",
      topAccentColor: "#f8fafc",
      bottom: "cargo",
      bottomColor: "#334155",
      bottomAccentColor: "#94a3b8",
      footwear: "sneakers",
      footwearColor: "#1e293b",
      footwearAccentColor: "#ffffff",
    },
    customLayers: [],
  };
}

export function isBackFacingAngle2D(angle: Angle2D): boolean {
  return angle === 135 || angle === 180 || angle === 225;
}

export function stepAngle2D(current: Angle2D, deltaSteps: number): Angle2D {
  const idx = ANGLES_2D.indexOf(current);
  const len = ANGLES_2D.length;
  const next = (((idx + deltaSteps) % len) + len) % len;
  return ANGLES_2D[next]!;
}

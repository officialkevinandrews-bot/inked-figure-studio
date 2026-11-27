import type {
  Angle2D,
  BottomStyle2D,
  BrowStyle2D,
  EyeStyle2D,
  FootwearStyle2D,
  HairStyle2D,
  MouthStyle2D,
  NoseStyle2D,
  TopStyle2D,
} from "./character2d-types";

export interface IllustratedHairPack2D {
  id: HairStyle2D;
  name: string;
  /** False while 2K art assets are queued/unverified so the live UI never hits 404s. Defaults to true. */
  ready?: boolean;
  frontFrames: Record<Angle2D, string>;
  backFrames: Partial<Record<Angle2D, string>>;
  canvasW: number;
  canvasH: number;
  pivotX: number;
  pivotY: number;
  refHeadRx: number;
  refHeadRy: number;
  /** Optional baked per-angle pixel calibration defaults (logical 480x1000 space). */
  perAngleFit?: Partial<Record<Angle2D, { offsetX?: number; offsetY?: number; scale?: number }>>;
}

export interface IllustratedClothingPack2D {
  id: TopStyle2D | BottomStyle2D | FootwearStyle2D;
  name: string;
  /** False while 2K art assets are queued/unverified so the live UI never hits 404s. Defaults to true. */
  ready?: boolean;
  slot: "top" | "bottom" | "footwear";
  frames: Record<Angle2D, string>;
  accentMasks?: Partial<Record<Angle2D, string>>;
  primaryLabel: string;
  accentLabel?: string;
  defaultPrimary: string;
  defaultAccent?: string;
  shortSleeve?: boolean;
}

export interface IllustratedFaceAngleAssets2D {
  eyeLeftBase: string;
  eyeLeftIris: string;
  eyeRightBase?: string;
  eyeRightIris?: string;
  browLeft: string;
  browRight?: string;
  nose: string;
  mouth: string;
}

export interface IllustratedFacePack2D {
  id: "sharp" | "cool";
  name: string;
  /** False while 2K art assets are queued/unverified so the live UI never hits 404s. Defaults to true. */
  ready?: boolean;
  angles: Partial<Record<Angle2D, IllustratedFaceAngleAssets2D>>;
  eyeW: number;
  eyeH: number;
  browW: number;
  browH: number;
  noseW: number;
  noseH: number;
  mouthW: number;
  mouthH: number;
  featureScaleRef: number;
}

export interface ResolvedFacePacks2D {
  eyes: IllustratedFacePack2D | null;
  brows: IllustratedFacePack2D | null;
  nose: IllustratedFacePack2D | null;
  mouth: IllustratedFacePack2D | null;
}

export interface CharacterStylePreset2D {
  id: string;
  name: string;
  subtitle: string;
  hair?: { style: HairStyle2D; color: string };
  face?: {
    eyeStyle: EyeStyle2D;
    browStyle: BrowStyle2D;
    noseStyle: NoseStyle2D;
    mouthStyle: MouthStyle2D;
    eyeColor?: string;
  };
  clothes: {
    top: TopStyle2D;
    topColor: string;
    topAccentColor: string;
    bottom: BottomStyle2D;
    bottomColor: string;
    bottomAccentColor?: string;
    footwear: FootwearStyle2D;
    footwearColor: string;
    footwearAccentColor: string;
  };
}

export interface ArtTemplateGuide2D {
  id: string;
  label: string;
  description: string;
  href: string;
  filename: string;
}

const angleMap = (
  dir: string,
  prefix: string,
  angles: readonly Angle2D[],
): Record<Angle2D, string> => {
  const out = {} as Record<Angle2D, string>;
  for (const ang of angles) {
    out[ang] = `${dir}/${prefix}-angle-${ang}.webp`;
  }
  return out;
};

const ALL8: readonly Angle2D[] = [0, 45, 90, 135, 180, 225, 270, 315];
const FRONT5: readonly Angle2D[] = [0, 45, 90, 270, 315];

export const ILLUSTRATED_HAIR_PACKS_2D: IllustratedHairPack2D[] = [
  {
    id: "spiky",
    name: "Spiky Anime",
    ready: true,
    frontFrames: angleMap("/characters/parts/hair/spiky", "front", ALL8),
    backFrames: angleMap("/characters/parts/hair/spiky", "back", ALL8),
    canvasW: 280,
    canvasH: 280,
    pivotX: 140,
    pivotY: 148,
    refHeadRx: 46,
    refHeadRy: 61,
  },
  {
    id: "curtains",
    name: "Center-Part Curtains",
    ready: false,
    frontFrames: angleMap("/characters/parts/hair/curtains", "front", ALL8),
    backFrames: angleMap("/characters/parts/hair/curtains", "back", ALL8),
    canvasW: 280,
    canvasH: 280,
    pivotX: 140,
    pivotY: 148,
    refHeadRx: 46,
    refHeadRy: 61,
  },
];

export const ILLUSTRATED_TOP_PACKS_2D: IllustratedClothingPack2D[] = [
  {
    id: "zip_hoodie_tee",
    name: "Zip Hoodie + Tee",
    ready: true,
    slot: "top",
    frames: angleMap("/characters/parts/tops/zip-hoodie-tee", "base", ALL8),
    accentMasks: {
      0: "/characters/parts/tops/zip-hoodie-tee/mask-angle-0.webp",
      45: "/characters/parts/tops/zip-hoodie-tee/mask-angle-45.webp",
      315: "/characters/parts/tops/zip-hoodie-tee/mask-angle-315.webp",
    },
    primaryLabel: "Hoodie Color (RGB)",
    accentLabel: "Inner T-Shirt (RGB)",
    defaultPrimary: "#273b5c",
    defaultAccent: "#f8fafc",
    shortSleeve: true,
  },
  {
    id: "blazer",
    name: "Suit Blazer + Shirt",
    ready: false,
    slot: "top",
    frames: angleMap("/characters/parts/tops/suit-blazer-shirt", "base", ALL8),
    accentMasks: {
      0: "/characters/parts/tops/suit-blazer-shirt/mask-angle-0.webp",
      45: "/characters/parts/tops/suit-blazer-shirt/mask-angle-45.webp",
      90: "/characters/parts/tops/suit-blazer-shirt/mask-angle-90.webp",
      270: "/characters/parts/tops/suit-blazer-shirt/mask-angle-270.webp",
      315: "/characters/parts/tops/suit-blazer-shirt/mask-angle-315.webp",
    },
    primaryLabel: "Blazer Color (RGB)",
    accentLabel: "Dress Shirt (RGB)",
    defaultPrimary: "#1e293b",
    defaultAccent: "#f8fafc",
    shortSleeve: false,
  },
];

export const ILLUSTRATED_BOTTOM_PACKS_2D: IllustratedClothingPack2D[] = [
  {
    id: "cargo",
    name: "Cargo Joggers",
    ready: true,
    slot: "bottom",
    frames: angleMap("/characters/parts/bottoms/cargo-joggers", "base", ALL8),
    primaryLabel: "Trousers Color (RGB)",
    defaultPrimary: "#334155",
  },
  {
    id: "trousers",
    name: "Dress Trousers",
    ready: false,
    slot: "bottom",
    frames: angleMap("/characters/parts/bottoms/dress-trousers", "base", ALL8),
    primaryLabel: "Trousers Color (RGB)",
    defaultPrimary: "#1e293b",
  },
];

export const ILLUSTRATED_FOOTWEAR_PACKS_2D: IllustratedClothingPack2D[] = [
  {
    id: "sneakers",
    name: "High-Top Sneakers",
    ready: true,
    slot: "footwear",
    frames: angleMap("/characters/parts/footwear/hightop-sneakers", "base", ALL8),
    accentMasks: angleMap("/characters/parts/footwear/hightop-sneakers", "mask", ALL8),
    primaryLabel: "Shoe Upper (RGB)",
    accentLabel: "Sole & Laces (RGB)",
    defaultPrimary: "#1e293b",
    defaultAccent: "#ffffff",
  },
  {
    id: "loafers",
    name: "Dress Loafers",
    ready: false,
    slot: "footwear",
    frames: angleMap("/characters/parts/footwear/dress-loafers", "base", ALL8),
    accentMasks: angleMap("/characters/parts/footwear/dress-loafers", "mask", ALL8),
    primaryLabel: "Leather Upper (RGB)",
    accentLabel: "Sole & Heel (RGB)",
    defaultPrimary: "#292524",
    defaultAccent: "#111827",
  },
];

const buildFaceAngles = (dir: string): Partial<Record<Angle2D, IllustratedFaceAngleAssets2D>> =>
  Object.fromEntries(
    FRONT5.map((ang) => {
      const twoEyes = ang === 0 || ang === 45 || ang === 315;
      return [
        ang,
        {
          eyeLeftBase: `${dir}/eye-left-base-angle-${ang}.webp`,
          eyeLeftIris: `${dir}/eye-left-iris-angle-${ang}.webp`,
          ...(twoEyes
            ? {
                eyeRightBase: `${dir}/eye-right-base-angle-${ang}.webp`,
                eyeRightIris: `${dir}/eye-right-iris-angle-${ang}.webp`,
              }
            : {}),
          browLeft: `${dir}/brow-left-angle-${ang}.webp`,
          ...(twoEyes ? { browRight: `${dir}/brow-right-angle-${ang}.webp` } : {}),
          nose: `${dir}/nose-angle-${ang}.webp`,
          mouth: `${dir}/mouth-angle-${ang}.webp`,
        } satisfies IllustratedFaceAngleAssets2D,
      ];
    }),
  ) as Partial<Record<Angle2D, IllustratedFaceAngleAssets2D>>;

export const ILLUSTRATED_FACE_PACKS_2D: IllustratedFacePack2D[] = [
  {
    id: "sharp",
    name: "Shonen Sharp",
    ready: true,
    angles: buildFaceAngles("/characters/parts/face/shonen-sharp"),
    eyeW: 72,
    eyeH: 56,
    browW: 72,
    browH: 40,
    noseW: 56,
    noseH: 56,
    mouthW: 72,
    mouthH: 44,
    featureScaleRef: 2.0,
  },
  {
    id: "cool",
    name: "Cool Narrow",
    ready: false,
    angles: buildFaceAngles("/characters/parts/face/cool-narrow"),
    eyeW: 72,
    eyeH: 56,
    browW: 72,
    browH: 40,
    noseW: 56,
    noseH: 56,
    mouthW: 72,
    mouthH: 44,
    featureScaleRef: 2.0,
  },
];

/**
 * Data-driven catalog of full character style presets (each uploaded set + curated colorways).
 * Only presets whose required asset packs are `ready` appear via `getAvailableStylePresets2D()`.
 */
export const CHARACTER_STYLE_PRESETS_2D: CharacterStylePreset2D[] = [
  {
    id: "shonen-street-navy",
    name: "Shonen Street (Navy)",
    subtitle: "Spiky Hair · Zip Hoodie + Cargo + Sneakers",
    hair: { style: "spiky", color: "#1e2433" },
    face: {
      eyeStyle: "sharp",
      browStyle: "sharp",
      noseStyle: "sharp",
      mouthStyle: "sharp",
      eyeColor: "#2563eb",
    },
    clothes: {
      top: "zip_hoodie_tee",
      topColor: "#273b5c",
      topAccentColor: "#f8fafc",
      bottom: "cargo",
      bottomColor: "#334155",
      footwear: "sneakers",
      footwearColor: "#1e293b",
      footwearAccentColor: "#ffffff",
    },
  },
  {
    id: "shonen-street-crimson",
    name: "Shonen Street (Crimson)",
    subtitle: "Spiky Hair · Red Hoodie + Charcoal Cargo",
    hair: { style: "spiky", color: "#1e2433" },
    clothes: {
      top: "zip_hoodie_tee",
      topColor: "#b91c1c",
      topAccentColor: "#f8fafc",
      bottom: "cargo",
      bottomColor: "#1f2937",
      footwear: "sneakers",
      footwearColor: "#b91c1c",
      footwearAccentColor: "#ffffff",
    },
  },
  {
    id: "formal-suit-charcoal",
    name: "Formal Executive (Charcoal)",
    subtitle: "Center-Part Curtains · Suit Blazer + Trousers + Loafers",
    hair: { style: "curtains", color: "#1e293b" },
    face: {
      eyeStyle: "cool",
      browStyle: "cool",
      noseStyle: "cool",
      mouthStyle: "cool",
      eyeColor: "#475569",
    },
    clothes: {
      top: "blazer",
      topColor: "#1e293b",
      topAccentColor: "#f8fafc",
      bottom: "trousers",
      bottomColor: "#1e293b",
      footwear: "loafers",
      footwearColor: "#292524",
      footwearAccentColor: "#111827",
    },
  },
  {
    id: "formal-suit-ivory",
    name: "Formal Ace (Silver & White)",
    subtitle: "Silver Curtains · Crisp White Suit + Loafers",
    hair: { style: "curtains", color: "#e2e8f0" },
    face: {
      eyeStyle: "cool",
      browStyle: "cool",
      noseStyle: "cool",
      mouthStyle: "cool",
      eyeColor: "#64748b",
    },
    clothes: {
      top: "blazer",
      topColor: "#f8fafc",
      topAccentColor: "#ffffff",
      bottom: "trousers",
      bottomColor: "#f1f5f9",
      footwear: "loafers",
      footwearColor: "#e2e8f0",
      footwearAccentColor: "#475569",
    },
  },
  {
    id: "smart-casual-navy",
    name: "Smart Casual (Mix & Match)",
    subtitle: "Navy Blazer + Cargo Joggers + Sneakers",
    clothes: {
      top: "blazer",
      topColor: "#1e3a5f",
      topAccentColor: "#f8fafc",
      bottom: "cargo",
      bottomColor: "#334155",
      footwear: "sneakers",
      footwearColor: "#1e293b",
      footwearAccentColor: "#ffffff",
    },
  },
];

export const MODEL1_ART_TEMPLATES_2D: ArtTemplateGuide2D[] = [
  {
    id: "sheet-8",
    label: "1×8 Full Body Guide",
    description: "2048×1152 · All 8 angles aligned to Model #1",
    href: "/characters/templates/model1-turnaround-1x8-guide.png",
    filename: "model1-turnaround-1x8-guide.png",
  },
  {
    id: "sheet-5",
    label: "1×5 Mirror Guide",
    description: "1280×1152 · 0°–180° (app mirrors opposite angles)",
    href: "/characters/templates/model1-turnaround-1x5-guide.png",
    filename: "model1-turnaround-1x5-guide.png",
  },
  {
    id: "bust-3",
    label: "1×3 Hi-Res Bust / Face",
    description: "1536×512 · 0° / 45° / 90° close-up face & hair guide",
    href: "/characters/templates/model1-bust-face-1x3-guide.png",
    filename: "model1-bust-face-1x3-guide.png",
  },
];

const isReady = (p: { ready?: boolean } | undefined): boolean =>
  p !== undefined && p.ready !== false;

export function resolveIllustratedHairPack2D(
  styleId: HairStyle2D | string | undefined,
): IllustratedHairPack2D | null {
  if (!styleId || styleId === "none") return null;
  const readyPacks = ILLUSTRATED_HAIR_PACKS_2D.filter(isReady);
  return readyPacks.find((p) => p.id === styleId) ?? readyPacks[0] ?? null;
}

export function resolveIllustratedTopPack2D(
  styleId: TopStyle2D | string | undefined,
): IllustratedClothingPack2D | null {
  if (!styleId || styleId === "none") return null;
  const readyPacks = ILLUSTRATED_TOP_PACKS_2D.filter(isReady);
  return readyPacks.find((p) => p.id === styleId) ?? readyPacks[0] ?? null;
}

export function resolveIllustratedBottomPack2D(
  styleId: BottomStyle2D | string | undefined,
): IllustratedClothingPack2D | null {
  if (!styleId || styleId === "none") return null;
  const readyPacks = ILLUSTRATED_BOTTOM_PACKS_2D.filter(isReady);
  return readyPacks.find((p) => p.id === styleId) ?? readyPacks[0] ?? null;
}

export function resolveIllustratedFootwearPack2D(
  styleId: FootwearStyle2D | string | undefined,
): IllustratedClothingPack2D | null {
  if (!styleId || styleId === "none") return null;
  const readyPacks = ILLUSTRATED_FOOTWEAR_PACKS_2D.filter(isReady);
  return readyPacks.find((p) => p.id === styleId) ?? readyPacks[0] ?? null;
}

export function resolveIllustratedFacePack2D(
  styleId: EyeStyle2D | BrowStyle2D | NoseStyle2D | MouthStyle2D | string | undefined,
): IllustratedFacePack2D | null {
  if (!styleId || styleId === "none") return null;
  const readyPacks = ILLUSTRATED_FACE_PACKS_2D.filter(isReady);
  return readyPacks.find((p) => p.id === styleId) ?? readyPacks[0] ?? null;
}

/** Independently resolves face packs per feature so users can freely mix-and-match eyes, brows, nose & mouth across packs. */
export function resolveIllustratedFacePacks2D(face: {
  eyeStyle: EyeStyle2D;
  browStyle: BrowStyle2D;
  noseStyle: NoseStyle2D;
  mouthStyle: MouthStyle2D;
}): ResolvedFacePacks2D {
  return {
    eyes: resolveIllustratedFacePack2D(face.eyeStyle),
    brows: resolveIllustratedFacePack2D(face.browStyle),
    nose: resolveIllustratedFacePack2D(face.noseStyle),
    mouth: resolveIllustratedFacePack2D(face.mouthStyle),
  };
}

/** Returns only style presets whose referenced hair, face, and clothing packs are all marked `ready`. */
export function getAvailableStylePresets2D(): CharacterStylePreset2D[] {
  const readyHair = new Set(ILLUSTRATED_HAIR_PACKS_2D.filter(isReady).map((p) => p.id));
  const readyTop = new Set(ILLUSTRATED_TOP_PACKS_2D.filter(isReady).map((p) => p.id));
  const readyBottom = new Set(ILLUSTRATED_BOTTOM_PACKS_2D.filter(isReady).map((p) => p.id));
  const readyFoot = new Set(ILLUSTRATED_FOOTWEAR_PACKS_2D.filter(isReady).map((p) => p.id));
  const readyFace = new Set<string>(ILLUSTRATED_FACE_PACKS_2D.filter(isReady).map((p) => p.id));

  return CHARACTER_STYLE_PRESETS_2D.filter((preset) => {
    if (preset.hair && preset.hair.style !== "none" && !readyHair.has(preset.hair.style)) {
      return false;
    }
    if (preset.face) {
      if (preset.face.eyeStyle !== "none" && !readyFace.has(preset.face.eyeStyle)) return false;
      if (preset.face.browStyle !== "none" && !readyFace.has(preset.face.browStyle)) return false;
      if (preset.face.noseStyle !== "none" && !readyFace.has(preset.face.noseStyle)) return false;
      if (preset.face.mouthStyle !== "none" && !readyFace.has(preset.face.mouthStyle)) return false;
    }
    if (preset.clothes.top !== "none" && !readyTop.has(preset.clothes.top)) return false;
    if (preset.clothes.bottom !== "none" && !readyBottom.has(preset.clothes.bottom)) return false;
    if (preset.clothes.footwear !== "none" && !readyFoot.has(preset.clothes.footwear)) return false;
    return true;
  });
}

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
  frontFrames: Record<Angle2D, string>;
  backFrames: Partial<Record<Angle2D, string>>;
  canvasW: number;
  canvasH: number;
  pivotX: number;
  pivotY: number;
  refHeadRx: number;
  refHeadRy: number;
}

export interface IllustratedClothingPack2D {
  id: TopStyle2D | BottomStyle2D | FootwearStyle2D;
  name: string;
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
  eyesBase: string;
  eyesIris: string;
  brows: string;
  nose: string;
  mouth: string;
}

export interface IllustratedFacePack2D {
  id: "sharp";
  name: string;
  angles: Partial<Record<Angle2D, IllustratedFaceAngleAssets2D>>;
  canvasW: number;
  canvasH: number;
  pivotX: number;
  pivotY: number;
  refHeadRx: number;
  refHeadRy: number;
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
    frontFrames: angleMap("/characters/parts/hair/spiky", "front", ALL8),
    backFrames: {},
    canvasW: 280,
    canvasH: 280,
    pivotX: 140,
    pivotY: 148,
    refHeadRx: 69,
    refHeadRy: 94.5,
  },
];

export const ILLUSTRATED_TOP_PACKS_2D: IllustratedClothingPack2D[] = [
  {
    id: "zip_hoodie_tee",
    name: "Zip Hoodie + Tee",
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
];

export const ILLUSTRATED_BOTTOM_PACKS_2D: IllustratedClothingPack2D[] = [
  {
    id: "cargo",
    name: "Cargo Joggers",
    slot: "bottom",
    frames: angleMap("/characters/parts/bottoms/cargo-joggers", "base", ALL8),
    primaryLabel: "Trousers Color (RGB)",
    defaultPrimary: "#334155",
  },
];

export const ILLUSTRATED_FOOTWEAR_PACKS_2D: IllustratedClothingPack2D[] = [
  {
    id: "sneakers",
    name: "High-Top Sneakers",
    slot: "footwear",
    frames: angleMap("/characters/parts/footwear/hightop-sneakers", "base", ALL8),
    accentMasks: angleMap("/characters/parts/footwear/hightop-sneakers", "mask", ALL8),
    primaryLabel: "Shoe Upper (RGB)",
    accentLabel: "Sole & Laces (RGB)",
    defaultPrimary: "#1e293b",
    defaultAccent: "#ffffff",
  },
];

export const ILLUSTRATED_FACE_PACKS_2D: IllustratedFacePack2D[] = [
  {
    id: "sharp",
    name: "Shonen Sharp",
    angles: Object.fromEntries(
      FRONT5.map((ang) => [
        ang,
        {
          eyesBase: `/characters/parts/face/shonen-sharp/eyes-base-angle-${ang}.webp`,
          eyesIris: `/characters/parts/face/shonen-sharp/eyes-iris-angle-${ang}.webp`,
          brows: `/characters/parts/face/shonen-sharp/brows-angle-${ang}.webp`,
          nose: `/characters/parts/face/shonen-sharp/nose-angle-${ang}.webp`,
          mouth: `/characters/parts/face/shonen-sharp/mouth-angle-${ang}.webp`,
        },
      ]),
    ) as Partial<Record<Angle2D, IllustratedFaceAngleAssets2D>>,
    canvasW: 220,
    canvasH: 220,
    pivotX: 110,
    pivotY: 100,
    refHeadRx: 92,
    refHeadRy: 126,
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

export function resolveIllustratedHairPack2D(
  styleId: HairStyle2D | string | undefined,
): IllustratedHairPack2D | null {
  if (!styleId || styleId === "none") return null;
  return ILLUSTRATED_HAIR_PACKS_2D.find((p) => p.id === styleId) ?? ILLUSTRATED_HAIR_PACKS_2D[0]!;
}

export function resolveIllustratedTopPack2D(
  styleId: TopStyle2D | string | undefined,
): IllustratedClothingPack2D | null {
  if (!styleId || styleId === "none") return null;
  return ILLUSTRATED_TOP_PACKS_2D.find((p) => p.id === styleId) ?? ILLUSTRATED_TOP_PACKS_2D[0]!;
}

export function resolveIllustratedBottomPack2D(
  styleId: BottomStyle2D | string | undefined,
): IllustratedClothingPack2D | null {
  if (!styleId || styleId === "none") return null;
  return (
    ILLUSTRATED_BOTTOM_PACKS_2D.find((p) => p.id === styleId) ?? ILLUSTRATED_BOTTOM_PACKS_2D[0]!
  );
}

export function resolveIllustratedFootwearPack2D(
  styleId: FootwearStyle2D | string | undefined,
): IllustratedClothingPack2D | null {
  if (!styleId || styleId === "none") return null;
  return (
    ILLUSTRATED_FOOTWEAR_PACKS_2D.find((p) => p.id === styleId) ?? ILLUSTRATED_FOOTWEAR_PACKS_2D[0]!
  );
}

export function resolveIllustratedFacePack2D(
  styleId: EyeStyle2D | BrowStyle2D | NoseStyle2D | MouthStyle2D | string | undefined,
): IllustratedFacePack2D | null {
  if (!styleId || styleId === "none") return null;
  return ILLUSTRATED_FACE_PACKS_2D.find((p) => p.id === styleId) ?? ILLUSTRATED_FACE_PACKS_2D[0]!;
}

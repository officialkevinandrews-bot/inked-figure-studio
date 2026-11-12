/** Manga face decal system: part styles × expression states. Pure data, no three.js / React. */

export const EYE_STYLES = { sharp: "Sharp Anime", round: "Round / Moe", almond: "Almond / Cool", shonen: "Shonen Intense" } as const;
export const BROW_STYLES = { thin: "Thin", soft: "Soft / Gentle", bold: "Bold / Fierce", arched: "Arched" } as const;
export const MOUTH_STYLES = { line: "Minimal Line", soft: "Soft Lips", fang: "Fang", wide: "Wide / Loud" } as const;

export const EYE_STATES = { open: "Open", happy: "Happy Closed ^^", glare: "Glare", shock: "Shock (tiny pupils)", half: "Half-lidded", intense: "Intense Focus", teary: "Teary", closed: "Closed", blank: "Blank / Deadpan" } as const;
export const BROW_STATES = { neutral: "Neutral", raised: "Raised", angry: "Angry V", sad: "Worried", smug: "One Raised", flat: "Flat" } as const;
export const MOUTH_STATES = { neutral: "Neutral", smile: "Smile", grin: "Open Grin", shout: "Shout", gasp: "Gasp O", smirk: "Smirk", gritted: "Gritted Teeth", wavy: "Trembling", flat: "Flat" } as const;
export const FACE_FX = { blush: "Blush ///", sweat: "Sweat Drop", anger: "Anger Mark", tears: "Tear Streams", gloom: "Gloom Lines", sparkle: "Sparkle" } as const;

export type EyeStyle = keyof typeof EYE_STYLES;
export type BrowStyle = keyof typeof BROW_STYLES;
export type MouthStyle = keyof typeof MOUTH_STYLES;
export type EyeState = keyof typeof EYE_STATES;
export type BrowState = keyof typeof BROW_STATES;
export type MouthState = keyof typeof MOUTH_STATES;
export type FaceFx = keyof typeof FACE_FX;

export interface Expression { eye: EyeState; brow: BrowState; mouth: MouthState; fx: FaceFx[] }

/** Each expression picks a state per part; parts that don't change simply share the same state. */
export const EXPRESSIONS: Record<string, Expression> = {
  Neutral: { eye: "open", brow: "neutral", mouth: "neutral", fx: [] },
  Happy: { eye: "open", brow: "raised", mouth: "smile", fx: [] },
  Laughing: { eye: "happy", brow: "raised", mouth: "grin", fx: ["blush"] },
  Angry: { eye: "glare", brow: "angry", mouth: "gritted", fx: ["anger"] },
  Furious: { eye: "intense", brow: "angry", mouth: "shout", fx: ["anger"] },
  Shocked: { eye: "shock", brow: "raised", mouth: "gasp", fx: ["sweat", "gloom"] },
  Smug: { eye: "half", brow: "smug", mouth: "smirk", fx: ["sparkle"] },
  Determined: { eye: "intense", brow: "angry", mouth: "flat", fx: [] },
  Sad: { eye: "teary", brow: "sad", mouth: "wavy", fx: [] },
  Crying: { eye: "closed", brow: "sad", mouth: "shout", fx: ["tears"] },
  Embarrassed: { eye: "open", brow: "sad", mouth: "wavy", fx: ["blush", "sweat"] },
  Exhausted: { eye: "blank", brow: "flat", mouth: "flat", fx: ["sweat"] },
};

export interface FaceCalibration {
  offsetX: number; offsetY: number; offsetZ: number; // metres, in the head's model frame
  size: number; // metres across the decal
  tilt: number; // degrees, pitch
  curve: number; // 0..1 wrap
  eyeSpacing: number; eyeY: number; browGap: number; mouthY: number; partScale: number; // canvas px (512 canvas)
}

export interface FaceConfig {
  visible: boolean;
  guide: boolean;
  fitted?: boolean; // auto-fit has run for this model
  eyeStyle: EyeStyle; browStyle: BrowStyle; mouthStyle: MouthStyle;
  expression: string | null;
  overrides: { eye?: EyeState; brow?: BrowState; mouth?: MouthState };
  fx: FaceFx[];
  calib: FaceCalibration;
}

export const DEFAULT_CALIBRATION: FaceCalibration = {
  offsetX: 0, offsetY: 0.08, offsetZ: 0.1, size: 0.2, tilt: 0, curve: 0.35,
  eyeSpacing: 80, eyeY: 250, browGap: 55, mouthY: 380, partScale: 1,
};

export const DEFAULT_FACE: FaceConfig = {
  visible: true, guide: false,
  eyeStyle: "sharp", browStyle: "thin", mouthStyle: "line",
  expression: "Neutral", overrides: {}, fx: [],
  calib: { ...DEFAULT_CALIBRATION },
};

export interface CharacterLook { name: string; eyeStyle: EyeStyle; browStyle: BrowStyle; mouthStyle: MouthStyle }
export const CHARACTER_LOOKS: CharacterLook[] = [
  { name: "Shonen Hero", eyeStyle: "sharp", browStyle: "bold", mouthStyle: "fang" },
  { name: "Gentle Heroine", eyeStyle: "round", browStyle: "soft", mouthStyle: "soft" },
  { name: "Cool Rival", eyeStyle: "almond", browStyle: "thin", mouthStyle: "line" },
  { name: "Hot-Blooded", eyeStyle: "shonen", browStyle: "bold", mouthStyle: "wide" },
  { name: "Elegant", eyeStyle: "almond", browStyle: "arched", mouthStyle: "soft" },
];

export interface ResolvedFace { eyeStyle: EyeStyle; browStyle: BrowStyle; mouthStyle: MouthStyle; eye: EyeState; brow: BrowState; mouth: MouthState; fx: FaceFx[] }

export function resolveFace(c: FaceConfig): ResolvedFace {
  const ex = EXPRESSIONS[c.expression ?? "Neutral"] ?? EXPRESSIONS["Neutral"]!;
  return {
    eyeStyle: c.eyeStyle, browStyle: c.browStyle, mouthStyle: c.mouthStyle,
    eye: c.overrides.eye ?? ex.eye, brow: c.overrides.brow ?? ex.brow, mouth: c.overrides.mouth ?? ex.mouth,
    fx: c.fx,
  };
}

/** 1-click preset: resets mix-and-match overrides and loads the expression's manga FX. */
export function applyExpression(c: FaceConfig, name: string): FaceConfig {
  const ex = EXPRESSIONS[name];
  if (!ex) return c;
  return { ...c, expression: name, overrides: {}, fx: [...ex.fx] };
}

export function setPartOverride(c: FaceConfig, part: "eye" | "brow" | "mouth", state: string): FaceConfig {
  return { ...c, overrides: { ...c.overrides, [part]: state } };
}

export function toggleFx(c: FaceConfig, fx: FaceFx): FaceConfig {
  return { ...c, fx: c.fx.includes(fx) ? c.fx.filter((f) => f !== fx) : [...c.fx, fx] };
}

/** Every style needs one drawing per state; this is the full list of variants the library covers. */
export function variantCount() {
  return {
    eyes: Object.keys(EYE_STYLES).length * Object.keys(EYE_STATES).length,
    brows: Object.keys(BROW_STYLES).length * Object.keys(BROW_STATES).length,
    mouths: Object.keys(MOUTH_STYLES).length * Object.keys(MOUTH_STATES).length,
  };
}

const KEY = "koma-face:";
export function loadFace(model: string): FaceConfig {
  try {
    const raw = localStorage.getItem(KEY + model);
    if (raw) {
      const p = JSON.parse(raw) as Partial<FaceConfig>;
      return { ...DEFAULT_FACE, ...p, calib: { ...DEFAULT_CALIBRATION, ...(p.calib ?? {}) }, overrides: p.overrides ?? {}, fx: p.fx ?? [] };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_FACE, calib: { ...DEFAULT_CALIBRATION } };
}
export function saveFace(model: string, c: FaceConfig) {
  try { localStorage.setItem(KEY + model, JSON.stringify(c)); } catch { /* ignore */ }
}

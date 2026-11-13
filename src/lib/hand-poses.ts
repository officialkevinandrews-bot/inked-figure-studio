import { mirrorRot, type PoseData, type Rot } from "./rig";

export type HandSide = "Left" | "Right" | "Both";

export type HandPresetId = "relaxed" | "fist" | "point" | "open" | "grip" | "peace";

export interface HandPreset {
  id: HandPresetId;
  label: string;
  curl: Partial<Record<"Index" | "Middle" | "Ring" | "Pinky", number>>;
  thumb: Rot;
}

const FINGERS = ["Index", "Middle", "Ring", "Pinky"] as const;

export const HAND_PRESETS: HandPreset[] = [
  {
    id: "relaxed",
    label: "Relaxed",
    curl: { Index: 15, Middle: 20, Ring: 25, Pinky: 30 },
    thumb: [0, 10, -10],
  },
  {
    id: "fist",
    label: "Fist",
    curl: { Index: 85, Middle: 88, Ring: 90, Pinky: 90 },
    thumb: [0, 30, -40],
  },
  {
    id: "point",
    label: "Point",
    curl: { Index: 0, Middle: 90, Ring: 90, Pinky: 90 },
    thumb: [0, 30, -40],
  },
  {
    id: "open",
    label: "Open Palm",
    curl: { Index: 0, Middle: 0, Ring: 0, Pinky: 0 },
    thumb: [0, 0, 0],
  },
  {
    id: "grip",
    label: "Grip Prop",
    curl: { Index: 62, Middle: 70, Ring: 75, Pinky: 80 },
    thumb: [14, 34, -34],
  },
  {
    id: "peace",
    label: "Peace",
    curl: { Index: 0, Middle: 0, Ring: 90, Pinky: 90 },
    thumb: [0, 30, -40],
  },
];

function buildSingleHand(side: "Left" | "Right", preset: HandPreset): PoseData {
  const out: PoseData = {};
  const isRight = side === "Right";
  for (const f of FINGERS) {
    const c = preset.curl[f] ?? 0;
    for (let n = 1; n <= 3; n++) {
      const v: Rot = [0, 0, (-c * (n === 1 ? 0.8 : 1)) || 0];
      out[`${side}Hand${f}${n}`] = isRight ? mirrorRot(v) : v;
    }
  }
  const [tx, ty, tz] = preset.thumb;
  for (let n = 1; n <= 3; n++) {
    const v: Rot = [tx, ty * (n === 1 ? 1 : 0.5), tz * (n === 1 ? 1 : 0.7)];
    out[`${side}HandThumb${n}`] = isRight ? mirrorRot(v) : v;
  }
  return out;
}

/** Builds a finger-only PoseData map for the chosen side and hand preset. */
export function buildHandPreset(side: HandSide, presetId: HandPresetId): PoseData {
  const preset = HAND_PRESETS.find((p) => p.id === presetId) ?? HAND_PRESETS[0];
  if (side === "Both") {
    return {
      ...buildSingleHand("Left", preset),
      ...buildSingleHand("Right", preset),
    };
  }
  return buildSingleHand(side, preset);
}

/** Applies a 1-click hand preset onto an existing pose without overwriting body limbs. */
export function applyHandPresetToPose(
  current: PoseData,
  side: HandSide,
  presetId: HandPresetId,
): PoseData {
  return {
    ...current,
    ...buildHandPreset(side, presetId),
  };
}


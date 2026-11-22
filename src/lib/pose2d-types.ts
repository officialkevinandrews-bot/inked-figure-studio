import type { Angle2D, Expression2DId, FaceFx2D, RenderMode2D } from "./character2d-types";
import type { SceneDepthLayer } from "./scene2d-types";

export const STAGE2D_W = 1280;
export const STAGE2D_H = 800;

export const JOINT_IDS_2D = [
  "hips",
  "spine",
  "chest",
  "head",
  "upperArmL",
  "forearmL",
  "handL",
  "upperArmR",
  "forearmR",
  "handR",
  "thighL",
  "shinL",
  "footL",
  "thighR",
  "shinR",
  "footR",
] as const;

export type JointId2D = (typeof JOINT_IDS_2D)[number];

export const JOINT_LABELS_2D: Record<JointId2D, string> = {
  hips: "Pelvis Tilt",
  spine: "Waist Bend",
  chest: "Chest Tilt",
  head: "Head Tilt",
  upperArmL: "L Upper Arm",
  forearmL: "L Elbow Bend",
  handL: "L Wrist",
  upperArmR: "R Upper Arm",
  forearmR: "R Elbow Bend",
  handR: "R Wrist",
  thighL: "L Thigh",
  shinL: "L Knee Bend",
  footL: "L Ankle",
  thighR: "R Thigh",
  shinR: "R Knee Bend",
  footR: "R Ankle",
};

export interface Pose2DState {
  joints: Record<JointId2D, number>;
  rootOffsetY: number;
  elbowBendL: 1 | -1;
  elbowBendR: 1 | -1;
  kneeBendL: 1 | -1;
  kneeBendR: 1 | -1;
  limbBehind?: {
    armL?: boolean;
    armR?: boolean;
    legL?: boolean;
    legR?: boolean;
  };
}

export type Pose2DCategory = "everyday" | "action" | "drama" | "custom";

export interface Pose2DPreset {
  id: string;
  name: string;
  category: Pose2DCategory;
  builtIn: boolean;
  createdAt: number;
  pose: Pose2DState;
}

export interface Stage2DActor {
  id: string;
  characterId: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  angle: Angle2D;
  flipX: boolean;
  depth: SceneDepthLayer;
  shadow: boolean;
  visible: boolean;
  expressionOverride?: Expression2DId;
  fxOverride?: FaceFx2D[];
  pose: Pose2DState;
}

export interface Stage2DCamera {
  zoom: number;
  panX: number;
  panY: number;
  tilt: number;
}

export interface Stage2D {
  id: string;
  name: string;
  sceneId: string | null;
  renderMode: RenderMode2D;
  camera: Stage2DCamera;
  actors: Stage2DActor[];
  createdAt: number;
  updatedAt: number;
}

export interface SourceStage2DMetadata {
  stageId: string;
  stageName: string;
  actorId?: string;
  renderMode: RenderMode2D;
  snapshot?: Stage2D;
}

export const ZERO_JOINTS_2D: Record<JointId2D, number> = {
  hips: 0,
  spine: 0,
  chest: 0,
  head: 0,
  upperArmL: 0,
  forearmL: 0,
  handL: 0,
  upperArmR: 0,
  forearmR: 0,
  handR: 0,
  thighL: 0,
  shinL: 0,
  footL: 0,
  thighR: 0,
  shinR: 0,
  footR: 0,
};

export const DEFAULT_POSE_2D: Pose2DState = {
  joints: { ...ZERO_JOINTS_2D },
  rootOffsetY: 0,
  elbowBendL: -1,
  elbowBendR: 1,
  kneeBendL: 1,
  kneeBendR: -1,
};

export function clonePose2D(pose: Pose2DState): Pose2DState {
  return {
    joints: { ...ZERO_JOINTS_2D, ...(pose?.joints ?? {}) },
    rootOffsetY: typeof pose?.rootOffsetY === "number" ? pose.rootOffsetY : 0,
    elbowBendL: pose?.elbowBendL === 1 ? 1 : -1,
    elbowBendR: pose?.elbowBendR === -1 ? -1 : 1,
    kneeBendL: pose?.kneeBendL === -1 ? -1 : 1,
    kneeBendR: pose?.kneeBendR === 1 ? 1 : -1,
    limbBehind: pose?.limbBehind ? { ...pose.limbBehind } : undefined,
  };
}

export function mirrorPose2D(pose: Pose2DState): Pose2DState {
  const j = pose.joints;
  return {
    joints: {
      hips: -j.hips,
      spine: -j.spine,
      chest: -j.chest,
      head: -j.head,
      upperArmL: -j.upperArmR,
      forearmL: -j.forearmR,
      handL: -j.handR,
      upperArmR: -j.upperArmL,
      forearmR: -j.forearmL,
      handR: -j.handL,
      thighL: -j.thighR,
      shinL: -j.shinR,
      footL: -j.footR,
      thighR: -j.thighL,
      shinR: -j.shinL,
      footR: -j.footL,
    },
    rootOffsetY: pose.rootOffsetY,
    elbowBendL: (pose.elbowBendR === 1 ? -1 : 1) as 1 | -1,
    elbowBendR: (pose.elbowBendL === 1 ? -1 : 1) as 1 | -1,
    kneeBendL: (pose.kneeBendR === 1 ? -1 : 1) as 1 | -1,
    kneeBendR: (pose.kneeBendL === 1 ? -1 : 1) as 1 | -1,
    limbBehind: pose.limbBehind
      ? {
          armL: pose.limbBehind.armR,
          armR: pose.limbBehind.armL,
          legL: pose.limbBehind.legR,
          legR: pose.limbBehind.legL,
        }
      : undefined,
  };
}

function makePreset(
  id: string,
  name: string,
  category: Exclude<Pose2DCategory, "custom">,
  joints: Partial<Record<JointId2D, number>>,
  extra?: Partial<Omit<Pose2DState, "joints">>,
): Pose2DPreset {
  return {
    id,
    name,
    category,
    builtIn: true,
    createdAt: 0,
    pose: {
      ...DEFAULT_POSE_2D,
      ...extra,
      joints: { ...ZERO_JOINTS_2D, ...joints },
    },
  };
}

export const BUILTIN_POSE_PRESETS_2D: Pose2DPreset[] = [
  // Everyday (8)
  makePreset("idle-standing", "Idle Standing", "everyday", {}),
  makePreset("relaxed-lean", "Relaxed Contrapposto", "everyday", {
    hips: -5,
    spine: 5,
    chest: 4,
    head: -6,
    upperArmL: 12,
    forearmL: -18,
    upperArmR: -6,
    forearmR: 25,
    thighL: 8,
    shinL: -6,
    thighR: -5,
    shinR: 8,
  }),
  makePreset("hands-on-hips", "Hands on Hips", "everyday", {
    chest: -4,
    head: 4,
    upperArmL: 42,
    forearmL: -96,
    handL: 15,
    upperArmR: -42,
    forearmR: 96,
    handR: -15,
    thighL: 7,
    thighR: -7,
  }),
  makePreset("arms-crossed", "Arms Crossed", "everyday", {
    spine: -2,
    head: 5,
    upperArmL: 24,
    forearmL: -102,
    handL: -15,
    upperArmR: -22,
    forearmR: 100,
    handR: 15,
    thighL: 6,
    thighR: -6,
  }),
  makePreset(
    "walking-stride",
    "Walking Stride",
    "everyday",
    {
      hips: -4,
      spine: 4,
      chest: 4,
      head: -3,
      upperArmL: 24,
      forearmL: -32,
      upperArmR: 18,
      forearmR: 28,
      thighL: 26,
      shinL: -22,
      footL: 12,
      thighR: -24,
      shinR: 20,
      footR: -10,
    },
    { rootOffsetY: 12 },
  ),
  makePreset(
    "sitting-chair",
    "Sitting / Perched",
    "everyday",
    {
      hips: 8,
      spine: -8,
      chest: -4,
      head: 4,
      upperArmL: 18,
      forearmL: -62,
      upperArmR: -18,
      forearmR: 62,
      thighL: 74,
      shinL: -82,
      footL: 12,
      thighR: -68,
      shinR: 78,
      footR: -12,
    },
    { rootOffsetY: 118 },
  ),
  makePreset("waving-hello", "Waving Hello", "everyday", {
    spine: 5,
    head: -8,
    upperArmL: 14,
    forearmL: -22,
    upperArmR: -135,
    forearmR: 48,
    handR: -15,
    thighL: 6,
    thighR: -8,
  }),
  makePreset("pointing-forward", "Confident Point", "everyday", {
    hips: -6,
    spine: 6,
    chest: 5,
    head: -6,
    upperArmL: 26,
    forearmL: -86,
    upperArmR: -82,
    forearmR: 12,
    thighL: 10,
    thighR: -12,
  }),

  // Action (8)
  makePreset(
    "battle-stance",
    "Battle Stance",
    "action",
    {
      hips: 7,
      spine: 10,
      chest: 8,
      head: -10,
      upperArmL: 58,
      forearmL: -108,
      upperArmR: -44,
      forearmR: 88,
      thighL: 34,
      shinL: -42,
      footL: 14,
      thighR: -32,
      shinR: 38,
      footR: -12,
    },
    { rootOffsetY: 48 },
  ),
  makePreset(
    "full-sprint",
    "Full Dash / Sprint",
    "action",
    {
      hips: 18,
      spine: 18,
      chest: 12,
      head: -22,
      upperArmL: 68,
      forearmL: -82,
      upperArmR: -56,
      forearmR: 92,
      thighL: 52,
      shinL: -72,
      footL: 18,
      thighR: -48,
      shinR: 62,
      footR: -15,
    },
    { rootOffsetY: 36 },
  ),
  makePreset(
    "midair-jump",
    "Mid-Air Leap",
    "action",
    {
      hips: -8,
      spine: -8,
      chest: 6,
      head: 8,
      upperArmL: 132,
      forearmL: -28,
      upperArmR: -126,
      forearmR: 34,
      thighL: 64,
      shinL: -96,
      footL: 22,
      thighR: -42,
      shinR: 68,
      footR: 18,
    },
    { rootOffsetY: -65 },
  ),
  makePreset(
    "power-punch",
    "Power Cross Punch",
    "action",
    {
      hips: 10,
      spine: 14,
      chest: 10,
      head: -16,
      upperArmL: 42,
      forearmL: -115,
      upperArmR: -94,
      forearmR: 8,
      thighL: 36,
      shinL: -38,
      thighR: -36,
      shinR: 26,
    },
    { rootOffsetY: 38 },
  ),
  makePreset(
    "high-kick",
    "Dynamic High Kick",
    "action",
    {
      hips: -24,
      spine: -12,
      chest: -8,
      head: 16,
      upperArmL: 55,
      forearmL: -85,
      upperArmR: -62,
      forearmR: 72,
      thighL: 108,
      shinL: -14,
      footL: -20,
      thighR: -12,
      shinR: 16,
    },
    { rootOffsetY: -18 },
  ),
  makePreset(
    "sword-slash",
    "Heavy Slash Swing",
    "action",
    {
      hips: 12,
      spine: 15,
      chest: 12,
      head: -18,
      upperArmL: -32,
      forearmL: -58,
      upperArmR: -122,
      forearmR: 36,
      handR: 28,
      thighL: 38,
      shinL: -46,
      thighR: -34,
      shinR: 32,
    },
    { rootOffsetY: 42 },
  ),
  makePreset(
    "superhero-crouch",
    "Low Landing Crouch",
    "action",
    {
      hips: 16,
      spine: 20,
      chest: 14,
      head: -26,
      upperArmL: 34,
      forearmL: -18,
      upperArmR: -56,
      forearmR: 22,
      thighL: 78,
      shinL: -102,
      footL: 20,
      thighR: -58,
      shinR: 84,
      footR: -15,
    },
    { rootOffsetY: 145 },
  ),
  makePreset(
    "guard-block",
    "Crossed Guard Block",
    "action",
    {
      hips: 5,
      spine: 8,
      chest: 6,
      head: -10,
      upperArmL: -22,
      forearmL: -116,
      upperArmR: 28,
      forearmR: 112,
      thighL: 24,
      shinL: -28,
      thighR: -26,
      shinR: 24,
    },
    { rootOffsetY: 32 },
  ),

  // Drama (2)
  makePreset(
    "shocked-recoil",
    "Shocked Recoil",
    "drama",
    {
      hips: -10,
      spine: -14,
      chest: -10,
      head: -12,
      upperArmL: 82,
      forearmL: -92,
      upperArmR: -84,
      forearmR: 92,
      thighL: 22,
      shinL: -24,
      thighR: -16,
      shinR: 28,
    },
    { rootOffsetY: 14 },
  ),
  makePreset(
    "victory-cheer",
    "Victory Cheer",
    "drama",
    {
      spine: -6,
      chest: -6,
      head: -10,
      upperArmL: 145,
      forearmL: -24,
      upperArmR: -148,
      forearmR: 24,
      thighL: 16,
      shinL: -22,
      thighR: -14,
      shinR: 18,
    },
    { rootOffsetY: -24 },
  ),
];

export function createDefaultStage2D(
  name = "Stage #1",
  sceneId: string | null = "scene-cozy-bedroom",
  characterId = "",
  characterName = "Hero #1",
): Stage2D {
  const now = Date.now();
  return {
    id: `stage2d-${now}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    sceneId,
    renderMode: "color",
    camera: {
      zoom: 1,
      panX: 0,
      panY: 0,
      tilt: 0,
    },
    actors: characterId
      ? [
          {
            id: `actor2d-${now}-1`,
            characterId,
            name: characterName,
            x: Math.round(STAGE2D_W * 0.5),
            y: Math.round(STAGE2D_H * 0.88),
            scale: 0.62,
            angle: 0,
            flipX: false,
            depth: "midground",
            shadow: true,
            visible: true,
            pose: clonePose2D(DEFAULT_POSE_2D),
          },
        ]
      : [],
    createdAt: now,
    updatedAt: now,
  };
}

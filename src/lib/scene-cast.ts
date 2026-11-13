import type { PoseData } from "./rig";
import type { FaceConfig } from "./face-library";
import type { Outfit } from "./wardrobe";
import type { ActiveProp } from "./props";
import type { VRM } from "@pixiv/three-vrm";
import type * as THREE from "three";
import type { Rig } from "./rig";
import type { CustomAsset } from "@/components/studio/WardrobeRig";

export interface SerializedActorPose {
  id: string;
  characterId: string | null;
  name: string;
  modelKey: string;
  position: [number, number, number];
  rotationY: number; // degrees
  pose: PoseData;
  hipsDrop: number;
  vrmExpressions?: Record<string, number>;
}

export interface StagedActor {
  id: string;
  characterId: string | null;
  name: string;
  modelKey: string;
  position: [number, number, number];
  rotationY: number; // degrees
  pose: PoseData;
  hipsDrop: number;
  face: FaceConfig;
  outfit: Outfit;
  props: ActiveProp[];
  vrmExpressions: Record<string, number>;
  visible: boolean;
  // Runtime Three.js objects (null while loading)
  model: THREE.Object3D | null;
  rig: Rig | null;
  vrm: VRM | null;
  wardrobeAssets: Record<string, CustomAsset>;
}

const STAGE_SLOTS: [number, number, number][] = [
  [0, 0, 0],
  [0.85, 0, -0.25],
  [-0.85, 0, -0.25],
  [1.45, 0, -0.55],
  [-1.45, 0, -0.55],
];

/** Returns a default staggered floor placement so newly added cast members don't overlap. */
export function nextStagePosition(existingCount: number): [number, number, number] {
  if (existingCount < STAGE_SLOTS.length) {
    return [...STAGE_SLOTS[existingCount]];
  }
  const offset = existingCount - STAGE_SLOTS.length + 1;
  return [offset % 2 === 0 ? -0.6 * offset : 0.6 * offset, 0, -0.5 * offset];
}

export function serializeCastForSnapshot(actors: StagedActor[]): SerializedActorPose[] {
  return actors.map((a) => ({
    id: a.id,
    characterId: a.characterId,
    name: a.name,
    modelKey: a.modelKey,
    position: [...a.position],
    rotationY: a.rotationY,
    pose: { ...a.pose },
    hipsDrop: a.hipsDrop,
    vrmExpressions: { ...a.vrmExpressions },
  }));
}


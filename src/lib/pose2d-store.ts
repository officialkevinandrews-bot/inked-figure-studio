import {
  BUILTIN_POSE_PRESETS_2D,
  createDefaultStage2D,
  type Pose2DPreset,
  type Stage2D,
} from "./pose2d-types";
import { userLsGet, userLsSet } from "./user-storage";

export const STAGES_2D_STORAGE_KEY = "koma-stages-2d";
export const POSES_2D_STORAGE_KEY = "koma-poses-2d";

export function loadStages2D(): Stage2D[] {
  try {
    const raw = userLsGet(STAGES_2D_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStages2D(list: Stage2D[]): boolean {
  return userLsSet(STAGES_2D_STORAGE_KEY, JSON.stringify(list), "workspace");
}

export function ensureStages2DInitialized(
  defaultCharacterId = "",
  defaultCharacterName = "Hero #1",
  defaultSceneId: string | null = "scene-cozy-bedroom",
): Stage2D[] {
  const existing = loadStages2D();
  if (existing.length > 0) return existing;
  const starter = createDefaultStage2D(
    "Stage #1",
    defaultSceneId,
    defaultCharacterId,
    defaultCharacterName,
  );
  saveStages2D([starter]);
  return [starter];
}

export function upsertStage2D(list: Stage2D[], item: Stage2D): Stage2D[] {
  const stamped = { ...item, updatedAt: Date.now() };
  const next = list.some((s) => s.id === item.id)
    ? list.map((s) => (s.id === item.id ? stamped : s))
    : [stamped, ...list];
  saveStages2D(next);
  return next;
}

export function removeStage2D(list: Stage2D[], id: string): Stage2D[] {
  const next = list.filter((s) => s.id !== id);
  saveStages2D(next);
  return next;
}

export function loadCustomPoses2D(): Pose2DPreset[] {
  try {
    const raw = userLsGet(POSES_2D_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPoses2D(list: Pose2DPreset[]): boolean {
  return userLsSet(POSES_2D_STORAGE_KEY, JSON.stringify(list), "workspace");
}

export function getAllPoses2D(): Pose2DPreset[] {
  return [...BUILTIN_POSE_PRESETS_2D, ...loadCustomPoses2D()];
}

export function upsertCustomPose2D(list: Pose2DPreset[], item: Pose2DPreset): Pose2DPreset[] {
  const next = list.some((p) => p.id === item.id)
    ? list.map((p) => (p.id === item.id ? item : p))
    : [item, ...list];
  saveCustomPoses2D(next);
  return next;
}

export function removeCustomPose2D(list: Pose2DPreset[], id: string): Pose2DPreset[] {
  const next = list.filter((p) => p.id !== id);
  saveCustomPoses2D(next);
  return next;
}

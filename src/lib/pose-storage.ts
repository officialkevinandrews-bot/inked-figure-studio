import type { Pose, PoseData } from "./rig";

const STORAGE_KEY = "inked_figure_studio_custom_poses_v1";

export interface CustomPose extends Pose {
  thumbnail?: string; // base64 preview
  createdAt: number;
}

export function loadCustomPoses(): CustomPose[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("Failed to load custom poses from storage:", err);
    return [];
  }
}

export function saveCustomPose(
  name: string,
  category: string,
  bones: PoseData,
  hipsDrop = 0,
  thumbnail?: string
): CustomPose {
  const customPoses = loadCustomPoses();
  const id = `custom-${Date.now()}-${name.toLowerCase().replace(/\W+/g, "-")}`;
  const newPose: CustomPose = {
    id,
    name: name.trim() || "Untitled Pose",
    category: category.trim() || "Custom",
    bones: { ...bones },
    hipsDrop,
    thumbnail,
    createdAt: Date.now(),
  };

  const updated = [newPose, ...customPoses];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to persist custom pose to storage:", err);
  }
  return newPose;
}

export function deleteCustomPose(id: string): CustomPose[] {
  const customPoses = loadCustomPoses();
  const updated = customPoses.filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to delete custom pose from storage:", err);
  }
  return updated;
}

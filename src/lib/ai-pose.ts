import { CANONICAL_BONES, type PoseData } from "./rig";

export const AI_POSE_BONES = CANONICAL_BONES;
export interface AiPoseResult { bones: PoseData; hipsDrop: number; note: string }

const clamp = (n: unknown, lo: number, hi: number) => { const v = Number(n); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0; };

/** Keeps only known bones with three finite angles (clamped to ±180°) and a sane hip drop. */
export function sanitizeAiPose(raw: unknown): AiPoseResult {
  const o = (raw ?? {}) as { bones?: Record<string, unknown>; hipsDrop?: unknown; note?: unknown };
  const allowed = new Set<string>(CANONICAL_BONES);
  const bones: PoseData = {};
  for (const [k, v] of Object.entries(o.bones ?? {})) {
    if (!allowed.has(k) || !Array.isArray(v) || v.length !== 3) continue;
    bones[k] = [clamp(v[0], -180, 180), clamp(v[1], -180, 180), clamp(v[2], -180, 180)];
  }
  return { bones, hipsDrop: clamp(o.hipsDrop, -0.6, 1.2), note: typeof o.note === "string" ? o.note.slice(0, 200) : "" };
}

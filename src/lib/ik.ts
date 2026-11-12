import * as THREE from "three";
import { offsetFromBone, type PoseData, type Rig } from "./rig";

/** Bones that can be dragged by position in IK mode, with the chain (root→end, excluding the effector) they bend. */
export const IK_CHAINS: Record<string, string[]> = {
  LeftHand: ["LeftArm", "LeftForeArm"],
  RightHand: ["RightArm", "RightForeArm"],
  LeftFoot: ["LeftUpLeg", "LeftLeg"],
  RightFoot: ["RightUpLeg", "RightLeg"],
  Head: ["Spine", "Spine1", "Spine2", "Neck"],
};
export const IK_EFFECTORS = [...Object.keys(IK_CHAINS), "Hips"];

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion();

/** CCD solve: rotate chain bones so `effector` reaches world-space `target`. Mutates bone quaternions. */
export function solveCCD(rig: Rig, effector: string, target: THREE.Vector3, iterations = 12) {
  const chain = (IK_CHAINS[effector] ?? []).map((n) => rig.bones.get(n)).filter(Boolean) as THREE.Bone[];
  const end = rig.bones.get(effector);
  if (!end || !chain.length) return;
  for (let it = 0; it < iterations; it++) {
    for (let i = chain.length - 1; i >= 0; i--) {
      const bone = chain[i]!;
      bone.updateWorldMatrix(true, true);
      bone.getWorldPosition(_a);
      end.getWorldPosition(_b);
      const toEnd = _b.sub(_a).normalize();
      const toTarget = _c.copy(target).sub(_a).normalize();
      const angle = toEnd.angleTo(toTarget);
      if (angle < 1e-4) continue;
      _q.setFromUnitVectors(toEnd, toTarget);
      // limit per-step rotation for stability
      if (angle > 0.5) _q.slerp(new THREE.Quaternion(), 1 - 0.5 / angle);
      bone.getWorldQuaternion(_wq);
      bone.parent!.getWorldQuaternion(_pq);
      bone.quaternion.copy(_pq.invert().multiply(_q).multiply(_wq));
    }
    end.updateWorldMatrix(true, false);
    if (end.getWorldPosition(_b).distanceTo(target) < 0.001 * rig.scale) break;
  }
}

/** Reads chain bone rotations back into pose offsets. */
export function chainOffsets(rig: Rig, effector: string): PoseData {
  const out: PoseData = {};
  for (const n of IK_CHAINS[effector] ?? []) if (rig.bones.has(n)) out[n] = offsetFromBone(rig, n);
  return out;
}

/** Re-solve legs so feet return to the given world positions (used when hips move). */
export function pinFeet(rig: Rig, feet: Partial<Record<"LeftFoot" | "RightFoot", THREE.Vector3>>): PoseData {
  let out: PoseData = {};
  for (const f of ["LeftFoot", "RightFoot"] as const) {
    const p = feet[f];
    if (!p) continue;
    solveCCD(rig, f, p, 20);
    out = { ...out, ...chainOffsets(rig, f) };
  }
  return out;
}

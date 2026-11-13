import * as THREE from "three";

/** Euler offsets in degrees, expressed in the character's model frame
 *  (Y up, character faces +Z, character's left is +X), applied on top of the rest (T) pose. */
export type Rot = [number, number, number];
export type PoseData = Record<string, Rot>;
export interface Pose {
  id: string;
  name: string;
  category: string;
  bones: PoseData;
  hipsDrop?: number; // metres on a 1.8m-tall character
  partial?: boolean; // merge onto the current pose (hand gestures)
}

export const CANONICAL_BONES = [
  "Hips", "Spine", "Spine1", "Spine2", "Neck", "Head",
  ...["Left", "Right"].flatMap((s) => [
    `${s}Shoulder`, `${s}Arm`, `${s}ForeArm`, `${s}Hand`,
    `${s}UpLeg`, `${s}Leg`, `${s}Foot`, `${s}ToeBase`,
    ...["Thumb", "Index", "Middle", "Ring", "Pinky"].flatMap((f) => [1, 2, 3].map((n) => `${s}Hand${f}${n}`)),
  ]),
];

const ALIASES: Record<string, string> = {
  pelvis: "Hips", hip: "Hips", chest: "Spine1", upperchest: "Spine2",
  leftupperarm: "LeftArm", rightupperarm: "RightArm", leftlowerarm: "LeftForeArm", rightlowerarm: "RightForeArm",
  leftupperleg: "LeftUpLeg", rightupperleg: "RightUpLeg", leftlowerleg: "LeftLeg", rightlowerleg: "RightLeg",
  lefttoes: "LeftToeBase", righttoes: "RightToeBase",
};
const CANON_LOWER = new Map(CANONICAL_BONES.map((b) => [b.toLowerCase(), b]));

/** Maps Mixamo-style names ("mixamorig:LeftArm", "mixamorig1LeftArm", "mixamorig_LeftArm") to canonical names. */
export function canonicalBoneName(raw: string): string | null {
  const stripped = raw.replace(/^.*?mixamorig\d*[:_]?/i, "").replace(/[:_\s.]/g, "");
  const key = stripped.toLowerCase();
  return CANON_LOWER.get(key) ?? ALIASES[key] ?? null;
}

export function mirrorRot([x, y, z]: Rot): Rot {
  return [x, y === 0 ? 0 : -y, z === 0 ? 0 : -z];
}

export function mirrorBoneName(name: string) {
  if (name.startsWith("Left")) return "Right" + name.slice(4);
  if (name.startsWith("Right")) return "Left" + name.slice(5);
  return name;
}

/** Mirror a pose across the character's centre plane. */
export function mirrorPose(p: PoseData): PoseData {
  const out: PoseData = {};
  for (const [k, v] of Object.entries(p)) out[mirrorBoneName(k)] = mirrorRot(v);
  return out;
}

export interface Rig {
  root: THREE.Object3D;
  bones: Map<string, THREE.Bone>;
  restLocal: Map<string, THREE.Quaternion>;
  restModel: Map<string, THREE.Quaternion>;
  hipsRestWorld: THREE.Vector3 | null;
  hipsRestLocal: THREE.Vector3 | null;
  scale: number;
  unmapped: number;
}

export function buildRig(root: THREE.Object3D, scale: number): Rig {
  root.updateMatrixWorld(true);
  const bones = new Map<string, THREE.Bone>();
  let unmapped = 0;
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      const c = canonicalBoneName(o.name);
      if (c && !bones.has(c)) bones.set(c, o as THREE.Bone);
      else if (!c) unmapped++;
    }
  });
  const rootInv = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const restLocal = new Map<string, THREE.Quaternion>();
  const restModel = new Map<string, THREE.Quaternion>();
  bones.forEach((b, k) => {
    restLocal.set(k, b.quaternion.clone());
    restModel.set(k, rootInv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())));
  });
  const hips = bones.get("Hips");
  return {
    root, bones, restLocal, restModel, scale, unmapped,
    hipsRestWorld: hips ? hips.getWorldPosition(new THREE.Vector3()) : null,
    hipsRestLocal: hips ? hips.position.clone() : null,
  };
}

const D = THREE.MathUtils.DEG2RAD;
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export function applyPose(rig: Rig, pose: PoseData, hipsDrop = 0) {
  rig.bones.forEach((bone, name) => {
    const rest = rig.restLocal.get(name)!;
    const R = rig.restModel.get(name)!;
    const r = pose[name];
    if (!r) { bone.quaternion.copy(rest); return; }
    _q.setFromEuler(_e.set(r[0] * D, r[1] * D, r[2] * D, "XYZ"));
    // local = rest * R^-1 * O * R
    bone.quaternion.copy(rest).multiply(R.clone().invert().multiply(_q).multiply(R));
  });
  const hips = rig.bones.get("Hips");
  if (hips && rig.hipsRestWorld && rig.hipsRestLocal && hips.parent) {
    if (!hipsDrop) hips.position.copy(rig.hipsRestLocal);
    else {
      const p = rig.hipsRestWorld.clone();
      p.y -= hipsDrop * rig.scale;
      hips.parent.updateWorldMatrix(true, false);
      hips.position.copy(hips.parent.worldToLocal(p));
    }
  }
}

/** Inverse of applyPose for one bone: read its current local rotation back into model-frame degrees. */
export function offsetFromBone(rig: Rig, name: string): Rot {
  const bone = rig.bones.get(name)!;
  const rest = rig.restLocal.get(name)!;
  const R = rig.restModel.get(name)!;
  const O = R.clone().multiply(rest.clone().invert().multiply(bone.quaternion)).multiply(R.clone().invert());
  _e.setFromQuaternion(O, "XYZ");
  const r = (v: number) => Math.round(v / D);
  return [r(_e.x), r(_e.y), r(_e.z)];
}

/** Hip drop that puts the lowest foot/toe back on the rest-pose floor level (leaves the rig posed). */
export function groundedHipsDrop(rig: Rig, pose: PoseData, hipsDrop: number): number {
  const feet = ["LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"].map((n) => rig.bones.get(n)).filter(Boolean) as THREE.Bone[];
  if (!feet.length || !rig.scale) return hipsDrop;
  const v = new THREE.Vector3();
  const lowest = () => { rig.root.updateMatrixWorld(true); return Math.min(...feet.map((b) => b.getWorldPosition(v).y)); };
  applyPose(rig, {}, 0);
  const rest = lowest();
  applyPose(rig, pose, hipsDrop);
  const posed = lowest();
  return hipsDrop + (posed - rest) / rig.scale;
}

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { buildRig, type Rig } from "./rig";

export interface LoadedCharacter {
  object: THREE.Object3D;
  rig: Rig | null;
  vrm?: VRM;
  type: "fbx" | "vrm" | "gltf" | "obj" | "static";
  name: string;
  hasSkeleton: boolean;
}

/** VRM bone name to canonical bone map */
const VRM_TO_CANONICAL: Record<string, string> = {
  hips: "Hips",
  spine: "Spine",
  chest: "Spine1",
  upperChest: "Spine2",
  neck: "Neck",
  head: "Head",
  leftShoulder: "LeftShoulder",
  leftUpperArm: "LeftArm",
  leftLowerArm: "LeftForeArm",
  leftHand: "LeftHand",
  rightShoulder: "RightShoulder",
  rightUpperArm: "RightArm",
  rightLowerArm: "RightForeArm",
  rightHand: "RightHand",
  leftUpperLeg: "LeftUpLeg",
  leftLowerLeg: "LeftLeg",
  leftFoot: "LeftFoot",
  leftToes: "LeftToeBase",
  rightUpperLeg: "RightUpLeg",
  rightLowerLeg: "RightLeg",
  rightFoot: "RightFoot",
  rightToes: "RightToeBase",
  // Fingers
  leftThumbMetacarpal: "LeftHandThumb1",
  leftThumbProximal: "LeftHandThumb2",
  leftThumbDistal: "LeftHandThumb3",
  leftIndexProximal: "LeftHandIndex1",
  leftIndexIntermediate: "LeftHandIndex2",
  leftIndexDistal: "LeftHandIndex3",
  leftMiddleProximal: "LeftHandMiddle1",
  leftMiddleIntermediate: "LeftHandMiddle2",
  leftMiddleDistal: "LeftHandMiddle3",
  leftRingProximal: "LeftHandRing1",
  leftRingIntermediate: "LeftHandRing2",
  leftRingDistal: "LeftHandRing3",
  leftLittleProximal: "LeftHandPinky1",
  leftLittleIntermediate: "LeftHandPinky2",
  leftLittleDistal: "LeftHandPinky3",

  rightThumbMetacarpal: "RightHandThumb1",
  rightThumbProximal: "RightHandThumb2",
  rightThumbDistal: "RightHandThumb3",
  rightIndexProximal: "RightHandIndex1",
  rightIndexIntermediate: "RightHandIndex2",
  rightIndexDistal: "RightHandIndex3",
  rightMiddleProximal: "RightHandMiddle1",
  rightMiddleIntermediate: "RightHandMiddle2",
  rightMiddleDistal: "RightHandMiddle3",
  rightRingProximal: "RightHandRing1",
  rightRingIntermediate: "RightHandRing2",
  rightRingDistal: "RightHandRing3",
  rightLittleProximal: "RightHandPinky1",
  rightLittleIntermediate: "RightHandPinky2",
  rightLittleDistal: "RightHandPinky3",
};

/** Normalises an object to ~1.8 units high with feet at Y=0 and centered on X/Z */
export function normaliseModel(obj: THREE.Object3D, targetHeight = 1.8): number {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const h = size.y || 1;
  const scale = targetHeight / h;
  obj.scale.multiplyScalar(scale);
  obj.updateMatrixWorld(true);

  const b2 = new THREE.Box3().setFromObject(obj);
  const center = b2.getCenter(new THREE.Vector3());
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= b2.min.y;
  obj.updateMatrixWorld(true);
  return scale;
}

/** Loads 3D models with format detection (.fbx, .vrm, .glb, .gltf, .obj) */
export async function loadCharacterModel(
  url: string,
  ext: string,
  name: string
): Promise<LoadedCharacter> {
  const cleanExt = ext.toLowerCase().replace(/^\./, "");

  if (cleanExt === "vrm") {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM;
    if (vrm) {
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      // Ensure VRM humanoid bones have canonical names for our FK rig
      if (vrm.humanoid) {
        Object.entries(VRM_TO_CANONICAL).forEach(([vrmBone, canon]) => {
          const node = vrm.humanoid?.getNormalizedBoneNode(vrmBone as any) ??
            vrm.humanoid?.getRawBoneNode(vrmBone as any);
          if (node) {
            node.name = canon;
          }
        });
      }
      const scale = normaliseModel(vrm.scene);
      const rig = buildRig(vrm.scene, scale);
      return {
        object: vrm.scene,
        rig: rig.bones.size >= 10 ? rig : null,
        vrm,
        type: "vrm",
        name,
        hasSkeleton: rig.bones.size >= 10,
      };
    }
  }

  if (cleanExt === "fbx") {
    const loader = new FBXLoader();
    const obj = await loader.loadAsync(url);
    const scale = normaliseModel(obj);
    const rig = buildRig(obj, scale);
    return {
      object: obj,
      rig: rig.bones.size >= 10 ? rig : null,
      type: "fbx",
      name,
      hasSkeleton: rig.bones.size >= 10,
    };
  }

  if (cleanExt === "obj") {
    const loader = new OBJLoader();
    const obj = await loader.loadAsync(url);
    normaliseModel(obj);
    return {
      object: obj,
      rig: null,
      type: "obj",
      name,
      hasSkeleton: false,
    };
  }

  // Default: GLTF / GLB
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const obj = gltf.scene;
  const scale = normaliseModel(obj);
  const rig = buildRig(obj, scale);
  return {
    object: obj,
    rig: rig.bones.size >= 10 ? rig : null,
    type: "gltf",
    name,
    hasSkeleton: rig.bones.size >= 10,
  };
}


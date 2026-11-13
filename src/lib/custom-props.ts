import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

const CUSTOM_PROPS_KEY = "koma-custom-props-v1";

export interface CustomPropMeta {
  id: string; // e.g. "customprop:uuid"
  name: string;
  fileId: string; // stored in IndexedDB "koma-files"
  ext: "glb" | "gltf" | "fbx" | "obj";
  defaultBone: string;
}

export function loadCustomPropsMeta(): CustomPropMeta[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PROPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPropsMeta(list: CustomPropMeta[]): boolean {
  try {
    localStorage.setItem(CUSTOM_PROPS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function upsertCustomPropMeta(list: CustomPropMeta[], item: CustomPropMeta): CustomPropMeta[] {
  const next = list.filter((x) => x.id !== item.id);
  return [item, ...next];
}

export function deleteCustomPropMeta(list: CustomPropMeta[], id: string): CustomPropMeta[] {
  return list.filter((x) => x.id !== id);
}

export function detectPropExtension(fileName: string): CustomPropMeta["ext"] | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "glb" || ext === "gltf" || ext === "fbx" || ext === "obj") return ext;
  return null;
}

/** Loads a custom 3D prop asset from Blob/File and normalizes it to ~0.45m size with shadows enabled. */
export async function loadCustomPropObject(
  blob: Blob,
  fileName: string,
): Promise<THREE.Object3D> {
  const ext = detectPropExtension(fileName) ?? "glb";
  const url = URL.createObjectURL(blob);
  try {
    let root: THREE.Object3D;
    if (ext === "fbx") {
      root = await new FBXLoader().loadAsync(url);
    } else if (ext === "obj") {
      root = await new OBJLoader().loadAsync(url);
    } else {
      const gltf = await new GLTFLoader().loadAsync(url);
      root = gltf.scene;
    }

    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 0.45 / maxDim;

    const wrapper = new THREE.Group();
    wrapper.name = fileName.replace(/\.[^.]+$/, "");
    root.position.sub(center);
    root.scale.multiplyScalar(scale);
    wrapper.add(root);

    wrapper.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    return wrapper;
  } finally {
    URL.revokeObjectURL(url);
  }
}


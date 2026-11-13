import * as THREE from "three";
import shonen from "@/assets/models/shonen_base.fbx.asset.json";
import type { FaceCalibration } from "./face-library";

/** Bodies that ship with the studio. Uploaded bodies use "file:<id>" keys stored in the browser file store. */
export interface BuiltinModel {
  key: string;
  name: string;
  url: string;
  fallbackUrl?: string;
  ext: string;
}

export interface CustomBaseModel {
  id: string;
  key: string; // "file:<id>"
  name: string;
  ext: string;
  addedAt: number;
  boneCount?: number;
  hasFullHands?: boolean;
  skinMaterials?: string[];
  defaultCalib?: FaceCalibration;
}

export const BUILTIN_MODELS: BuiltinModel[] = [
  { key: "builtin:xbot", name: "X Bot (demo)", url: "/models/xbot.glb", ext: "glb" },
  {
    key: "builtin:shonen-base",
    name: "Shonen Hero Base",
    url: "/models/shonen_base.fbx",
    fallbackUrl: shonen.url,
    ext: "fbx",
  },
];

export const builtinModel = (key: string) => BUILTIN_MODELS.find((m) => m.key === key);
export const isBuiltinModel = (key: string) => key.startsWith("builtin:") && !!builtinModel(key);

export const SKIN_SWATCHES = ["#fff0e5", "#f9dcc8", "#f0c5a6", "#dfa57d", "#c6855c", "#9e613e", "#734229", "#4b2b1a"];

const BASE_MODELS_KEY = "koma-base-models";

export function loadBaseModels(): CustomBaseModel[] {
  try {
    const raw = localStorage.getItem(BASE_MODELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomBaseModel[];
    return Array.isArray(parsed) ? parsed.filter((m) => m && m.key?.startsWith("file:")) : [];
  } catch {
    return [];
  }
}

export function saveBaseModels(list: CustomBaseModel[]): boolean {
  try {
    localStorage.setItem(BASE_MODELS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function upsertBaseModel(list: CustomBaseModel[], entry: CustomBaseModel): CustomBaseModel[] {
  const without = list.filter((m) => m.key !== entry.key);
  return [entry, ...without];
}

export function renameBaseModel(list: CustomBaseModel[], key: string, name: string): CustomBaseModel[] {
  const clean = name.trim();
  if (!clean) return list;
  return list.map((m) => (m.key === key ? { ...m, name: clean } : m));
}

export function removeBaseModel(list: CustomBaseModel[], key: string): CustomBaseModel[] {
  return list.filter((m) => m.key !== key);
}

/** Ensures any uploaded `file:<id>` bodies referenced by characters also appear in the persistent base model library. */
export function reconcileBaseModels(
  library: CustomBaseModel[],
  chars: { model: string; modelName: string }[],
): CustomBaseModel[] {
  const byKey = new Map(library.map((m) => [m.key, m]));
  let changed = false;
  for (const c of chars) {
    if (c.model.startsWith("file:") && !byKey.has(c.model)) {
      const ext = c.modelName.split(".").pop()?.toLowerCase() ?? "glb";
      byKey.set(c.model, {
        id: c.model,
        key: c.model,
        name: c.modelName,
        ext,
        addedAt: Date.now(),
      });
      changed = true;
    }
  }
  return changed ? [...byKey.values()] : library;
}

/** Every distinct uploaded body from the persistent library + any legacy character references. */
export function uploadedBodies(
  chars: { model: string; modelName: string }[],
  library: CustomBaseModel[] = [],
) {
  const seen = new Map<string, string>();
  for (const m of library) {
    if (m.key.startsWith("file:")) seen.set(m.key, m.name);
  }
  for (const c of chars) {
    if (c.model.startsWith("file:") && !seen.has(c.model)) seen.set(c.model, c.modelName);
  }
  return [...seen].map(([key, name]) => ({ key, name }));
}

const SKIN_POSITIVE_RE = /(skin|body|face|head|flesh|surface|torso|limb|arm|leg|hand|foot|neck|ear|nose|human|ch\d+)/i;
const SKIN_EXCLUDE_RE = /(joint|eye|iris|pupil|cornea|sclera|lash|brow|teeth|tooth|tongue|mouth_in|hair|wig|cloth|shirt|coat|jacket|top|pant|jean|short|skirt|dress|shoe|boot|sneaker|sock|glove|belt|armor|metal|weapon|sword|hat|cap|glasses|glass|strap|button|zipper|outline)/i;

/** Returns distinct material (or fallback mesh) identifiers on a 3D character root. */
export function collectMaterialNames(root: THREE.Object3D): string[] {
  const names = new Set<string>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat, idx) => {
      const id = mat?.name?.trim() || `${m.name || "mesh"}#${idx}`;
      names.add(id);
    });
  });
  return [...names];
}

/** Auto-detects which materials on a base model represent bare body/skin so eyes/hair/cloth aren't tinted accidentally. */
export function detectSkinMaterials(root: THREE.Object3D): { all: string[]; targets: string[]; isSingleMaterial: boolean } {
  const all = collectMaterialNames(root);
  if (all.length <= 1) {
    return { all, targets: all, isSingleMaterial: true };
  }
  const positive = all.filter((n) => SKIN_POSITIVE_RE.test(n) && !SKIN_EXCLUDE_RE.test(n));
  if (positive.length > 0) {
    return { all, targets: positive, isSingleMaterial: false };
  }
  const nonExcluded = all.filter((n) => !SKIN_EXCLUDE_RE.test(n));
  return {
    all,
    targets: nonExcluded.length > 0 ? nonExcluded : [all[0]!],
    isSingleMaterial: false,
  };
}

export function shouldTintMaterial(
  matIdentifier: string,
  allMaterialNames: string[],
  explicitTargets?: string[],
): boolean {
  if (explicitTargets && explicitTargets.length > 0) {
    return explicitTargets.includes(matIdentifier);
  }
  if (allMaterialNames.length <= 1) return true;
  if (SKIN_POSITIVE_RE.test(matIdentifier) && !SKIN_EXCLUDE_RE.test(matIdentifier)) return true;
  const anyPositive = allMaterialNames.some((n) => SKIN_POSITIVE_RE.test(n) && !SKIN_EXCLUDE_RE.test(n));
  if (anyPositive) return false;
  return !SKIN_EXCLUDE_RE.test(matIdentifier);
}

import {
  ANGLES_2D,
  createDefaultCharacter2D,
  type Angle2D,
  type BaseModel2D,
  type Character2D,
  type CustomPartAsset2D,
} from "./character2d-types";
import { BUILTIN_MODEL_MALE_ATHLETIC_V1, MODEL1_ANCHORS } from "./character2d-model1";
import { deleteFile, getFile, putFile } from "./file-store";
import { userLsGet, userLsSet } from "./user-storage";

export const CHAR2D_STORAGE_KEY = "koma-characters-2d";
export const BASE_MODELS_2D_STORAGE_KEY = "koma-base-models-2d";
export const PARTS_2D_STORAGE_KEY = "koma-parts-2d";

const IDB_PREFIX = "idb://";

export function loadCharacters2D(): Character2D[] {
  try {
    const raw = userLsGet(CHAR2D_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCharacters2D(list: Character2D[]): boolean {
  return userLsSet(CHAR2D_STORAGE_KEY, JSON.stringify(list), "workspace");
}

export function ensureCharacters2DInitialized(): Character2D[] {
  const existing = loadCharacters2D();
  if (existing.length > 0) return existing;
  const starter = createDefaultCharacter2D("Hero #1");
  saveCharacters2D([starter]);
  return [starter];
}

export function upsertCharacter2D(list: Character2D[], item: Character2D): Character2D[] {
  const next = list.some((c) => c.id === item.id)
    ? list.map((c) => (c.id === item.id ? { ...item, updatedAt: Date.now() } : c))
    : [{ ...item, updatedAt: Date.now() }, ...list];
  saveCharacters2D(next);
  return next;
}

export function removeCharacter2D(list: Character2D[], id: string): Character2D[] {
  const next = list.filter((c) => c.id !== id);
  saveCharacters2D(next);
  return next;
}

export function loadCustomBaseModels2D(): BaseModel2D[] {
  try {
    const raw = userLsGet(BASE_MODELS_2D_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomBaseModels2D(models: BaseModel2D[]): boolean {
  return userLsSet(BASE_MODELS_2D_STORAGE_KEY, JSON.stringify(models), "workspace");
}

export function getAllBaseModels2D(): BaseModel2D[] {
  return [BUILTIN_MODEL_MALE_ATHLETIC_V1, ...loadCustomBaseModels2D()];
}

export function resolveBaseModel2D(id: string, customModels?: BaseModel2D[]): BaseModel2D {
  const pool = customModels ? [BUILTIN_MODEL_MALE_ATHLETIC_V1, ...customModels] : getAllBaseModels2D();
  const found = pool.find((m) => m.id === id);
  if (!found) return BUILTIN_MODEL_MALE_ATHLETIC_V1;
  return {
    ...found,
    anchors: { ...MODEL1_ANCHORS, ...(found.anchors ?? {}) },
  };
}

export function loadCustomParts2D(): CustomPartAsset2D[] {
  try {
    const raw = userLsGet(PARTS_2D_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomParts2D(parts: CustomPartAsset2D[]): boolean {
  return userLsSet(PARTS_2D_STORAGE_KEY, JSON.stringify(parts), "workspace");
}

async function dataUrlToPngBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Stores sliced/prepared frame data URLs in account-scoped IndexedDB (`idb://<fileId>`). */
export async function persistAssetImage2D(
  fileId: string,
  dataUrl: string,
  slot: string,
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return dataUrl;
  try {
    const blob = await dataUrlToPngBlob(dataUrl);
    await putFile(fileId, blob, `${fileId}.png`, slot);
    return `${IDB_PREFIX}${fileId}`;
  } catch {
    return dataUrl;
  }
}

export async function saveUploadedBaseModel2D(
  name: string,
  sheetMode: "sheet-8" | "sheet-5",
  rawFrames: Record<Angle2D, string>,
  anchors: BaseModel2D["anchors"],
): Promise<BaseModel2D> {
  const id = `model2d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const frames = {} as Record<Angle2D, string>;
  for (const angle of ANGLES_2D) {
    frames[angle] = await persistAssetImage2D(
      `${id}-a${angle}`,
      rawFrames[angle],
      "char2d-base",
    );
  }
  const model: BaseModel2D = {
    id,
    name: name.trim() || "Custom 2D Base",
    builtIn: false,
    sheetMode,
    createdAt: Date.now(),
    frames,
    anchors,
  };
  const next = [...loadCustomBaseModels2D(), model];
  saveCustomBaseModels2D(next);
  return model;
}

export async function deleteUploadedBaseModel2D(model: BaseModel2D): Promise<BaseModel2D[]> {
  if (model.builtIn) return loadCustomBaseModels2D();
  for (const angle of ANGLES_2D) {
    const ref = model.frames[angle];
    if (ref?.startsWith(IDB_PREFIX)) {
      await deleteFile(ref.slice(IDB_PREFIX.length)).catch(() => {});
    }
  }
  const next = loadCustomBaseModels2D().filter((m) => m.id !== model.id);
  saveCustomBaseModels2D(next);
  return next;
}

export async function saveUploadedCustomPart2D(input: {
  name: string;
  kind: CustomPartAsset2D["kind"];
  slot: CustomPartAsset2D["slot"];
  rawFrames?: Partial<Record<Angle2D, string>>;
  rawSingle?: string;
}): Promise<CustomPartAsset2D> {
  const id = `part2d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const frames: Partial<Record<Angle2D, string>> = {};
  let singleSrc: string | undefined;

  if (input.kind === "single" && input.rawSingle) {
    singleSrc = await persistAssetImage2D(`${id}-single`, input.rawSingle, "char2d-part");
  } else if (input.rawFrames) {
    for (const angle of ANGLES_2D) {
      const val = input.rawFrames[angle];
      if (val) {
        frames[angle] = await persistAssetImage2D(`${id}-a${angle}`, val, "char2d-part");
      }
    }
  }

  const asset: CustomPartAsset2D = {
    id,
    name: input.name.trim() || "Custom Part",
    kind: input.kind,
    slot: input.slot,
    createdAt: Date.now(),
    frames,
    singleSrc,
  };
  const next = [asset, ...loadCustomParts2D()];
  saveCustomParts2D(next);
  return asset;
}

export async function deleteUploadedCustomPart2D(asset: CustomPartAsset2D): Promise<CustomPartAsset2D[]> {
  if (asset.singleSrc?.startsWith(IDB_PREFIX)) {
    await deleteFile(asset.singleSrc.slice(IDB_PREFIX.length)).catch(() => {});
  }
  for (const angle of ANGLES_2D) {
    const ref = asset.frames[angle];
    if (ref?.startsWith(IDB_PREFIX)) {
      await deleteFile(ref.slice(IDB_PREFIX.length)).catch(() => {});
    }
  }
  const next = loadCustomParts2D().filter((p) => p.id !== asset.id);
  saveCustomParts2D(next);
  return next;
}

const resolvedObjectUrls = new Map<string, string>();
const loadedImageCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadImageElement2D(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const cached = loadedImageCache.get(src);
  if (cached) return cached;

  const p = (async () => {
    let url = src;
    if (src.startsWith(IDB_PREFIX)) {
      const existingUrl = resolvedObjectUrls.get(src);
      if (existingUrl) {
        url = existingUrl;
      } else {
        const stored = await getFile(src.slice(IDB_PREFIX.length)).catch(() => null);
        if (!stored) return null;
        url = URL.createObjectURL(stored.blob);
        resolvedObjectUrls.set(src, url);
      }
    }
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  })().then((img) => {
    if (!img) loadedImageCache.delete(src);
    return img;
  });

  loadedImageCache.set(src, p);
  return p;
}

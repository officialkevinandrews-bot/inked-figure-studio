import { knockOutWhiteBackgroundFloodFill } from "./character2d-slicer";
import { deleteFile, getFile, putFile } from "./file-store";
import {
  createScene2DFromTemplate,
  type Scene2D,
  type SceneObjectAsset2D,
  type SceneObjectCategory,
} from "./scene2d-types";
import { userLsGet, userLsSet } from "./user-storage";

export const SCENES_2D_STORAGE_KEY = "koma-scenes-2d";
export const SCENE_OBJECTS_2D_STORAGE_KEY = "koma-scene-objects-2d";

const IDB_PREFIX = "idb://";

export function loadScenes2D(): Scene2D[] {
  try {
    const raw = userLsGet(SCENES_2D_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveScenes2D(list: Scene2D[]): boolean {
  return userLsSet(SCENES_2D_STORAGE_KEY, JSON.stringify(list), "workspace");
}

export function ensureScenes2DInitialized(): Scene2D[] {
  const existing = loadScenes2D();
  if (existing.length > 0) return existing;
  const starter = createScene2DFromTemplate("cozy-bedroom", "Hero's Bedroom");
  saveScenes2D([starter]);
  return [starter];
}

export function upsertScene2D(list: Scene2D[], item: Scene2D): Scene2D[] {
  const stamped = { ...item, updatedAt: Date.now() };
  const next = list.some((s) => s.id === item.id)
    ? list.map((s) => (s.id === item.id ? stamped : s))
    : [stamped, ...list];
  saveScenes2D(next);
  return next;
}

export function removeScene2D(list: Scene2D[], id: string): Scene2D[] {
  const next = list.filter((s) => s.id !== id);
  saveScenes2D(next);
  return next;
}

export function loadCustomSceneObjects2D(): SceneObjectAsset2D[] {
  try {
    const raw = userLsGet(SCENE_OBJECTS_2D_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomSceneObjects2D(assets: SceneObjectAsset2D[]): boolean {
  return userLsSet(SCENE_OBJECTS_2D_STORAGE_KEY, JSON.stringify(assets), "workspace");
}

function encodePreferWebp(canvas: HTMLCanvasElement, quality = 0.94): string {
  try {
    const u = canvas.toDataURL("image/webp", quality);
    if (u.startsWith("data:image/webp")) return u;
  } catch {
    /* fallback below */
  }
  return canvas.toDataURL("image/png");
}

function cleanAndTrimCell(
  srcCanvas: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  removeWhiteBg: boolean,
): { src: string; width: number; height: number } | null {
  const cell = document.createElement("canvas");
  cell.width = sw;
  cell.height = sh;
  const ctx = cell.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  const img = ctx.getImageData(0, 0, sw, sh);
  if (removeWhiteBg) {
    knockOutWhiteBackgroundFloodFill(img);
    ctx.putImageData(img, 0, 0);
  }

  let x0 = sw;
  let y0 = sh;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if ((img.data[(y * sw + x) * 4 + 3] ?? 0) > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 + 3 || y1 <= y0 + 3) return null;

  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const maxDim = Math.max(cw, ch);
  const scale = maxDim > 720 ? 720 / maxDim : 1;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cw * scale));
  out.height = Math.max(1, Math.round(ch * scale));
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(cell, x0, y0, cw, ch, 0, 0, out.width, out.height);

  return { src: encodePreferWebp(out, 0.94), width: out.width, height: out.height };
}

/**
 * Slices a user-uploaded scene object image (`single`, `grid-4`, or `grid-8` object sheet),
 * knocking out white paper backgrounds and tightly trimming each object.
 */
export function prepareSceneObjectImages(
  source: HTMLImageElement | HTMLCanvasElement,
  mode: "single" | "grid-4" | "grid-8",
  removeWhiteBg = true,
): Array<{ src: string; width: number; height: number }> {
  const w = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const h =
    source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
  if (!w || !h) return [];

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = w;
  srcCanvas.height = h;
  const sctx = srcCanvas.getContext("2d");
  if (!sctx) return [];
  sctx.drawImage(source, 0, 0);

  if (mode === "single") {
    const one = cleanAndTrimCell(srcCanvas, 0, 0, w, h, removeWhiteBg);
    return one ? [one] : [];
  }

  let cols = 4;
  let rows = 1;
  if (mode === "grid-4") {
    if (h > w * 0.72) {
      cols = 2;
      rows = 2;
    } else {
      cols = 4;
      rows = 1;
    }
  } else {
    if (h > w * 0.45) {
      cols = 4;
      rows = 2;
    } else {
      cols = 8;
      rows = 1;
    }
  }

  const out: Array<{ src: string; width: number; height: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = Math.floor((w * c) / cols);
      const ex = Math.floor((w * (c + 1)) / cols);
      const sy = Math.floor((h * r) / rows);
      const ey = Math.floor((h * (r + 1)) / rows);
      const trimmed = cleanAndTrimCell(
        srcCanvas,
        sx,
        sy,
        Math.max(1, ex - sx),
        Math.max(1, ey - sy),
        removeWhiteBg,
      );
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

export async function saveUploadedSceneObject2D(input: {
  name: string;
  category: SceneObjectCategory;
  kind: "single" | "sheet";
  rawSrc: string;
  width: number;
  height: number;
}): Promise<SceneObjectAsset2D> {
  const id = `sceneobj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let src = input.rawSrc;
  if (src.startsWith("data:")) {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = src.startsWith("data:image/webp") ? "webp" : "png";
      await putFile(id, blob, `${id}.${ext}`, "scene2d-obj");
      src = `${IDB_PREFIX}${id}`;
    } catch {
      /* keep dataUrl fallback */
    }
  }
  const asset: SceneObjectAsset2D = {
    id,
    name: input.name.trim() || "Custom Scene Object",
    category: input.category,
    kind: input.kind,
    src,
    width: input.width,
    height: input.height,
    createdAt: Date.now(),
  };
  const next = [asset, ...loadCustomSceneObjects2D()];
  saveCustomSceneObjects2D(next);
  return asset;
}

export async function deleteUploadedSceneObject2D(
  asset: SceneObjectAsset2D,
): Promise<SceneObjectAsset2D[]> {
  if (asset.src?.startsWith(IDB_PREFIX)) {
    await deleteFile(asset.src.slice(IDB_PREFIX.length)).catch(() => {});
  }
  const next = loadCustomSceneObjects2D().filter((a) => a.id !== asset.id);
  saveCustomSceneObjects2D(next);
  return next;
}

const resolvedUrls = new Map<string, string>();
const imgPromiseCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadSceneImageElement2D(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  const hit = imgPromiseCache.get(src);
  if (hit) return hit;

  const p = (async () => {
    let url = src;
    if (src.startsWith(IDB_PREFIX)) {
      const cached = resolvedUrls.get(src);
      if (cached) {
        url = cached;
      } else {
        const file = await getFile(src.slice(IDB_PREFIX.length)).catch(() => null);
        if (!file) return null;
        url = URL.createObjectURL(file.blob);
        resolvedUrls.set(src, url);
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
    if (!img) imgPromiseCache.delete(src);
    return img;
  });

  imgPromiseCache.set(src, p);
  return p;
}

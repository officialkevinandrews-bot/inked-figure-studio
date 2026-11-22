import {
  ANGLES_2D,
  CHAR2D_H,
  CHAR2D_W,
  MIRROR_PAIRS_2D,
  type Angle2D,
  type BodyAngleAnchors,
  type RenderMode2D,
} from "./character2d-types";
import { defaultAnchorsForAngle } from "./character2d-model1";

/**
 * Flood-fills white/near-white paper background starting from image edges
 * so clothing/body interiors stay solid opaque while outer paper turns transparent.
 */
export function knockOutWhiteBackgroundFloodFill(
  imageData: ImageData,
  threshold = 232,
  maxChroma = 18,
): ImageData {
  const { width: w, height: h, data } = imageData;
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const isBg = (p: number): boolean => {
    const i = p * 4;
    const a = data[i + 3] ?? 255;
    if (a < 20) return true;
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    const mn = Math.min(r, g, b);
    const mx = Math.max(r, g, b);
    return mn >= threshold && mx - mn <= maxChroma;
  };

  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (visited[p] || !isBg(p)) return;
    visited[p] = 1;
    queue[tail++] = p;
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x + 1 < w) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < h) push(x, y + 1);
  }

  for (let p = 0; p < w * h; p++) {
    if (visited[p]) {
      data[p * 4 + 3] = 0;
    }
  }

  // Soften 1px anti-aliased bright neutral fringes bordering cleared background
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (visited[p]) continue;
      const adj = visited[p - 1] || visited[p + 1] || visited[p - w] || visited[p + w];
      if (!adj) continue;
      const i = p * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const lum = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum > 188 && chroma < 24) {
        data[i + 3] = Math.max(0, Math.min(255, Math.round(((242 - lum) / 96) * 255)));
      }
    }
  }

  return imageData;
}

function mirrorCanvasHorizontally(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return out;
}

function detectHorizontalSegments(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): [number, number][] {
  const colHasContent = new Uint8Array(w);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3] ?? 255;
      const mn = Math.min(data[i] ?? 255, data[i + 1] ?? 255, data[i + 2] ?? 255);
      if (a > 24 && mn < 238) {
        colHasContent[x] = 1;
        break;
      }
    }
  }

  const segs: [number, number][] = [];
  let inSeg = false;
  let start = 0;
  for (let x = 0; x < w; x++) {
    if (colHasContent[x] && !inSeg) {
      start = x;
      inSeg = true;
    } else if (!colHasContent[x] && inSeg) {
      if (x - start > 12) segs.push([start, x - 1]);
      inSeg = false;
    }
  }
  if (inSeg && w - start > 12) segs.push([start, w - 1]);
  return segs;
}

/**
 * Slices a 1x8 (full turnaround) or 1x5 (0°,45°,90°,135°,180° + auto-mirrored opposite views)
 * uploaded spritesheet into normalized 480x1000 transparent PNG frames + anchors.
 */
export function sliceTurnaroundSheet(
  source: HTMLImageElement | HTMLCanvasElement,
  mode: "sheet-8" | "sheet-5",
  removeWhiteBg = true,
): { frames: Record<Angle2D, string>; anchors: Record<Angle2D, BodyAngleAnchors> } {
  const w = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
  if (!w || !h) throw new Error("Image has zero dimensions.");

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = w;
  srcCanvas.height = h;
  const sctx = srcCanvas.getContext("2d");
  if (!sctx) throw new Error("Canvas 2D unavailable.");
  sctx.drawImage(source, 0, 0);

  const raw = sctx.getImageData(0, 0, w, h);
  let segs = detectHorizontalSegments(raw.data, w, h);
  const expected = mode === "sheet-8" ? 8 : 5;
  if (segs.length !== expected) {
    // Fallback to uniform equal-width grid columns if figures touch or whitespace gaps vary
    segs = Array.from({ length: expected }, (_, i) => [
      Math.floor((w * i) / expected),
      Math.floor((w * (i + 1)) / expected) - 1,
    ]);
  }

  const canvases = {} as Record<Angle2D, HTMLCanvasElement>;
  const targetAngles: readonly Angle2D[] =
    mode === "sheet-8" ? ANGLES_2D : ([0, 45, 90, 135, 180] as const);

  const TOP_Y = 80;
  const BOT_Y = 950;
  const BODY_H = BOT_Y - TOP_Y;

  targetAngles.forEach((angle, idx) => {
    const [rawX0, rawX1] = segs[idx]!;
    const pad = 4;
    const cx0 = Math.max(0, rawX0 - pad);
    const cx1 = Math.min(w - 1, rawX1 + pad);
    const cw = cx1 - cx0 + 1;

    const crop = document.createElement("canvas");
    crop.width = cw;
    crop.height = h;
    const cctx = crop.getContext("2d")!;
    cctx.drawImage(srcCanvas, cx0, 0, cw, h, 0, 0, cw, h);

    const cropImg = cctx.getImageData(0, 0, cw, h);
    if (removeWhiteBg) {
      knockOutWhiteBackgroundFloodFill(cropImg);
      cctx.putImageData(cropImg, 0, 0);
    }

    let ax0 = cw;
    let ax1 = 0;
    let ay0 = h;
    let ay1 = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < cw; x++) {
        if ((cropImg.data[(y * cw + x) * 4 + 3] ?? 0) > 20) {
          if (x < ax0) ax0 = x;
          if (x > ax1) ax1 = x;
          if (y < ay0) ay0 = y;
          if (y > ay1) ay1 = y;
        }
      }
    }

    const out = document.createElement("canvas");
    out.width = CHAR2D_W;
    out.height = CHAR2D_H;
    const octx = out.getContext("2d")!;
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";

    if (ax1 > ax0 && ay1 > ay0) {
      const figW = ax1 - ax0 + 1;
      const figH = ay1 - ay0 + 1;
      const scale = Math.min((CHAR2D_W * 0.92) / figW, BODY_H / figH);
      const drawW = figW * scale;
      const drawH = figH * scale;
      const dx = (CHAR2D_W - drawW) / 2;
      const dy = BOT_Y - drawH;
      octx.drawImage(crop, ax0, ay0, figW, figH, dx, dy, drawW, drawH);
    }

    canvases[angle] = out;
  });

  if (mode === "sheet-5") {
    for (const [srcAngle, mirrorAngle] of MIRROR_PAIRS_2D) {
      canvases[mirrorAngle] = mirrorCanvasHorizontally(canvases[srcAngle]);
    }
  }

  const frames = {} as Record<Angle2D, string>;
  const anchors = {} as Record<Angle2D, BodyAngleAnchors>;
  for (const angle of ANGLES_2D) {
    frames[angle] = canvases[angle].toDataURL("image/png");
    anchors[angle] = defaultAnchorsForAngle(angle);
  }
  return { frames, anchors };
}

/** Prepares a single custom image (e.g. clothing overlay, accessory, decal) into a tightly cropped transparent PNG. */
export function prepareSinglePartImage(
  source: HTMLImageElement | HTMLCanvasElement,
  removeWhiteBg = true,
): string {
  const w = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
  if (!w || !h) return "";

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0);

  const img = ctx.getImageData(0, 0, w, h);
  if (removeWhiteBg) {
    knockOutWhiteBackgroundFloodFill(img);
    ctx.putImageData(img, 0, 0);
  }

  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((img.data[(y * w + x) * 4 + 3] ?? 0) > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return canvas.toDataURL("image/png");

  const cropW = x1 - x0 + 1;
  const cropH = y1 - y0 + 1;
  const maxDim = Math.max(cropW, cropH);
  const scale = maxDim > 720 ? 720 / maxDim : 1;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cropW * scale));
  out.height = Math.max(1, Math.round(cropH * scale));
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(canvas, x0, y0, cropW, cropH, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0]! + clean[0]!, 16),
      parseInt(clean[1]! + clean[1]!, 16),
      parseInt(clean[2]! + clean[2]!, 16),
    ];
  }
  const n = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(n)) return [245, 200, 170];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Converts a colored character/clothing sprite into pure black ink lineart over opaque white interior.
 * Removes all skin/clothing fills and flat dark garment fills, preserving only crisp outline & anatomy lines.
 */
export function extractMangaLineartCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  targetW = CHAR2D_W,
  targetH = CHAR2D_H,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.drawImage(source, 0, 0, targetW, targetH);

  const img = ctx.getImageData(0, 0, targetW, targetH);
  const d = img.data;
  const len = targetW * targetH;
  const lum = new Float32Array(len);
  const alpha = new Uint8Array(len);

  for (let p = 0; p < len; p++) {
    const i = p * 4;
    alpha[p] = d[i + 3] ?? 0;
    lum[p] = 0.299 * (d[i] ?? 255) + 0.587 * (d[i + 1] ?? 255) + 0.114 * (d[i + 2] ?? 255);
  }

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const p = y * targetW + x;
      const a = alpha[p]!;
      const i = p * 4;
      if (a < 24) {
        d[i + 3] = 0;
        continue;
      }

      // 1) Check silhouette border within radius 2 -> crisp outer ink outline
      let nearTransparent = false;
      for (let dy = -2; dy <= 2 && !nearTransparent; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= targetH) {
          nearTransparent = true;
          break;
        }
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= targetW) {
            nearTransparent = true;
            break;
          }
          if (alpha[ny * targetW + nx]! < 35) {
            nearTransparent = true;
            break;
          }
        }
      }

      const l = lum[p]!;
      // 2) Interior line detector: dark pixels significantly darker than local 7x7 max (anatomy/seams)
      let localMax = l;
      const yMin = Math.max(0, y - 3);
      const yMax = Math.min(targetH - 1, y + 3);
      const xMin = Math.max(0, x - 3);
      const xMax = Math.min(targetW - 1, x + 3);
      for (let ny = yMin; ny <= yMax; ny++) {
        for (let nx = xMin; nx <= xMax; nx++) {
          const np = ny * targetW + nx;
          if (alpha[np]! > 40) {
            const nl = lum[np]!;
            if (nl > localMax) localMax = nl;
          }
        }
      }

      const contrast = localMax - l;
      let inkStrength = 0;
      if (nearTransparent && l < 198) {
        inkStrength = Math.max(0, Math.min(1, (198 - l) / 56));
      } else if (l < 168 && contrast >= 30) {
        inkStrength = Math.max(0, Math.min(1, (contrast - 26) / 38));
      }

      const shade = Math.round(255 * (1 - inkStrength));
      d[i] = shade;
      d[i + 1] = shade;
      d[i + 2] = shade;
      d[i + 3] = a > 120 ? 255 : Math.min(255, Math.round(a * 1.4));
    }
  }

  ctx.putImageData(img, 0, 0);
  return out;
}

/** Shifts peach skin tones in Color Mode toward `skinHex` while preserving cel-shading, outlines, and briefs. */
export function applySkinToneCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  skinHex: string | null,
  targetW = CHAR2D_W,
  targetH = CHAR2D_H,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.drawImage(source, 0, 0, targetW, targetH);
  if (!skinHex) return out;

  const [tr, tg, tb] = parseHexRgb(skinHex);
  const img = ctx.getImageData(0, 0, targetW, targetH);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] ?? 0;
    if (a < 16) continue;
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const warmth = r - b;
    // Skin regions on Model #1 are warm & lighter than neutral outlines/briefs
    if (lum > 105 && warmth > 12) {
      const shadeScale = Math.min(1.06, lum / 222);
      const mask = Math.min(1, (warmth - 12) / 18) * Math.min(1, (lum - 105) / 35);
      const nr = Math.min(255, Math.round(tr * shadeScale));
      const ng = Math.min(255, Math.round(tg * shadeScale));
      const nb = Math.min(255, Math.round(tb * shadeScale));
      d[i] = Math.round(r * (1 - mask) + nr * mask);
      d[i + 1] = Math.round(g * (1 - mask) + ng * mask);
      d[i + 2] = Math.round(b * (1 - mask) + nb * mask);
    }
  }

  ctx.putImageData(img, 0, 0);
  return out;
}

/** Applies RGB multiply-tinting in Color Mode or pure lineart extraction in Manga Mode for uploaded custom parts. */
export function tintCustomPartCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  tintHex: string | null,
  renderMode: RenderMode2D,
): HTMLCanvasElement {
  const w = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
  if (!w || !h) {
    const empty = document.createElement("canvas");
    empty.width = 1;
    empty.height = 1;
    return empty;
  }

  if (renderMode === "manga") {
    return extractMangaLineartCanvas(source, w, h);
  }

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(source, 0, 0, w, h);
  if (!tintHex) return out;

  const [tr, tg, tb] = parseHexRgb(tintHex);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if ((d[i + 3] ?? 0) < 8) continue;
    d[i] = Math.round(((d[i] ?? 0) * tr) / 255);
    d[i + 1] = Math.round(((d[i + 1] ?? 0) * tg) / 255);
    d[i + 2] = Math.round(((d[i + 2] ?? 0) * tb) / 255);
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

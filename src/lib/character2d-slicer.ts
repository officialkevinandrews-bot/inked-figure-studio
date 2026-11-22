import {
  ANGLES_2D,
  CHAR2D_H,
  CHAR2D_W,
  MIRROR_PAIRS_2D,
  type Angle2D,
  type BodyAngleAnchors,
  type HeadAngleAnchors2D,
  type HeadPack2D,
  type RenderMode2D,
  type ShadingDepth2D,
} from "./character2d-types";
import { OVERLAY_HEAD_CROP_Y0, OVERLAY_HEAD_H, OVERLAY_HEAD_W } from "./character2d-heads";
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
  const h =
    source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
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
  const h =
    source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
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

/**
 * Crisp pure-lineart extractor tuned for neutral white/cool-gray illustrated clothes & hair.
 * Keeps opaque interior white `#FFFFFF` and razor-sharp `#000000` ink outlines, seams, and folds,
 * stripping gray cel-shading fills cleanly for Manga Ink Mode.
 */
export function extractIllustratedMangaLineartCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  targetW?: number,
  targetH?: number,
): HTMLCanvasElement {
  const sw =
    source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const sh =
    source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
  const w = targetW ?? (sw || 1);
  const h = targetH ?? (sh || 1);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx || !sw || !sh) return out;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const len = w * h;
  const lum = new Float32Array(len);
  const alpha = new Uint8Array(len);

  for (let p = 0; p < len; p++) {
    const i = p * 4;
    alpha[p] = d[i + 3] ?? 0;
    lum[p] = 0.299 * (d[i] ?? 255) + 0.587 * (d[i + 1] ?? 255) + 0.114 * (d[i + 2] ?? 255);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const a = alpha[p]!;
      const i = p * 4;
      if (a < 22) {
        d[i + 3] = 0;
        continue;
      }

      let nearTransparent = false;
      for (let dy = -2; dy <= 2 && !nearTransparent; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) {
          nearTransparent = true;
          break;
        }
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w || alpha[ny * w + nx]! < 35) {
            nearTransparent = true;
            break;
          }
        }
      }

      let localMax = lum[p]!;
      const y0 = Math.max(0, y - 2);
      const y1 = Math.min(h - 1, y + 2);
      const x0 = Math.max(0, x - 2);
      const x1 = Math.min(w - 1, x + 2);
      for (let ny = y0; ny <= y1; ny++) {
        for (let nx = x0; nx <= x1; nx++) {
          const np = ny * w + nx;
          if (alpha[np]! > 40 && lum[np]! > localMax) localMax = lum[np]!;
        }
      }

      const l = lum[p]!;
      const contrast = localMax - l;
      let inkStrength = 0;
      if (nearTransparent && l < 214) {
        inkStrength = Math.max(0, Math.min(1, (214 - l) / 56));
      } else if (l < 142) {
        inkStrength = Math.max(0, Math.min(1, (152 - l) / 56));
      } else if (l < 180 && contrast >= 28) {
        inkStrength = Math.max(0, Math.min(1, (contrast - 24) / 36));
      }

      const shade = Math.round(255 * (1 - inkStrength));
      d[i] = shade;
      d[i + 1] = shade;
      d[i + 2] = shade;
      d[i + 3] = a > 110 ? 255 : Math.min(255, Math.round(a * 1.4));
    }
  }

  ctx.putImageData(img, 0, 0);
  return out;
}

/**
 * 3-Stop Anime Cel-Shading RGB Recolor Engine with optional 2-zone accent mask & shading depth.
 * Keeps dark ink lines crisp while mapping neutral white/gray base fills & cel shadows cleanly to any RGB color.
 */
export function recolorIllustratedPartCanvas(
  baseImg: HTMLImageElement | HTMLCanvasElement,
  primaryHex: string,
  opts: {
    accentMaskImg?: HTMLImageElement | HTMLCanvasElement | null;
    accentHex?: string | null;
    shadingDepth?: ShadingDepth2D;
    renderMode: RenderMode2D;
    targetW?: number;
    targetH?: number;
  },
): HTMLCanvasElement {
  const sw =
    baseImg instanceof HTMLImageElement ? baseImg.naturalWidth || baseImg.width : baseImg.width;
  const sh =
    baseImg instanceof HTMLImageElement ? baseImg.naturalHeight || baseImg.height : baseImg.height;
  const w = opts.targetW ?? (sw || 1);
  const h = opts.targetH ?? (sh || 1);
  if (!sw || !sh) {
    const empty = document.createElement("canvas");
    empty.width = 1;
    empty.height = 1;
    return empty;
  }

  if (opts.renderMode === "manga") {
    return extractIllustratedMangaLineartCanvas(baseImg, w, h);
  }

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(baseImg, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  let maskData: Uint8ClampedArray | null = null;
  if (opts.accentMaskImg && opts.accentHex) {
    const mc = document.createElement("canvas");
    mc.width = w;
    mc.height = h;
    const mctx = mc.getContext("2d")!;
    mctx.drawImage(opts.accentMaskImg, 0, 0, w, h);
    maskData = mctx.getImageData(0, 0, w, h).data;
  }

  const [pr, pg, pb] = parseHexRgb(primaryHex);
  const [ar, ag, ab] = parseHexRgb(opts.accentHex ?? primaryHex);
  const depth = opts.shadingDepth ?? "cel";

  const len = w * h;
  const lumArr = new Float32Array(len);
  const alphaArr = new Uint8Array(len);
  for (let p = 0; p < len; p++) {
    const i = p * 4;
    alphaArr[p] = d[i + 3] ?? 0;
    lumArr[p] = 0.299 * (d[i] ?? 255) + 0.587 * (d[i + 1] ?? 255) + 0.114 * (d[i + 2] ?? 255);
  }

  const liftDarkColor = (r: number, g: number, b: number): [number, number, number] => {
    const mx = Math.max(r, g, b);
    if (mx >= 92) return [r, g, b];
    // Lift very dark charcoal/navy RGB fills just enough that black ink lines & deep cel shadows remain readable
    const lift = (92 - mx) * 0.46;
    return [
      Math.min(255, Math.round(r + lift * 0.88)),
      Math.min(255, Math.round(g + lift * 0.94)),
      Math.min(255, Math.round(b + lift * 1.08)),
    ];
  };

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 2);
    const y1 = Math.min(h - 1, y + 2);
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const a = alphaArr[p]!;
      if (a < 8) continue;

      const i = p * 4;
      const L = lumArr[p]!;
      let localMax = L;
      const x0 = Math.max(0, x - 2);
      const x1 = Math.min(w - 1, x + 2);
      for (let ny = y0; ny <= y1; ny++) {
        const rowOff = ny * w;
        for (let nx = x0; nx <= x1; nx++) {
          const np = rowOff + nx;
          if (alphaArr[np]! >= 48 && lumArr[np]! > localMax) {
            localMax = lumArr[np]!;
          }
        }
      }

      const m = maskData ? (maskData[i + 3] ?? 0) / 255 : 0;
      const rawR = pr + (ar - pr) * m;
      const rawG = pg + (ag - pg) * m;
      const rawB = pb + (ab - pb) * m;
      const isNearWhite = rawR >= 236 && rawG >= 236 && rawB >= 236;

      if (isNearWhite) {
        // Near-white / original art mode: preserve original linework and cool-gray cel shadows directly
        const scaleR = rawR / 255;
        const scaleG = rawG / 255;
        const scaleB = rawB / 255;
        const localDrop = Math.max(0, localMax - L);
        const lineBoost = localDrop > 8 && L < 220 ? Math.min(24, (localDrop - 8) * 0.45) : 0;
        const effL = Math.max(12, L - lineBoost);
        const cool = effL < 232 && effL > 140 ? (232 - effL) * 0.08 : 0;
        d[i] = Math.max(0, Math.min(255, Math.round((effL - cool * 0.6) * scaleR)));
        d[i + 1] = Math.max(0, Math.min(255, Math.round((effL - cool * 0.2) * scaleG)));
        d[i + 2] = Math.max(0, Math.min(255, Math.round(Math.min(255, effL + cool) * scaleB)));
        continue;
      }

      const [tr, tg, tb] = liftDarkColor(rawR, rawG, rawB);

      // 1. Local-contrast + global dark lineart detection (preserves thin gray hair strands, seams, & laces)
      const localDrop = Math.max(0, localMax - L);
      const globalInk = Math.max(0, Math.min(1, (148 - L) / 92));
      const detailInk = L < 222 ? Math.max(0, Math.min(1, (localDrop - 10) / 44)) : 0;
      const lineStrength = Math.max(globalInk, detailInk * 0.86);

      const inkR = Math.min(22, Math.round(rawR * 0.09 + 6));
      const inkG = Math.min(24, Math.round(rawG * 0.09 + 7));
      const inkB = Math.min(32, Math.round(rawB * 0.11 + 10));

      // 2. Crisp 3-stop anime cel-shading transfer (lit plane vs distinct cool cel shadow)
      const tLinear = Math.max(0, Math.min(1, (L - 160) / 88));
      const tStep = Math.max(0, Math.min(1, (L - 210) / 22));
      const tSmoothStep = tStep * tStep * (3 - 2 * tStep);
      const tTone = 0.45 * tLinear + 0.55 * tSmoothStep;

      const shadeFactor =
        depth === "flat"
          ? 0.88 + 0.12 * tTone
          : depth === "dramatic"
            ? 0.48 + 0.52 * tTone
            : 0.66 + 0.34 * tTone;

      const coolBoost = (1 - tTone) * (depth === "flat" ? 3 : 11);
      const hiLift = L > 245 ? ((L - 245) / 10) * 14 : 0;
      const fillR = Math.min(255, tr * shadeFactor + hiLift);
      const fillG = Math.min(255, tg * (shadeFactor * 0.99) + hiLift);
      const fillB = Math.min(255, tb * Math.min(1.04, shadeFactor * 1.02) + coolBoost + hiLift);

      d[i] = Math.round(fillR * (1 - lineStrength) + inkR * lineStrength);
      d[i + 1] = Math.round(fillG * (1 - lineStrength) + inkG * lineStrength);
      d[i + 2] = Math.round(fillB * (1 - lineStrength) + inkB * lineStrength);
    }
  }

  ctx.putImageData(img, 0, 0);
  return out;
}

/** Renders a grayscale iris luminance sprite into a 3-stop luminous anime iris at any RGB color. */
export function recolorIrisCanvas(
  irisImg: HTMLImageElement | HTMLCanvasElement,
  eyeColorHex: string,
  renderMode: RenderMode2D,
): HTMLCanvasElement {
  const w =
    irisImg instanceof HTMLImageElement ? irisImg.naturalWidth || irisImg.width : irisImg.width;
  const h =
    irisImg instanceof HTMLImageElement ? irisImg.naturalHeight || irisImg.height : irisImg.height;
  const out = document.createElement("canvas");
  out.width = w || 1;
  out.height = h || 1;
  if (!w || !h) return out;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(irisImg, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const [er, eg, eb] = parseHexRgb(eyeColorHex);

  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] ?? 0;
    if (a < 10) continue;
    if (renderMode === "manga") {
      // Manga Mode keeps eyes white inside with crisp black rim
      const l =
        (0.299 * (d[i] ?? 255) + 0.587 * (d[i + 1] ?? 255) + 0.114 * (d[i + 2] ?? 255)) / 255;
      const val = l < 0.48 ? 24 : 255;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
      continue;
    }

    const l = (0.299 * (d[i] ?? 180) + 0.587 * (d[i + 1] ?? 180) + 0.114 * (d[i + 2] ?? 180)) / 255;
    if (l < 0.56) {
      const k = 0.42 + (l / 0.56) * 0.48;
      d[i] = Math.round(er * k);
      d[i + 1] = Math.round(eg * k);
      d[i + 2] = Math.round(eb * k);
    } else if (l < 0.78) {
      const k = 0.9 + ((l - 0.56) / 0.22) * 0.22;
      d[i] = Math.min(255, Math.round(er * k));
      d[i + 1] = Math.min(255, Math.round(eg * k));
      d[i + 2] = Math.min(255, Math.round(eb * k));
    } else {
      const mix = ((l - 0.78) / 0.22) * 0.55;
      d[i] = Math.min(255, Math.round(er + (255 - er) * mix));
      d[i + 1] = Math.min(255, Math.round(eg + (255 - eg) * mix));
      d[i + 2] = Math.min(255, Math.round(eb + (255 - eb) * mix));
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Tints extracted ink strokes (eyebrows, nose, mouth) to an exact RGB ink or pure black in Manga Mode. */
export function recolorTintedInkCanvas(
  strokeImg: HTMLImageElement | HTMLCanvasElement,
  hexColor: string,
  renderMode: RenderMode2D,
): HTMLCanvasElement {
  const w =
    strokeImg instanceof HTMLImageElement
      ? strokeImg.naturalWidth || strokeImg.width
      : strokeImg.width;
  const h =
    strokeImg instanceof HTMLImageElement
      ? strokeImg.naturalHeight || strokeImg.height
      : strokeImg.height;
  const out = document.createElement("canvas");
  out.width = w || 1;
  out.height = h || 1;
  if (!w || !h) return out;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(strokeImg, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const [tr, tg, tb] = renderMode === "manga" ? [0, 0, 0] : parseHexRgb(hexColor);
  for (let i = 0; i < d.length; i += 4) {
    if ((d[i + 3] ?? 0) < 8) continue;
    d[i] = tr;
    d[i + 1] = tg;
    d[i + 2] = tb;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Applies 3-stop Anime Cel-Shading RGB tint in Color Mode or pure lineart extraction in Manga Mode for uploaded custom parts. */
export function tintCustomPartCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  tintHex: string | null,
  renderMode: RenderMode2D,
  shadingDepth: ShadingDepth2D = "cel",
): HTMLCanvasElement {
  const w = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const h =
    source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
  if (!w || !h) {
    const empty = document.createElement("canvas");
    empty.width = 1;
    empty.height = 1;
    return empty;
  }

  if (renderMode === "manga") {
    return extractIllustratedMangaLineartCanvas(source, w, h);
  }

  if (!tintHex) {
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.getContext("2d")!.drawImage(source, 0, 0, w, h);
    return out;
  }

  return recolorIllustratedPartCanvas(source, tintHex, { shadingDepth, renderMode });
}

function encodeCanvasPreferWebp(canvas: HTMLCanvasElement, quality = 0.94): string {
  try {
    const webp = canvas.toDataURL("image/webp", quality);
    if (webp.startsWith("data:image/webp")) return webp;
  } catch {
    /* fallback below */
  }
  return canvas.toDataURL("image/png");
}

function scanRowSpan(
  data: Uint8ClampedArray,
  w: number,
  y: number,
  xMin: number,
  xMax: number,
  centerHint: number,
): [number, number] | null {
  const runs: [number, number][] = [];
  let inRun = false;
  let sx = 0;
  for (let x = xMin; x <= xMax; x++) {
    const op = (data[(y * w + x) * 4 + 3] ?? 0) > 40;
    if (op && !inRun) {
      sx = x;
      inRun = true;
    } else if (!op && inRun) {
      runs.push([sx, x - 1]);
      inRun = false;
    }
  }
  if (inRun) runs.push([sx, xMax]);
  if (runs.length === 0) return null;
  if (runs.length === 1) return runs[0]!;
  let best = runs[0]!;
  let bestScore = -1e9;
  for (const r of runs) {
    const mid = (r[0] + r[1]) / 2;
    const rw = r[1] - r[0] + 1;
    const score = rw - Math.abs(mid - centerHint) * 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

function medianNum(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/**
 * Measures head+neck landmarks from a normalized 480x1000 body frame OR a 220x280 head+neck overlay
 * (returned coordinates are always expressed in canonical 480x1000 world space + overlay pivot).
 */
export function measureHeadAnchorsFromCanvas(
  canvas: HTMLCanvasElement,
  angle: Angle2D,
  space: "body-480x1000" | "overlay-220x280" = "body-480x1000",
): HeadAngleAnchors2D {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const ref = defaultAnchorsForAngle(angle);
  if (!ctx) {
    return {
      headCx: ref.headCx,
      headCy: ref.headCy,
      headRx: ref.headRx,
      headRy: ref.headRy,
      faceShiftX: ref.faceShiftX,
      eyeY: ref.eyeY,
      noseY: ref.noseY,
      mouthY: ref.mouthY,
      chinY: ref.chinY,
      neckY: ref.neckY,
      neckL: ref.neckL,
      neckR: ref.neckR,
      neckAttachX: OVERLAY_HEAD_W / 2,
      neckAttachY: 230 - OVERLAY_HEAD_CROP_Y0,
    };
  }

  const d = ctx.getImageData(0, 0, w, h).data;
  const offsetY = space === "overlay-220x280" ? OVERLAY_HEAD_CROP_Y0 : 0;
  const offsetX = space === "overlay-220x280" ? 240 - OVERLAY_HEAD_W / 2 : 0;
  const xMin = 0;
  const xMax = w - 1;
  const centerX = w / 2;

  let headTopLocal = Math.max(0, 80 - offsetY);
  for (let y = 8; y <= Math.min(h - 40, 175 - offsetY); y++) {
    const sp = scanRowSpan(d, w, y, xMin, xMax, centerX);
    if (sp && sp[1] - sp[0] + 1 >= 8) {
      headTopLocal = y;
      break;
    }
  }
  const headTopY = headTopLocal + offsetY;

  let neckMinW = 999;
  let neckL = ref.neckL;
  let neckR = ref.neckR;
  for (let y = 211 - offsetY; y <= Math.min(h - 1, 220 - offsetY); y++) {
    if (y < 0) continue;
    const sp = scanRowSpan(d, w, y, xMin, xMax, centerX);
    if (sp) {
      const rw = sp[1] - sp[0] + 1;
      if (rw < neckMinW) {
        neckMinW = rw;
        neckL = sp[0] + offsetX;
        neckR = sp[1] + offsetX;
      }
    }
  }
  const neckCx = (neckL + neckR) / 2;
  const neckW = neckMinW < 999 ? neckMinW : ref.neckR - ref.neckL;

  let chinY = 205;
  if (angle === 90 || angle === 270) {
    let peakFront = angle === 90 ? 0 : CHAR2D_W;
    let peakY = 204;
    for (let wy = 194; wy <= 215; wy++) {
      const ly = wy - offsetY;
      if (ly < 0 || ly >= h) continue;
      const sp = scanRowSpan(d, w, ly, xMin, xMax, centerX);
      if (!sp) continue;
      const front = (angle === 90 ? sp[1] : sp[0]) + offsetX;
      if (wy >= 198) {
        if (angle === 90 && front >= peakFront - 1) {
          peakFront = Math.max(peakFront, front);
          peakY = wy;
        } else if (angle === 270 && front <= peakFront + 1) {
          peakFront = Math.min(peakFront, front);
          peakY = wy;
        }
      }
    }
    chinY = Math.max(201, Math.min(213, peakY));
    for (let wy = chinY; wy <= 217; wy++) {
      const ly = wy - offsetY;
      if (ly < 0 || ly >= h) continue;
      const sp = scanRowSpan(d, w, ly, xMin, xMax, centerX);
      if (!sp) continue;
      const front = (angle === 90 ? sp[1] : sp[0]) + offsetX;
      const dist = angle === 90 ? peakFront - front : front - peakFront;
      if (dist >= 6) {
        chinY = Math.max(201, Math.min(214, wy - 1));
        break;
      }
    }
  } else if (angle === 0 || angle === 45 || angle === 315) {
    const initL: number[] = [];
    const initR: number[] = [];
    for (let wy = headTopY + 34; wy <= headTopY + 56; wy++) {
      const ly = wy - offsetY;
      if (ly < 0 || ly >= h) continue;
      const sp = scanRowSpan(d, w, ly, xMin, xMax, centerX);
      if (sp) {
        initL.push(sp[0] + offsetX);
        initR.push(sp[1] + offsetX);
      }
    }
    const rawCx = initL.length ? Math.round((medianNum(initL) + medianNum(initR)) / 2) : 240;
    const shiftHint = angle === 45 ? 10 : angle === 315 ? -10 : 0;
    const cxLocal = rawCx + shiftHint - offsetX;
    let darkestY = 205;
    let darkestLum = 255;
    for (let wy = 201; wy <= 216; wy++) {
      const ly = wy - offsetY;
      if (ly < 0 || ly >= h) continue;
      let rowMin = 255;
      for (let lx = Math.max(0, cxLocal - 4); lx <= Math.min(w - 1, cxLocal + 4); lx++) {
        const i = (ly * w + lx) * 4;
        if ((d[i + 3] ?? 0) < 80) continue;
        const l = 0.299 * (d[i] ?? 255) + 0.587 * (d[i + 1] ?? 255) + 0.114 * (d[i + 2] ?? 255);
        if (l < rowMin) rowMin = l;
      }
      if (rowMin < darkestLum) {
        darkestLum = rowMin;
        darkestY = wy;
      }
    }
    if (darkestLum < 168) {
      chinY = darkestY;
    } else {
      for (let wy = 200; wy <= 218; wy++) {
        const ly = wy - offsetY;
        if (ly < 0 || ly >= h) continue;
        const sp = scanRowSpan(d, w, ly, xMin, xMax, centerX);
        if (sp && sp[1] - sp[0] + 1 <= neckW + 4) {
          chinY = Math.max(201, Math.min(214, wy - 1));
          break;
        }
      }
    }
  } else {
    chinY = 205;
  }

  const headH = Math.max(88, chinY - headTopY);
  const browL: number[] = [];
  const browR: number[] = [];
  for (
    let wy = Math.round(headTopY + headH * 0.28);
    wy <= Math.round(headTopY + headH * 0.44);
    wy++
  ) {
    const ly = wy - offsetY;
    if (ly < 0 || ly >= h) continue;
    const sp = scanRowSpan(d, w, ly, xMin, xMax, centerX);
    if (sp) {
      browL.push(sp[0] + offsetX);
      browR.push(sp[1] + offsetX);
    }
  }
  const medL = browL.length ? medianNum(browL) : ref.headCx - ref.headRx;
  const medR = browR.length ? medianNum(browR) : ref.headCx + ref.headRx;
  const headCx = Math.round((medL + medR) / 2);
  const headRx = Math.max(28, Math.round((medR - medL) / 2));
  const headCy = Math.round((headTopY + chinY) / 2);
  const headRy = Math.round(headH / 2);
  const eyeY = Math.round(headTopY + headH * 0.515);
  const noseY = Math.round(headTopY + headH * 0.698);
  const mouthY = Math.round(headTopY + headH * 0.849);
  const faceShiftX = Math.round(ref.faceShiftX * (headRx / Math.max(28, ref.headRx)));
  const cropX0 = Math.round(neckCx - OVERLAY_HEAD_W / 2);

  return {
    headCx,
    headCy,
    headRx,
    headRy,
    faceShiftX,
    eyeY,
    noseY,
    mouthY,
    chinY,
    neckY: 230,
    neckL,
    neckR,
    neckAttachX:
      space === "overlay-220x280" ? Math.round(neckCx - offsetX) : Math.round(neckCx - cropX0),
    neckAttachY: 230 - OVERLAY_HEAD_CROP_Y0,
  };
}

/**
 * Extracts a standalone transparent 220x280 Head+Neck overlay sprite from a 480x1000 body canvas,
 * feathering cleanly at the collarbone base so it transfers seamlessly onto any other body.
 */
export function extractHeadNeckFromBodyCanvas(
  bodyCanvas: HTMLCanvasElement,
  angle: Angle2D,
): { overlayCanvas: HTMLCanvasElement; anchors: HeadAngleAnchors2D } {
  const anchors = measureHeadAnchorsFromCanvas(bodyCanvas, angle, "body-480x1000");
  const neckCx = (anchors.neckL + anchors.neckR) / 2;
  const neckW = Math.max(36, anchors.neckR - anchors.neckL);
  const cropX0 = Math.round(neckCx - OVERLAY_HEAD_W / 2);

  const out = document.createElement("canvas");
  out.width = OVERLAY_HEAD_W;
  out.height = OVERLAY_HEAD_H;
  const octx = out.getContext("2d")!;
  octx.drawImage(
    bodyCanvas,
    cropX0,
    OVERLAY_HEAD_CROP_Y0,
    OVERLAY_HEAD_W,
    OVERLAY_HEAD_H,
    0,
    0,
    OVERLAY_HEAD_W,
    OVERLAY_HEAD_H,
  );

  const img = octx.getImageData(0, 0, OVERLAY_HEAD_W, OVERLAY_HEAD_H);
  const d = img.data;
  for (let oy = 0; oy < OVERLAY_HEAD_H; oy++) {
    const y480 = oy + OVERLAY_HEAD_CROP_Y0;
    const pastChin = y480 - (anchors.chinY + 8);
    const halfKeepW = neckW * 0.5 + 7 + Math.max(0, y480 - (anchors.chinY + 4)) * 0.22;
    for (let ox = 0; ox < OVERLAY_HEAD_W; ox++) {
      const x480 = ox + cropX0;
      const i = (oy * OVERLAY_HEAD_W + ox) * 4;
      let a = d[i + 3] ?? 0;
      if (a === 0) continue;

      if (y480 >= 250) {
        d[i + 3] = 0;
        continue;
      }
      if (pastChin > 0) {
        const distX = Math.abs(x480 - neckCx);
        if (distX > halfKeepW) {
          d[i + 3] = 0;
          continue;
        }
        if (distX > halfKeepW - 3) {
          a = Math.round(a * ((halfKeepW - distX) / 3));
        }
      }
      if (y480 > anchors.neckY + 4) {
        const vFade = Math.max(0, Math.min(1, (250 - y480) / 16));
        a = Math.round(a * vFade);
      }
      d[i + 3] = a;
    }
  }
  octx.putImageData(img, 0, 0);
  return { overlayCanvas: out, anchors };
}

function buildHeadThumbDataUrl(overlayCanvas: HTMLCanvasElement, a: HeadAngleAnchors2D): string {
  const thumb = document.createElement("canvas");
  thumb.width = 128;
  thumb.height = 128;
  const ctx = thumb.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const topY = Math.max(0, a.headCy - a.headRy - 14 - OVERLAY_HEAD_CROP_Y0);
  const win = Math.max(140, Math.round(a.headRy * 2 + 52));
  const sx = Math.max(0, Math.round(a.neckAttachX - win / 2));
  ctx.drawImage(
    overlayCanvas,
    sx,
    topY,
    Math.min(OVERLAY_HEAD_W - sx, win),
    Math.min(OVERLAY_HEAD_H - topY, win),
    0,
    0,
    128,
    128,
  );
  return encodeCanvasPreferWebp(thumb, 0.94);
}

/**
 * Slices a user-uploaded head image (`single`, `1x5`, or `1x8`) — either dedicated head+neck art
 * OR full-body turnaround sheets — into a reusable 8-angle `HeadPack2D` draft ready to save.
 */
export function sliceHeadTurnaroundSheet(
  source: HTMLImageElement | HTMLCanvasElement,
  mode: HeadPack2D["sheetMode"],
  removeWhiteBg = true,
  attachToBaseModelId?: string,
): {
  thumbnail: string;
  overlayFrames: Record<Angle2D, string>;
  bodyVariants?: Record<string, Record<Angle2D, string>>;
  anchors: Record<Angle2D, HeadAngleAnchors2D>;
} {
  const w = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const h =
    source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
  if (!w || !h) throw new Error("Image has zero dimensions.");

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = w;
  srcCanvas.height = h;
  const sctx = srcCanvas.getContext("2d");
  if (!sctx) throw new Error("Canvas 2D unavailable.");
  sctx.drawImage(source, 0, 0);

  const raw = sctx.getImageData(0, 0, w, h);
  let segs =
    mode === "single" ? [[0, w - 1] as [number, number]] : detectHorizontalSegments(raw.data, w, h);
  const expected = mode === "sheet-8" ? 8 : mode === "sheet-5" ? 5 : 1;
  if (segs.length !== expected) {
    segs = Array.from({ length: expected }, (_, i) => [
      Math.floor((w * i) / expected),
      Math.floor((w * (i + 1)) / expected) - 1,
    ]);
  }

  // Inspect first segment content aspect ratio to distinguish full-body vs head+neck-only uploads
  const cleanCrops: Array<{
    canvas: HTMLCanvasElement;
    ax0: number;
    ax1: number;
    ay0: number;
    ay1: number;
  }> = [];
  for (let i = 0; i < expected; i++) {
    const [rx0, rx1] = segs[i]!;
    const cx0 = Math.max(0, rx0 - 4);
    const cx1 = Math.min(w - 1, rx1 + 4);
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
    cleanCrops.push({ canvas: crop, ax0, ax1, ay0, ay1 });
  }

  const first = cleanCrops[0]!;
  const firstW = Math.max(1, first.ax1 - first.ax0 + 1);
  const firstH = Math.max(1, first.ay1 - first.ay0 + 1);
  const isFullBodySheet = mode !== "single" && firstH / firstW > 2.2;

  const targetAngles: readonly Angle2D[] =
    mode === "sheet-8"
      ? ANGLES_2D
      : mode === "sheet-5"
        ? ([0, 45, 90, 135, 180] as const)
        : ([0] as const);

  const overlayCanvases = {} as Record<Angle2D, HTMLCanvasElement>;
  const bodyCanvases = {} as Record<Angle2D, HTMLCanvasElement>;
  const anchors = {} as Record<Angle2D, HeadAngleAnchors2D>;

  targetAngles.forEach((angle, idx) => {
    const item = cleanCrops[idx]!;
    if (item.ax1 <= item.ax0 || item.ay1 <= item.ay0) {
      const blank = document.createElement("canvas");
      blank.width = OVERLAY_HEAD_W;
      blank.height = OVERLAY_HEAD_H;
      overlayCanvases[angle] = blank;
      anchors[angle] = measureHeadAnchorsFromCanvas(blank, angle, "overlay-220x280");
      return;
    }
    const figW = item.ax1 - item.ax0 + 1;
    const figH = item.ay1 - item.ay0 + 1;

    if (isFullBodySheet) {
      const bodyCanvas = document.createElement("canvas");
      bodyCanvas.width = CHAR2D_W;
      bodyCanvas.height = CHAR2D_H;
      const bctx = bodyCanvas.getContext("2d")!;
      bctx.imageSmoothingEnabled = true;
      bctx.imageSmoothingQuality = "high";
      const scale = Math.min((CHAR2D_W * 0.92) / figW, 870 / figH);
      const drawW = figW * scale;
      const drawH = figH * scale;
      bctx.drawImage(
        item.canvas,
        item.ax0,
        item.ay0,
        figW,
        figH,
        (CHAR2D_W - drawW) / 2,
        950 - drawH,
        drawW,
        drawH,
      );
      bodyCanvases[angle] = bodyCanvas;
      const extracted = extractHeadNeckFromBodyCanvas(bodyCanvas, angle);
      overlayCanvases[angle] = extracted.overlayCanvas;
      anchors[angle] = extracted.anchors;
    } else {
      // Dedicated Head+Neck upload: normalize so bottom of neck lands cleanly around y=214 in 220x280
      const ov = document.createElement("canvas");
      ov.width = OVERLAY_HEAD_W;
      ov.height = OVERLAY_HEAD_H;
      const octx = ov.getContext("2d")!;
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
      const targetH = 166;
      const scale = Math.min(156 / figW, targetH / figH);
      const drawW = figW * scale;
      const drawH = figH * scale;
      const neckBotInOv = 250 - OVERLAY_HEAD_CROP_Y0; // 214
      const dx = (OVERLAY_HEAD_W - drawW) / 2;
      const dy = Math.max(12, neckBotInOv - drawH);
      octx.drawImage(item.canvas, item.ax0, item.ay0, figW, figH, dx, dy, drawW, drawH);

      // Feather bottom 16px linearly at neck base
      const imgData = octx.getImageData(0, 0, OVERLAY_HEAD_W, OVERLAY_HEAD_H);
      for (let oy = 198; oy < OVERLAY_HEAD_H; oy++) {
        const fade = oy >= 214 ? 0 : (214 - oy) / 16;
        for (let ox = 0; ox < OVERLAY_HEAD_W; ox++) {
          const i = (oy * OVERLAY_HEAD_W + ox) * 4;
          imgData.data[i + 3] = Math.round((imgData.data[i + 3] ?? 0) * fade);
        }
      }
      octx.putImageData(imgData, 0, 0);
      overlayCanvases[angle] = ov;
      anchors[angle] = measureHeadAnchorsFromCanvas(ov, angle, "overlay-220x280");
    }
  });

  if (mode === "sheet-5") {
    for (const [srcAng, mirAng] of MIRROR_PAIRS_2D) {
      overlayCanvases[mirAng] = mirrorCanvasHorizontally(overlayCanvases[srcAng]);
      anchors[mirAng] = measureHeadAnchorsFromCanvas(
        overlayCanvases[mirAng],
        mirAng,
        "overlay-220x280",
      );
      if (isFullBodySheet && bodyCanvases[srcAng]) {
        bodyCanvases[mirAng] = mirrorCanvasHorizontally(bodyCanvases[srcAng]);
      }
    }
  } else if (mode === "single") {
    const front = overlayCanvases[0];
    const frontA = anchors[0];
    for (const ang of ANGLES_2D) {
      if (ang === 0) continue;
      const useMirror = ang === 225 || ang === 270 || ang === 315;
      overlayCanvases[ang] = useMirror ? mirrorCanvasHorizontally(front) : front;
      const ref = defaultAnchorsForAngle(ang);
      anchors[ang] = {
        ...frontA,
        faceShiftX: Math.round(ref.faceShiftX * (frontA.headRx / Math.max(28, ref.headRx))),
      };
    }
  }

  const overlayFrames = {} as Record<Angle2D, string>;
  for (const ang of ANGLES_2D) {
    overlayFrames[ang] = encodeCanvasPreferWebp(overlayCanvases[ang], 0.94);
  }

  let bodyVariants: Record<string, Record<Angle2D, string>> | undefined;
  if (isFullBodySheet && attachToBaseModelId) {
    const variantFrames = {} as Record<Angle2D, string>;
    for (const ang of ANGLES_2D) {
      variantFrames[ang] = encodeCanvasPreferWebp(bodyCanvases[ang], 0.94);
    }
    bodyVariants = { [attachToBaseModelId]: variantFrames };
  }

  const thumbnail = buildHeadThumbDataUrl(overlayCanvases[0], anchors[0]);
  return { thumbnail, overlayFrames, bodyVariants, anchors };
}

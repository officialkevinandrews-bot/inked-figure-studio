import {
  ANGLES_2D,
  CHAR2D_H,
  CHAR2D_W,
  DEFAULT_CUSTOM_TRANSFORM_2D,
  EXPRESSION_PRESETS_2D,
  isBackFacingAngle2D,
  type Angle2D,
  type BaseModel2D,
  type BodyAngleAnchors,
  type BodyPoint2D,
  type BrowStyle2D,
  type Character2D,
  type CustomLayerInstance2D,
  type CustomPartAsset2D,
  type EyeStyle2D,
  type HeadAngleAnchors2D,
  type HeadPack2D,
  type MouthStyle2D,
  type NoseStyle2D,
  type RenderMode2D,
} from "./character2d-types";
import { OVERLAY_HEAD_H, OVERLAY_HEAD_W, resolveHeadPack2D } from "./character2d-heads";
import type { ShadingDepth2D } from "./character2d-types";
import {
  resolveIllustratedBottomPack2D,
  resolveIllustratedFacePack2D,
  resolveIllustratedFootwearPack2D,
  resolveIllustratedHairPack2D,
  resolveIllustratedTopPack2D,
  type IllustratedClothingPack2D,
  type IllustratedFacePack2D,
  type IllustratedHairPack2D,
} from "./character2d-catalog";
import {
  applySkinToneCanvas,
  extractIllustratedMangaLineartCanvas,
  extractMangaLineartCanvas,
  recolorIllustratedPartCanvas,
  recolorIrisCanvas,
  recolorTintedInkCanvas,
  tintCustomPartCanvas,
} from "./character2d-slicer";
import { loadImageElement2D } from "./character2d-store";

type C = CanvasRenderingContext2D;

const INK_COLOR = "#161922";
const MANGA_INK = "#000000";

const PROCESSED_SPRITE_CACHE = new Map<string, HTMLCanvasElement>();
function putProcessedCache(key: string, val: HTMLCanvasElement): HTMLCanvasElement {
  if (PROCESSED_SPRITE_CACHE.size > 72) {
    const oldest = PROCESSED_SPRITE_CACHE.keys().next().value;
    if (oldest) PROCESSED_SPRITE_CACHE.delete(oldest);
  }
  PROCESSED_SPRITE_CACHE.set(key, val);
  return val;
}

export function isUsingSeamlessHeadVariant(
  baseModel: BaseModel2D,
  char: Character2D,
  angle: Angle2D,
  headPack?: HeadPack2D,
): boolean {
  const head = headPack ?? resolveHeadPack2D(char.headShapeId);
  const scale = char.headFit?.scale ?? 1;
  const offsetY = char.headFit?.offsetY ?? 0;
  return (
    Boolean(head.bodyVariants?.[baseModel.id]?.[angle]) &&
    Math.abs(scale - 1) < 0.005 &&
    Math.abs(offsetY) < 0.5
  );
}

function getProcessedCompositedBaseSprite(
  baseImg: HTMLImageElement,
  baseSrc: string,
  headOverlayImg: HTMLImageElement | undefined,
  headSrc: string,
  baseAnchors: BodyAngleAnchors,
  headAnchors: HeadAngleAnchors2D | undefined,
  fitScale: number,
  fitOffsetY: number,
  mode: RenderMode2D,
  skinTone: string | null,
): HTMLCanvasElement {
  const key = `comp|${baseSrc}|${headSrc}|${fitScale.toFixed(2)}|${fitOffsetY}|${mode}|${skinTone ?? "orig"}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;

  if (!headOverlayImg || !headAnchors) {
    return getProcessedBaseSprite(baseImg, baseSrc, mode, skinTone);
  }

  const scale = baseImg.naturalWidth >= CHAR2D_W * 2 ? 2 : 1;
  const tw = CHAR2D_W * scale;
  const th = CHAR2D_H * scale;
  const merged = document.createElement("canvas");
  merged.width = tw;
  merged.height = th;
  const ctx = merged.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.scale(scale, scale);
  ctx.drawImage(baseImg, 0, 0, CHAR2D_W, CHAR2D_H);

  // Erase existing base head+neck strictly inside the neck column so base shoulders/trapezius stay 100% intact
  const targetNeckCx = (baseAnchors.neckL + baseAnchors.neckR) / 2;
  const targetNeckY = baseAnchors.neckY + fitOffsetY;
  const scoopY = Math.min(baseAnchors.neckY + 2, targetNeckY + 4);
  const neckMinX = baseAnchors.neckL - 3;
  const neckMaxX = baseAnchors.neckR + 3;

  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(CHAR2D_W, 0);
  ctx.lineTo(CHAR2D_W, baseAnchors.chinY + 2);
  ctx.lineTo(neckMaxX + 4, baseAnchors.chinY + 4);
  ctx.quadraticCurveTo(neckMaxX, scoopY - 2, targetNeckCx, scoopY);
  ctx.quadraticCurveTo(neckMinX, scoopY - 2, neckMinX - 4, baseAnchors.chinY + 4);
  ctx.lineTo(0, baseAnchors.chinY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Draw standalone Head+Neck overlay aligned onto target collarbone pivot
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const dx = targetNeckCx - headAnchors.neckAttachX * fitScale;
  const dy = targetNeckY - headAnchors.neckAttachY * fitScale;
  ctx.drawImage(headOverlayImg, dx, dy, OVERLAY_HEAD_W * fitScale, OVERLAY_HEAD_H * fitScale);
  ctx.restore();
  ctx.restore();

  const processed =
    mode === "manga"
      ? extractMangaLineartCanvas(merged, tw, th, { kind: "body", pixelScale: scale })
      : applySkinToneCanvas(merged, skinTone, tw, th);
  return putProcessedCache(key, processed);
}

function getProcessedBaseSprite(
  img: HTMLImageElement,
  srcKey: string,
  mode: RenderMode2D,
  skinTone: string | null,
): HTMLCanvasElement {
  const key = `base|${srcKey}|${mode}|${skinTone ?? "orig"}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;
  const scale = img.naturalWidth >= CHAR2D_W * 2 ? 2 : 1;
  const tw = CHAR2D_W * scale;
  const th = CHAR2D_H * scale;
  const processed =
    mode === "manga"
      ? extractMangaLineartCanvas(img, tw, th, { kind: "body", pixelScale: scale })
      : applySkinToneCanvas(img, skinTone, tw, th);
  return putProcessedCache(key, processed);
}

function getProcessedPartSprite(
  img: HTMLImageElement,
  srcKey: string,
  mode: RenderMode2D,
  tintHex: string | null,
  shadingDepth: ShadingDepth2D = "cel",
): HTMLCanvasElement {
  const key = `part|${srcKey}|${mode}|${shadingDepth}|${tintHex ?? "orig"}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;
  return putProcessedCache(key, tintCustomPartCanvas(img, tintHex, mode, shadingDepth));
}

function getRecoloredIllustratedPart(
  baseImg: HTMLImageElement | HTMLCanvasElement,
  srcKey: string,
  primaryHex: string,
  mode: RenderMode2D,
  shadingDepth: ShadingDepth2D,
  accentMaskImg?: HTMLImageElement | HTMLCanvasElement | null,
  accentKey?: string,
  accentHex?: string | null,
  targetW?: number,
  targetH?: number,
  kind: "hair" | "cloth" = "cloth",
): HTMLCanvasElement {
  const key = `ill2|${kind}|${srcKey}|${accentKey ?? "nomask"}|${mode}|${shadingDepth}|${primaryHex}|${accentHex ?? "noacc"}|${targetW ?? 0}x${targetH ?? 0}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;
  return putProcessedCache(
    key,
    recolorIllustratedPartCanvas(baseImg, primaryHex, {
      accentMaskImg,
      accentHex,
      shadingDepth,
      renderMode: mode,
      kind,
      targetW,
      targetH,
    }),
  );
}

function getHairShadowSilhouette(img: HTMLImageElement, srcKey: string): HTMLCanvasElement {
  const key = `hair-sh|${srcKey}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;
  const w = Math.min(560, img.naturalWidth || img.width || 280);
  const h = Math.min(560, img.naturalHeight || img.height || 280);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cctx = c.getContext("2d")!;
  cctx.drawImage(img, 0, 0, w, h);
  cctx.globalCompositeOperation = "source-in";
  cctx.fillStyle = "rgba(116, 62, 56, 0.25)";
  cctx.fillRect(0, 0, w, h);
  return putProcessedCache(key, c);
}

function getRecoloredIrisSprite(
  irisImg: HTMLImageElement,
  srcKey: string,
  eyeColorHex: string,
  mode: RenderMode2D,
): HTMLCanvasElement {
  const key = `iris|${srcKey}|${mode}|${eyeColorHex}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;
  return putProcessedCache(key, recolorIrisCanvas(irisImg, eyeColorHex, mode));
}

function getRecoloredInkSprite(
  strokeImg: HTMLImageElement,
  srcKey: string,
  hexColor: string,
  mode: RenderMode2D,
): HTMLCanvasElement {
  const key = `ink|${srcKey}|${mode}|${hexColor}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;
  return putProcessedCache(key, recolorTintedInkCanvas(strokeImg, hexColor, mode));
}

function getMangaLineSprite(img: HTMLImageElement, srcKey: string): HTMLCanvasElement {
  const key = `ill-manga-eye|${srcKey}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;
  return putProcessedCache(
    key,
    extractIllustratedMangaLineartCanvas(img, undefined, undefined, { kind: "eye" }),
  );
}

interface HeadSilhouetteInfo {
  topY: number;
  chinY: number;
  headH: number;
  eyeY: number;
  noseY: number;
  mouthY: number;
  skullL: number;
  skullR: number;
  skullCx: number;
  skullW: number;
  headCy: number;
  eyeSpan: [number, number];
  noseSpan: [number, number];
  mouthSpan: [number, number];
  neckL: number;
  neckR: number;
  neckCx: number;
  neckW: number;
  /** Exact neck [left, right] measured in the hoodie-collar contact band (y = 212..216). */
  collarNeckL: number;
  collarNeckR: number;
  headMaskCanvas: HTMLCanvasElement;
}

const HEAD_SILHOUETTE_CACHE = new Map<string, HeadSilhouetteInfo>();

const M1_REF_SKULL_W: Record<Angle2D, number> = {
  0: 88,
  45: 96,
  90: 102,
  135: 98,
  180: 90,
  225: 101,
  270: 101,
  315: 94,
};

/**
 * Exact Model #1 (Classic Oval) neck [left, right] collar-contact edges measured in angle-aware bands:
 * - Nape / back-of-neck side measured at y = 203..209 (right at the hood crest, strictly above the y = 211 shoulder-blend seam)
 * - Front / throat side measured at y = 212..217 (strictly below protruding jaw/chin contours)
 */
const M1_REF_COLLAR_NECK: Record<Angle2D, readonly [number, number]> = {
  0: [220, 263],
  45: [203, 245],
  90: [203, 245],
  135: [204, 249],
  180: [215, 262],
  225: [237, 282],
  270: [242, 284],
  315: [237, 279],
};

function getCollarMeasureYBands2D(angle: Angle2D): {
  leftBand: readonly [number, number];
  rightBand: readonly [number, number];
} {
  if (angle === 0) return { leftBand: [205, 210], rightBand: [205, 210] };
  if (angle === 180) return { leftBand: [204, 209], rightBand: [204, 209] };
  // Facing right (45°, 90°, 135°): left = nape (hood crest), right = throat (below jaw/chin)
  if (angle === 45 || angle === 135) return { leftBand: [203, 208], rightBand: [212, 216] };
  if (angle === 90) return { leftBand: [204, 209], rightBand: [212, 217] };
  // Facing left (225°, 270°, 315°): left = throat (below jaw/chin), right = nape (hood crest)
  if (angle === 270) return { leftBand: [212, 217], rightBand: [204, 209] };
  return { leftBand: [212, 216], rightBand: [203, 208] };
}

function analyzeBaseHeadSilhouette(
  processedBase: HTMLCanvasElement,
  key: string,
  angle: Angle2D,
  fallbackAnchors: BodyAngleAnchors,
): HeadSilhouetteInfo {
  const cacheKey = `${key}|${angle}|${Math.round(fallbackAnchors.chinY)}`;
  const cached = HEAD_SILHOUETTE_CACHE.get(cacheKey);
  if (cached) return cached;

  const s = processedBase.width / CHAR2D_W;
  const x0 = 140;
  const x1 = 340;
  const y0 = 55;
  const y1 = 255;
  const rw = x1 - x0;
  const rh = y1 - y0;
  // Probe at logical 1x for fast landmark measurement regardless of 1x vs 2x backing canvas
  const probe = document.createElement("canvas");
  probe.width = rw;
  probe.height = rh;
  const pctx = probe.getContext("2d")!;
  pctx.drawImage(processedBase, x0 * s, y0 * s, rw * s, rh * s, 0, 0, rw, rh);
  const data = pctx.getImageData(0, 0, rw, rh).data;

  const rowSpan = (wy: number): [number, number] | null => {
    const ly = Math.round(wy) - y0;
    if (ly < 0 || ly >= rh) return null;
    let l = -1;
    let r = -1;
    for (let lx = 0; lx < rw; lx++) {
      if ((data[(ly * rw + lx) * 4 + 3] ?? 0) > 60) {
        if (l < 0) l = x0 + lx;
        r = x0 + lx;
      }
    }
    return l >= 0 ? [l, r] : null;
  };

  let topY = 80;
  for (let y = 58; y <= 135; y++) {
    const sp = rowSpan(y);
    if (sp && sp[1] - sp[0] + 1 >= 14) {
      topY = y;
      break;
    }
  }

  const chinY = Math.max(topY + 112, Math.min(topY + 130, Math.round(fallbackAnchors.chinY)));
  const headH = Math.max(100, chinY - topY);
  const eyeY = Math.round(topY + headH * 0.515);
  const noseY = Math.round(topY + headH * 0.695);
  const mouthY = Math.round(topY + headH * 0.825);

  const rowSpanBand = (cy: number, fallbackW: number): [number, number] => {
    const ls: number[] = [];
    const rs: number[] = [];
    for (let dy = -2; dy <= 2; dy++) {
      const sp = rowSpan(cy + dy);
      if (sp && sp[1] - sp[0] > 18) {
        ls.push(sp[0]);
        rs.push(sp[1]);
      }
    }
    if (!ls.length) {
      return [fallbackAnchors.headCx - fallbackW / 2, fallbackAnchors.headCx + fallbackW / 2];
    }
    ls.sort((a, b) => a - b);
    rs.sort((a, b) => a - b);
    return [ls[ls.length >> 1]!, rs[rs.length >> 1]!];
  };

  const skullLs: number[] = [];
  const skullRs: number[] = [];
  for (let y = topY + 24; y <= eyeY - 4; y++) {
    const sp = rowSpan(y);
    if (sp && sp[1] - sp[0] >= 30) {
      skullLs.push(sp[0]);
      skullRs.push(sp[1]);
    }
  }
  skullLs.sort((a, b) => a - b);
  skullRs.sort((a, b) => a - b);
  const skullL = skullLs.length ? skullLs[skullLs.length >> 1]! : fallbackAnchors.headCx - 45;
  const skullR = skullRs.length ? skullRs[skullRs.length >> 1]! : fallbackAnchors.headCx + 45;
  const skullCx = (skullL + skullR) / 2;
  const skullW = skullR - skullL + 1;
  const headCy = topY + headH * 0.51;

  const eyeSpan = rowSpanBand(eyeY, skullW);
  const noseSpan = rowSpanBand(noseY, skullW * 0.86);
  const mouthSpan = rowSpanBand(mouthY, skullW * 0.72);

  let neckL = fallbackAnchors.neckL;
  let neckR = fallbackAnchors.neckR;
  let minNeckW = 999;
  for (let y = chinY + 5; y <= 226; y++) {
    const sp = rowSpan(y);
    if (sp) {
      const w = sp[1] - sp[0] + 1;
      if (w >= 26 && w < minNeckW) {
        minNeckW = w;
        neckL = sp[0];
        neckR = sp[1];
      }
    }
  }
  const neckCx = (neckL + neckR) / 2;
  const neckW = neckR - neckL + 1;

  // Measure exact collar-contact neck edges per side using angle-aware nape vs. throat Y bands
  const { leftBand, rightBand } = getCollarMeasureYBands2D(angle);
  const colLs: number[] = [];
  for (let y = leftBand[0]; y <= leftBand[1]; y++) {
    const sp = rowSpan(y);
    if (sp && sp[1] - sp[0] >= 22) colLs.push(sp[0]);
  }
  const colRs: number[] = [];
  for (let y = rightBand[0]; y <= rightBand[1]; y++) {
    const sp = rowSpan(y);
    if (sp && sp[1] - sp[0] >= 22) colRs.push(sp[1]);
  }
  colLs.sort((a, b) => a - b);
  colRs.sort((a, b) => a - b);
  const collarNeckL = colLs.length ? colLs[colLs.length >> 1]! : neckL;
  const collarNeckR = colRs.length ? colRs[colRs.length >> 1]! : neckR;

  // Build per-pixel eroded interior head mask canvas at native sprite scale so zero face pixels float outside head outline
  const maskScale = Math.max(1, Math.round(s));
  const mrw = rw * maskScale;
  const mrh = rh * maskScale;
  const headMaskCanvas = document.createElement("canvas");
  headMaskCanvas.width = mrw;
  headMaskCanvas.height = mrh;
  const hmCtx = headMaskCanvas.getContext("2d")!;
  const srcMaskData =
    maskScale === 1
      ? data
      : processedBase.getContext("2d")!.getImageData(x0 * maskScale, y0 * maskScale, mrw, mrh).data;
  const hmId = hmCtx.createImageData(mrw, mrh);
  const hmd = hmId.data;
  const maxMaskY = Math.min(mrh - 1, (chinY - 2 - y0) * maskScale);
  const minMaskY = Math.max(0, (topY + 2 - y0) * maskScale);
  const alphaAt = (lx: number, ly: number) =>
    lx >= 0 && lx < mrw && ly >= 0 && ly < mrh ? (srcMaskData[(ly * mrw + lx) * 4 + 3] ?? 0) : 0;
  for (let ly = minMaskY; ly <= maxMaskY; ly++) {
    const wy = y0 + ly / maskScale;
    const inEyeBand = Math.abs(wy - eyeY) <= 15;
    const marginL = (inEyeBand && angle === 315 ? 1 : 2) * maskScale;
    const marginR = (inEyeBand && angle === 45 ? 1 : 2) * maskScale;
    for (let lx = 0; lx < mrw; lx++) {
      if (
        alphaAt(lx, ly) >= 200 &&
        alphaAt(lx - marginL, ly) >= 160 &&
        alphaAt(lx + marginR, ly) >= 160 &&
        alphaAt(lx, ly - maskScale) >= 180 &&
        alphaAt(lx, ly + maskScale) >= 180
      ) {
        const p = (ly * mrw + lx) * 4;
        hmd[p] = 0;
        hmd[p + 1] = 0;
        hmd[p + 2] = 0;
        hmd[p + 3] = 255;
      }
    }
  }
  hmCtx.putImageData(hmId, 0, 0);

  const info: HeadSilhouetteInfo = {
    topY,
    chinY,
    headH,
    eyeY,
    noseY,
    mouthY,
    skullL,
    skullR,
    skullCx,
    skullW,
    headCy,
    eyeSpan,
    noseSpan,
    mouthSpan,
    neckL,
    neckR,
    neckCx,
    neckW,
    collarNeckL,
    collarNeckR,
    headMaskCanvas,
  };
  if (HEAD_SILHOUETTE_CACHE.size >= 48) {
    const first = HEAD_SILHOUETTE_CACHE.keys().next().value;
    if (first !== undefined) HEAD_SILHOUETTE_CACHE.delete(first);
  }
  HEAD_SILHOUETTE_CACHE.set(cacheKey, info);
  return info;
}

export interface TopCollarFit2D {
  srcL: number;
  srcR: number;
  /** Signed horizontal shift for left collar/hood rim (- = expand outward, + = pull inward/right). */
  dL: number;
  /** Signed horizontal shift for right collar/hood rim (+ = expand outward, - = pull inward/left). */
  dR: number;
  angle: Angle2D;
}

/**
 * Pure monotonic C1 piecewise horizontal coordinate mapper for bidirectional collar & hood fitting.
 * Keeps outer shoulders (`<= anchorL`, `>= anchorR`) 100% locked while smoothly moving the left & right
 * collar/hood rims to hug any head shape's exact neck width & horizontal offset with zero folds or tears.
 */
export function mapCollarWarpDstXToSrcX(
  x: number,
  yFac: number,
  srcL: number,
  srcR: number,
  dL: number,
  dR: number,
  anchorL: number,
  anchorR: number,
): number {
  if (yFac <= 0.001 || x <= anchorL || x >= anchorR) return x;
  const effDL = dL * yFac;
  const effDR = dR * yFac;
  const dstL = srcL + effDL;
  const dstR = srcR + effDR;
  if (dstL <= anchorL + 4 || dstR >= anchorR - 4 || dstR <= dstL + 8) return x;

  if (x <= dstL) {
    const u = (x - anchorL) / (dstL - anchorL);
    const sm = u * u * (3 - 2 * u);
    return x - effDL * sm;
  }
  if (x >= dstR) {
    const u = (anchorR - x) / (anchorR - dstR);
    const sm = u * u * (3 - 2 * u);
    return x - effDR * sm;
  }
  const t = (x - dstL) / (dstR - dstL);
  return x - (effDL + (effDR - effDL) * t);
}

/**
 * Warps a raw top sprite (or its accent mask) BEFORE recoloring / Manga Ink extraction so collars & hoods
 * hug every head/neck shape snugly (contracting for slim necks, expanding for wide necks, translating for shifted necks)
 * while keeping shoulders, sleeves, zipper & pockets locked and Manga Ink lines razor sharp.
 */
function getCollarWarpedSourceCanvas(
  srcImg: HTMLImageElement,
  srcKey: string,
  fit: TopCollarFit2D,
): HTMLCanvasElement | HTMLImageElement {
  if (Math.abs(fit.dL) <= 1 && Math.abs(fit.dR) <= 1) return srcImg;
  const w = srcImg.naturalWidth || srcImg.width || CHAR2D_W;
  const h = srcImg.naturalHeight || srcImg.height || CHAR2D_H;
  const s = w / CHAR2D_W;
  const rDL = Math.round(fit.dL * 2) / 2;
  const rDR = Math.round(fit.dR * 2) / 2;
  const key = `collarwarp4|${srcKey}|${w}x${h}|${fit.angle}|${rDL}|${rDR}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d")!;
  octx.drawImage(srcImg, 0, 0, w, h);

  const yMin = Math.max(0, Math.floor(188 * s));
  const yFull = Math.round(238 * s);
  const yMax = Math.min(h - 1, Math.ceil(304 * s));
  const bandH = yMax - yMin + 1;
  if (bandH <= 2) return srcImg;

  const srcId = octx.getImageData(0, yMin, w, bandH);
  const sd = srcId.data;
  const dstId = octx.createImageData(w, bandH);
  const dd = dstId.data;
  dd.set(sd);

  // Give generous reach on the draped-hood side so the entire back hood translates cohesively without squishing
  const reachL = fit.angle === 45 || fit.angle === 90 || fit.angle === 135 ? 82 : 64;
  const reachR = fit.angle === 225 || fit.angle === 270 || fit.angle === 315 ? 82 : 64;
  const srcLPx = fit.srcL * s;
  const srcRPx = fit.srcR * s;
  const dLPx = rDL * s;
  const dRPx = rDR * s;
  const anchorLPx = Math.max(2, (fit.srcL - reachL) * s);
  const anchorRPx = Math.min(w - 3, (fit.srcR + reachR) * s);
  const xScanMin = Math.max(0, Math.floor(anchorLPx));
  const xScanMax = Math.min(w - 1, Math.ceil(anchorRPx));

  for (let ly = 0; ly < bandH; ly++) {
    const wy = yMin + ly;
    let yFac = 1;
    if (wy > yFull) {
      const t = Math.max(0, Math.min(1, (yMax - wy) / Math.max(1, yMax - yFull)));
      yFac = t * t * (3 - 2 * t);
    }
    if (yFac <= 0.001) continue;
    const rowOff = ly * w;
    for (let x = xScanMin; x <= xScanMax; x++) {
      const sx = mapCollarWarpDstXToSrcX(x, yFac, srcLPx, srcRPx, dLPx, dRPx, anchorLPx, anchorRPx);
      const x0 = Math.max(0, Math.min(w - 2, Math.floor(sx)));
      const f = sx - x0;
      const i0 = (rowOff + x0) * 4;
      const i1 = i0 + 4;
      const oi = (rowOff + x) * 4;
      const a0 = sd[i0 + 3] ?? 0;
      const a1 = sd[i1 + 3] ?? 0;
      const aOut = a0 * (1 - f) + a1 * f;
      if (aOut < 1) {
        dd[oi] = 0;
        dd[oi + 1] = 0;
        dd[oi + 2] = 0;
        dd[oi + 3] = 0;
        continue;
      }
      // Premultiplied-alpha bilinear interpolation avoids dark/white edge fringes along collar silhouettes!
      const w0 = (1 - f) * a0;
      const w1 = f * a1;
      const wSum = w0 + w1 || 1;
      dd[oi] = Math.round(((sd[i0] ?? 0) * w0 + (sd[i1] ?? 0) * w1) / wSum);
      dd[oi + 1] = Math.round(((sd[i0 + 1] ?? 0) * w0 + (sd[i1 + 1] ?? 0) * w1) / wSum);
      dd[oi + 2] = Math.round(((sd[i0 + 2] ?? 0) * w0 + (sd[i1 + 2] ?? 0) * w1) / wSum);
      dd[oi + 3] = Math.round(aOut);
    }
  }

  octx.putImageData(dstId, 0, yMin);
  return putProcessedCache(key, out);
}

function redrawHeadNeckAboveCollar2D(
  ctx: C,
  processedBase: HTMLCanvasElement | null,
  sil: HeadSilhouetteInfo | null,
  angle: Angle2D,
) {
  if (!processedBase || !sil) return;
  // On rear views (135°, 180°, 225°), the hoodie hood sits in front of the nape — NEVER stamp neck skin over the hood crest!
  if (isBackFacingAngle2D(angle)) return;
  ctx.save();
  ctx.beginPath();
  // Keep jawline & chin crisp strictly above y = chinY + 1 so collar & inner T-shirt crewneck remain intact
  ctx.rect(140, 0, 200, sil.chinY + 1);
  ctx.clip();
  ctx.drawImage(processedBase, 0, 0, CHAR2D_W, CHAR2D_H);
  ctx.restore();
}

function getClothingMaskedBaseCanvas(
  processedBase: HTMLCanvasElement,
  rawBaseImg: HTMLImageElement | null,
  silKey: string,
  angle: Angle2D,
  anchors: BodyAngleAnchors,
  sil: HeadSilhouetteInfo | null,
  hasHair: boolean,
  hasTop: boolean,
  hasBottom: boolean,
  hasFootwear: boolean,
): HTMLCanvasElement {
  if (!hasHair && !hasTop && !hasBottom && !hasFootwear) return processedBase;
  const w = processedBase.width;
  const h = processedBase.height;
  const s = w / CHAR2D_W;
  const key = `cmask2|${silKey}|${w}x${h}|${angle}|${hasHair ? 1 : 0}${hasTop ? 1 : 0}${hasBottom ? 1 : 0}${hasFootwear ? 1 : 0}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d")!;
  octx.drawImage(processedBase, 0, 0);
  const img = octx.getImageData(0, 0, w, h);
  const d = img.data;

  // 1. Hide bald top-of-skull black outline underneath illustrated hair dome
  if (hasHair && sil) {
    const y0 = Math.max(0, Math.floor((sil.topY - 2) * s));
    const y1 = Math.min(h - 1, Math.ceil(Math.min(126, sil.topY + 32) * s));
    const xL = Math.max(0, Math.floor((sil.skullL - 2) * s));
    const xR = Math.min(w - 1, Math.ceil((sil.skullR + 2) * s));
    for (let y = y0; y <= y1; y++) {
      for (let x = xL; x <= xR; x++) {
        d[(y * w + x) * 4 + 3] = 0;
      }
    }
  }

  // 2. Hide covered central torso & inner deltoids under equipped top while keeping neck V-opening & bare forearms intact
  if (hasTop) {
    const neckCx = sil
      ? (sil.collarNeckL + sil.collarNeckR) / 2
      : (anchors.neckL + anchors.neckR) / 2;
    const baseVHalf = sil ? Math.max(26, (sil.collarNeckR - sil.collarNeckL) * 0.56) : 26;
    const isFrontV = angle === 0 || angle === 45 || angle === 315;
    const isProf = angle === 90 || angle === 270;
    const yTop0 = Math.floor(234 * s);
    const yTop1 = Math.ceil(334 * s);
    const xTop0 = Math.floor(124 * s);
    const xTop1 = Math.ceil(356 * s);
    for (let y = yTop0; y <= yTop1; y++) {
      const ly = y / s;
      const vHalfW = isFrontV ? Math.max(0, baseVHalf - Math.max(0, ly - 236) * 0.68) : 0;
      const vCx = neckCx + (angle === 45 ? 4 : angle === 315 ? -4 : 0);
      for (let x = xTop0; x <= xTop1; x++) {
        const lx = x / s;
        if (vHalfW > 0 && Math.abs(lx - vCx) <= vHalfW) continue;
        d[(y * w + x) * 4 + 3] = 0;
      }
    }
    const torsoClearL = Math.floor((isProf ? 155 : anchors.waistL + 6) * s);
    const torsoClearR = Math.ceil((isProf ? 325 : anchors.waistR - 6) * s);
    const yMid0 = Math.floor(335 * s);
    const yMid1 = Math.ceil(476 * s);
    for (let y = yMid0; y <= yMid1; y++) {
      for (let x = torsoClearL; x <= torsoClearR; x++) {
        d[(y * w + x) * 4 + 3] = 0;
      }
    }
  }

  // 3. Hide solid dark briefs at hips using RAW colored base pixels (NEVER black-and-white Manga pixels!)
  //    Erode+dilate the solid dark briefs core so thin 2-4px forearm/wrist/hand ink outlines are 100% preserved!
  if (hasBottom) {
    const hipCoreL = Math.floor((anchors.hipL + 6) * s);
    const hipCoreR = Math.ceil((anchors.hipR - 6) * s);
    const yB0 = Math.floor(432 * s);
    const yB1 = Math.ceil(584 * s);
    const xB0 = Math.floor(135 * s);
    const xB1 = Math.ceil(345 * s);
    const bandW = xB1 - xB0 + 1;
    const bandH = yB1 - yB0 + 1;

    let rawBandData: Uint8ClampedArray | null = null;
    if (rawBaseImg) {
      const rawS = (rawBaseImg.naturalWidth || rawBaseImg.width || CHAR2D_W) / CHAR2D_W;
      const rc = document.createElement("canvas");
      rc.width = bandW;
      rc.height = bandH;
      const rctx = rc.getContext("2d")!;
      rctx.drawImage(
        rawBaseImg,
        (xB0 / s) * rawS,
        (yB0 / s) * rawS,
        (bandW / s) * rawS,
        (bandH / s) * rawS,
        0,
        0,
        bandW,
        bandH,
      );
      rawBandData = rctx.getImageData(0, 0, bandW, bandH).data;
    }

    const darkNeutral = new Uint8Array(bandW * bandH);
    for (let ly = 0; ly < bandH; ly++) {
      for (let lx = 0; lx < bandW; lx++) {
        const q = ly * bandW + lx;
        if (rawBandData) {
          const ri = q * 4;
          if ((rawBandData[ri + 3] ?? 0) < 30) continue;
          const r = rawBandData[ri] ?? 255;
          const g = rawBandData[ri + 1] ?? 255;
          const b = rawBandData[ri + 2] ?? 255;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          if (maxDiff <= 24 && lum < 118) darkNeutral[q] = 1;
        } else {
          const i = ((yB0 + ly) * w + (xB0 + lx)) * 4;
          if ((d[i + 3] ?? 0) < 30) continue;
          const r = d[i] ?? 255;
          const g = d[i + 1] ?? 255;
          const b = d[i + 2] ?? 255;
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          if (maxDiff <= 15 && r < 110) darkNeutral[q] = 1;
        }
      }
    }

    // Keep only solid interior dark briefs core (erode by >= 2.5*s so thin hand/arm ink lines NEVER match)
    const erodeR = Math.max(2, Math.round(2.5 * s));
    const briefsCore = new Uint8Array(bandW * bandH);
    for (let ly = erodeR; ly < bandH - erodeR; ly++) {
      for (let lx = erodeR; lx < bandW - erodeR; lx++) {
        const q = ly * bandW + lx;
        if (!darkNeutral[q]) continue;
        if (
          darkNeutral[q - erodeR] &&
          darkNeutral[q + erodeR] &&
          darkNeutral[q - erodeR * bandW] &&
          darkNeutral[q + erodeR * bandW]
        ) {
          briefsCore[q] = 1;
        }
      }
    }

    // Dilate surviving briefs core by 3.5*s so the briefs border clears cleanly without touching bare hands
    const dilR = Math.max(3, Math.round(3.5 * s));
    const briefsMask = new Uint8Array(bandW * bandH);
    for (let ly = 0; ly < bandH; ly++) {
      for (let lx = 0; lx < bandW; lx++) {
        if (!briefsCore[ly * bandW + lx]) continue;
        const ny0 = Math.max(0, ly - dilR);
        const ny1 = Math.min(bandH - 1, ly + dilR);
        const nx0 = Math.max(0, lx - dilR);
        const nx1 = Math.min(bandW - 1, lx + dilR);
        for (let ny = ny0; ny <= ny1; ny++) {
          const rowOff = ny * bandW;
          for (let nx = nx0; nx <= nx1; nx++) {
            briefsMask[rowOff + nx] = 1;
          }
        }
      }
    }

    for (let ly = 0; ly < bandH; ly++) {
      const y = yB0 + ly;
      const wy = y / s;
      for (let lx = 0; lx < bandW; lx++) {
        const x = xB0 + lx;
        const q = ly * bandW + lx;
        const i = (y * w + x) * 4;
        if ((d[i + 3] ?? 0) < 10) continue;
        if (briefsMask[q] || (x >= hipCoreL && x <= hipCoreR && wy >= 468)) {
          d[i + 3] = 0;
        }
      }
    }
    const yL0 = Math.floor(584 * s);
    const yL1 = Math.ceil(846 * s);
    const xL0 = Math.floor(105 * s);
    const xL1 = Math.ceil(375 * s);
    for (let y = yL0; y <= yL1; y++) {
      for (let x = xL0; x <= xL1; x++) {
        d[(y * w + x) * 4 + 3] = 0;
      }
    }
  }

  // 4. Hide bare ankles, heels, and toes under equipped footwear
  if (hasFootwear) {
    const yF0 = Math.floor(844 * s);
    const yF1 = Math.min(h - 1, Math.ceil(970 * s));
    const xF0 = Math.floor(95 * s);
    const xF1 = Math.ceil(385 * s);
    for (let y = yF0; y <= yF1; y++) {
      for (let x = xF0; x <= xF1; x++) {
        d[(y * w + x) * 4 + 3] = 0;
      }
    }
  }

  octx.putImageData(img, 0, 0);
  return putProcessedCache(key, out);
}

function parseRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0]! + clean[0]!, 16),
      parseInt(clean[1]! + clean[1]!, 16),
      parseInt(clean[2]! + clean[2]!, 16),
    ];
  }
  const n = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(n)) return [120, 130, 145];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shadeHex(hex: string, amount: number): string {
  const [r, g, b] = parseRgb(hex);
  const mix = (v: number) =>
    amount >= 0 ? Math.round(v + (255 - v) * amount) : Math.round(v * (1 + amount));
  return `rgb(${Math.max(0, Math.min(255, mix(r)))},${Math.max(0, Math.min(255, mix(g)))},${Math.max(0, Math.min(255, mix(b)))})`;
}

function inkOf(mode: RenderMode2D): string {
  return mode === "manga" ? MANGA_INK : INK_COLOR;
}

function drawCelShape(
  ctx: C,
  tracePath: () => void,
  baseColor: string,
  mode: RenderMode2D,
  opts: {
    strokeWidth?: number;
    shadowSide?: "left" | "right" | "bottom";
    highlight?: boolean;
    bounds?: { x: number; y: number; w: number; h: number };
    noStroke?: boolean;
  } = {},
) {
  const lw = opts.strokeWidth ?? 2.3;
  ctx.save();
  ctx.beginPath();
  tracePath();

  if (mode === "manga") {
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    if (!opts.noStroke) {
      ctx.strokeStyle = MANGA_INK;
      ctx.lineWidth = lw;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = baseColor;
  ctx.fill();

  const b = opts.bounds ?? { x: 0, y: 0, w: CHAR2D_W, h: CHAR2D_H };
  ctx.save();
  ctx.clip();
  ctx.fillStyle = shadeHex(baseColor, -0.25);
  if (opts.shadowSide === "right") {
    ctx.fillRect(b.x + b.w * 0.68, b.y - 4, b.w * 0.4, b.h + 8);
  } else if (opts.shadowSide === "bottom") {
    ctx.fillRect(b.x - 4, b.y + b.h * 0.72, b.w + 8, b.h * 0.35);
  } else {
    ctx.fillRect(b.x - 4, b.y - 4, b.w * 0.3, b.h + 8);
  }

  if (opts.highlight) {
    ctx.fillStyle = shadeHex(baseColor, 0.24);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(
      b.x + b.w * 0.52,
      b.y + b.h * 0.22,
      Math.max(4, b.w * 0.24),
      Math.max(3, b.h * 0.08),
      -0.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();

  if (!opts.noStroke) {
    ctx.beginPath();
    tracePath();
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
}

function strokeLine(ctx: C, pts: [number, number][], mode: RenderMode2D, width = 1.8) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = inkOf(mode);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.stroke();
  ctx.restore();
}

function traceTaperedTube(ctx: C, pts: BodyPoint2D[], radii: number[]) {
  const leftSide: BodyPoint2D[] = [];
  const rightSide: BodyPoint2D[] = [];

  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)]!;
    const next = pts[Math.min(pts.length - 1, i + 1)]!;
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const nx = -dy;
    const ny = dx;
    const r = radii[i] ?? radii[radii.length - 1] ?? 16;
    const p = pts[i]!;
    leftSide.push({ x: p.x + nx * r, y: p.y + ny * r });
    rightSide.push({ x: p.x - nx * r, y: p.y - ny * r });
  }

  ctx.moveTo(leftSide[0]!.x, leftSide[0]!.y);
  for (let i = 1; i < leftSide.length; i++) {
    ctx.lineTo(leftSide[i]!.x, leftSide[i]!.y);
  }
  for (let i = rightSide.length - 1; i >= 0; i--) {
    ctx.lineTo(rightSide[i]!.x, rightSide[i]!.y);
  }
  ctx.closePath();
}

export function resolveEffectiveAnchors(
  model: BaseModel2D,
  char: Character2D,
  angle: Angle2D,
  headPack?: HeadPack2D,
): BodyAngleAnchors {
  const base = model.anchors[angle];
  const head = headPack ?? resolveHeadPack2D(char.headShapeId);
  const ha = head.anchors[angle];
  const fitScale = Math.max(0.75, Math.min(1.25, char.headFit?.scale ?? 1));
  const fitOffsetY = char.headFit?.offsetY ?? 0;
  const seamless = isUsingSeamlessHeadVariant(model, char, angle, head);

  let merged: BodyAngleAnchors = base;
  if (ha) {
    if (seamless) {
      merged = {
        ...base,
        headCx: ha.headCx,
        headCy: ha.headCy,
        headRx: ha.headRx,
        headRy: ha.headRy,
        faceShiftX: ha.faceShiftX,
        eyeY: ha.eyeY,
        noseY: ha.noseY,
        mouthY: ha.mouthY,
        chinY: ha.chinY,
        neckY: ha.neckY,
        neckL: ha.neckL,
        neckR: ha.neckR,
      };
    } else {
      const targetNeckCx = (base.neckL + base.neckR) / 2;
      const targetNeckY = base.neckY + fitOffsetY;
      const worldNeckCx = (ha.neckL + ha.neckR) / 2;
      const mapX = (wx: number) => Math.round(targetNeckCx + (wx - worldNeckCx) * fitScale);
      const mapY = (wy: number) => Math.round(targetNeckY + (wy - ha.neckY) * fitScale);
      const neckHalfW = Math.round(((ha.neckR - ha.neckL) / 2) * fitScale);
      merged = {
        ...base,
        headCx: mapX(ha.headCx),
        headCy: mapY(ha.headCy),
        headRx: Math.round(ha.headRx * fitScale),
        headRy: Math.round(ha.headRy * fitScale),
        faceShiftX: Math.round(ha.faceShiftX * fitScale),
        eyeY: mapY(ha.eyeY),
        noseY: mapY(ha.noseY),
        mouthY: mapY(ha.mouthY),
        chinY: mapY(ha.chinY),
        neckY: base.neckY,
        neckL: Math.round(targetNeckCx - neckHalfW),
        neckR: Math.round(targetNeckCx + neckHalfW),
      };
    }
  }

  const ov = char.anchorOverrides?.[angle];
  if (!ov) return merged;
  return { ...merged, ...ov };
}

function facingDir(angle: Angle2D): number {
  if (angle === 45 || angle === 90 || angle === 135) return 1;
  if (angle === 225 || angle === 270 || angle === 315) return -1;
  return 0;
}

function isProfile(angle: Angle2D): boolean {
  return angle === 90 || angle === 270;
}

function drawShoeUnit(
  ctx: C,
  ankle: BodyPoint2D,
  toe: BodyPoint2D,
  style: "sneakers" | "boots",
  angle: Angle2D,
  baseCol: string,
  accentCol: string,
  mode: RenderMode2D,
  footW: number,
  sideSign: number,
  isLeadFoot: boolean,
) {
  const dir = facingDir(angle);
  const prof = isProfile(angle);
  const collarY = style === "boots" ? ankle.y - 68 : ankle.y - 4;
  const soleBot = toe.y + 8;
  const soleTop = soleBot - (style === "boots" ? 12 : 9);

  let heelX: number;
  let tipX: number;
  if (prof) {
    heelX = dir > 0 ? ankle.x - 21 : ankle.x + 21;
    tipX = dir > 0 ? ankle.x + 76 : ankle.x - 76;
  } else if (dir !== 0 && isLeadFoot) {
    heelX = ankle.x - dir * 18;
    tipX = ankle.x + dir * 48;
  } else {
    const cx = ankle.x + sideSign * 2;
    heelX = cx - footW * 0.56;
    tipX = cx + footW * 0.56;
  }

  const x0 = Math.min(heelX, tipX);
  const x1 = Math.max(heelX, tipX);
  const w = Math.max(30, x1 - x0);
  const collarL = ankle.x - (prof ? 18 : footW * 0.44);
  const collarR = ankle.x + (prof ? 18 : footW * 0.44);
  const midX = (x0 + x1) / 2;

  // Tapered shoe/boot silhouette curving naturally down to toe cap
  drawCelShape(
    ctx,
    () => {
      if (prof || (dir !== 0 && isLeadFoot)) {
        const instepX = ankle.x + dir * (prof ? 28 : 18);
        const instepY = soleTop - 18;
        ctx.moveTo(collarL, collarY);
        ctx.lineTo(collarR, collarY);
        if (dir > 0) {
          ctx.lineTo(instepX, instepY);
          ctx.quadraticCurveTo(x1 + 2, soleTop - 16, x1, soleTop);
          ctx.lineTo(x0, soleTop);
          ctx.lineTo(x0 + 2, ankle.y + 18);
        } else {
          ctx.lineTo(x1 - 2, ankle.y + 18);
          ctx.lineTo(x1, soleTop);
          ctx.lineTo(x0, soleTop);
          ctx.quadraticCurveTo(x0 - 2, soleTop - 16, instepX, instepY);
        }
        ctx.closePath();
      } else {
        ctx.moveTo(collarL, collarY);
        ctx.lineTo(collarR, collarY);
        ctx.quadraticCurveTo(x1 + 2, ankle.y + 22, x1, soleTop);
        ctx.lineTo(x0, soleTop);
        ctx.quadraticCurveTo(x0 - 2, ankle.y + 22, collarL, collarY);
        ctx.closePath();
      }
    },
    baseCol,
    mode,
    {
      strokeWidth: 2.1,
      shadowSide: dir > 0 ? "left" : "right",
      bounds: { x: x0, y: collarY, w, h: soleBot - collarY },
    },
  );

  // Sleek midsole & toe cap
  drawCelShape(
    ctx,
    () => ctx.roundRect(x0 - 1, soleTop, w + 2, soleBot - soleTop, 3),
    accentCol,
    mode,
    { strokeWidth: 2.0, shadowSide: "bottom", bounds: { x: x0, y: soleTop, w, h: 12 } },
  );

  if (style === "sneakers") {
    strokeLine(
      ctx,
      [
        [x0 + 3, soleTop - 6],
        [x1 - 3, soleTop - 6],
      ],
      mode,
      1.4,
    );
    if (!prof) {
      for (let i = 0; i < 3; i++) {
        const ly = ankle.y + 8 + i * 8;
        strokeLine(
          ctx,
          [
            [midX - 5, ly],
            [midX + 5, ly],
          ],
          mode,
          1.5,
        );
      }
    }
  } else {
    drawCelShape(
      ctx,
      () => {
        const cw = prof ? 38 : footW * 0.96;
        ctx.roundRect(ankle.x - cw / 2, collarY - 2, cw, 14, 2);
      },
      accentCol,
      mode,
      { strokeWidth: 1.8, bounds: { x: ankle.x - 20, y: collarY, w: 40, h: 14 } },
    );
    strokeLine(
      ctx,
      [
        [ankle.x - 14, collarY + 30],
        [ankle.x + 14, collarY + 30],
      ],
      mode,
      1.7,
    );
    strokeLine(
      ctx,
      [
        [ankle.x - 14, collarY + 48],
        [ankle.x + 14, collarY + 48],
      ],
      mode,
      1.7,
    );
  }
}

function drawFootwear2D(
  ctx: C,
  char: Character2D,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
) {
  const fw = char.clothes.footwear;
  if (fw === "none") return;
  const col = char.clothes.footwearColor;
  const acc = char.clothes.footwearAccentColor;
  const dir = facingDir(angle);

  if (isProfile(angle)) {
    drawShoeUnit(
      ctx,
      a.legLeft[2],
      a.legLeft[3],
      fw,
      angle,
      col,
      acc,
      mode,
      a.calfWidth + 8,
      0,
      true,
    );
    return;
  }

  const footW = a.calfWidth * 1.1;
  if (dir > 0) {
    drawShoeUnit(ctx, a.legLeft[2], a.legLeft[3], fw, angle, col, acc, mode, footW, -1, false);
    drawShoeUnit(ctx, a.legRight[2], a.legRight[3], fw, angle, col, acc, mode, footW, 1, true);
  } else if (dir < 0) {
    drawShoeUnit(ctx, a.legRight[2], a.legRight[3], fw, angle, col, acc, mode, footW, 1, false);
    drawShoeUnit(ctx, a.legLeft[2], a.legLeft[3], fw, angle, col, acc, mode, footW, -1, true);
  } else {
    drawShoeUnit(ctx, a.legLeft[2], a.legLeft[3], fw, angle, col, acc, mode, footW, -1, false);
    drawShoeUnit(ctx, a.legRight[2], a.legRight[3], fw, angle, col, acc, mode, footW, 1, false);
  }
}

function drawBottoms2D(
  ctx: C,
  char: Character2D,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
) {
  const style = char.clothes.bottom;
  if (style === "none") return;

  const col = char.clothes.bottomColor;
  const acc = char.clothes.bottomAccentColor;
  const dir = facingDir(angle);
  const prof = isProfile(angle);
  const back = isBackFacingAngle2D(angle);
  const waistTop = a.waistY + 34; // ~446px (covers base dark briefs 100%)
  const pad = style === "cargo" ? 8 : style === "shorts" ? 7 : 5;
  const pelvisL = a.hipL - pad;
  const pelvisR = a.hipR + pad;
  const hipMidX = (pelvisL + pelvisR) / 2;

  const legWiden = style === "cargo" ? 9 : style === "shorts" ? 6 : 4;
  const drawLeg = (leg: BodyAngleAnchors["legLeft"]) => {
    const hipPt = { x: leg[0].x, y: a.hipY - 12 };
    const kneePt = leg[1];
    const hemPt =
      style === "shorts"
        ? { x: leg[0].x + (leg[1].x - leg[0].x) * 0.88, y: leg[1].y - 26 }
        : { x: leg[2].x, y: leg[2].y + 10 };
    const calfPt = {
      x: kneePt.x + (hemPt.x - kneePt.x) * 0.42 - dir * 3,
      y: kneePt.y + (hemPt.y - kneePt.y) * 0.42,
    };

    const r0 = a.thighWidth / 2 + legWiden;
    const r1 = a.thighWidth * 0.44 + legWiden * 0.85;
    const rCalf = a.calfWidth * 0.62 + legWiden * 0.9;
    const r2 = a.calfWidth / 2 + legWiden * 0.75;
    const pts = style === "shorts" ? [hipPt, hemPt] : [hipPt, kneePt, calfPt, hemPt];
    const radii = style === "shorts" ? [r0 + 3, r1 + 3] : [r0, r1, rCalf, r2];

    drawCelShape(ctx, () => traceTaperedTube(ctx, pts, radii), col, mode, {
      strokeWidth: 2.3,
      shadowSide: dir > 0 ? "left" : "right",
      bounds: { x: hipPt.x - r0, y: hipPt.y, w: r0 * 2, h: hemPt.y - hipPt.y },
    });

    if (style !== "shorts") {
      strokeLine(
        ctx,
        [
          [kneePt.x - r1 * 0.45, kneePt.y - 4],
          [kneePt.x + r1 * 0.35, kneePt.y + 3],
        ],
        mode,
        1.4,
      );
    }
    if (style === "cargo") {
      const midX = (hipPt.x + kneePt.x) / 2;
      const midY = (hipPt.y + kneePt.y) / 2 - 4;
      const pw = Math.max(22, r1 * 1.12);
      drawCelShape(ctx, () => ctx.roundRect(midX - pw / 2, midY - 18, pw, 38, 3), col, mode, {
        strokeWidth: 1.8,
        shadowSide: "bottom",
        bounds: { x: midX - pw / 2, y: midY - 18, w: pw, h: 38 },
      });
      strokeLine(
        ctx,
        [
          [midX - pw / 2 + 2, midY - 8],
          [midX + pw / 2 - 2, midY - 8],
        ],
        mode,
        1.5,
      );
      drawCelShape(ctx, () => ctx.roundRect(hemPt.x - r2, hemPt.y - 12, r2 * 2, 13, 2), acc, mode, {
        strokeWidth: 1.7,
        bounds: { x: hemPt.x - r2, y: hemPt.y - 12, w: r2 * 2, h: 13 },
      });
    }
    if (style === "shorts") {
      drawCelShape(
        ctx,
        () => ctx.roundRect(hemPt.x - r1 - 3, hemPt.y - 10, (r1 + 3) * 2, 10, 2),
        acc,
        mode,
        {
          strokeWidth: 1.7,
          bounds: { x: hemPt.x - r1 - 3, y: hemPt.y - 10, w: (r1 + 3) * 2, h: 10 },
        },
      );
    }
  };

  if (prof) {
    drawLeg(a.legLeft);
  } else if (dir > 0) {
    drawLeg(a.legLeft);
    drawLeg(a.legRight);
  } else if (dir < 0) {
    drawLeg(a.legRight);
    drawLeg(a.legLeft);
  } else {
    drawLeg(a.legLeft);
    drawLeg(a.legRight);
  }

  // Pelvis block completely masking black briefs from every angle
  drawCelShape(
    ctx,
    () => {
      ctx.moveTo(pelvisL + 2, waistTop);
      ctx.lineTo(pelvisR - 2, waistTop);
      ctx.lineTo(pelvisR + 1, a.hipY + 34);
      ctx.quadraticCurveTo(hipMidX, a.crotchY + 14, pelvisL - 1, a.hipY + 34);
      ctx.closePath();
    },
    col,
    mode,
    {
      strokeWidth: 2.3,
      shadowSide: dir > 0 ? "left" : "right",
      bounds: { x: pelvisL, y: waistTop, w: pelvisR - pelvisL, h: a.crotchY - waistTop + 16 },
    },
  );

  drawCelShape(
    ctx,
    () => ctx.roundRect(pelvisL + 2, waistTop, pelvisR - pelvisL - 4, 15, 2),
    style === "shorts" ? acc : col,
    mode,
    {
      strokeWidth: 2,
      shadowSide: "bottom",
      bounds: { x: pelvisL + 2, y: waistTop, w: pelvisR - pelvisL - 4, h: 15 },
    },
  );

  if (style === "jeans" && !prof) {
    if (back) {
      const pw = (pelvisR - pelvisL) * 0.25;
      const py = waistTop + 24;
      strokeLine(
        ctx,
        [
          [pelvisL + 16, py],
          [pelvisL + 16 + pw, py],
          [pelvisL + 16 + pw, py + 24],
          [pelvisL + 16 + pw / 2, py + 31],
          [pelvisL + 16, py + 24],
          [pelvisL + 16, py],
        ],
        mode,
        1.6,
      );
      strokeLine(
        ctx,
        [
          [pelvisR - 16 - pw, py],
          [pelvisR - 16, py],
          [pelvisR - 16, py + 24],
          [pelvisR - 16 - pw / 2, py + 31],
          [pelvisR - 16 - pw, py + 24],
          [pelvisR - 16 - pw, py],
        ],
        mode,
        1.6,
      );
    } else {
      const flyX = hipMidX + dir * 10;
      strokeLine(
        ctx,
        [
          [flyX, waistTop + 15],
          [flyX, waistTop + 44],
          [flyX - 5 * (dir || 1), waistTop + 50],
        ],
        mode,
        1.7,
      );
      strokeLine(
        ctx,
        [
          [pelvisL + 6, waistTop + 17],
          [pelvisL + 16, waistTop + 40],
        ],
        mode,
        1.6,
      );
      strokeLine(
        ctx,
        [
          [pelvisR - 6, waistTop + 17],
          [pelvisR - 16, waistTop + 40],
        ],
        mode,
        1.6,
      );
      ctx.save();
      ctx.fillStyle = mode === "manga" ? "#ffffff" : acc;
      ctx.strokeStyle = inkOf(mode);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(flyX, waistTop + 7.5, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawSleeve(
  ctx: C,
  arm: BodyAngleAnchors["armLeft"],
  baseArmW: number,
  lengthFrac: number,
  color: string,
  accentCol: string,
  hasCuff: boolean,
  mode: RenderMode2D,
  dir: number,
  shoulderTopY: number,
) {
  const r0 = baseArmW * 0.64;
  const r1 = baseArmW * 0.5;
  const r2 = baseArmW * 0.44;

  // Seat sleeve root right at the deltoid dome with a soft rounded shoulder arch
  const shoulderBaseY = Math.max(arm[0].y + 2, shoulderTopY + 14);
  const capApexY = shoulderTopY - 4;
  const capPt = { x: arm[0].x, y: shoulderBaseY };
  let pts: BodyPoint2D[];
  let radii: number[];
  if (lengthFrac < 0.65) {
    const pMid = {
      x: arm[0].x + (arm[1].x - arm[0].x) * (lengthFrac * 1.45),
      y: arm[0].y + (arm[1].y - arm[0].y) * (lengthFrac * 1.45),
    };
    pts = [capPt, pMid];
    radii = [r0 + 3, r1 + 4];
  } else {
    pts = [capPt, arm[1], arm[2]];
    radii = [r0 + 3, r1 + 2, r2 + 2];
  }

  drawCelShape(
    ctx,
    () => {
      const n = pts.length - 1;
      ctx.moveTo(pts[0]!.x - radii[0]!, shoulderBaseY);
      ctx.quadraticCurveTo(pts[0]!.x, capApexY, pts[0]!.x + radii[0]!, shoulderBaseY);
      for (let i = 1; i <= n; i++) {
        ctx.lineTo(pts[i]!.x + radii[i]!, pts[i]!.y);
      }
      ctx.quadraticCurveTo(pts[n]!.x, pts[n]!.y + 4, pts[n]!.x - radii[n]!, pts[n]!.y);
      for (let i = n - 1; i >= 0; i--) {
        ctx.lineTo(pts[i]!.x - radii[i]!, pts[i]!.y);
      }
      ctx.closePath();
    },
    color,
    mode,
    {
      strokeWidth: 2.3,
      shadowSide: dir >= 0 ? "left" : "right",
      bounds: {
        x: Math.min(...pts.map((p) => p.x)) - 28,
        y: capApexY - 4,
        w: 62,
        h: pts[pts.length - 1]!.y - capApexY + 8,
      },
    },
  );

  if (lengthFrac >= 0.65) {
    strokeLine(
      ctx,
      [
        [arm[1].x - r1 * 0.45, arm[1].y - 3],
        [arm[1].x + r1 * 0.45, arm[1].y + 2],
      ],
      mode,
      1.4,
    );
  }

  if (hasCuff && lengthFrac >= 0.65) {
    const wrist = arm[2];
    const cw = (r2 + 2) * 2;
    drawCelShape(
      ctx,
      () => ctx.roundRect(wrist.x - cw / 2, wrist.y - 10, cw, 13, 2),
      accentCol,
      mode,
      { strokeWidth: 1.9, bounds: { x: wrist.x - cw / 2, y: wrist.y - 10, w: cw, h: 13 } },
    );
  }
}

function drawTop2D(
  ctx: C,
  char: Character2D,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
) {
  const style = char.clothes.top;
  if (style === "none") return;

  const col = char.clothes.topColor;
  const acc = char.clothes.topAccentColor;
  const dir = facingDir(angle);
  const prof = isProfile(angle);
  const back = isBackFacingAngle2D(angle);
  const longSleeve = style !== "tshirt";
  const sleeveFrac = longSleeve ? 1.0 : 0.42;
  const sleeveCol = col;
  const hasCuff = style === "hoodie" || style === "zip_jacket";
  const topWidthPad = style === "hoodie" || style === "zip_jacket" || style === "blazer" ? 7 : 4;

  const collarTopY = a.neckY - 16; // trapezius base (~214px)
  const deltoidTopY = a.shoulderY - 20; // natural deltoid crown (~248px)
  const chestL = a.torsoL - topWidthPad;
  const chestR = a.torsoR + topWidthPad;
  const waistL = a.waistL - topWidthPad;
  const waistR = a.waistR + topWidthPad;
  const hemL = a.hipL - topWidthPad;
  const hemR = a.hipR + topWidthPad;
  const hemY = style === "tshirt" ? a.hipY + 2 : a.hipY + 12;
  const topMidX = (chestL + chestR) / 2;

  // Draw far-side sleeve first on 3/4 views
  if (!prof) {
    if (dir > 0) {
      drawSleeve(
        ctx,
        a.armRight,
        a.armWidth,
        sleeveFrac,
        sleeveCol,
        style === "hoodie" ? col : acc,
        hasCuff,
        mode,
        dir,
        deltoidTopY,
      );
    } else if (dir < 0) {
      drawSleeve(
        ctx,
        a.armLeft,
        a.armWidth,
        sleeveFrac,
        sleeveCol,
        style === "hoodie" ? col : acc,
        hasCuff,
        mode,
        dir,
        deltoidTopY,
      );
    } else {
      drawSleeve(
        ctx,
        a.armLeft,
        a.armWidth,
        sleeveFrac,
        sleeveCol,
        style === "hoodie" ? col : acc,
        hasCuff,
        mode,
        dir,
        deltoidTopY,
      );
      drawSleeve(
        ctx,
        a.armRight,
        a.armWidth,
        sleeveFrac,
        sleeveCol,
        style === "hoodie" ? col : acc,
        hasCuff,
        mode,
        dir,
        deltoidTopY,
      );
    }
  }

  // Draped Hood behind neck/shoulders when viewed from 3/4, side, or back
  if (style === "hoodie" && angle !== 0) {
    drawCelShape(
      ctx,
      () => {
        if (back) {
          ctx.moveTo(a.neckL - 12, collarTopY - 2);
          ctx.quadraticCurveTo(a.neckL - 22, a.shoulderY + 24, topMidX, a.chestY + 16);
          ctx.quadraticCurveTo(a.neckR + 22, a.shoulderY + 24, a.neckR + 12, collarTopY - 2);
          ctx.quadraticCurveTo(topMidX, collarTopY - 12, a.neckL - 12, collarTopY - 2);
          ctx.closePath();
        } else {
          const backEdge = dir > 0 ? a.neckL - 24 : a.neckR + 24;
          const frontNeck = dir > 0 ? a.neckR + 6 : a.neckL - 6;
          ctx.moveTo(a.neckL - 6, collarTopY + 2);
          ctx.quadraticCurveTo(backEdge, deltoidTopY - 8, backEdge - dir * 8, a.shoulderY + 24);
          ctx.quadraticCurveTo(topMidX, a.chestY - 8, frontNeck, deltoidTopY + 6);
          ctx.closePath();
        }
      },
      col,
      mode,
      {
        strokeWidth: 2.3,
        shadowSide: "bottom",
        bounds: { x: a.neckL - 28, y: collarTopY - 14, w: 128, h: 92 },
      },
    );
  }

  // Main Torso Shell sweeping smoothly from neck base over trapezius/deltoids to chest & waist
  drawCelShape(
    ctx,
    () => {
      const shL = prof ? chestL + 2 : Math.min(chestL, a.armLeft[0].x - 10);
      const shR = prof ? chestR - 2 : Math.max(chestR, a.armRight[0].x + 10);
      ctx.moveTo(a.neckL - 5, collarTopY);
      ctx.quadraticCurveTo((a.neckL + shL) / 2, collarTopY + 2, shL, deltoidTopY);
      ctx.quadraticCurveTo(shL - 5, deltoidTopY + 14, chestL, a.chestY);
      ctx.lineTo(waistL, a.waistY);
      ctx.lineTo(hemL, hemY);
      ctx.quadraticCurveTo(topMidX, hemY + 5, hemR, hemY);
      ctx.lineTo(waistR, a.waistY);
      ctx.lineTo(chestR, a.chestY);
      ctx.quadraticCurveTo(shR + 5, deltoidTopY + 14, shR, deltoidTopY);
      ctx.quadraticCurveTo((a.neckR + shR) / 2, collarTopY + 2, a.neckR + 5, collarTopY);
      ctx.quadraticCurveTo(
        (a.neckL + a.neckR) / 2 + dir * 6,
        back ? collarTopY + 6 : collarTopY + 26,
        a.neckL - 5,
        collarTopY,
      );
      ctx.closePath();
    },
    col,
    mode,
    {
      strokeWidth: 2.4,
      shadowSide: dir > 0 ? "left" : "right",
      bounds: { x: chestL, y: collarTopY, w: chestR - chestL, h: hemY - collarTopY },
    },
  );

  if (style === "hoodie") {
    if (!back) {
      drawCelShape(
        ctx,
        () => {
          const cx = (a.neckL + a.neckR) / 2 + dir * 10;
          ctx.ellipse(cx, collarTopY + 12, (a.neckR - a.neckL) * 0.68, 12, 0, 0, Math.PI * 2);
        },
        col,
        mode,
        {
          strokeWidth: 2.1,
          shadowSide: "bottom",
          bounds: { x: a.neckL - 12, y: collarTopY, w: 72, h: 28 },
        },
      );
      if (!prof) {
        const stringX = topMidX + dir * 12;
        strokeLine(
          ctx,
          [
            [stringX - 9, collarTopY + 22],
            [stringX - 11, a.chestY + 22],
          ],
          mode,
          2.2,
        );
        strokeLine(
          ctx,
          [
            [stringX + 9, collarTopY + 22],
            [stringX + 11, a.chestY + 18],
          ],
          mode,
          2.2,
        );
        const pW = (waistR - waistL) * 0.62;
        const pCx = topMidX + dir * 10;
        drawCelShape(
          ctx,
          () => {
            ctx.moveTo(pCx - pW * 0.38, a.waistY + 6);
            ctx.lineTo(pCx + pW * 0.38, a.waistY + 6);
            ctx.lineTo(pCx + pW * 0.5, hemY - 16);
            ctx.lineTo(pCx - pW * 0.5, hemY - 16);
            ctx.closePath();
          },
          col,
          mode,
          {
            strokeWidth: 1.9,
            shadowSide: "bottom",
            bounds: { x: pCx - pW * 0.5, y: a.waistY + 6, w: pW, h: 60 },
          },
        );
      }
    } else {
      strokeLine(
        ctx,
        [
          [topMidX, collarTopY + 4],
          [topMidX, a.shoulderY + 24],
        ],
        mode,
        1.8,
      );
    }
    drawCelShape(ctx, () => ctx.roundRect(hemL + 1, hemY - 15, hemR - hemL - 2, 16, 2), col, mode, {
      strokeWidth: 2,
      shadowSide: "bottom",
      bounds: { x: hemL, y: hemY - 15, w: hemR - hemL, h: 16 },
    });
  } else if (style === "zip_jacket" || style === "blazer") {
    const centerFrontX = topMidX + dir * (prof ? 38 : 14);
    if (!back && !prof) {
      drawCelShape(
        ctx,
        () => {
          ctx.moveTo(a.neckL + 2, collarTopY + 6);
          ctx.lineTo(a.neckR - 2, collarTopY + 6);
          ctx.lineTo(centerFrontX + 12, style === "blazer" ? a.chestY + 42 : hemY - 2);
          ctx.lineTo(centerFrontX - 12, style === "blazer" ? a.chestY + 42 : hemY - 2);
          ctx.closePath();
        },
        acc,
        mode,
        {
          strokeWidth: 1.9,
          shadowSide: "right",
          bounds: { x: centerFrontX - 24, y: collarTopY + 6, w: 48, h: hemY - collarTopY },
        },
      );

      if (style === "blazer") {
        strokeLine(
          ctx,
          [
            [a.neckL + 2, collarTopY + 8],
            [centerFrontX - 18, a.chestY + 6],
            [centerFrontX - 6, a.chestY + 42],
          ],
          mode,
          2,
        );
        strokeLine(
          ctx,
          [
            [a.neckR - 2, collarTopY + 8],
            [centerFrontX + 18, a.chestY + 6],
            [centerFrontX + 6, a.chestY + 42],
          ],
          mode,
          2,
        );
        drawCelShape(
          ctx,
          () => {
            ctx.moveTo(centerFrontX, collarTopY + 14);
            ctx.lineTo(centerFrontX + 6, a.chestY + 18);
            ctx.lineTo(centerFrontX, a.chestY + 34);
            ctx.lineTo(centerFrontX - 6, a.chestY + 18);
            ctx.closePath();
          },
          col,
          mode,
          { strokeWidth: 1.7, bounds: { x: centerFrontX - 8, y: collarTopY + 14, w: 16, h: 80 } },
        );
        ctx.save();
        ctx.fillStyle = inkOf(mode);
        ctx.beginPath();
        ctx.arc(centerFrontX, a.waistY - 8, 3.5, 0, Math.PI * 2);
        ctx.arc(centerFrontX, a.waistY + 20, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        strokeLine(
          ctx,
          [
            [centerFrontX - 12, collarTopY + 6],
            [centerFrontX - 12, hemY],
          ],
          mode,
          1.9,
        );
        strokeLine(
          ctx,
          [
            [centerFrontX + 12, collarTopY + 6],
            [centerFrontX + 12, hemY],
          ],
          mode,
          1.9,
        );
      }
    } else if (back) {
      strokeLine(
        ctx,
        [
          [chestL + 8, a.shoulderY + 20],
          [chestR - 8, a.shoulderY + 20],
        ],
        mode,
        1.6,
      );
      if (style === "blazer") {
        strokeLine(
          ctx,
          [
            [topMidX, a.hipY - 8],
            [topMidX, hemY],
          ],
          mode,
          1.8,
        );
      }
    }
  } else {
    if (!back) {
      strokeLine(
        ctx,
        [
          [a.neckL - 3, collarTopY + 4],
          [(a.neckL + a.neckR) / 2 + dir * 6, collarTopY + 26],
          [a.neckR + 3, collarTopY + 4],
        ],
        mode,
        2.3,
      );
    }
    strokeLine(
      ctx,
      [
        [chestL + 22, a.chestY + 38],
        [topMidX + dir * 8, a.chestY + 46],
      ],
      mode,
      1.5,
    );
  }

  // Near/profile sleeve drawn AFTER torso so it drapes cleanly over torso side
  if (prof) {
    drawSleeve(
      ctx,
      a.armLeft,
      a.armWidth,
      sleeveFrac,
      sleeveCol,
      style === "hoodie" ? col : acc,
      hasCuff,
      mode,
      dir,
      deltoidTopY,
    );
  } else if (dir > 0) {
    drawSleeve(
      ctx,
      a.armLeft,
      a.armWidth,
      sleeveFrac,
      sleeveCol,
      style === "hoodie" ? col : acc,
      hasCuff,
      mode,
      dir,
      deltoidTopY,
    );
  } else if (dir < 0) {
    drawSleeve(
      ctx,
      a.armRight,
      a.armWidth,
      sleeveFrac,
      sleeveCol,
      style === "hoodie" ? col : acc,
      hasCuff,
      mode,
      dir,
      deltoidTopY,
    );
  }
}

function drawAnimeEye2D(
  ctx: C,
  cx: number,
  cy: number,
  eyeStyle: EyeStyle2D,
  eyeMode: "open" | "happy" | "glare" | "shock" | "sad" | "smug" | "serious" | "closed",
  scaleX: number,
  outwardSign: number,
  eyeColor: string,
  mode: RenderMode2D,
) {
  const ink = inkOf(mode);
  const wByStyle: Record<EyeStyle2D, number> = {
    none: 0,
    sharp: 18,
    round: 16,
    almond: 19,
    intense: 17,
    gentle: 17,
    stoic: 18,
  };
  const hByStyle: Record<EyeStyle2D, number> = {
    none: 0,
    sharp: 11,
    round: 14,
    almond: 10,
    intense: 12,
    gentle: 13,
    stoic: 8,
  };
  const ew = wByStyle[eyeStyle] * scaleX;
  const eh = hByStyle[eyeStyle];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (eyeMode === "happy") {
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-ew * 0.52, 2);
    ctx.quadraticCurveTo(0, -eh * 0.65, ew * 0.52, 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (eyeMode === "closed") {
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-ew * 0.5, -1);
    ctx.quadraticCurveTo(0, eh * 0.42, ew * 0.5, -1);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const openFactor =
    eyeMode === "shock"
      ? 1.25
      : eyeMode === "glare"
        ? 0.68
        : eyeMode === "smug"
          ? 0.6
          : eyeMode === "serious"
            ? 0.8
            : 1;
  const topLift = eh * 0.68 * openFactor;
  const botDrop = eh * 0.48 * (eyeMode === "shock" ? 1.15 : 1);
  const slant =
    eyeStyle === "sharp" || eyeStyle === "intense" ? -2.2 : eyeStyle === "gentle" ? 1.5 : 0;
  const leftX = -ew * 0.5;
  const rightX = ew * 0.5;
  const outerX = outwardSign >= 0 ? rightX : leftX;
  const innerX = outwardSign >= 0 ? leftX : rightX;
  const outerY = slant;
  const innerY = eyeMode === "sad" ? -2.2 : 1.2;

  const eyeShape = new Path2D();
  eyeShape.moveTo(innerX, innerY);
  eyeShape.quadraticCurveTo(0, -topLift, outerX, outerY);
  eyeShape.lineTo(outerX - outwardSign * 1.5, botDrop * 0.72);
  eyeShape.quadraticCurveTo(0, botDrop, innerX + outwardSign * 1.5, innerY + 2);
  eyeShape.closePath();

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fill(eyeShape);
  ctx.clip(eyeShape);

  const irisRatio = eyeMode === "shock" ? 0.34 : eyeStyle === "round" ? 0.62 : 0.52;
  const irx = Math.max(2.6, (ew * irisRatio) / 2);
  const iry = Math.max(3.6, eh * (eyeMode === "shock" ? 0.36 : 0.54));
  const irisCx = outwardSign * (scaleX < 0.75 ? 1.2 : 0.4);
  const irisCy = eyeMode === "glare" || eyeMode === "smug" ? 1.2 : 0.2;

  if (mode === "manga") {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = MANGA_INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(irisCx, irisCy, irx, iry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = MANGA_INK;
    ctx.beginPath();
    ctx.ellipse(irisCx, irisCy, irx * 0.46, iry * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const grad = ctx.createLinearGradient(0, irisCy - iry, 0, irisCy + iry);
    grad.addColorStop(0, shadeHex(eyeColor, -0.5));
    grad.addColorStop(0.55, eyeColor);
    grad.addColorStop(1, shadeHex(eyeColor, 0.35));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(irisCx, irisCy, irx, iry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(10, 15, 28, 0.24)";
    ctx.fillRect(-ew, -eh, ew * 2, eh * 0.38);

    ctx.fillStyle = shadeHex(eyeColor, -0.78);
    ctx.beginPath();
    ctx.ellipse(irisCx, irisCy, irx * 0.44, iry * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (eyeMode !== "shock") {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(irisCx - irx * 0.34, irisCy - iry * 0.36, Math.max(1.2, irx * 0.28), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(irisCx + irx * 0.32, irisCy + iry * 0.32, Math.max(0.8, irx * 0.14), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = ink;
  ctx.lineWidth = eyeStyle === "intense" ? 3.2 : 2.6;
  ctx.beginPath();
  ctx.moveTo(innerX, innerY);
  ctx.quadraticCurveTo(0, -topLift, outerX + outwardSign * 2, outerY - 1);
  ctx.stroke();

  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(outerX - outwardSign * 1.5, botDrop * 0.72);
  ctx.quadraticCurveTo(0, botDrop, innerX + outwardSign * 2.5, innerY + 2);
  ctx.stroke();

  ctx.restore();
}

function drawAnimeBrow2D(
  ctx: C,
  cx: number,
  cy: number,
  browStyle: BrowStyle2D,
  browTiltDeg: number,
  scaleX: number,
  outwardSign: number,
  browColor: string,
  mode: RenderMode2D,
) {
  const bw = 18 * scaleX;
  const wByStyle: Record<BrowStyle2D, number> = {
    none: 0,
    thin: 1.8,
    bold: 3.4,
    sharp: 2.5,
    soft: 2.4,
    flat: 2.6,
  };
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((outwardSign * -browTiltDeg * Math.PI) / 180);
  ctx.strokeStyle = mode === "manga" ? MANGA_INK : browColor;
  ctx.lineWidth = wByStyle[browStyle];
  ctx.lineCap = "round";
  const arch = browStyle === "flat" ? 1 : browStyle === "sharp" ? 4.5 : 3;
  ctx.beginPath();
  ctx.moveTo(-bw * 0.5, 0);
  ctx.quadraticCurveTo(0, -arch, bw * 0.5, -outwardSign * 1.2);
  ctx.stroke();
  ctx.restore();
}

function drawAnimeNose2D(
  ctx: C,
  cx: number,
  cy: number,
  noseStyle: NoseStyle2D,
  angle: Angle2D,
  skinTone: string | null,
  mode: RenderMode2D,
) {
  const ink = inkOf(mode);
  const dir = facingDir(angle);
  const prof = isProfile(angle);
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.7;

  if (prof) {
    // Seamless side-profile anime nose bridge without inner vertical border bar
    const tipDist = noseStyle === "button" ? 5 : noseStyle === "tall" ? 9 : 7;
    const fillSkin = mode === "manga" ? "#ffffff" : (skinTone ?? "#f8cfb3");
    ctx.beginPath();
    ctx.moveTo(cx - dir * 5, cy - 12);
    ctx.lineTo(cx + dir * tipDist, cy + 1);
    ctx.lineTo(cx - dir * 2, cy + 5);
    ctx.closePath();
    ctx.fillStyle = fillSkin;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - dir * 2, cy - 11);
    ctx.lineTo(cx + dir * tipDist, cy + 1);
    ctx.lineTo(cx - dir * 2, cy + 5);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const s = dir || 1;
  if (noseStyle === "button") {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (noseStyle === "subtle") {
    ctx.beginPath();
    ctx.moveTo(cx + s * 1, cy - 4);
    ctx.lineTo(cx - s * 1, cy + 2);
    ctx.stroke();
  } else if (noseStyle === "classic" || noseStyle === "tall") {
    const h = noseStyle === "tall" ? 13 : 9;
    ctx.beginPath();
    ctx.moveTo(cx - s * 1.5, cy - h);
    ctx.lineTo(cx + s * 3.5, cy + 1);
    ctx.lineTo(cx - s * 1, cy + 3);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx + s * 2, cy - 5);
    ctx.lineTo(cx + s * 4 * (dir !== 0 ? 1.15 : 0.6), cy + 1);
    ctx.lineTo(cx - s * 2, cy + 2.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAnimeMouth2D(
  ctx: C,
  cx: number,
  cy: number,
  mouthStyle: MouthStyle2D,
  pose: "neutral" | "smile" | "grin" | "angry" | "gasp" | "sad" | "smirk" | "serious",
  scaleX: number,
  mouthColor: string,
  dir: number,
  mode: RenderMode2D,
) {
  const ink = inkOf(mode);
  const w = (mouthStyle === "wide" ? 26 : mouthStyle === "line" ? 18 : 21) * scaleX;
  const hw = w / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 2.0;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const drawOpen = (h: number) => {
    ctx.beginPath();
    ctx.moveTo(-hw, -2);
    ctx.quadraticCurveTo(0, -1, hw, -2);
    ctx.quadraticCurveTo(hw * 0.85, h, 0, h);
    ctx.quadraticCurveTo(-hw * 0.85, h, -hw, -2);
    ctx.closePath();
    if (mode === "manga") {
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = MANGA_INK;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.7, 2);
      ctx.lineTo(hw * 0.7, 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#5c1f29";
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = mouthColor;
      ctx.beginPath();
      ctx.ellipse(0, h, hw * 0.55, h * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-hw * 0.8, -3, hw * 1.6, 3.8);
      ctx.restore();
      ctx.stroke();
    }
  };

  switch (pose) {
    case "grin":
      drawOpen(11);
      break;
    case "gasp":
      ctx.beginPath();
      ctx.ellipse(0, 2, Math.max(3.5, hw * 0.38), 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = mode === "manga" ? "#ffffff" : "#5c1f29";
      ctx.fill();
      ctx.stroke();
      break;
    case "angry":
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(-hw, -4, w, 9, 3);
      ctx.fill();
      ctx.stroke();
      strokeLine(
        ctx,
        [
          [-hw + 2, 0.5],
          [hw - 2, 0.5],
        ],
        mode,
        1.3,
      );
      break;
    case "smile":
      ctx.beginPath();
      ctx.moveTo(-hw, -2);
      ctx.quadraticCurveTo(0, 7, hw, -2);
      ctx.stroke();
      break;
    case "sad":
      ctx.beginPath();
      ctx.moveTo(-hw * 0.8, 3);
      ctx.quadraticCurveTo(0, -4, hw * 0.8, 3);
      ctx.stroke();
      break;
    case "smirk":
      ctx.beginPath();
      ctx.moveTo(-hw * 0.75, 1);
      ctx.quadraticCurveTo(hw * 0.2, 3, hw * 0.85, dir >= 0 ? -4 : 1);
      ctx.stroke();
      break;
    case "serious":
      ctx.beginPath();
      ctx.moveTo(-hw * 0.7, 1);
      ctx.lineTo(hw * 0.7, 1);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.moveTo(-hw * 0.72, 0);
      ctx.quadraticCurveTo(0, 2.2, hw * 0.72, 0);
      ctx.stroke();
      break;
  }

  if (mouthStyle === "soft" && (pose === "neutral" || pose === "smile")) {
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, 5.5);
    ctx.quadraticCurveTo(0, 7.2, 4, 5.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFace2D(
  ctx: C,
  char: Character2D,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
) {
  if (isBackFacingAngle2D(angle)) return;

  const dir = facingDir(angle);
  const prof = isProfile(angle);
  const preset = EXPRESSION_PRESETS_2D[char.face.expression] ?? EXPRESSION_PRESETS_2D.neutral;
  const fScale = Math.max(0.75, Math.min(1.35, char.face.scale));
  const fOffsetY = char.face.offsetY;

  ctx.save();
  const faceCx = a.headCx + a.faceShiftX * 0.42;
  const faceCy = a.eyeY + fOffsetY;
  ctx.translate(faceCx, faceCy);
  ctx.scale(fScale, fScale);

  const eyeDy = 0;
  const noseDy = a.noseY - a.eyeY;
  const mouthDy = a.mouthY - a.eyeY;

  if (prof) {
    const edgeEyeX = dir * 13;
    drawAnimeEye2D(
      ctx,
      edgeEyeX,
      eyeDy,
      char.face.eyeStyle,
      preset.eyeMode,
      0.54,
      dir,
      char.face.eyeColor,
      mode,
    );
    drawAnimeBrow2D(
      ctx,
      edgeEyeX,
      eyeDy - 12,
      char.face.browStyle,
      preset.browTilt,
      0.6,
      dir,
      char.face.browColor,
      mode,
    );
    drawAnimeNose2D(
      ctx,
      dir * (a.headRx - 18),
      noseDy,
      char.face.noseStyle,
      angle,
      char.skinTone,
      mode,
    );
    drawAnimeMouth2D(
      ctx,
      dir * (a.headRx - 22),
      mouthDy,
      char.face.mouthStyle,
      preset.mouthPose,
      0.48,
      char.face.mouthColor,
      dir,
      mode,
    );
  } else if (dir !== 0) {
    const nearEyeX = -dir * 16;
    const farEyeX = dir * 13;
    drawAnimeEye2D(
      ctx,
      nearEyeX,
      eyeDy,
      char.face.eyeStyle,
      preset.eyeMode,
      0.94,
      -dir,
      char.face.eyeColor,
      mode,
    );
    drawAnimeEye2D(
      ctx,
      farEyeX,
      eyeDy,
      char.face.eyeStyle,
      preset.eyeMode,
      0.7,
      dir,
      char.face.eyeColor,
      mode,
    );
    drawAnimeBrow2D(
      ctx,
      nearEyeX,
      eyeDy - 12,
      char.face.browStyle,
      preset.browTilt,
      0.92,
      -dir,
      char.face.browColor,
      mode,
    );
    drawAnimeBrow2D(
      ctx,
      farEyeX,
      eyeDy - 12,
      char.face.browStyle,
      preset.browTilt,
      0.72,
      dir,
      char.face.browColor,
      mode,
    );
    drawAnimeNose2D(ctx, dir * 3, noseDy, char.face.noseStyle, angle, char.skinTone, mode);
    drawAnimeMouth2D(
      ctx,
      dir * 2,
      mouthDy,
      char.face.mouthStyle,
      preset.mouthPose,
      0.82,
      char.face.mouthColor,
      dir,
      mode,
    );
  } else {
    drawAnimeEye2D(
      ctx,
      -18,
      eyeDy,
      char.face.eyeStyle,
      preset.eyeMode,
      1,
      -1,
      char.face.eyeColor,
      mode,
    );
    drawAnimeEye2D(
      ctx,
      18,
      eyeDy,
      char.face.eyeStyle,
      preset.eyeMode,
      1,
      1,
      char.face.eyeColor,
      mode,
    );
    drawAnimeBrow2D(
      ctx,
      -18,
      eyeDy - 12,
      char.face.browStyle,
      preset.browTilt,
      1,
      -1,
      char.face.browColor,
      mode,
    );
    drawAnimeBrow2D(
      ctx,
      18,
      eyeDy - 12,
      char.face.browStyle,
      preset.browTilt,
      1,
      1,
      char.face.browColor,
      mode,
    );
    drawAnimeNose2D(ctx, 0, noseDy, char.face.noseStyle, angle, char.skinTone, mode);
    drawAnimeMouth2D(
      ctx,
      0,
      mouthDy,
      char.face.mouthStyle,
      preset.mouthPose,
      1,
      char.face.mouthColor,
      0,
      mode,
    );
  }

  for (const fx of char.face.fx) {
    if (fx === "blush") {
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : "#ec4899";
      ctx.lineWidth = 1.4;
      const xs = prof ? [dir * 12] : [-20, 16];
      for (const bx of xs) {
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(bx + k * 4, eyeDy + 13);
          ctx.lineTo(bx + k * 4 - 2, eyeDy + 19);
          ctx.stroke();
        }
      }
      ctx.restore();
    } else if (fx === "sweat") {
      ctx.save();
      ctx.fillStyle = mode === "manga" ? "#ffffff" : "#7dd3fc";
      ctx.strokeStyle = inkOf(mode);
      ctx.lineWidth = 1.6;
      const sx = prof ? -dir * 18 : 30;
      ctx.beginPath();
      ctx.moveTo(sx, -24);
      ctx.quadraticCurveTo(sx + 6, -12, sx, -8);
      ctx.quadraticCurveTo(sx - 6, -12, sx, -24);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (fx === "anger") {
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : "#ef4444";
      ctx.lineWidth = 1.9;
      const ax = prof ? -dir * 14 : -26;
      const ay = -24;
      for (const [dx, dy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(ax + dx * 2, ay + dy * 6);
        ctx.quadraticCurveTo(ax + dx * 2, ay + dy * 2, ax + dx * 6, ay + dy * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (fx === "tears") {
      ctx.save();
      ctx.fillStyle = mode === "manga" ? "#ffffff" : "#93c5fd";
      ctx.strokeStyle = inkOf(mode);
      ctx.lineWidth = 1.3;
      const txs = prof ? [dir * 13] : [-17, 17];
      for (const tx of txs) {
        ctx.beginPath();
        ctx.roundRect(tx - 3, eyeDy + 6, 6, 22, 3);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    } else if (fx === "gloom") {
      ctx.save();
      ctx.strokeStyle = inkOf(mode);
      ctx.lineWidth = 1.5;
      for (let gx = -26; gx <= 26; gx += 7) {
        ctx.beginPath();
        ctx.moveTo(gx, -44);
        ctx.lineTo(gx, -22);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  ctx.restore();
}

/** Layer 1 (BEHIND body sprite): trailing long locks & nape flare visible around neck/shoulders. */
function drawHairBack2D(
  ctx: C,
  char: Character2D,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
) {
  const style = char.hair.style;
  if (style === "none") return;

  const col = char.hair.color;
  const cx = a.headCx;
  const cy = a.headCy;
  const rx = a.headRx + (style === "spiky" || style === "messy" ? 12 : 7);
  const ry = a.headRy + 6;
  const dir = facingDir(angle);

  if (style === "long") {
    drawCelShape(
      ctx,
      () => {
        ctx.moveTo(cx - rx - 6, cy + 4);
        ctx.quadraticCurveTo(cx, cy - ry - 10, cx + rx + 6, cy + 4);
        ctx.lineTo(cx + rx + 14, a.chestY + 26);
        ctx.lineTo(cx + rx * 0.4, a.chestY + 14);
        ctx.lineTo(cx, a.chestY + 34);
        ctx.lineTo(cx - rx * 0.4, a.chestY + 14);
        ctx.lineTo(cx - rx - 14, a.chestY + 26);
        ctx.closePath();
      },
      col,
      mode,
      {
        strokeWidth: 2.3,
        shadowSide: "bottom",
        bounds: { x: cx - rx - 16, y: cy - ry - 10, w: rx * 2 + 32, h: 260 },
      },
    );
    return;
  }

  // Lower-neck & nape tufts behind jaw (symmetric on 0°, opposite facing direction on 45°/90°/270°/315°)
  if (style === "spiky" || style === "messy" || style === "curtains") {
    if (dir === 0) {
      for (const s of [-1, 1] as const) {
        drawCelShape(
          ctx,
          () => {
            ctx.moveTo(cx + s * 10, cy - ry + 6);
            ctx.quadraticCurveTo(cx + s * (rx + 7), cy + 2, cx + s * (rx + 4), a.chinY + 8);
            ctx.lineTo(cx + s * (rx * 0.25), a.chinY + 3);
            ctx.closePath();
          },
          col,
          mode,
          {
            strokeWidth: 2.1,
            shadowSide: "bottom",
            bounds: { x: cx - rx - 10, y: cy - ry, w: rx * 2 + 20, h: 160 },
          },
        );
      }
    } else {
      const backDir = -dir;
      drawCelShape(
        ctx,
        () => {
          ctx.moveTo(cx, cy - ry);
          ctx.quadraticCurveTo(
            cx + backDir * (rx + 10),
            cy - 8,
            cx + backDir * (rx + 6),
            a.chinY + 12,
          );
          ctx.lineTo(cx + backDir * (rx * 0.25), a.chinY + 5);
          ctx.closePath();
        },
        col,
        mode,
        {
          strokeWidth: 2.2,
          shadowSide: "bottom",
          bounds: { x: cx - rx - 16, y: cy - ry, w: rx * 2 + 32, h: 160 },
        },
      );
    }
  }
}

/** Layer 8 (ABOVE head/face): Full opaque scalp coverage for rear/profile views + front bangs & highlights. */
function drawHairFront2D(
  ctx: C,
  char: Character2D,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
) {
  const style = char.hair.style;
  if (style === "none") return;

  const col = char.hair.color;
  const cx = a.headCx;
  const cy = a.headCy;
  const rx = a.headRx + (style === "spiky" ? 10 : style === "messy" ? 8 : 5);
  const ry = a.headRy + 4;
  const dir = facingDir(angle);
  const prof = isProfile(angle);
  const back = isBackFacingAngle2D(angle);
  const shift = a.faceShiftX * 0.35;
  const topY = cy - ry - (style === "spiky" ? 18 : style === "messy" ? 12 : 6);

  if (back) {
    // Full sculpted opaque anime back-of-head hair dome covering 135°, 180°, 225° seamlessly
    drawCelShape(
      ctx,
      () => {
        ctx.moveTo(cx - rx, cy + 16);
        ctx.quadraticCurveTo(cx - rx - 4, topY + 6, cx, topY);
        ctx.quadraticCurveTo(cx + rx + 4, topY + 6, cx + rx, cy + 16);
        if (style === "long") {
          ctx.lineTo(cx + rx + 10, a.chestY + 26);
          ctx.lineTo(cx + rx * 0.38, a.chestY + 12);
          ctx.lineTo(cx, a.chestY + 34);
          ctx.lineTo(cx - rx * 0.38, a.chestY + 12);
          ctx.lineTo(cx - rx - 10, a.chestY + 26);
        } else {
          const napeY = a.chinY + 24;
          ctx.lineTo(cx + rx * 0.78, napeY);
          ctx.lineTo(cx + rx * 0.35, napeY - 10);
          ctx.lineTo(cx, napeY + 8);
          ctx.lineTo(cx - rx * 0.35, napeY - 10);
          ctx.lineTo(cx - rx * 0.78, napeY);
        }
        ctx.closePath();
      },
      col,
      mode,
      {
        strokeWidth: 2.3,
        shadowSide: dir > 0 ? "left" : "right",
        highlight: true,
        bounds: { x: cx - rx - 12, y: topY, w: rx * 2 + 24, h: 240 },
      },
    );
    strokeLine(
      ctx,
      [
        [cx - rx * 0.36, cy - ry * 0.2],
        [cx - rx * 0.48, a.chinY - 6],
      ],
      mode,
      1.5,
    );
    strokeLine(
      ctx,
      [
        [cx + rx * 0.36, cy - ry * 0.2],
        [cx + rx * 0.48, a.chinY - 6],
      ],
      mode,
      1.5,
    );
    return;
  }

  // Profile side-skull cap + front hair proud of forehead contour cleanly on 90° & 270°
  if (prof) {
    const frontEdge = cx + dir * (a.headRx + 4);
    const backEdge = cx - dir * (rx + 8);
    const browY = a.eyeY - 12;
    drawCelShape(
      ctx,
      () => {
        ctx.moveTo(frontEdge + dir * 2, browY - 2);
        ctx.quadraticCurveTo(frontEdge + dir * 4, topY + 4, cx, topY - 4);
        ctx.quadraticCurveTo(backEdge, topY + 6, backEdge, cy + 18);
        ctx.lineTo(cx - dir * (rx * 0.35), a.chinY + 18);
        ctx.quadraticCurveTo(cx - dir * 8, cy + 16, cx + dir * 2, cy - 2);
        ctx.lineTo(cx + dir * 12, browY + 22);
        ctx.lineTo(cx + dir * 22, browY + 2);
        ctx.lineTo(frontEdge + dir * 12, browY + 6);
        ctx.closePath();
      },
      col,
      mode,
      {
        strokeWidth: 2.3,
        shadowSide: dir > 0 ? "left" : "right",
        highlight: true,
        bounds: { x: cx - rx - 10, y: topY, w: rx * 2 + 20, h: 170 },
      },
    );
    strokeLine(
      ctx,
      [
        [cx, topY + 14],
        [cx - dir * 18, cy + 10],
      ],
      mode,
      1.4,
    );
    strokeLine(
      ctx,
      [
        [cx + dir * 10, topY + 18],
        [cx + dir * 20, browY - 2],
      ],
      mode,
      1.4,
    );
    return;
  }

  // Front (0°) & Three-Quarter (45°, 315°) front hair bangs lifted slightly to keep eyes crisp
  const browY = a.eyeY - 13;
  drawCelShape(
    ctx,
    () => {
      if (style === "spiky") {
        ctx.moveTo(cx - rx - 4, browY + 16);
        ctx.lineTo(cx - rx - 10, cy - 22);
        ctx.lineTo(cx - rx * 0.65, cy - 30);
        ctx.lineTo(cx - rx * 0.8, topY + 6);
        ctx.lineTo(cx - rx * 0.3, topY + 14);
        ctx.lineTo(cx - 4, topY - 4);
        ctx.lineTo(cx + rx * 0.35, topY + 12);
        ctx.lineTo(cx + rx * 0.85, topY + 4);
        ctx.lineTo(cx + rx * 0.72, cy - 28);
        ctx.lineTo(cx + rx + 10, cy - 18);
        ctx.lineTo(cx + rx + 4, browY + 16);
        ctx.lineTo(cx + rx * 0.65 + shift, browY + 26);
        ctx.lineTo(cx + rx * 0.38 + shift, browY - 5);
        ctx.lineTo(cx + rx * 0.14 + shift, browY + 8);
        ctx.lineTo(cx - rx * 0.04 + shift, browY - 11);
        ctx.lineTo(cx - rx * 0.25 + shift, browY + 7);
        ctx.lineTo(cx - rx * 0.62 + shift, browY + 26);
        ctx.closePath();
      } else if (style === "messy") {
        ctx.moveTo(cx - rx - 2, browY + 18);
        ctx.quadraticCurveTo(cx - rx - 6, topY + 12, cx, topY);
        ctx.quadraticCurveTo(cx + rx + 6, topY + 12, cx + rx + 2, browY + 18);
        ctx.lineTo(cx + rx * 0.6 + shift, browY + 24);
        ctx.lineTo(cx + rx * 0.38 + shift, browY);
        ctx.lineTo(cx + rx * 0.16 + shift, browY + 10);
        ctx.lineTo(cx - rx * 0.06 + shift, browY - 4);
        ctx.lineTo(cx - rx * 0.3 + shift, browY + 9);
        ctx.lineTo(cx - rx * 0.62 + shift, browY + 24);
        ctx.closePath();
      } else if (style === "short") {
        ctx.moveTo(cx - rx, browY + 8);
        ctx.quadraticCurveTo(cx - rx * 0.9, topY + 8, cx, topY);
        ctx.quadraticCurveTo(cx + rx * 0.9, topY + 8, cx + rx, browY + 8);
        ctx.lineTo(cx + rx * 0.55 + shift, browY - 2);
        ctx.lineTo(cx + shift, browY - 10);
        ctx.lineTo(cx - rx * 0.55 + shift, browY - 2);
        ctx.closePath();
      } else if (style === "slick") {
        ctx.moveTo(cx - rx + 2, browY - 4);
        ctx.quadraticCurveTo(cx - rx * 0.9, topY + 4, cx + dir * 4, topY - 4);
        ctx.quadraticCurveTo(cx + rx * 0.9, topY + 4, cx + rx - 2, browY - 4);
        ctx.quadraticCurveTo(cx + shift, cy - ry * 0.64, cx - rx + 2, browY - 4);
        ctx.closePath();
      } else if (style === "curtains") {
        ctx.moveTo(cx - rx, browY + 20);
        ctx.quadraticCurveTo(cx - rx, topY + 10, cx, topY + 2);
        ctx.quadraticCurveTo(cx + rx, topY + 10, cx + rx, browY + 20);
        ctx.quadraticCurveTo(cx + rx * 0.45 + shift, browY + 10, cx + shift, browY - 22);
        ctx.quadraticCurveTo(cx - rx * 0.45 + shift, browY + 10, cx - rx, browY + 20);
        ctx.closePath();
      } else {
        const cheekY = a.mouthY + 16;
        ctx.moveTo(cx - rx - 2, cheekY);
        ctx.lineTo(cx - rx - 4, cy - 20);
        ctx.quadraticCurveTo(cx, topY - 2, cx + rx + 4, cy - 20);
        ctx.lineTo(cx + rx + 2, cheekY);
        ctx.lineTo(cx + rx * 0.68, browY + 8);
        ctx.lineTo(cx + rx * 0.32 + shift, browY + 4);
        ctx.lineTo(cx + shift, browY - 9);
        ctx.lineTo(cx - rx * 0.32 + shift, browY + 4);
        ctx.lineTo(cx - rx * 0.68, browY + 8);
        ctx.closePath();
      }
    },
    col,
    mode,
    {
      strokeWidth: 2.3,
      shadowSide: "bottom",
      highlight: true,
      bounds: { x: cx - rx - 10, y: topY, w: rx * 2 + 20, h: ry * 1.5 },
    },
  );
  // Crisp inner anime strand lines for manga hair depth
  strokeLine(
    ctx,
    [
      [cx - rx * 0.32, topY + 14],
      [cx - rx * 0.42 + shift, browY - 4],
    ],
    mode,
    1.3,
  );
  strokeLine(
    ctx,
    [
      [cx + rx * 0.32, topY + 14],
      [cx + rx * 0.42 + shift, browY - 4],
    ],
    mode,
    1.3,
  );
}

function computeHairPlacement2D(
  char: Character2D,
  a: BodyAngleAnchors,
  angle: Angle2D,
  pack: IllustratedHairPack2D,
  sil: HeadSilhouetteInfo | null,
) {
  const refW = M1_REF_SKULL_W[angle];
  const wRatio = sil ? Math.max(0.93, Math.min(1.16, sil.skullW / refW)) : a.headRx / 46;
  const crownH = sil ? Math.max(46, sil.eyeY - sil.topY) : 61;
  const refCrownH = 61;
  const hRatio = Math.max(0.94, Math.min(1.14, crownH / refCrownH));

  const packAng = pack.perAngleFit?.[angle];
  const userAng = char.hair.perAngle?.[angle];
  const packDx = packAng?.offsetX ?? 0;
  const packDy = packAng?.offsetY ?? 0;
  const packScale = packAng?.scale ?? 1;

  const userGlobalScale = Math.max(0.8, Math.min(1.25, char.hair.scale ?? 1));
  const userGlobalOffsetY = Math.max(-24, Math.min(24, char.hair.offsetY ?? 0));
  const userAngDx = Math.max(-36, Math.min(36, userAng?.offsetX ?? 0));
  const userAngDy = Math.max(-36, Math.min(36, userAng?.offsetY ?? 0));
  const userAngScale = Math.max(0.8, Math.min(1.25, userAng?.scale ?? 1));

  const skullCx = (sil ? sil.skullCx : a.headCx) + packDx * wRatio + userAngDx;
  const eyeAnchorY =
    (sil ? sil.eyeY : a.eyeY) +
    (crownH - refCrownH) * 0.14 +
    packDy * hRatio +
    userGlobalOffsetY +
    userAngDy;
  const baseScale = (47.2 / pack.refHeadRx) * packScale * userGlobalScale * userAngScale;
  const scaleX = baseScale * wRatio;
  // Adapt vertically to each head shape's true crown-to-eye height while clamping aspect ratio so spikes never distort
  const scaleY = Math.max(scaleX * 0.91, Math.min(scaleX * 1.09, baseScale * hRatio));
  return { skullCx, eyeAnchorY, scaleX, scaleY };
}

function drawIllustratedHairCastShadow2D(
  ctx: C,
  char: Character2D,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
  imageMap: Map<string, HTMLImageElement>,
  pack: IllustratedHairPack2D | null,
  sil: HeadSilhouetteInfo | null,
) {
  if (!pack || !sil || mode === "manga" || isBackFacingAngle2D(angle)) return;
  const src = pack.frontFrames[angle];
  if (!src) return;
  const img = imageMap.get(src);
  if (!img) return;

  const { skullCx, eyeAnchorY, scaleX, scaleY } = computeHairPlacement2D(char, a, angle, pack, sil);
  const shSprite = getHairShadowSilhouette(img, src);
  const dir = facingDir(angle);

  // Project subtle cel-shaded bang shadow onto forehead/temples, clipped strictly inside active head silhouette
  const x0 = 140;
  const y0 = 55;
  const fRes = 2;
  const sc = document.createElement("canvas");
  sc.width = 200 * fRes;
  sc.height = 200 * fRes;
  const sctx = sc.getContext("2d")!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.save();
  sctx.scale(fRes, fRes);
  sctx.translate(-x0, -y0);
  // Restrict cast shadow cleanly to upper face / forehead / temple zone (never below cheekbones or on neck)
  sctx.beginPath();
  sctx.rect(x0, y0, 200, Math.max(40, sil.eyeY + 14 - y0));
  sctx.clip();
  sctx.translate(skullCx + dir * 1.4, eyeAnchorY + 4.2);
  sctx.scale(scaleX, scaleY);
  sctx.drawImage(shSprite, -pack.pivotX, -pack.pivotY, pack.canvasW, pack.canvasH);
  sctx.restore();

  sctx.globalCompositeOperation = "destination-in";
  sctx.drawImage(sil.headMaskCanvas, 0, 0, sc.width, sc.height);

  ctx.save();
  ctx.drawImage(sc, x0, y0, 200, 200);
  ctx.restore();
}

function drawIllustratedHair2D(
  ctx: C,
  char: Character2D,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
  side: "back" | "front",
  imageMap: Map<string, HTMLImageElement>,
  pack: IllustratedHairPack2D | null,
  sil: HeadSilhouetteInfo | null,
) {
  if (!pack) return;
  const src = side === "back" ? pack.backFrames[angle] : pack.frontFrames[angle];
  if (!src) return;
  const img = imageMap.get(src);
  if (!img) return;

  const sprite = getRecoloredIllustratedPart(
    img,
    src,
    char.hair.color,
    mode,
    char.shadingDepth ?? "cel",
    null,
    undefined,
    null,
    undefined,
    undefined,
    "hair",
  );
  const { skullCx, eyeAnchorY, scaleX, scaleY } = computeHairPlacement2D(char, a, angle, pack, sil);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.translate(skullCx, eyeAnchorY);
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(sprite, -pack.pivotX, -pack.pivotY, pack.canvasW, pack.canvasH);
  ctx.restore();
}

function drawIllustratedClothing2D(
  ctx: C,
  pack: IllustratedClothingPack2D | null,
  primaryHex: string,
  accentHex: string,
  angle: Angle2D,
  mode: RenderMode2D,
  shadingDepth: ShadingDepth2D,
  imageMap: Map<string, HTMLImageElement>,
  collarFit?: TopCollarFit2D | null,
) {
  if (!pack) return;
  const src = pack.frames[angle];
  const img = src ? imageMap.get(src) : undefined;
  if (!src || !img) return;

  const maskSrc = pack.accentMasks?.[angle];
  const maskImg = maskSrc ? imageMap.get(maskSrc) : undefined;

  let effectiveImg: HTMLImageElement | HTMLCanvasElement = img;
  let effectiveMask: HTMLImageElement | HTMLCanvasElement | undefined = maskImg;
  let effectiveKey = src;
  let effectiveMaskKey = maskSrc;

  // Warp raw 2K top & accent mask BEFORE recoloring / G-Pen Manga Ink extraction for razor-sharp collar seams!
  if (
    pack.slot === "top" &&
    collarFit &&
    (Math.abs(collarFit.dL) > 1 || Math.abs(collarFit.dR) > 1)
  ) {
    const warpTag = `cw:${Math.round(collarFit.dL * 2)}:${Math.round(collarFit.dR * 2)}`;
    effectiveImg = getCollarWarpedSourceCanvas(img, src, collarFit);
    effectiveKey = `${src}|${warpTag}`;
    if (maskImg && maskSrc) {
      effectiveMask = getCollarWarpedSourceCanvas(maskImg, maskSrc, collarFit);
      effectiveMaskKey = `${maskSrc}|${warpTag}`;
    }
  }

  const sprite = getRecoloredIllustratedPart(
    effectiveImg,
    effectiveKey,
    primaryHex,
    mode,
    shadingDepth,
    effectiveMask,
    effectiveMaskKey,
    accentHex,
  );
  ctx.drawImage(sprite, 0, 0, CHAR2D_W, CHAR2D_H);
}

function getProfileSkinForearmCanvas(
  rawBaseImg: HTMLImageElement,
  processedBase: HTMLCanvasElement,
  rawBaseSrc: string,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
  skinTone: string | null,
): { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number } {
  const arm = angle === 90 ? a.armLeft : a.armRight;
  const elbow = arm[1];
  const wrist = arm[2];
  const shiftX = angle === 90 ? 12 : -12;
  const bx0 = Math.max(0, Math.round(Math.min(elbow.x, wrist.x) + shiftX - 30));
  const bx1 = Math.min(CHAR2D_W - 1, Math.round(Math.max(elbow.x, wrist.x) + shiftX + 30));
  const by0 = Math.max(0, Math.round(elbow.y - 34));
  const by1 = Math.min(CHAR2D_H - 1, Math.round(wrist.y + 84));
  const bw = bx1 - bx0 + 1;
  const bh = by1 - by0 + 1;
  const s = processedBase.width / CHAR2D_W;
  const pbw = Math.round(bw * s);
  const pbh = Math.round(bh * s);

  const key = `prof-arm-v6|${rawBaseSrc}|${pbw}x${pbh}|${angle}|${mode}|${skinTone ?? "orig"}|${bx0},${by0},${bw},${bh}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return { canvas: hit, x: bx0, y: by0, w: bw, h: bh };

  const rawS = (rawBaseImg.naturalWidth || rawBaseImg.width || CHAR2D_W) / CHAR2D_W;
  const rawC = document.createElement("canvas");
  rawC.width = pbw;
  rawC.height = pbh;
  const rawCtx = rawC.getContext("2d")!;
  rawCtx.drawImage(rawBaseImg, bx0 * rawS, by0 * rawS, bw * rawS, bh * rawS, 0, 0, pbw, pbh);
  const rawD = rawCtx.getImageData(0, 0, pbw, pbh).data;

  const outC = document.createElement("canvas");
  outC.width = pbw;
  outC.height = pbh;
  const outCtx = outC.getContext("2d")!;
  outCtx.drawImage(processedBase, bx0 * s, by0 * s, bw * s, bh * s, 0, 0, pbw, pbh);
  const outId = outCtx.getImageData(0, 0, pbw, pbh);
  const od = outId.data;

  // Tapered anatomical arm+hand envelope calibrated to Model #1 90° / 270° contours
  // starting cleanly right below the short-sleeve cuff (y=360) down through elbow, forearm, and hand.
  const keys: ReadonlyArray<readonly [number, number, number]> =
    angle === 90
      ? [
          [360, 199, 236],
          [392, 200, 235],
          [415, 201, 238],
          [440, 209, 239],
          [465, 217, 243],
          [495, 223, 250],
          [515, 220, 253],
          [538, 223, 253],
          [558, 228, 251],
          [570, 234, 249],
          [576, 240, 246],
        ]
      : [
          [360, 243, 280],
          [392, 243, 279],
          [415, 238, 278],
          [440, 240, 270],
          [465, 236, 262],
          [495, 226, 254],
          [515, 225, 256],
          [538, 223, 254],
          [558, 226, 249],
          [570, 226, 238],
          [576, 228, 234],
        ];

  const evalSpan = (wy: number): [number, number] | null => {
    if (wy < keys[0]![0] || wy > keys[keys.length - 1]![0]) return null;
    for (let k = 0; k < keys.length - 1; k++) {
      const [y0, l0, r0] = keys[k]!;
      const [y1, l1, r1] = keys[k + 1]!;
      if (wy >= y0 && wy <= y1) {
        const t = (wy - y0) / Math.max(1, y1 - y0);
        return [l0 + (l1 - l0) * t, r0 + (r1 - r0) * t];
      }
    }
    return null;
  };

  const keepMask = new Uint8Array(pbw * pbh);
  for (let py = 0; py < pbh; py++) {
    const wy = by0 + py / s;
    const span = evalSpan(wy);
    if (!span) continue;
    let [elx, erx] = span;

    // Refine within ±3px in black-briefs band to trim dark briefs pixels while retaining 1px ink outline
    if (wy >= 432 && wy <= 504) {
      let sl = -1;
      let sr = -1;
      const scanL = Math.max(0, Math.floor((elx - 3 - bx0) * s));
      const scanR = Math.min(pbw - 1, Math.ceil((erx + 3 - bx0) * s));
      for (let px = scanL; px <= scanR; px++) {
        const i = (py * pbw + px) * 4;
        if ((rawD[i + 3] ?? 0) < 40) continue;
        const r = rawD[i] ?? 0;
        const g = rawD[i + 1] ?? 0;
        const b = rawD[i + 2] ?? 0;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (r > g + 4 && r - b >= 14 && lum > 118) {
          const wx = bx0 + px / s;
          if (sl < 0) sl = wx;
          sr = wx;
        }
      }
      if (sl >= 0 && sr >= sl) {
        elx = sl - 1;
        erx = sr + 1;
      }
    }

    const xStart = Math.max(0, Math.floor((elx - bx0) * s));
    const xEnd = Math.min(pbw - 1, Math.ceil((erx - bx0) * s));
    for (let px = xStart; px <= xEnd; px++) {
      const i = (py * pbw + px) * 4;
      if ((rawD[i + 3] ?? 0) > 40) keepMask[py * pbw + px] = 1;
    }
  }

  for (let p = 0; p < pbw * pbh; p++) {
    if (!keepMask[p]) od[p * 4 + 3] = 0;
  }

  // In Manga Mode, guarantee a 100% continuous G-Pen black ink contour along the bare forearm, wrist & hand
  // where the arm overlaps clothes (strictly below the short-sleeve cuff wy >= 364 so zero bar across sleeve).
  if (mode === "manga") {
    const cRad = Math.max(2, Math.round(1.25 * s));
    const cuffCutoffPy = Math.ceil((364 - by0) * s);
    for (let py = Math.max(0, cuffCutoffPy); py < pbh; py++) {
      const rowOff = py * pbw;
      for (let px = 0; px < pbw; px++) {
        const p = rowOff + px;
        if (!keepMask[p]) continue;
        let minD2 = 9999;
        const y0 = Math.max(0, py - cRad);
        const y1 = Math.min(pbh - 1, py + cRad);
        const x0 = Math.max(0, px - cRad);
        const x1 = Math.min(pbw - 1, px + cRad);
        for (let ny = y0; ny <= y1; ny++) {
          const nRow = ny * pbw;
          const dy = ny - py;
          for (let nx = x0; nx <= x1; nx++) {
            if (!keepMask[nRow + nx]) {
              const dx = nx - px;
              const d2 = dx * dx + dy * dy;
              if (d2 < minD2) minD2 = d2;
            }
          }
        }
        const dist = Math.sqrt(minD2);
        if (dist <= cRad + 0.45) {
          const cInk = Math.max(0, Math.min(1, (cRad + 0.45 - dist) / 1.05));
          const i = p * 4;
          const curShade = od[i] ?? 255;
          const targetShade = Math.round(255 * (1 - cInk));
          if (targetShade < curShade) {
            od[i] = targetShade;
            od[i + 1] = targetShade;
            od[i + 2] = targetShade;
          }
          od[i + 3] = 255;
        }
      }
    }
  }

  outCtx.putImageData(outId, 0, 0);
  putProcessedCache(key, outC);
  return { canvas: outC, x: bx0, y: by0, w: bw, h: bh };
}

export function extractProfileForearmForPose2D(
  char: Character2D,
  baseModel: BaseModel2D,
  angle: Angle2D,
  mode: RenderMode2D,
  imageMap: Map<string, HTMLImageElement>,
  headPack?: HeadPack2D,
): { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number } | null {
  if (angle !== 90 && angle !== 270) return null;
  const head = headPack ?? resolveHeadPack2D(char.headShapeId);
  const anchors = resolveEffectiveAnchors(baseModel, char, angle, head);
  const seamless = isUsingSeamlessHeadVariant(baseModel, char, angle, head);
  const variantSrc = seamless ? head.bodyVariants?.[baseModel.id]?.[angle] : undefined;
  const baseSrc = variantSrc ?? baseModel.frames[angle] ?? baseModel.frames[0];
  const rawImg = baseSrc ? imageMap.get(baseSrc) : undefined;
  if (!rawImg || !baseSrc) return null;

  let processedBaseCanvas: HTMLCanvasElement;
  if (variantSrc) {
    processedBaseCanvas = getProcessedBaseSprite(rawImg, variantSrc, mode, char.skinTone);
  } else {
    const headSrc = head.overlayFrames[angle] ?? head.overlayFrames[0];
    const headImg = headSrc ? imageMap.get(headSrc) : undefined;
    const fitScale = Math.max(0.75, Math.min(1.25, char.headFit?.scale ?? 1));
    const fitOffsetY = char.headFit?.offsetY ?? 0;
    processedBaseCanvas = getProcessedCompositedBaseSprite(
      rawImg,
      baseSrc,
      headImg,
      headSrc,
      baseModel.anchors[angle],
      head.anchors[angle] ?? head.anchors[0],
      fitScale,
      fitOffsetY,
      mode,
      char.skinTone,
    );
  }
  return getProfileSkinForearmCanvas(
    rawImg,
    processedBaseCanvas,
    baseSrc,
    anchors,
    angle,
    mode,
    char.skinTone,
  );
}

function drawForegroundProfileArm2D(
  ctx: C,
  rawBaseImg: HTMLImageElement | null,
  processedBase: HTMLCanvasElement | null,
  rawBaseSrc: string,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
  skinTone: string | null,
) {
  if (!rawBaseImg || !processedBase || !rawBaseSrc || (angle !== 90 && angle !== 270)) return;
  const sprite = getProfileSkinForearmCanvas(
    rawBaseImg,
    processedBase,
    rawBaseSrc,
    a,
    angle,
    mode,
    skinTone,
  );
  ctx.drawImage(sprite.canvas, sprite.x, sprite.y, sprite.w, sprite.h);
}

function drawSingleClosedEye2D(
  ctx: C,
  ex: number,
  ey: number,
  ew: number,
  fScale: number,
  eyeMode: "happy" | "closed",
  mode: RenderMode2D,
) {
  ctx.save();
  ctx.translate(ex, ey);
  ctx.strokeStyle = inkOf(mode);
  ctx.lineCap = "round";
  ctx.lineWidth = 2.4 * fScale;
  ctx.beginPath();
  if (eyeMode === "happy") {
    ctx.moveTo(-ew * 0.5, 2 * fScale);
    ctx.quadraticCurveTo(0, -6.5 * fScale, ew * 0.5, 2 * fScale);
  } else {
    ctx.moveTo(-ew * 0.5, -1 * fScale);
    ctx.quadraticCurveTo(0, 4.5 * fScale, ew * 0.5, -1 * fScale);
  }
  ctx.stroke();
  ctx.restore();
}

function drawMangaEmotionFx2D(
  ctx: C,
  fxList: Character2D["face"]["fx"],
  cx: number,
  eyeY: number,
  fScale: number,
  dir: number,
  prof: boolean,
  mode: RenderMode2D,
) {
  if (!fxList.length) return;
  ctx.save();
  ctx.translate(cx, eyeY);
  ctx.scale(fScale, fScale);
  for (const fx of fxList) {
    if (fx === "blush") {
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : "#ec4899";
      ctx.lineWidth = 1.4;
      const xs = prof ? [dir * 16] : [-20, 18];
      for (const bx of xs) {
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(bx + k * 4, 13);
          ctx.lineTo(bx + k * 4 - 2, 19);
          ctx.stroke();
        }
      }
      ctx.restore();
    } else if (fx === "sweat") {
      ctx.save();
      ctx.fillStyle = mode === "manga" ? "#ffffff" : "#7dd3fc";
      ctx.strokeStyle = inkOf(mode);
      ctx.lineWidth = 1.6;
      const sx = prof ? -dir * 16 : 30;
      ctx.beginPath();
      ctx.moveTo(sx, -24);
      ctx.quadraticCurveTo(sx + 6, -12, sx, -8);
      ctx.quadraticCurveTo(sx - 6, -12, sx, -24);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (fx === "anger") {
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? MANGA_INK : "#ef4444";
      ctx.lineWidth = 1.9;
      const ax = prof ? -dir * 12 : -29;
      const ay = -10;
      for (const [dx, dy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(ax + dx * 2, ay + dy * 6);
        ctx.quadraticCurveTo(ax + dx * 2, ay + dy * 2, ax + dx * 6, ay + dy * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (fx === "tears") {
      ctx.save();
      ctx.fillStyle = mode === "manga" ? "#ffffff" : "#93c5fd";
      ctx.strokeStyle = inkOf(mode);
      ctx.lineWidth = 1.3;
      const txs = prof ? [dir * 20] : [-18, 18];
      for (const tx of txs) {
        ctx.beginPath();
        ctx.roundRect(tx - 3, 6, 6, 22, 3);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    } else if (fx === "gloom") {
      ctx.save();
      ctx.strokeStyle = inkOf(mode);
      ctx.lineWidth = 1.5;
      for (let gx = -26; gx <= 26; gx += 7) {
        ctx.beginPath();
        ctx.moveTo(gx, -44);
        ctx.lineTo(gx, -22);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawIllustratedFace2D(
  ctx: C,
  char: Character2D,
  a: BodyAngleAnchors,
  angle: Angle2D,
  mode: RenderMode2D,
  imageMap: Map<string, HTMLImageElement>,
  facePack: IllustratedFacePack2D | null,
  sil: HeadSilhouetteInfo | null,
  pass: "full" | "eyes_brows_over_bangs" = "full",
) {
  if (isBackFacingAngle2D(angle)) return;

  const dir = facingDir(angle);
  const prof = isProfile(angle);
  const preset = EXPRESSION_PRESETS_2D[char.face.expression] ?? EXPRESSION_PRESETS_2D.neutral;
  const fScale = Math.max(0.75, Math.min(1.35, char.face.scale));
  const fOffsetY = char.face.offsetY;
  const eyeCenterY = (sil ? sil.eyeY : a.eyeY) + fOffsetY;
  const noseCenterY = (sil ? sil.noseY : a.noseY) + fOffsetY;
  const mouthCenterY = (sil ? sil.mouthY : a.mouthY) + fOffsetY;

  const eyeL = sil ? sil.eyeSpan[0] : a.headCx - a.headRx;
  const eyeR = sil ? sil.eyeSpan[1] : a.headCx + a.headRx;
  const eyeW = Math.max(40, eyeR - eyeL);
  const noseL = sil ? sil.noseSpan[0] : eyeL + 4;
  const noseR = sil ? sil.noseSpan[1] : eyeR - 4;
  const noseW = Math.max(32, noseR - noseL);
  const mouthL = sil ? sil.mouthSpan[0] : eyeL + 10;
  const mouthR = sil ? sil.mouthSpan[1] : eyeR - 10;
  const mouthW = Math.max(26, mouthR - mouthL);
  const skullW = sil ? sil.skullW : a.headRx * 2;
  const baseS =
    (angle === 45 || angle === 315 ? 0.55 : 0.53) * (skullW / M1_REF_SKULL_W[angle]) * fScale;

  // Individual feature anchors calibrated directly to the bust turnaround proportions
  let leftEyePos: { x: number; y: number; sx: number; sy: number; tiltDir: number };
  let rightEyePos: { x: number; y: number; sx: number; sy: number; tiltDir: number } | null = null;
  let nosePos: { x: number; y: number; sx: number } | null = null;
  let mouthPos: { x: number; y: number; sx: number };

  if (angle === 0) {
    const midX = (eyeL + eyeR) / 2;
    const dx = eyeW * 0.215;
    leftEyePos = { x: midX - dx, y: eyeCenterY, sx: baseS, sy: baseS, tiltDir: 1 };
    rightEyePos = { x: midX + dx, y: eyeCenterY, sx: baseS, sy: baseS, tiltDir: -1 };
    nosePos = { x: (noseL + noseR) / 2, y: noseCenterY, sx: baseS };
    mouthPos = { x: (mouthL + mouthR) / 2, y: mouthCenterY, sx: baseS };
  } else if (angle === 45) {
    leftEyePos = {
      x: eyeR - eyeW * 0.39,
      y: eyeCenterY,
      sx: baseS * 1.02,
      sy: baseS * 1.02,
      tiltDir: 1,
    };
    rightEyePos = {
      x: eyeR - eyeW * 0.135,
      y: eyeCenterY + 1,
      sx: baseS * 0.94,
      sy: baseS,
      tiltDir: -1,
    };
    nosePos = { x: noseR - noseW * 0.17, y: noseCenterY, sx: baseS * 0.96 };
    mouthPos = { x: mouthR - mouthW * 0.2, y: mouthCenterY, sx: baseS * 0.95 };
  } else if (angle === 315) {
    leftEyePos = {
      x: eyeL + eyeW * 0.135,
      y: eyeCenterY + 1,
      sx: baseS * 0.94,
      sy: baseS,
      tiltDir: 1,
    };
    rightEyePos = {
      x: eyeL + eyeW * 0.39,
      y: eyeCenterY,
      sx: baseS * 1.02,
      sy: baseS * 1.02,
      tiltDir: -1,
    };
    nosePos = { x: noseL + noseW * 0.17, y: noseCenterY, sx: baseS * 0.96 };
    mouthPos = { x: mouthL + mouthW * 0.2, y: mouthCenterY, sx: baseS * 0.95 };
  } else if (angle === 90) {
    leftEyePos = {
      x: eyeR - Math.max(17, eyeW * 0.205),
      y: eyeCenterY,
      sx: baseS * 0.88,
      sy: baseS,
      tiltDir: -1,
    };
    nosePos = null; // Base head already draws crisp profile nose bridge
    mouthPos = { x: mouthR - Math.max(10, mouthW * 0.13), y: mouthCenterY, sx: baseS * 0.85 };
  } else {
    leftEyePos = {
      x: eyeL + Math.max(17, eyeW * 0.205),
      y: eyeCenterY,
      sx: baseS * 0.88,
      sy: baseS,
      tiltDir: 1,
    };
    nosePos = null;
    mouthPos = { x: mouthL + Math.max(10, mouthW * 0.13), y: mouthCenterY, sx: baseS * 0.85 };
  }

  const angAssets = facePack?.angles[angle];
  if (facePack && angAssets) {
    // Render all facial parts onto a 400x400 (2x Hi-Res) offscreen canvas and intersect with active eroded head mask
    const x0 = 140;
    const y0 = 55;
    const fRes = 2;
    const fc = document.createElement("canvas");
    fc.width = 200 * fRes;
    fc.height = 200 * fRes;
    const fctx = fc.getContext("2d")!;
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = "high";
    fctx.scale(fRes, fRes);
    fctx.translate(-x0, -y0);

    const drawCenteredSprite = (
      img: HTMLImageElement | HTMLCanvasElement,
      cx: number,
      cy: number,
      w: number,
      h: number,
      sx: number,
      sy: number,
      rotRad = 0,
    ) => {
      fctx.save();
      fctx.translate(cx, cy);
      if (rotRad !== 0) fctx.rotate(rotRad);
      fctx.scale(sx, sy);
      fctx.drawImage(img, -w / 2, -h / 2, w, h);
      fctx.restore();
    };

    const eyeYScale =
      preset.eyeMode === "glare" || preset.eyeMode === "smug"
        ? 0.82
        : preset.eyeMode === "serious"
          ? 0.92
          : preset.eyeMode === "shock"
            ? 1.08
            : 1;

    if (pass === "full" && char.face.eyeStyle !== "none") {
      if (preset.eyeMode === "happy" || preset.eyeMode === "closed") {
        drawSingleClosedEye2D(
          fctx,
          leftEyePos.x,
          leftEyePos.y,
          prof ? 11 * fScale : (leftEyePos.sx / baseS) * 16 * fScale,
          fScale,
          preset.eyeMode,
          mode,
        );
        if (rightEyePos) {
          drawSingleClosedEye2D(
            fctx,
            rightEyePos.x,
            rightEyePos.y,
            (rightEyePos.sx / baseS) * 16 * fScale,
            fScale,
            preset.eyeMode,
            mode,
          );
        }
      } else {
        const renderEyeUnit = (
          pos: { x: number; y: number; sx: number; sy: number },
          baseSrc: string | undefined,
          irisSrc: string | undefined,
        ) => {
          if (!baseSrc || !irisSrc) return;
          const ebImg = imageMap.get(baseSrc);
          const eiImg = imageMap.get(irisSrc);
          if (ebImg) {
            const ebSp = mode === "manga" ? getMangaLineSprite(ebImg, baseSrc) : ebImg;
            drawCenteredSprite(
              ebSp,
              pos.x,
              pos.y,
              facePack.eyeW,
              facePack.eyeH,
              pos.sx,
              pos.sy * eyeYScale,
            );
          }
          if (eiImg) {
            const eiSp = getRecoloredIrisSprite(eiImg, irisSrc, char.face.eyeColor, mode);
            drawCenteredSprite(
              eiSp,
              pos.x,
              pos.y,
              facePack.eyeW,
              facePack.eyeH,
              pos.sx,
              pos.sy * eyeYScale,
            );
          }
        };

        renderEyeUnit(leftEyePos, angAssets.eyeLeftBase, angAssets.eyeLeftIris);
        if (rightEyePos) {
          renderEyeUnit(rightEyePos, angAssets.eyeRightBase, angAssets.eyeRightIris);
        }
      }
    }

    if (char.face.browStyle !== "none") {
      fctx.save();
      if (pass === "eyes_brows_over_bangs") fctx.globalAlpha = mode === "manga" ? 0.78 : 0.42;
      const browDy = (preset.browTilt > 0 ? 3 : preset.browTilt < 0 ? -3.5 : 0) * fScale;
      const tiltRad = (preset.browTilt * 0.55 * Math.PI) / 180;
      const brOffY = (prof ? 8.5 : 9.5) * fScale;
      const browLeftSx = prof ? leftEyePos.sx * 0.82 : leftEyePos.sx;

      const blImg = imageMap.get(angAssets.browLeft);
      if (blImg) {
        const blSp = getRecoloredInkSprite(blImg, angAssets.browLeft, char.face.browColor, mode);
        drawCenteredSprite(
          blSp,
          leftEyePos.x,
          leftEyePos.y - brOffY + browDy,
          facePack.browW,
          facePack.browH,
          browLeftSx,
          leftEyePos.sy,
          leftEyePos.tiltDir * tiltRad,
        );
      }
      if (rightEyePos && angAssets.browRight) {
        const brImg = imageMap.get(angAssets.browRight);
        if (brImg) {
          const brSp = getRecoloredInkSprite(brImg, angAssets.browRight, char.face.browColor, mode);
          drawCenteredSprite(
            brSp,
            rightEyePos.x,
            rightEyePos.y - brOffY + browDy,
            facePack.browW,
            facePack.browH,
            rightEyePos.sx,
            rightEyePos.sy,
            rightEyePos.tiltDir * tiltRad,
          );
        }
      }
      fctx.restore();
    }

    if (pass === "full" && char.face.noseStyle !== "none" && nosePos) {
      const nsImg = imageMap.get(angAssets.nose);
      if (nsImg) {
        const nsSp = getRecoloredInkSprite(nsImg, angAssets.nose, "#1c1f29", mode);
        drawCenteredSprite(
          nsSp,
          nosePos.x,
          nosePos.y,
          facePack.noseW,
          facePack.noseH,
          nosePos.sx,
          baseS,
        );
      }
    }

    if (pass === "full" && char.face.mouthStyle !== "none") {
      if (preset.mouthPose === "neutral" || preset.mouthPose === "serious") {
        const mtImg = imageMap.get(angAssets.mouth);
        if (mtImg) {
          const mtSp = getRecoloredInkSprite(mtImg, angAssets.mouth, "#1c1f29", mode);
          drawCenteredSprite(
            mtSp,
            mouthPos.x,
            mouthPos.y,
            facePack.mouthW,
            facePack.mouthH,
            mouthPos.sx,
            baseS * (preset.mouthPose === "serious" ? 0.9 : 1),
          );
        }
      } else {
        fctx.save();
        if (prof) {
          fctx.translate(mouthPos.x, mouthPos.y);
          fctx.scale(1, 0.74);
          fctx.translate(-mouthPos.x, -mouthPos.y);
        }
        drawAnimeMouth2D(
          fctx,
          mouthPos.x,
          mouthPos.y,
          "line",
          preset.mouthPose,
          (prof ? 0.36 : dir !== 0 ? 0.72 : 0.94) * fScale,
          char.face.mouthColor,
          dir,
          mode,
        );
        fctx.restore();
      }
    }

    // Hard clip all facial features strictly inside active eroded head silhouette (zero floating pixels)
    if (sil?.headMaskCanvas) {
      fctx.save();
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.globalCompositeOperation = "destination-in";
      fctx.drawImage(sil.headMaskCanvas, 0, 0, fc.width, fc.height);
      fctx.restore();
    }

    ctx.drawImage(fc, x0, y0, 200, 200);
  }

  if (pass === "full") {
    drawMangaEmotionFx2D(
      ctx,
      char.face.fx,
      (leftEyePos.x + (rightEyePos ? rightEyePos.x : leftEyePos.x)) / 2,
      eyeCenterY,
      fScale,
      dir,
      prof,
      mode,
    );
  }
}

function resolveAngleCustomTransform(layer: CustomLayerInstance2D, angle: Angle2D) {
  const ov = layer.perAngle[angle] ?? layer.perAngle[0] ?? {};
  return { ...DEFAULT_CUSTOM_TRANSFORM_2D, ...layer.defaultTransform, ...ov };
}

function drawCustomLayers2D(
  ctx: C,
  char: Character2D,
  customParts: CustomPartAsset2D[],
  zLayer: "behind" | "front",
  angle: Angle2D,
  imageMap: Map<string, HTMLImageElement>,
) {
  const partMap = new Map(customParts.map((p) => [p.id, p]));

  for (const layer of char.customLayers) {
    if (layer.zLayer !== zLayer) continue;
    const tr = resolveAngleCustomTransform(layer, angle);
    if (!tr.visible || tr.opacity <= 0.01) continue;

    const asset = partMap.get(layer.assetId);
    if (!asset) continue;

    const rawSrc =
      asset.kind === "single"
        ? (asset.singleSrc ?? asset.frames[angle] ?? asset.frames[0])
        : (asset.frames[angle] ?? asset.frames[0]);
    if (!rawSrc) continue;

    const img = imageMap.get(rawSrc);
    if (!img) continue;

    const sprite = getProcessedPartSprite(
      img,
      rawSrc,
      char.renderMode,
      layer.tintEnabled ? layer.tintColor : null,
      char.shadingDepth ?? "cel",
    );

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, tr.opacity));
    ctx.translate(CHAR2D_W / 2 + tr.x, CHAR2D_H / 2 + tr.y);
    ctx.rotate((tr.rotation * Math.PI) / 180);
    ctx.scale(tr.flipX ? -tr.scaleX : tr.scaleX, tr.scaleY);
    const baseW = asset.kind === "single" ? Math.min(260, sprite.width) : CHAR2D_W;
    const baseH =
      asset.kind === "single" ? (baseW * sprite.height) / Math.max(1, sprite.width) : CHAR2D_H;
    ctx.drawImage(sprite, -baseW / 2, -baseH / 2, baseW, baseH);
    ctx.restore();
  }
}

export async function preloadCharacter2DImages(
  char: Character2D,
  baseModel: BaseModel2D,
  customParts: CustomPartAsset2D[],
  headPack?: HeadPack2D,
): Promise<Map<string, HTMLImageElement>> {
  const urls = new Set<string>();
  const head = headPack ?? resolveHeadPack2D(char.headShapeId);
  const seamless = isUsingSeamlessHeadVariant(baseModel, char, char.angle, head);
  const variantSrc = seamless ? head.bodyVariants?.[baseModel.id]?.[char.angle] : undefined;
  const baseSrc = variantSrc ?? baseModel.frames[char.angle] ?? baseModel.frames[0];
  if (baseSrc) urls.add(baseSrc);
  if (!variantSrc) {
    const ovSrc = head.overlayFrames[char.angle] ?? head.overlayFrames[0];
    if (ovSrc) urls.add(ovSrc);
  }

  const ang = char.angle;
  const hairPack = resolveIllustratedHairPack2D(char.hair.style);
  if (hairPack) {
    if (hairPack.frontFrames[ang]) urls.add(hairPack.frontFrames[ang]);
    const backSrc = hairPack.backFrames[ang];
    if (backSrc) urls.add(backSrc);
  }

  const topPack = resolveIllustratedTopPack2D(char.clothes.top);
  if (topPack) {
    urls.add(topPack.frames[ang]);
    const topMask = topPack.accentMasks?.[ang];
    if (topMask) urls.add(topMask);
  }

  const bottomPack = resolveIllustratedBottomPack2D(char.clothes.bottom);
  if (bottomPack) {
    urls.add(bottomPack.frames[ang]);
    const botMask = bottomPack.accentMasks?.[ang];
    if (botMask) urls.add(botMask);
  }

  const footwearPack = resolveIllustratedFootwearPack2D(char.clothes.footwear);
  if (footwearPack) {
    urls.add(footwearPack.frames[ang]);
    const fwMask = footwearPack.accentMasks?.[ang];
    if (fwMask) urls.add(fwMask);
  }

  if (!isBackFacingAngle2D(ang)) {
    const facePack =
      resolveIllustratedFacePack2D(char.face.eyeStyle) ??
      resolveIllustratedFacePack2D(char.face.browStyle) ??
      resolveIllustratedFacePack2D(char.face.noseStyle) ??
      resolveIllustratedFacePack2D(char.face.mouthStyle);
    const faceAng = facePack?.angles[ang];
    if (faceAng) {
      urls.add(faceAng.eyeLeftBase);
      urls.add(faceAng.eyeLeftIris);
      if (faceAng.eyeRightBase) urls.add(faceAng.eyeRightBase);
      if (faceAng.eyeRightIris) urls.add(faceAng.eyeRightIris);
      urls.add(faceAng.browLeft);
      if (faceAng.browRight) urls.add(faceAng.browRight);
      urls.add(faceAng.nose);
      urls.add(faceAng.mouth);
    }
  }

  const partMap = new Map(customParts.map((p) => [p.id, p]));
  for (const layer of char.customLayers) {
    const asset = partMap.get(layer.assetId);
    if (!asset) continue;
    if (asset.singleSrc) urls.add(asset.singleSrc);
    for (const a of ANGLES_2D) {
      const f = asset.frames[a];
      if (f) urls.add(f);
    }
  }

  const out = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...urls].map(async (src) => {
      const img = await loadImageElement2D(src);
      if (img) out.set(src, img);
    }),
  );
  return out;
}

export function renderCharacter2DSync(
  ctx: C,
  char: Character2D,
  baseModel: BaseModel2D,
  customParts: CustomPartAsset2D[],
  imageMap: Map<string, HTMLImageElement>,
  headPack?: HeadPack2D,
  opts?: { skipProfileForegroundArm?: boolean },
) {
  const angle = char.angle;
  const mode = char.renderMode;
  const shadingDepth = char.shadingDepth ?? "cel";
  const head = headPack ?? resolveHeadPack2D(char.headShapeId);
  const anchors = resolveEffectiveAnchors(baseModel, char, angle, head);
  const seamless = isUsingSeamlessHeadVariant(baseModel, char, angle, head);
  const variantSrc = seamless ? head.bodyVariants?.[baseModel.id]?.[angle] : undefined;

  const hairPack = resolveIllustratedHairPack2D(char.hair.style);
  const topPack = resolveIllustratedTopPack2D(char.clothes.top);
  const bottomPack = resolveIllustratedBottomPack2D(char.clothes.bottom);
  const footwearPack = resolveIllustratedFootwearPack2D(char.clothes.footwear);
  const facePack =
    resolveIllustratedFacePack2D(char.face.eyeStyle) ??
    resolveIllustratedFacePack2D(char.face.browStyle) ??
    resolveIllustratedFacePack2D(char.face.noseStyle) ??
    resolveIllustratedFacePack2D(char.face.mouthStyle);

  let processedBaseCanvas: HTMLCanvasElement | null = null;
  let rawBaseImg: HTMLImageElement | null = null;
  let rawBaseSrc = "";
  let silKey = "";
  if (variantSrc) {
    const varImg = imageMap.get(variantSrc);
    if (varImg) {
      rawBaseImg = varImg;
      rawBaseSrc = variantSrc;
      silKey = `${variantSrc}|${mode}`;
      processedBaseCanvas = getProcessedBaseSprite(varImg, variantSrc, mode, char.skinTone);
    }
  } else {
    const baseSrc = baseModel.frames[angle] ?? baseModel.frames[0];
    const baseImg = baseSrc ? imageMap.get(baseSrc) : undefined;
    const headSrc = head.overlayFrames[angle] ?? head.overlayFrames[0];
    const headImg = headSrc ? imageMap.get(headSrc) : undefined;
    if (baseImg) {
      rawBaseImg = baseImg;
      rawBaseSrc = baseSrc;
      const fitScale = Math.max(0.75, Math.min(1.25, char.headFit?.scale ?? 1));
      const fitOffsetY = char.headFit?.offsetY ?? 0;
      silKey = `${baseSrc}|${headSrc}|${fitScale}|${fitOffsetY}|${mode}`;
      processedBaseCanvas = getProcessedCompositedBaseSprite(
        baseImg,
        baseSrc,
        headImg,
        headSrc,
        baseModel.anchors[angle],
        head.anchors[angle] ?? head.anchors[0],
        fitScale,
        fitOffsetY,
        mode,
        char.skinTone,
      );
    }
  }

  const headSil = processedBaseCanvas
    ? analyzeBaseHeadSilhouette(processedBaseCanvas, silKey, angle, anchors)
    : null;

  ctx.save();
  drawIllustratedHair2D(ctx, char, anchors, angle, mode, "back", imageMap, hairPack, headSil);
  drawCustomLayers2D(ctx, char, customParts, "behind", angle, imageMap);

  if (processedBaseCanvas) {
    const maskedBase = getClothingMaskedBaseCanvas(
      processedBaseCanvas,
      rawBaseImg,
      silKey,
      angle,
      anchors,
      headSil,
      Boolean(hairPack),
      Boolean(topPack),
      Boolean(bottomPack),
      Boolean(footwearPack),
    );
    ctx.drawImage(maskedBase, 0, 0, CHAR2D_W, CHAR2D_H);
  }

  drawIllustratedClothing2D(
    ctx,
    footwearPack,
    char.clothes.footwearColor,
    char.clothes.footwearAccentColor,
    angle,
    mode,
    shadingDepth,
    imageMap,
  );
  drawIllustratedClothing2D(
    ctx,
    bottomPack,
    char.clothes.bottomColor,
    char.clothes.bottomAccentColor,
    angle,
    mode,
    shadingDepth,
    imageMap,
  );
  const [refColL, refColR] = M1_REF_COLLAR_NECK[angle];
  const collarFit: TopCollarFit2D | null = headSil
    ? {
        srcL: refColL,
        srcR: refColR,
        dL: Math.max(-26, Math.min(26, headSil.collarNeckL - refColL)),
        dR: Math.max(-26, Math.min(26, headSil.collarNeckR - refColR)),
        angle,
      }
    : null;
  drawIllustratedClothing2D(
    ctx,
    topPack,
    char.clothes.topColor,
    char.clothes.topAccentColor,
    angle,
    mode,
    shadingDepth,
    imageMap,
    collarFit,
  );
  if (topPack) {
    redrawHeadNeckAboveCollar2D(ctx, processedBaseCanvas, headSil, angle);
  }
  if (
    !opts?.skipProfileForegroundArm &&
    (bottomPack || topPack) &&
    (!topPack || topPack.shortSleeve)
  ) {
    drawForegroundProfileArm2D(
      ctx,
      rawBaseImg,
      processedBaseCanvas,
      rawBaseSrc,
      anchors,
      angle,
      mode,
      char.skinTone,
    );
  }
  drawIllustratedFace2D(ctx, char, anchors, angle, mode, imageMap, facePack, headSil, "full");
  drawIllustratedHairCastShadow2D(ctx, char, anchors, angle, mode, imageMap, hairPack, headSil);
  drawIllustratedHair2D(ctx, char, anchors, angle, mode, "front", imageMap, hairPack, headSil);
  if (hairPack) {
    drawIllustratedFace2D(
      ctx,
      char,
      anchors,
      angle,
      mode,
      imageMap,
      facePack,
      headSil,
      "eyes_brows_over_bangs",
    );
  }
  drawCustomLayers2D(ctx, char, customParts, "front", angle, imageMap);
  ctx.restore();
}

export async function exportCharacter2DPng(
  char: Character2D,
  baseModel: BaseModel2D,
  customParts: CustomPartAsset2D[],
  scale = 2,
  headPack?: HeadPack2D,
): Promise<string> {
  const resolvedHead = headPack ?? resolveHeadPack2D(char.headShapeId);
  const imageMap = await preloadCharacter2DImages(char, baseModel, customParts, resolvedHead);
  const full = document.createElement("canvas");
  full.width = Math.round(CHAR2D_W * scale);
  full.height = Math.round(CHAR2D_H * scale);
  const fctx = full.getContext("2d");
  if (!fctx) return "";
  fctx.scale(scale, scale);
  renderCharacter2DSync(fctx, char, baseModel, customParts, imageMap, resolvedHead);

  const img = fctx.getImageData(0, 0, full.width, full.height);
  const d = img.data;
  let x0 = full.width;
  let y0 = full.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < full.height; y++) {
    for (let x = 0; x < full.width; x++) {
      if ((d[(y * full.width + x) * 4 + 3] ?? 0) > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return full.toDataURL("image/png");

  const pad = Math.round(14 * scale);
  const cx0 = Math.max(0, x0 - pad);
  const cy0 = Math.max(0, y0 - pad);
  const cx1 = Math.min(full.width - 1, x1 + pad);
  const cy1 = Math.min(full.height - 1, y1 + pad);
  const cw = cx1 - cx0 + 1;
  const ch = cy1 - cy0 + 1;

  const cropped = document.createElement("canvas");
  cropped.width = cw;
  cropped.height = ch;
  const cctx = cropped.getContext("2d")!;
  cctx.drawImage(full, cx0, cy0, cw, ch, 0, 0, cw, ch);
  return cropped.toDataURL("image/png");
}

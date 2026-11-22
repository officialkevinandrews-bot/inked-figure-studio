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
  type MouthStyle2D,
  type NoseStyle2D,
  type RenderMode2D,
} from "./character2d-types";
import {
  applySkinToneCanvas,
  extractMangaLineartCanvas,
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

function getProcessedBaseSprite(
  img: HTMLImageElement,
  srcKey: string,
  mode: RenderMode2D,
  skinTone: string | null,
): HTMLCanvasElement {
  const key = `base|${srcKey}|${mode}|${skinTone ?? "orig"}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;
  const processed =
    mode === "manga"
      ? extractMangaLineartCanvas(img, CHAR2D_W, CHAR2D_H)
      : applySkinToneCanvas(img, skinTone, CHAR2D_W, CHAR2D_H);
  return putProcessedCache(key, processed);
}

function getProcessedPartSprite(
  img: HTMLImageElement,
  srcKey: string,
  mode: RenderMode2D,
  tintHex: string | null,
): HTMLCanvasElement {
  const key = `part|${srcKey}|${mode}|${tintHex ?? "orig"}`;
  const hit = PROCESSED_SPRITE_CACHE.get(key);
  if (hit) return hit;
  return putProcessedCache(key, tintCustomPartCanvas(img, tintHex, mode));
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
    amount >= 0
      ? Math.round(v + (255 - v) * amount)
      : Math.round(v * (1 + amount));
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

function traceTaperedTube(
  ctx: C,
  pts: BodyPoint2D[],
  radii: number[],
) {
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
): BodyAngleAnchors {
  const base = model.anchors[angle];
  const ov = char.anchorOverrides?.[angle];
  if (!ov) return base;
  return { ...base, ...ov };
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
    { strokeWidth: 2.1, shadowSide: dir > 0 ? "left" : "right", bounds: { x: x0, y: collarY, w, h: soleBot - collarY } },
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
    strokeLine(ctx, [[x0 + 3, soleTop - 6], [x1 - 3, soleTop - 6]], mode, 1.4);
    if (!prof) {
      for (let i = 0; i < 3; i++) {
        const ly = ankle.y + 8 + i * 8;
        strokeLine(ctx, [[midX - 5, ly], [midX + 5, ly]], mode, 1.5);
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
    strokeLine(ctx, [[ankle.x - 14, collarY + 30], [ankle.x + 14, collarY + 30]], mode, 1.7);
    strokeLine(ctx, [[ankle.x - 14, collarY + 48], [ankle.x + 14, collarY + 48]], mode, 1.7);
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
    drawShoeUnit(ctx, a.legLeft[2], a.legLeft[3], fw, angle, col, acc, mode, a.calfWidth + 8, 0, true);
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

    drawCelShape(
      ctx,
      () => traceTaperedTube(ctx, pts, radii),
      col,
      mode,
      {
        strokeWidth: 2.3,
        shadowSide: dir > 0 ? "left" : "right",
        bounds: { x: hipPt.x - r0, y: hipPt.y, w: r0 * 2, h: hemPt.y - hipPt.y },
      },
    );

    if (style !== "shorts") {
      strokeLine(ctx, [[kneePt.x - r1 * 0.45, kneePt.y - 4], [kneePt.x + r1 * 0.35, kneePt.y + 3]], mode, 1.4);
    }
    if (style === "cargo") {
      const midX = (hipPt.x + kneePt.x) / 2;
      const midY = (hipPt.y + kneePt.y) / 2 - 4;
      const pw = Math.max(22, r1 * 1.12);
      drawCelShape(
        ctx,
        () => ctx.roundRect(midX - pw / 2, midY - 18, pw, 38, 3),
        col,
        mode,
        { strokeWidth: 1.8, shadowSide: "bottom", bounds: { x: midX - pw / 2, y: midY - 18, w: pw, h: 38 } },
      );
      strokeLine(ctx, [[midX - pw / 2 + 2, midY - 8], [midX + pw / 2 - 2, midY - 8]], mode, 1.5);
      drawCelShape(
        ctx,
        () => ctx.roundRect(hemPt.x - r2, hemPt.y - 12, r2 * 2, 13, 2),
        acc,
        mode,
        { strokeWidth: 1.7, bounds: { x: hemPt.x - r2, y: hemPt.y - 12, w: r2 * 2, h: 13 } },
      );
    }
    if (style === "shorts") {
      drawCelShape(
        ctx,
        () => ctx.roundRect(hemPt.x - r1 - 3, hemPt.y - 10, (r1 + 3) * 2, 10, 2),
        acc,
        mode,
        { strokeWidth: 1.7, bounds: { x: hemPt.x - r1 - 3, y: hemPt.y - 10, w: (r1 + 3) * 2, h: 10 } },
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
    { strokeWidth: 2, shadowSide: "bottom", bounds: { x: pelvisL + 2, y: waistTop, w: pelvisR - pelvisL - 4, h: 15 } },
  );

  if (style === "jeans" && !prof) {
    if (back) {
      const pw = (pelvisR - pelvisL) * 0.25;
      const py = waistTop + 24;
      strokeLine(ctx, [[pelvisL + 16, py], [pelvisL + 16 + pw, py], [pelvisL + 16 + pw, py + 24], [pelvisL + 16 + pw / 2, py + 31], [pelvisL + 16, py + 24], [pelvisL + 16, py]], mode, 1.6);
      strokeLine(ctx, [[pelvisR - 16 - pw, py], [pelvisR - 16, py], [pelvisR - 16, py + 24], [pelvisR - 16 - pw / 2, py + 31], [pelvisR - 16 - pw, py + 24], [pelvisR - 16 - pw, py]], mode, 1.6);
    } else {
      const flyX = hipMidX + dir * 10;
      strokeLine(ctx, [[flyX, waistTop + 15], [flyX, waistTop + 44], [flyX - 5 * (dir || 1), waistTop + 50]], mode, 1.7);
      strokeLine(ctx, [[pelvisL + 6, waistTop + 17], [pelvisL + 16, waistTop + 40]], mode, 1.6);
      strokeLine(ctx, [[pelvisR - 6, waistTop + 17], [pelvisR - 16, waistTop + 40]], mode, 1.6);
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
      drawSleeve(ctx, a.armRight, a.armWidth, sleeveFrac, sleeveCol, style === "hoodie" ? col : acc, hasCuff, mode, dir, deltoidTopY);
    } else if (dir < 0) {
      drawSleeve(ctx, a.armLeft, a.armWidth, sleeveFrac, sleeveCol, style === "hoodie" ? col : acc, hasCuff, mode, dir, deltoidTopY);
    } else {
      drawSleeve(ctx, a.armLeft, a.armWidth, sleeveFrac, sleeveCol, style === "hoodie" ? col : acc, hasCuff, mode, dir, deltoidTopY);
      drawSleeve(ctx, a.armRight, a.armWidth, sleeveFrac, sleeveCol, style === "hoodie" ? col : acc, hasCuff, mode, dir, deltoidTopY);
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
      { strokeWidth: 2.3, shadowSide: "bottom", bounds: { x: a.neckL - 28, y: collarTopY - 14, w: 128, h: 92 } },
    );
  }

  // Main Torso Shell sweeping smoothly from neck base over trapezius/deltoids to chest & waist
  drawCelShape(
    ctx,
    () => {
      const shL = prof ? chestL + 2 : Math.min(chestL, a.armLeft[0].x - 10);
      const shR = prof ? chestR - 2 : Math.max(chestR, a.armRight[0].x + 10);
      ctx.moveTo(a.neckL - 5, collarTopY);
      ctx.quadraticCurveTo((a.neckL + shL) / 2, collarTopY + 8, shL, deltoidTopY);
      ctx.quadraticCurveTo(shL - 5, deltoidTopY + 14, chestL, a.chestY);
      ctx.lineTo(waistL, a.waistY);
      ctx.lineTo(hemL, hemY);
      ctx.quadraticCurveTo(topMidX, hemY + 5, hemR, hemY);
      ctx.lineTo(waistR, a.waistY);
      ctx.lineTo(chestR, a.chestY);
      ctx.quadraticCurveTo(shR + 5, deltoidTopY + 14, shR, deltoidTopY);
      ctx.quadraticCurveTo((a.neckR + shR) / 2, collarTopY + 8, a.neckR + 5, collarTopY);
      ctx.quadraticCurveTo((a.neckL + a.neckR) / 2 + dir * 6, back ? collarTopY + 6 : collarTopY + 26, a.neckL - 5, collarTopY);
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
        { strokeWidth: 2.1, shadowSide: "bottom", bounds: { x: a.neckL - 12, y: collarTopY, w: 72, h: 28 } },
      );
      if (!prof) {
        const stringX = topMidX + dir * 12;
        strokeLine(ctx, [[stringX - 9, collarTopY + 22], [stringX - 11, a.chestY + 22]], mode, 2.2);
        strokeLine(ctx, [[stringX + 9, collarTopY + 22], [stringX + 11, a.chestY + 18]], mode, 2.2);
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
          { strokeWidth: 1.9, shadowSide: "bottom", bounds: { x: pCx - pW * 0.5, y: a.waistY + 6, w: pW, h: 60 } },
        );
      }
    } else {
      strokeLine(ctx, [[topMidX, collarTopY + 4], [topMidX, a.shoulderY + 24]], mode, 1.8);
    }
    drawCelShape(
      ctx,
      () => ctx.roundRect(hemL + 1, hemY - 15, hemR - hemL - 2, 16, 2),
      col,
      mode,
      { strokeWidth: 2, shadowSide: "bottom", bounds: { x: hemL, y: hemY - 15, w: hemR - hemL, h: 16 } },
    );
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
        { strokeWidth: 1.9, shadowSide: "right", bounds: { x: centerFrontX - 24, y: collarTopY + 6, w: 48, h: hemY - collarTopY } },
      );

      if (style === "blazer") {
        strokeLine(ctx, [[a.neckL + 2, collarTopY + 8], [centerFrontX - 18, a.chestY + 6], [centerFrontX - 6, a.chestY + 42]], mode, 2);
        strokeLine(ctx, [[a.neckR - 2, collarTopY + 8], [centerFrontX + 18, a.chestY + 6], [centerFrontX + 6, a.chestY + 42]], mode, 2);
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
        strokeLine(ctx, [[centerFrontX - 12, collarTopY + 6], [centerFrontX - 12, hemY]], mode, 1.9);
        strokeLine(ctx, [[centerFrontX + 12, collarTopY + 6], [centerFrontX + 12, hemY]], mode, 1.9);
      }
    } else if (back) {
      strokeLine(ctx, [[chestL + 8, a.shoulderY + 20], [chestR - 8, a.shoulderY + 20]], mode, 1.6);
      if (style === "blazer") {
        strokeLine(ctx, [[topMidX, a.hipY - 8], [topMidX, hemY]], mode, 1.8);
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
    strokeLine(ctx, [[chestL + 22, a.chestY + 38], [topMidX + dir * 8, a.chestY + 46]], mode, 1.5);
  }

  // Near/profile sleeve drawn AFTER torso so it drapes cleanly over torso side
  if (prof) {
    drawSleeve(ctx, a.armLeft, a.armWidth, sleeveFrac, sleeveCol, style === "hoodie" ? col : acc, hasCuff, mode, dir, deltoidTopY);
  } else if (dir > 0) {
    drawSleeve(ctx, a.armLeft, a.armWidth, sleeveFrac, sleeveCol, style === "hoodie" ? col : acc, hasCuff, mode, dir, deltoidTopY);
  } else if (dir < 0) {
    drawSleeve(ctx, a.armRight, a.armWidth, sleeveFrac, sleeveCol, style === "hoodie" ? col : acc, hasCuff, mode, dir, deltoidTopY);
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
    sharp: 18,
    round: 16,
    almond: 19,
    intense: 17,
    gentle: 17,
    stoic: 18,
  };
  const hByStyle: Record<EyeStyle2D, number> = {
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
    eyeStyle === "sharp" || eyeStyle === "intense"
      ? -2.2
      : eyeStyle === "gentle"
        ? 1.5
        : 0;
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
    const fillSkin = mode === "manga" ? "#ffffff" : skinTone ?? "#f8cfb3";
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
      strokeLine(ctx, [[-hw + 2, 0.5], [hw - 2, 0.5]], mode, 1.3);
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
    drawAnimeEye2D(ctx, edgeEyeX, eyeDy, char.face.eyeStyle, preset.eyeMode, 0.54, dir, char.face.eyeColor, mode);
    drawAnimeBrow2D(ctx, edgeEyeX, eyeDy - 12, char.face.browStyle, preset.browTilt, 0.6, dir, char.face.browColor, mode);
    drawAnimeNose2D(ctx, dir * (a.headRx - 18), noseDy, char.face.noseStyle, angle, char.skinTone, mode);
    drawAnimeMouth2D(ctx, dir * (a.headRx - 22), mouthDy, char.face.mouthStyle, preset.mouthPose, 0.48, char.face.mouthColor, dir, mode);
  } else if (dir !== 0) {
    const nearEyeX = -dir * 16;
    const farEyeX = dir * 13;
    drawAnimeEye2D(ctx, nearEyeX, eyeDy, char.face.eyeStyle, preset.eyeMode, 0.94, -dir, char.face.eyeColor, mode);
    drawAnimeEye2D(ctx, farEyeX, eyeDy, char.face.eyeStyle, preset.eyeMode, 0.7, dir, char.face.eyeColor, mode);
    drawAnimeBrow2D(ctx, nearEyeX, eyeDy - 12, char.face.browStyle, preset.browTilt, 0.92, -dir, char.face.browColor, mode);
    drawAnimeBrow2D(ctx, farEyeX, eyeDy - 12, char.face.browStyle, preset.browTilt, 0.72, dir, char.face.browColor, mode);
    drawAnimeNose2D(ctx, dir * 3, noseDy, char.face.noseStyle, angle, char.skinTone, mode);
    drawAnimeMouth2D(ctx, dir * 2, mouthDy, char.face.mouthStyle, preset.mouthPose, 0.82, char.face.mouthColor, dir, mode);
  } else {
    drawAnimeEye2D(ctx, -18, eyeDy, char.face.eyeStyle, preset.eyeMode, 1, -1, char.face.eyeColor, mode);
    drawAnimeEye2D(ctx, 18, eyeDy, char.face.eyeStyle, preset.eyeMode, 1, 1, char.face.eyeColor, mode);
    drawAnimeBrow2D(ctx, -18, eyeDy - 12, char.face.browStyle, preset.browTilt, 1, -1, char.face.browColor, mode);
    drawAnimeBrow2D(ctx, 18, eyeDy - 12, char.face.browStyle, preset.browTilt, 1, 1, char.face.browColor, mode);
    drawAnimeNose2D(ctx, 0, noseDy, char.face.noseStyle, angle, char.skinTone, mode);
    drawAnimeMouth2D(ctx, 0, mouthDy, char.face.mouthStyle, preset.mouthPose, 1, char.face.mouthColor, 0, mode);
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
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
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
      { strokeWidth: 2.3, shadowSide: "bottom", bounds: { x: cx - rx - 16, y: cy - ry - 10, w: rx * 2 + 32, h: 260 } },
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
          { strokeWidth: 2.1, shadowSide: "bottom", bounds: { x: cx - rx - 10, y: cy - ry, w: rx * 2 + 20, h: 160 } },
        );
      }
    } else {
      const backDir = -dir;
      drawCelShape(
        ctx,
        () => {
          ctx.moveTo(cx, cy - ry);
          ctx.quadraticCurveTo(cx + backDir * (rx + 10), cy - 8, cx + backDir * (rx + 6), a.chinY + 12);
          ctx.lineTo(cx + backDir * (rx * 0.25), a.chinY + 5);
          ctx.closePath();
        },
        col,
        mode,
        { strokeWidth: 2.2, shadowSide: "bottom", bounds: { x: cx - rx - 16, y: cy - ry, w: rx * 2 + 32, h: 160 } },
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
      { strokeWidth: 2.3, shadowSide: dir > 0 ? "left" : "right", highlight: true, bounds: { x: cx - rx - 12, y: topY, w: rx * 2 + 24, h: 240 } },
    );
    strokeLine(ctx, [[cx - rx * 0.36, cy - ry * 0.2], [cx - rx * 0.48, a.chinY - 6]], mode, 1.5);
    strokeLine(ctx, [[cx + rx * 0.36, cy - ry * 0.2], [cx + rx * 0.48, a.chinY - 6]], mode, 1.5);
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
      { strokeWidth: 2.3, shadowSide: dir > 0 ? "left" : "right", highlight: true, bounds: { x: cx - rx - 10, y: topY, w: rx * 2 + 20, h: 170 } },
    );
    strokeLine(ctx, [[cx, topY + 14], [cx - dir * 18, cy + 10]], mode, 1.4);
    strokeLine(ctx, [[cx + dir * 10, topY + 18], [cx + dir * 20, browY - 2]], mode, 1.4);
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
  strokeLine(ctx, [[cx - rx * 0.32, topY + 14], [cx - rx * 0.42 + shift, browY - 4]], mode, 1.3);
  strokeLine(ctx, [[cx + rx * 0.32, topY + 14], [cx + rx * 0.42 + shift, browY - 4]], mode, 1.3);
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
        ? asset.singleSrc ?? asset.frames[angle] ?? asset.frames[0]
        : asset.frames[angle] ?? asset.frames[0];
    if (!rawSrc) continue;

    const img = imageMap.get(rawSrc);
    if (!img) continue;

    const sprite = getProcessedPartSprite(
      img,
      rawSrc,
      char.renderMode,
      layer.tintEnabled ? layer.tintColor : null,
    );

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, tr.opacity));
    ctx.translate(CHAR2D_W / 2 + tr.x, CHAR2D_H / 2 + tr.y);
    ctx.rotate((tr.rotation * Math.PI) / 180);
    ctx.scale(tr.flipX ? -tr.scaleX : tr.scaleX, tr.scaleY);
    const baseW = asset.kind === "single" ? Math.min(260, sprite.width) : CHAR2D_W;
    const baseH =
      asset.kind === "single"
        ? (baseW * sprite.height) / Math.max(1, sprite.width)
        : CHAR2D_H;
    ctx.drawImage(sprite, -baseW / 2, -baseH / 2, baseW, baseH);
    ctx.restore();
  }
}

export async function preloadCharacter2DImages(
  char: Character2D,
  baseModel: BaseModel2D,
  customParts: CustomPartAsset2D[],
): Promise<Map<string, HTMLImageElement>> {
  const urls = new Set<string>();
  const baseSrc = baseModel.frames[char.angle] ?? baseModel.frames[0];
  if (baseSrc) urls.add(baseSrc);

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
) {
  const angle = char.angle;
  const mode = char.renderMode;
  const anchors = resolveEffectiveAnchors(baseModel, char, angle);

  ctx.save();
  drawHairBack2D(ctx, char, anchors, angle, mode);
  drawCustomLayers2D(ctx, char, customParts, "behind", angle, imageMap);

  const baseSrc = baseModel.frames[angle] ?? baseModel.frames[0];
  const baseImg = baseSrc ? imageMap.get(baseSrc) : undefined;
  if (baseImg) {
    const processed = getProcessedBaseSprite(baseImg, baseSrc, mode, char.skinTone);
    ctx.drawImage(processed, 0, 0, CHAR2D_W, CHAR2D_H);
  }

  drawFootwear2D(ctx, char, anchors, angle, mode);
  drawBottoms2D(ctx, char, anchors, angle, mode);
  drawTop2D(ctx, char, anchors, angle, mode);
  drawFace2D(ctx, char, anchors, angle, mode);
  drawHairFront2D(ctx, char, anchors, angle, mode);
  drawCustomLayers2D(ctx, char, customParts, "front", angle, imageMap);
  ctx.restore();
}

export async function exportCharacter2DPng(
  char: Character2D,
  baseModel: BaseModel2D,
  customParts: CustomPartAsset2D[],
  scale = 2,
): Promise<string> {
  const imageMap = await preloadCharacter2DImages(char, baseModel, customParts);
  const full = document.createElement("canvas");
  full.width = Math.round(CHAR2D_W * scale);
  full.height = Math.round(CHAR2D_H * scale);
  const fctx = full.getContext("2d");
  if (!fctx) return "";
  fctx.scale(scale, scale);
  renderCharacter2DSync(fctx, char, baseModel, customParts, imageMap);

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

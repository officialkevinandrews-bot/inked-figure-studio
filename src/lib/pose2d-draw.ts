import {
  CHAR2D_H,
  CHAR2D_W,
  type Angle2D,
  type BaseModel2D,
  type BodyAngleAnchors,
  type BodyPoint2D,
  type Character2D,
  type CustomPartAsset2D,
  type HeadPack2D,
  type RenderMode2D,
} from "./character2d-types";
import {
  extractProfileForearmForPose2D,
  preloadCharacter2DImages,
  renderCharacter2DSync,
  resolveEffectiveAnchors,
} from "./character2d-draw";
import { resolveBaseModel2D, resolveCharacterHeadPack2D } from "./character2d-store";
import {
  cameraCanvasToStageWorldPoint,
  characterToStagePoint,
  characterToStageWorldPoint,
  computeForwardKinematics2D,
  degToRad,
  type SkeletonWorld2D,
} from "./pose2d-rig";
import {
  STAGE2D_H,
  STAGE2D_W,
  type JointId2D,
  type Pose2DState,
  type Stage2D,
  type Stage2DActor,
} from "./pose2d-types";
import { preloadScene2DImages, renderScene2DSync } from "./scene2d-draw";
import type { Scene2D, SceneDepthLayer, SceneObjectAsset2D } from "./scene2d-types";

type C = CanvasRenderingContext2D;

export type RigPartName2D =
  | "head"
  | "torso"
  | "pelvis"
  | "upperArmL"
  | "forearmL"
  | "handL"
  | "upperArmR"
  | "forearmR"
  | "handR"
  | "thighL"
  | "shinL"
  | "footL"
  | "thighR"
  | "shinR"
  | "footR";

export interface PartSlice2D {
  canvas: HTMLCanvasElement;
  pivotX: number;
  pivotY: number;
}

export interface CharacterRig2D {
  anchors: BodyAngleAnchors;
  slices: Record<RigPartName2D, PartSlice2D>;
}

const RIG_SLICE_CACHE = new Map<string, CharacterRig2D>();

function putRigCache(key: string, val: CharacterRig2D): CharacterRig2D {
  if (RIG_SLICE_CACHE.size > 36) {
    const oldest = RIG_SLICE_CACHE.keys().next().value;
    if (oldest) RIG_SLICE_CACHE.delete(oldest);
  }
  RIG_SLICE_CACHE.set(key, val);
  return val;
}

export function clearPose2DRigCache(): void {
  RIG_SLICE_CACHE.clear();
}

function makeCharRigCacheKey(
  char: Character2D,
  angle: Angle2D,
  mode: RenderMode2D,
  actor: Stage2DActor,
): string {
  const expr = actor.expressionOverride ?? char.face.expression;
  const fx = (actor.fxOverride ?? char.face.fx).join(",");
  const depth = char.shadingDepth ?? "cel";
  return `${char.id}|${char.updatedAt}|${angle}|${mode}|${depth}|${char.headShapeId ?? ""}|${char.hair.style}|${char.clothes.top}|${char.clothes.bottom}|${char.clothes.footwear}|${expr}|${fx}`;
}

function isProfileAngle(angle: Angle2D): boolean {
  return angle === 90 || angle === 270;
}

/**
 * Traces a smooth rounded tapered stadium / capsule enclosing segment A->B with end-cap radii
 * `radA` around A and `radB` around B (`extA = 0, extB = 0` keeps every circular cap concentric on its joint pivot).
 */
function traceCapsulePath(
  ctx: C,
  a: BodyPoint2D,
  b: BodyPoint2D,
  radA: number,
  radB: number = radA,
  extA = 0,
  extB = 0,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const pa = { x: a.x - ux * extA, y: a.y - uy * extA };
  const pb = { x: b.x + ux * extB, y: b.y + uy * extB };
  const nx = -uy;
  const ny = ux;
  const ang = Math.atan2(uy, ux);
  ctx.beginPath();
  ctx.arc(pa.x, pa.y, radA, ang + Math.PI / 2, ang + (Math.PI * 3) / 2);
  ctx.lineTo(pb.x - nx * radB, pb.y - ny * radB);
  ctx.arc(pb.x, pb.y, radB, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  out.getContext("2d")!.drawImage(src, 0, 0);
  return out;
}

/**
 * In 90° and 270° side-profile views, the resting hanging arm crosses the torso & hip block.
 * Cleanly removes that vertical arm strip from torso/pelvis and inpaints interior skin/garment rows
 * between the pixels immediately left and right of the arm so swinging the arm leaves zero hole or ghost lines.
 */
function inpaintProfileArmStrip(
  torsoCanvas: HTMLCanvasElement,
  anchors: BodyAngleAnchors,
  mode: RenderMode2D,
  maxY?: number,
) {
  const ctx = torsoCanvas.getContext("2d");
  if (!ctx) return;
  const w = torsoCanvas.width;
  const h = torsoCanvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  const armPts = anchors.armLeft;
  const yStart = Math.max(0, Math.round(anchors.shoulderY + 18));
  const yEnd = Math.min(h - 1, Math.round(maxY ?? anchors.hemY + 4));
  const halfArm = Math.max(13, Math.round(anchors.armWidth * 0.44));

  for (let y = yStart; y <= yEnd; y++) {
    // Interpolate arm centerline X along shoulder -> elbow -> wrist
    let ax = armPts[0].x;
    if (y <= armPts[1].y) {
      const t = (y - armPts[0].y) / Math.max(1, armPts[1].y - armPts[0].y);
      ax = armPts[0].x + (armPts[1].x - armPts[0].x) * Math.max(0, Math.min(1, t));
    } else {
      const t = (y - armPts[1].y) / Math.max(1, armPts[2].y - armPts[1].y);
      ax = armPts[1].x + (armPts[2].x - armPts[1].x) * Math.max(0, Math.min(1, t));
    }

    const x0 = Math.max(2, Math.round(ax - halfArm));
    const x1 = Math.min(w - 3, Math.round(ax + halfArm));

    // Sample nearest non-dark interior torso pixel left & right of arm strip
    const findCleanSample = (
      startX: number,
      step: number,
    ): [number, number, number, number] | null => {
      for (let k = 0; k < 14; k++) {
        const sx = startX + k * step;
        if (sx < 1 || sx >= w - 1) break;
        const idx = (y * w + sx) * 4;
        const a = d[idx + 3] ?? 0;
        if (a < 180) continue;
        const lum = ((d[idx] ?? 0) + (d[idx + 1] ?? 0) + (d[idx + 2] ?? 0)) / 3;
        if (lum > 45) return [d[idx]!, d[idx + 1]!, d[idx + 2]!, a];
      }
      return null;
    };

    const leftS = findCleanSample(x0 - 2, -1);
    const rightS = findCleanSample(x1 + 2, 1);

    if (leftS && rightS) {
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / Math.max(1, x1 - x0);
        const idx = (y * w + x) * 4;
        if (mode === "manga") {
          d[idx] = 255;
          d[idx + 1] = 255;
          d[idx + 2] = 255;
          d[idx + 3] = 255;
        } else {
          d[idx] = Math.round(leftS[0] + (rightS[0] - leftS[0]) * t);
          d[idx + 1] = Math.round(leftS[1] + (rightS[1] - leftS[1]) * t);
          d[idx + 2] = Math.round(leftS[2] + (rightS[2] - leftS[2]) * t);
          d[idx + 3] = 255;
        }
      }
    } else if (leftS || rightS) {
      const s = (leftS ?? rightS)!;
      // Only fill pixels inside arm strip that border filled body area
      for (let x = x0; x <= x1; x++) {
        const idx = (y * w + x) * 4;
        if ((d[idx + 3] ?? 0) > 120) {
          d[idx] = mode === "manga" ? 255 : s[0];
          d[idx + 1] = mode === "manga" ? 255 : s[1];
          d[idx + 2] = mode === "manga" ? 255 : s[2];
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Slices a rendered `480x1000` master character sprite using a custom clip function and pivot
 * into a tight padded slice canvas for fast zero-allocation articulated redraws.
 */
function sliceRegion(
  master: HTMLCanvasElement,
  pivot: BodyPoint2D,
  bounds: { x: number; y: number; w: number; h: number },
  clipFn: (ctx: C) => void,
  opts?: { dimDarken?: number; postProcess?: (c: HTMLCanvasElement) => void },
): PartSlice2D {
  const bx = Math.max(0, Math.floor(bounds.x));
  const by = Math.max(0, Math.floor(bounds.y));
  const bw = Math.max(4, Math.min(CHAR2D_W - bx, Math.ceil(bounds.w)));
  const bh = Math.max(4, Math.min(CHAR2D_H - by, Math.ceil(bounds.h)));

  const out = document.createElement("canvas");
  out.width = bw;
  out.height = bh;
  const ctx = out.getContext("2d")!;
  ctx.save();
  ctx.translate(-bx, -by);
  clipFn(ctx);
  ctx.clip();
  ctx.drawImage(master, 0, 0, CHAR2D_W, CHAR2D_H);
  if (opts?.dimDarken && opts.dimDarken > 0) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(15, 23, 42, ${Math.min(0.45, opts.dimDarken)})`;
    ctx.fillRect(0, 0, CHAR2D_W, CHAR2D_H);
  }
  ctx.restore();

  if (opts?.postProcess) opts.postProcess(out);

  return {
    canvas: out,
    pivotX: pivot.x - bx,
    pivotY: pivot.y - by,
  };
}

/**
 * Computes inner X separator polygon clip for an arm on non-profile angles so arm slices
 * exclude torso/waist/chest interior pixels while preserving natural sleeve & shoulder contours.
 */
function traceArmOuterRegion(
  ctx: C,
  a: BodyAngleAnchors,
  side: "left" | "right",
  topPad: number,
  elbowRadius: number,
) {
  const sh = side === "left" ? a.armLeft[0] : a.armRight[0];
  const el = side === "left" ? a.armLeft[1] : a.armRight[1];
  const wr = side === "left" ? a.armLeft[2] : a.armRight[2];
  const sign = side === "left" ? -1 : 1;

  const chestEdge = (side === "left" ? a.torsoL : a.torsoR) + sign * topPad;
  const waistEdge = (side === "left" ? a.waistL : a.waistR) + sign * topPad;
  const hipEdge = (side === "left" ? a.hipL : a.hipR) + sign * topPad;

  const sepTop =
    side === "left"
      ? Math.min(sh.x + elbowRadius, (sh.x + chestEdge) / 2)
      : Math.max(sh.x - elbowRadius, (sh.x + chestEdge) / 2);
  const sepMid =
    side === "left"
      ? Math.min(el.x + elbowRadius, waistEdge - 1)
      : Math.max(el.x - elbowRadius, waistEdge + 1);
  const sepBot =
    side === "left"
      ? Math.min(wr.x + elbowRadius, hipEdge - 1)
      : Math.max(wr.x - elbowRadius, hipEdge + 1);
  const outerX = side === "left" ? 0 : CHAR2D_W;

  ctx.beginPath();
  ctx.moveTo(outerX, Math.max(0, a.shoulderY - 52));
  ctx.lineTo(sh.x - sign * 18, Math.max(0, a.shoulderY - 52));
  ctx.lineTo(sepTop, a.chestY - 8);
  ctx.lineTo(sepMid, a.waistY);
  ctx.lineTo(sepBot, Math.min(CHAR2D_H, wr.y + 96));
  ctx.lineTo(outerX, Math.min(CHAR2D_H, wr.y + 96));
  ctx.closePath();
}

export function buildCharacterRigSlices(
  char: Character2D,
  baseModel: BaseModel2D,
  customParts: CustomPartAsset2D[],
  headPack: HeadPack2D,
  imageMap: Map<string, HTMLImageElement>,
  actor: Stage2DActor,
  mode: RenderMode2D,
): CharacterRig2D {
  const key = makeCharRigCacheKey(char, actor.angle, mode, actor);
  const cached = RIG_SLICE_CACHE.get(key);
  if (cached) return cached;

  const effectiveChar: Character2D = {
    ...char,
    angle: actor.angle,
    renderMode: mode,
    face: {
      ...char.face,
      expression: actor.expressionOverride ?? char.face.expression,
      fx: actor.fxOverride ?? char.face.fx,
    },
  };

  const master = document.createElement("canvas");
  master.width = CHAR2D_W;
  master.height = CHAR2D_H;
  const mctx = master.getContext("2d")!;
  renderCharacter2DSync(mctx, effectiveChar, baseModel, customParts, imageMap, headPack);

  const profile = isProfileAngle(actor.angle);
  const usesIllustratedBodyCutout =
    effectiveChar.clothes.top !== "none" || effectiveChar.clothes.bottom !== "none";
  const bodyNoArmMaster =
    profile && usesIllustratedBodyCutout
      ? (() => {
          const c = document.createElement("canvas");
          c.width = CHAR2D_W;
          c.height = CHAR2D_H;
          renderCharacter2DSync(
            c.getContext("2d")!,
            effectiveChar,
            baseModel,
            customParts,
            imageMap,
            headPack,
            { skipProfileForegroundArm: true },
          );
          return c;
        })()
      : null;

  const a = resolveEffectiveAnchors(baseModel, effectiveChar, actor.angle, headPack);

  const shL = a.armLeft[0];
  const elL = a.armLeft[1];
  const wrL = a.armLeft[2];
  const shR = a.armRight[0];
  const elR = a.armRight[1];
  const wrR = a.armRight[2];

  const hipL = a.legLeft[0];
  const kneeL = a.legLeft[1];
  const ankleL = a.legLeft[2];
  const toeL = a.legLeft[3];

  const hipR = a.legRight[0];
  const kneeR = a.legRight[1];
  const ankleR = a.legRight[2];
  const toeR = a.legRight[3];

  const spinePivot: BodyPoint2D = { x: (a.waistL + a.waistR) / 2, y: a.waistY };
  const chestPivot: BodyPoint2D = { x: (a.torsoL + a.torsoR) / 2, y: a.chestY };
  const neckPivot: BodyPoint2D = { x: (a.neckL + a.neckR) / 2, y: a.neckY };
  const hipsPivot: BodyPoint2D = { x: (hipL.x + hipR.x) / 2, y: a.hipY };

  const topStyle = effectiveChar.clothes.top;
  const bottomStyle = effectiveChar.clothes.bottom;
  const topPad =
    topStyle === "zip_hoodie_tee" ||
    topStyle === "hoodie" ||
    topStyle === "zip_jacket" ||
    topStyle === "blazer"
      ? 11
      : topStyle === "none"
        ? 2
        : 7;
  const topWiden = topStyle === "none" ? 1 : 4.5;
  const legWiden =
    bottomStyle === "cargo" ? 10 : bottomStyle === "shorts" ? 6 : bottomStyle === "none" ? 1.5 : 5;

  // Exact tangent hinge radii matching drawSleeve / drawBottoms2D garment width + stroke so ink outlines stay 100% intact with zero tabs
  const shoulderR = Math.max(20, a.armWidth * (profile ? 0.58 : 0.66) + topWiden);
  const elbowR = Math.max(17, a.armWidth * 0.52 + topWiden);
  const wristR = Math.max(15, a.armWidth * 0.48 + topWiden);
  const hipLegR = Math.max(25, a.thighWidth * 0.54 + legWiden + 2);
  const radKnee = Math.max(22, Math.max(a.thighWidth * 0.46, a.calfWidth * 0.65) + legWiden + 2.5);
  const radAnkle = Math.max(19, a.calfWidth * 0.54 + legWiden + 2.5);

  // 1. Head + Hair slice (pivots around neck base)
  const headMinX = Math.max(0, Math.round(a.headCx - a.headRx - 68));
  const headMaxX = Math.min(CHAR2D_W, Math.round(a.headCx + a.headRx + 68));
  const headBottomY = Math.round(a.neckY + 24);
  const headSlice = sliceRegion(
    master,
    neckPivot,
    { x: headMinX, y: 0, w: headMaxX - headMinX, h: headBottomY },
    (ctx) => {
      ctx.beginPath();
      ctx.moveTo(headMinX, 0);
      ctx.lineTo(headMaxX, 0);
      ctx.lineTo(headMaxX, a.neckY + 4);
      ctx.quadraticCurveTo(neckPivot.x, headBottomY, headMinX, a.neckY + 4);
      ctx.closePath();
    },
  );

  // 2. Arm slices (UpperArm, Forearm, Hand) with concentric tangent ball caps
  const handTip = (el: BodyPoint2D, wr: BodyPoint2D): BodyPoint2D => {
    const dx = wr.x - el.x;
    const dy = wr.y - el.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    return {
      x: wr.x + (dx / len) * Math.max(24, a.armWidth * 1.12),
      y: wr.y + (dy / len) * Math.max(24, a.armWidth * 1.12),
    };
  };
  const hTipL = handTip(elL, wrL);
  const hTipR = handTip(elR, wrR);

  const profileForearmCutout =
    profile && usesIllustratedBodyCutout
      ? extractProfileForearmForPose2D(
          effectiveChar,
          baseModel,
          actor.angle,
          mode,
          imageMap,
          headPack,
        )
      : null;

  const sliceArm = (side: "left" | "right", dimFar: number) => {
    const sh = side === "left" ? shL : shR;
    const el = side === "left" ? elL : elR;
    const wr = side === "left" ? wrL : wrR;
    const tip = side === "left" ? hTipL : hTipR;

    const armMaster = profile
      ? profileForearmCutout
        ? (() => {
            const c = document.createElement("canvas");
            c.width = CHAR2D_W;
            c.height = CHAR2D_H;
            const cx = c.getContext("2d")!;
            cx.save();
            cx.beginPath();
            cx.rect(Math.max(0, sh.x - 36), Math.max(0, sh.y - 38), 86, el.y - sh.y + 42);
            cx.clip();
            cx.drawImage(master, 0, 0);
            cx.restore();
            cx.drawImage(
              profileForearmCutout.canvas,
              profileForearmCutout.x,
              profileForearmCutout.y,
              profileForearmCutout.w,
              profileForearmCutout.h,
            );
            return c;
          })()
        : master
      : (() => {
          const c = document.createElement("canvas");
          c.width = CHAR2D_W;
          c.height = CHAR2D_H;
          const cx = c.getContext("2d")!;
          cx.save();
          traceArmOuterRegion(cx, a, side, topPad, elbowR);
          cx.clip();
          cx.drawImage(master, 0, 0);
          cx.restore();
          return c;
        })();

    const profArmShiftX = profile && profileForearmCutout ? (actor.angle === 90 ? 12 : -12) : 0;
    const maxUpR = Math.max(shoulderR, elbowR);
    const upperArm = sliceRegion(
      armMaster,
      sh,
      {
        x: Math.min(sh.x, el.x) - maxUpR - 6,
        y: Math.min(sh.y, el.y) - maxUpR - 6,
        w: Math.abs(el.x - sh.x) + (maxUpR + 6) * 2 + 12,
        h: Math.abs(el.y - sh.y) + (maxUpR + 6) * 2,
      },
      (ctx) => traceCapsulePath(ctx, sh, el, shoulderR, elbowR + 4, 0, 0),
      { dimDarken: dimFar },
    );

    const maxFoR = Math.max(elbowR, wristR) + (profileForearmCutout ? 8 : 0);
    const elBox = { x: el.x + profArmShiftX, y: el.y };
    const wrBox = { x: wr.x + profArmShiftX, y: wr.y };
    const tipBox = { x: tip.x + profArmShiftX, y: tip.y };
    const forearm = sliceRegion(
      armMaster,
      el,
      {
        x: Math.min(elBox.x, wrBox.x) - maxFoR - 2,
        y: Math.min(elBox.y, wrBox.y) - maxFoR - 2,
        w: Math.abs(wrBox.x - elBox.x) + (maxFoR + 2) * 2,
        h: Math.abs(wrBox.y - elBox.y) + (maxFoR + 2) * 2,
      },
      (ctx) => traceCapsulePath(ctx, elBox, wrBox, elbowR + 4, wristR + 4, 0, 0),
      { dimDarken: dimFar },
    );

    const handR = Math.max(wristR, 18) + (profileForearmCutout ? 8 : 0);
    const hand = sliceRegion(
      armMaster,
      wr,
      {
        x: Math.min(wrBox.x, tipBox.x) - handR - 4,
        y: Math.min(wrBox.y, tipBox.y) - handR - 4,
        w: Math.abs(tipBox.x - wrBox.x) + (handR + 4) * 2,
        h: Math.abs(tipBox.y - wrBox.y) + (handR + 20) * 2,
      },
      (ctx) => traceCapsulePath(ctx, wrBox, tipBox, wristR + 4, handR, 0, 16),
      { dimDarken: dimFar },
    );

    return { upperArm, forearm, hand };
  };

  // In profile views (90° facing right / 270° facing left), far limb is cloned & subtly shaded in Color mode only
  const farDim = profile && mode === "color" ? 0.22 : 0;
  const leftArmSlices = sliceArm("left", 0);
  const rightArmSlices = sliceArm("right", 0);
  const baseArmBright = leftArmSlices;
  const baseArmDim = profile && farDim > 0 ? sliceArm("left", farDim) : leftArmSlices;
  const finalArmL = profile && actor.angle === 270 ? baseArmDim : leftArmSlices;
  const finalArmR = profile ? (actor.angle === 90 ? baseArmDim : baseArmBright) : rightArmSlices;

  // 3. Torso & Pelvis base canvas (head trimmed + outer arms removed strictly outside clothing outline)
  const bodyCleaned = cloneCanvas(bodyNoArmMaster ?? master);
  {
    const bctx = bodyCleaned.getContext("2d")!;
    bctx.save();
    bctx.globalCompositeOperation = "destination-out";
    bctx.beginPath();
    bctx.moveTo(0, 0);
    bctx.lineTo(CHAR2D_W, 0);
    bctx.lineTo(CHAR2D_W, a.chinY + 4);
    bctx.lineTo(a.neckR + 8, a.chinY + 4);
    bctx.quadraticCurveTo(neckPivot.x, a.neckY + 6, a.neckL - 8, a.chinY + 4);
    bctx.lineTo(0, a.chinY + 4);
    bctx.closePath();
    bctx.fill();

    if (!profile) {
      const torsoWall = (side: "left" | "right") => {
        const sign = side === "left" ? -1 : 1;
        const chestE = (side === "left" ? a.torsoL : a.torsoR) + sign * topPad;
        const waistE = (side === "left" ? a.waistL : a.waistR) + sign * topPad;
        const hipE = (side === "left" ? a.hipL : a.hipR) + sign * topPad;
        const shOuter = (side === "left" ? a.shoulderL : a.shoulderR) + sign * 8;
        const wr = side === "left" ? wrL : wrR;
        const outerX = side === "left" ? 0 : CHAR2D_W;
        bctx.beginPath();
        bctx.moveTo(outerX, Math.max(0, a.shoulderY - 58));
        bctx.lineTo(shOuter, a.shoulderY - 6);
        bctx.lineTo(chestE, a.chestY);
        bctx.lineTo(waistE, a.waistY);
        bctx.lineTo(hipE, a.hipY + 80);
        bctx.lineTo(outerX, Math.min(CHAR2D_H, wr.y + 115));
        bctx.closePath();
        bctx.fill();
      };
      torsoWall("left");
      torsoWall("right");

      // Also remove dangling resting hand capsules below hemY so raised arms never leave a hand sliver on pelvis
      bctx.save();
      bctx.beginPath();
      bctx.rect(0, a.hipY + 12, CHAR2D_W, CHAR2D_H - (a.hipY + 12));
      bctx.clip();
      traceCapsulePath(bctx, wrL, hTipL, wristR + 3, elbowR + 4, 4, 20);
      bctx.fill();
      traceCapsulePath(bctx, wrR, hTipR, wristR + 3, elbowR + 4, 4, 20);
      bctx.fill();
      bctx.restore();
    }
    bctx.restore();

    if (profile && (!bodyNoArmMaster || effectiveChar.clothes.top === "none")) {
      inpaintProfileArmStrip(
        bodyCleaned,
        a,
        mode,
        effectiveChar.clothes.bottom !== "none" ? 472 : undefined,
      );
    }
  }

  const torsoSlice = sliceRegion(
    bodyCleaned,
    chestPivot,
    {
      x: Math.min(a.shoulderL, a.torsoL, a.hipL) - 38,
      y: Math.max(0, a.neckY - 12),
      w: Math.max(a.shoulderR, a.torsoR, a.hipR) - Math.min(a.shoulderL, a.torsoL, a.hipL) + 76,
      h: a.waistY - a.neckY + 52,
    },
    (ctx) => {
      const lx = Math.min(a.shoulderL, a.torsoL, a.hipL) - 34;
      const rx = Math.max(a.shoulderR, a.torsoR, a.hipR) + 34;
      ctx.beginPath();
      ctx.moveTo(lx, Math.max(0, a.neckY - 12));
      ctx.lineTo(rx, Math.max(0, a.neckY - 12));
      ctx.lineTo(rx, a.waistY + 12);
      ctx.quadraticCurveTo(spinePivot.x, a.waistY + 34, lx, a.waistY + 12);
      ctx.closePath();
    },
  );

  const pelvisSlice = sliceRegion(
    bodyCleaned,
    hipsPivot,
    {
      x: Math.min(a.waistL, a.hipL) - 36,
      y: a.waistY - 22,
      w: Math.max(a.waistR, a.hipR) - Math.min(a.waistL, a.hipL) + 72,
      h: a.crotchY - a.waistY + 46,
    },
    (ctx) => {
      const lx = Math.min(a.waistL, a.hipL) - 32;
      const rx = Math.max(a.waistR, a.hipR) + 32;
      ctx.beginPath();
      ctx.moveTo(lx, a.waistY - 12);
      ctx.quadraticCurveTo(spinePivot.x, a.waistY - 26, rx, a.waistY - 12);
      ctx.lineTo(rx, a.crotchY + 4);
      ctx.quadraticCurveTo(hipsPivot.x, a.crotchY + 20, lx, a.crotchY + 4);
      ctx.closePath();
    },
  );

  // 4. Leg slices (Thigh, Shin, Foot) split along diagonal leg midline below crotch (zero cross-leg slivers)
  const midHipX = (hipL.x + hipR.x) / 2;
  const midKneeX = (kneeL.x + kneeR.x) / 2;
  const midAnkleX = (ankleL.x + ankleR.x) / 2;

  const sliceLeg = (side: "left" | "right", dimFar: number) => {
    const hip = side === "left" ? hipL : hipR;
    const knee = side === "left" ? kneeL : kneeR;
    const ankle = side === "left" ? ankleL : ankleR;
    const toe = side === "left" ? toeL : toeR;

    const legMaster = profile
      ? (bodyNoArmMaster ?? master)
      : (() => {
          const c = document.createElement("canvas");
          c.width = CHAR2D_W;
          c.height = CHAR2D_H;
          const cx = c.getContext("2d")!;
          cx.save();
          cx.beginPath();
          const outerX = side === "left" ? 0 : CHAR2D_W;
          const topY = a.hipY - 2;
          cx.moveTo(outerX, topY);
          cx.lineTo(midHipX, topY);
          cx.lineTo(midHipX, a.crotchY + 2);
          cx.lineTo(midKneeX, knee.y);
          cx.lineTo(midAnkleX, CHAR2D_H);
          cx.lineTo(outerX, CHAR2D_H);
          cx.closePath();
          cx.clip();
          cx.drawImage(master, 0, 0);
          cx.restore();
          return c;
        })();

    const maxThR = Math.max(hipLegR, radKnee);
    const thigh = sliceRegion(
      legMaster,
      hip,
      {
        x: Math.min(hip.x, knee.x) - maxThR - 4,
        y: Math.min(hip.y, knee.y) - maxThR - 4,
        w: Math.abs(knee.x - hip.x) + (maxThR + 4) * 2,
        h: Math.abs(knee.y - hip.y) + (maxThR + 4) * 2,
      },
      (ctx) => traceCapsulePath(ctx, hip, knee, hipLegR, radKnee, 0, 0),
      { dimDarken: dimFar },
    );

    const maxShR = Math.max(radKnee, radAnkle);
    const shin = sliceRegion(
      legMaster,
      knee,
      {
        x: Math.min(knee.x, ankle.x) - maxShR - 4,
        y: Math.min(knee.y, ankle.y) - maxShR - 4,
        w: Math.abs(ankle.x - knee.x) + (maxShR + 4) * 2,
        h: Math.abs(ankle.y - knee.y) + (maxShR + 4) * 2,
      },
      (ctx) => traceCapsulePath(ctx, knee, ankle, radKnee, radAnkle, 0, 0),
      { dimDarken: dimFar },
    );

    const footMinX = Math.max(0, Math.min(ankle.x, toe.x) - 34);
    const footMaxX = Math.min(CHAR2D_W, Math.max(ankle.x, toe.x) + 38);
    const footMinY = Math.max(0, ankle.y - radAnkle);
    const footMaxY = Math.min(CHAR2D_H, Math.max(ankle.y + 32, toe.y + 36));
    const foot = sliceRegion(
      legMaster,
      ankle,
      {
        x: footMinX,
        y: footMinY,
        w: footMaxX - footMinX,
        h: footMaxY - footMinY,
      },
      (ctx) => {
        ctx.beginPath();
        ctx.arc(ankle.x, ankle.y, radAnkle, Math.PI, 0);
        ctx.lineTo(footMaxX, Math.max(ankle.y, toe.y - 6));
        ctx.lineTo(footMaxX, footMaxY);
        ctx.lineTo(footMinX, footMaxY);
        ctx.lineTo(footMinX, ankle.y);
        ctx.closePath();
      },
      { dimDarken: dimFar },
    );

    return { thigh, shin, foot };
  };

  const legL = sliceLeg("left", profile && actor.angle === 270 ? farDim : 0);
  const legR = profile ? sliceLeg("left", actor.angle === 90 ? farDim : 0) : sliceLeg("right", 0);

  return putRigCache(key, {
    anchors: a,
    slices: {
      head: headSlice,
      torso: torsoSlice,
      pelvis: pelvisSlice,
      upperArmL: finalArmL.upperArm,
      forearmL: finalArmL.forearm,
      handL: finalArmL.hand,
      upperArmR: finalArmR.upperArm,
      forearmR: finalArmR.forearm,
      handR: finalArmR.hand,
      thighL: legL.thigh,
      shinL: legL.shin,
      footL: legL.foot,
      thighR: legR.thigh,
      shinR: legR.shin,
      footR: legR.foot,
    },
  });
}

function drawSliceAt(ctx: C, slice: PartSlice2D, worldPos: BodyPoint2D, angleDeg: number) {
  ctx.save();
  ctx.translate(worldPos.x, worldPos.y);
  if (angleDeg) ctx.rotate(degToRad(angleDeg));
  ctx.drawImage(slice.canvas, -slice.pivotX, -slice.pivotY);
  ctx.restore();
}

function buildPartDrawOrder(angle: Angle2D, pose: Pose2DState): RigPartName2D[] {
  const behind = pose.limbBehind ?? {};
  const partsFrontArms = ["upperArm", "forearm", "hand"] as const;
  const sideOrderArm = (s: "L" | "R"): RigPartName2D[] =>
    partsFrontArms.map((p) => `${p}${s}` as RigPartName2D);
  const sideOrderLeg = (s: "L" | "R"): RigPartName2D[] => [
    `thigh${s}` as RigPartName2D,
    `shin${s}` as RigPartName2D,
    `foot${s}` as RigPartName2D,
  ];

  // Determine far-side (drawn behind torso/pelvis) vs near-side based on viewing angle
  let farSide: "L" | "R" | null = null;
  if (angle === 45 || angle === 90 || angle === 135) farSide = "R";
  else if (angle === 225 || angle === 270 || angle === 315) farSide = "L";

  const armLBehind = Boolean(behind.armL) || farSide === "L";
  const armRBehind = Boolean(behind.armR) || farSide === "R";
  const legLBehind = Boolean(behind.legL) || farSide === "L";
  const legRBehind = Boolean(behind.legR) || farSide === "R";

  const back: RigPartName2D[] = [];
  const midLegs: RigPartName2D[] = [];
  const front: RigPartName2D[] = [];

  if (armLBehind) back.push(...sideOrderArm("L"));
  if (armRBehind) back.push(...sideOrderArm("R"));
  if (legLBehind) back.push(...sideOrderLeg("L"));
  if (legRBehind) back.push(...sideOrderLeg("R"));

  if (!legLBehind) midLegs.push(...sideOrderLeg("L"));
  if (!legRBehind) midLegs.push(...sideOrderLeg("R"));

  if (!armLBehind) front.push(...sideOrderArm("L"));
  if (!armRBehind) front.push(...sideOrderArm("R"));

  if (angle === 135 || angle === 180 || angle === 225) {
    // From back views, head sits cleanly with back/torso depth; keep arms over/under per behind flags
    return [...back, ...midLegs, "pelvis", "torso", "head", ...front];
  }

  return [...back, ...midLegs, "pelvis", "torso", "head", ...front];
}

export function renderPosedCharacter2D(
  ctx: C,
  actor: Stage2DActor,
  char: Character2D,
  baseModel: BaseModel2D,
  customParts: CustomPartAsset2D[],
  headPack: HeadPack2D,
  charImages: Map<string, HTMLImageElement>,
  mode: RenderMode2D,
): SkeletonWorld2D {
  const rig = buildCharacterRigSlices(
    char,
    baseModel,
    customParts,
    headPack,
    charImages,
    actor,
    mode,
  );
  const sk = computeForwardKinematics2D(rig.anchors, actor.pose);

  ctx.save();
  ctx.translate(actor.x, actor.y);
  ctx.scale(actor.flipX ? -actor.scale : actor.scale, actor.scale);
  ctx.translate(-CHAR2D_W / 2, -940);

  // Ground contact ellipse beneath lowest foot point
  if (actor.shadow) {
    const floorY = Math.max(940, sk.ankleL.y + 38, sk.ankleR.y + 38, sk.toeL.y + 8, sk.toeR.y + 8);
    ctx.save();
    ctx.fillStyle = mode === "manga" ? "rgba(0,0,0,0.14)" : "rgba(15,23,42,0.22)";
    ctx.beginPath();
    ctx.ellipse(sk.hips.x, floorY, 108, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const order = buildPartDrawOrder(actor.angle, actor.pose);
  for (const part of order) {
    const slice = rig.slices[part];
    switch (part) {
      case "pelvis":
        drawSliceAt(ctx, slice, sk.hips, sk.anglesDeg.hips);
        break;
      case "torso":
        drawSliceAt(ctx, slice, sk.chest, sk.anglesDeg.chest);
        break;
      case "head":
        drawSliceAt(ctx, slice, sk.neck, sk.anglesDeg.head);
        break;
      case "upperArmL":
        drawSliceAt(ctx, slice, sk.shoulderL, sk.anglesDeg.upperArmL);
        break;
      case "forearmL":
        drawSliceAt(ctx, slice, sk.elbowL, sk.anglesDeg.forearmL);
        break;
      case "handL":
        drawSliceAt(ctx, slice, sk.wristL, sk.anglesDeg.handL);
        break;
      case "upperArmR":
        drawSliceAt(ctx, slice, sk.shoulderR, sk.anglesDeg.upperArmR);
        break;
      case "forearmR":
        drawSliceAt(ctx, slice, sk.elbowR, sk.anglesDeg.forearmR);
        break;
      case "handR":
        drawSliceAt(ctx, slice, sk.wristR, sk.anglesDeg.handR);
        break;
      case "thighL":
        drawSliceAt(ctx, slice, sk.hipL, sk.anglesDeg.thighL);
        break;
      case "shinL":
        drawSliceAt(ctx, slice, sk.kneeL, sk.anglesDeg.shinL);
        break;
      case "footL":
        drawSliceAt(ctx, slice, sk.ankleL, sk.anglesDeg.footL);
        break;
      case "thighR":
        drawSliceAt(ctx, slice, sk.hipR, sk.anglesDeg.thighR);
        break;
      case "shinR":
        drawSliceAt(ctx, slice, sk.kneeR, sk.anglesDeg.shinR);
        break;
      case "footR":
        drawSliceAt(ctx, slice, sk.ankleR, sk.anglesDeg.footR);
        break;
    }
  }

  ctx.restore();
  return sk;
}

export type RigHandleKind2D =
  | { type: "root"; label: string }
  | { type: "joint"; jointId: JointId2D; label: string }
  | { type: "ik_hand_L"; label: string }
  | { type: "ik_hand_R"; label: string }
  | { type: "ik_foot_L"; label: string }
  | { type: "ik_foot_R"; label: string }
  | { type: "scale"; label: string };

export interface RigOverlayHandle2D {
  id: string;
  kind: RigHandleKind2D;
  screenPt: BodyPoint2D;
  color: string;
  shape: "circle" | "diamond" | "square";
  radius: number;
}

export function getActorOverlayHandles(
  actor: Stage2DActor,
  sk: SkeletonWorld2D,
  stage: Stage2D,
  controlMode: "ik" | "fk",
): { handles: RigOverlayHandle2D[]; scaleHandle: BodyPoint2D } {
  const toScr = (pt: BodyPoint2D) => characterToStagePoint(pt, actor, stage.camera);

  const hipsPt = toScr(sk.hips);
  const spinePt = toScr(sk.spine);
  const chestPt = toScr(sk.chest);
  const headPt = toScr(sk.head);
  const shLPt = toScr(sk.shoulderL);
  const elLPt = toScr(sk.elbowL);
  const wrLPt = toScr(sk.wristL);
  const shRPt = toScr(sk.shoulderR);
  const elRPt = toScr(sk.elbowR);
  const wrRPt = toScr(sk.wristR);
  const hipLPt = toScr(sk.hipL);
  const kneeLPt = toScr(sk.kneeL);
  const ankleLPt = toScr(sk.ankleL);
  const hipRPt = toScr(sk.hipR);
  const kneeRPt = toScr(sk.kneeR);
  const ankleRPt = toScr(sk.ankleR);

  // Corner scale handle near bottom-right of actor bounding area
  const brWorld = characterToStageWorldPoint({ x: CHAR2D_W * 0.85, y: 970 }, actor);
  const blWorld = characterToStageWorldPoint({ x: CHAR2D_W * 0.15, y: 970 }, actor);
  const rightWorld = brWorld.x >= blWorld.x ? brWorld : blWorld;
  const camScreenBR = characterToStagePoint(
    { x: actor.flipX ? CHAR2D_W * 0.15 : CHAR2D_W * 0.85, y: 970 },
    actor,
    stage.camera,
  );
  void rightWorld;

  const isIK = controlMode === "ik";

  const handles: RigOverlayHandle2D[] = [
    {
      id: "root",
      kind: { type: "root", label: "Move Character" },
      screenPt: hipsPt,
      color: "#ef4444",
      shape: "circle",
      radius: 8.5,
    },
    {
      id: "spine",
      kind: { type: "joint", jointId: "spine", label: "Waist" },
      screenPt: spinePt,
      color: "#06b6d4",
      shape: "circle",
      radius: 6.5,
    },
    {
      id: "chest",
      kind: { type: "joint", jointId: "chest", label: "Chest" },
      screenPt: chestPt,
      color: "#06b6d4",
      shape: "circle",
      radius: 6.5,
    },
    {
      id: "head",
      kind: { type: "joint", jointId: "head", label: "Head" },
      screenPt: headPt,
      color: "#06b6d4",
      shape: "circle",
      radius: 7.5,
    },

    {
      id: "shoulderL",
      kind: { type: "joint", jointId: "upperArmL", label: "L Shoulder" },
      screenPt: shLPt,
      color: "#f97316",
      shape: "circle",
      radius: 6.5,
    },
    {
      id: "elbowL",
      kind: { type: "joint", jointId: "forearmL", label: "L Elbow" },
      screenPt: elLPt,
      color: "#f97316",
      shape: "circle",
      radius: 6.5,
    },
    {
      id: "wristL",
      kind: isIK
        ? { type: "ik_hand_L", label: "Drag L Hand (IK)" }
        : { type: "joint", jointId: "handL", label: "L Wrist" },
      screenPt: wrLPt,
      color: isIK ? "#eab308" : "#f97316",
      shape: isIK ? "diamond" : "circle",
      radius: isIK ? 8.5 : 6,
    },

    {
      id: "shoulderR",
      kind: { type: "joint", jointId: "upperArmR", label: "R Shoulder" },
      screenPt: shRPt,
      color: "#f97316",
      shape: "circle",
      radius: 6.5,
    },
    {
      id: "elbowR",
      kind: { type: "joint", jointId: "forearmR", label: "R Elbow" },
      screenPt: elRPt,
      color: "#f97316",
      shape: "circle",
      radius: 6.5,
    },
    {
      id: "wristR",
      kind: isIK
        ? { type: "ik_hand_R", label: "Drag R Hand (IK)" }
        : { type: "joint", jointId: "handR", label: "R Wrist" },
      screenPt: wrRPt,
      color: isIK ? "#eab308" : "#f97316",
      shape: isIK ? "diamond" : "circle",
      radius: isIK ? 8.5 : 6,
    },

    {
      id: "hipL",
      kind: { type: "joint", jointId: "thighL", label: "L Hip" },
      screenPt: hipLPt,
      color: "#3b82f6",
      shape: "circle",
      radius: 6.5,
    },
    {
      id: "kneeL",
      kind: { type: "joint", jointId: "shinL", label: "L Knee" },
      screenPt: kneeLPt,
      color: "#3b82f6",
      shape: "circle",
      radius: 6.5,
    },
    {
      id: "ankleL",
      kind: isIK
        ? { type: "ik_foot_L", label: "Drag L Foot (IK)" }
        : { type: "joint", jointId: "footL", label: "L Ankle" },
      screenPt: ankleLPt,
      color: isIK ? "#eab308" : "#3b82f6",
      shape: isIK ? "diamond" : "circle",
      radius: isIK ? 8.5 : 6,
    },

    {
      id: "hipR",
      kind: { type: "joint", jointId: "thighR", label: "R Hip" },
      screenPt: hipRPt,
      color: "#3b82f6",
      shape: "circle",
      radius: 6.5,
    },
    {
      id: "kneeR",
      kind: { type: "joint", jointId: "shinR", label: "R Knee" },
      screenPt: kneeRPt,
      color: "#3b82f6",
      shape: "circle",
      radius: 6.5,
    },
    {
      id: "ankleR",
      kind: isIK
        ? { type: "ik_foot_R", label: "Drag R Foot (IK)" }
        : { type: "joint", jointId: "footR", label: "R Ankle" },
      screenPt: ankleRPt,
      color: isIK ? "#eab308" : "#3b82f6",
      shape: isIK ? "diamond" : "circle",
      radius: isIK ? 8.5 : 6,
    },

    {
      id: "scale",
      kind: { type: "scale", label: "Resize Character" },
      screenPt: camScreenBR,
      color: "#111827",
      shape: "square",
      radius: 7.5,
    },
  ];

  return { handles, scaleHandle: camScreenBR };
}

export function drawRigOverlay2D(
  ctx: C,
  actor: Stage2DActor,
  sk: SkeletonWorld2D,
  stage: Stage2D,
  controlMode: "ik" | "fk",
  activeHandleId: string | null,
) {
  const { handles } = getActorOverlayHandles(actor, sk, stage, controlMode);
  const byId = new Map(handles.map((h) => [h.id, h.screenPt]));

  const link = (idA: string, idB: string, col: string) => {
    const a = byId.get(idA);
    const b = byId.get(idB);
    if (!a || !b) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  ctx.save();
  ctx.globalAlpha = 0.85;
  link("root", "spine", "#06b6d4");
  link("spine", "chest", "#06b6d4");
  link("chest", "head", "#06b6d4");

  link("chest", "shoulderL", "#f97316");
  link("shoulderL", "elbowL", "#f97316");
  link("elbowL", "wristL", "#f97316");

  link("chest", "shoulderR", "#f97316");
  link("shoulderR", "elbowR", "#f97316");
  link("elbowR", "wristR", "#f97316");

  link("root", "hipL", "#3b82f6");
  link("hipL", "kneeL", "#3b82f6");
  link("kneeL", "ankleL", "#3b82f6");

  link("root", "hipR", "#3b82f6");
  link("hipR", "kneeR", "#3b82f6");
  link("kneeR", "ankleR", "#3b82f6");

  ctx.globalAlpha = 1;
  for (const h of handles) {
    const active = activeHandleId === h.id;
    const r = h.radius + (active ? 2.5 : 0);
    ctx.fillStyle = h.color;
    ctx.strokeStyle = active ? "#ffffff" : "#0f172a";
    ctx.lineWidth = active ? 2.5 : 1.75;
    ctx.beginPath();
    if (h.shape === "diamond") {
      ctx.moveTo(h.screenPt.x, h.screenPt.y - r * 1.15);
      ctx.lineTo(h.screenPt.x + r * 1.15, h.screenPt.y);
      ctx.lineTo(h.screenPt.x, h.screenPt.y + r * 1.15);
      ctx.lineTo(h.screenPt.x - r * 1.15, h.screenPt.y);
      ctx.closePath();
    } else if (h.shape === "square") {
      ctx.rect(h.screenPt.x - r, h.screenPt.y - r, r * 2, r * 2);
    } else {
      ctx.arc(h.screenPt.x, h.screenPt.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export async function preloadStage2DImages(
  stage: Stage2D,
  scene: Scene2D | null,
  customSceneObjects: SceneObjectAsset2D[],
  characters: Character2D[],
  customModels: BaseModel2D[],
  customParts: CustomPartAsset2D[],
  customHeads: HeadPack2D[],
): Promise<{
  sceneImages: Map<string, HTMLImageElement>;
  charImages: Map<string, HTMLImageElement>;
}> {
  const scenePromise = scene
    ? preloadScene2DImages(scene, customSceneObjects)
    : Promise.resolve(new Map<string, HTMLImageElement>());

  const charPromises = stage.actors.map(async (actor) => {
    const ch = characters.find((c) => c.id === actor.characterId) ?? characters[0];
    if (!ch) return new Map<string, HTMLImageElement>();
    const model = resolveBaseModel2D(ch.baseModelId, customModels);
    const head = resolveCharacterHeadPack2D(ch.headShapeId, customHeads);
    const charAtAngle: Character2D = { ...ch, angle: actor.angle, renderMode: stage.renderMode };
    return preloadCharacter2DImages(charAtAngle, model, customParts, head);
  });

  const [sceneImages, ...charMaps] = await Promise.all([scenePromise, ...charPromises]);
  const charImages = new Map<string, HTMLImageElement>();
  for (const m of charMaps) {
    for (const [k, v] of m.entries()) charImages.set(k, v);
  }
  return { sceneImages, charImages };
}

function drawCheckerboard(ctx: C) {
  const size = 32;
  for (let y = 0; y < STAGE2D_H; y += size) {
    for (let x = 0; x < STAGE2D_W; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? "#f8fafc" : "#e2e8f0";
      ctx.fillRect(x, y, size, size);
    }
  }
}

export function renderStage2DSync(
  ctx: C,
  stage: Stage2D,
  scene: Scene2D | null,
  assets: {
    customSceneObjects: SceneObjectAsset2D[];
    sceneImages: Map<string, HTMLImageElement>;
    characters: Character2D[];
    customModels: BaseModel2D[];
    customParts: CustomPartAsset2D[];
    customHeads: HeadPack2D[];
    charImages: Map<string, HTMLImageElement>;
  },
  opts: {
    showRig?: boolean;
    selectedActorId?: string | null;
    controlMode?: "ik" | "fk";
    activeHandleId?: string | null;
    transparentWhenNoScene?: boolean;
  } = {},
): Map<string, SkeletonWorld2D> {
  const skeletons = new Map<string, SkeletonWorld2D>();

  ctx.save();
  ctx.clearRect(0, 0, STAGE2D_W, STAGE2D_H);
  if (!scene && !opts.transparentWhenNoScene) {
    drawCheckerboard(ctx);
  }

  // Apply Stage Camera (around stage center 640x400)
  const cam = stage.camera;
  const hw = STAGE2D_W / 2;
  const hh = STAGE2D_H / 2;
  ctx.save();
  ctx.translate(hw, hh);
  if (cam.tilt) ctx.rotate(degToRad(cam.tilt));
  ctx.translate(cam.panX || 0, cam.panY || 0);
  const zoom = Math.max(0.3, cam.zoom || 1);
  ctx.scale(zoom, zoom);
  ctx.translate(-hw, -hh);

  const drawActorsAtDepth = (depthPass: SceneDepthLayer) => {
    for (const actor of stage.actors) {
      if (!actor.visible || actor.depth !== depthPass) continue;
      const ch = assets.characters.find((c) => c.id === actor.characterId) ?? assets.characters[0];
      if (!ch) continue;
      const model = resolveBaseModel2D(ch.baseModelId, assets.customModels);
      const head = resolveCharacterHeadPack2D(ch.headShapeId, assets.customHeads);
      const sk = renderPosedCharacter2D(
        ctx,
        actor,
        ch,
        model,
        assets.customParts,
        head,
        assets.charImages,
        stage.renderMode,
      );
      skeletons.set(actor.id, sk);
    }
  };

  if (scene) {
    const themedScene: Scene2D = { ...scene, renderMode: stage.renderMode };
    renderScene2DSync(ctx, themedScene, assets.customSceneObjects, assets.sceneImages, {
      showGuides: false,
      selectedObjectId: null,
      onAfterDepthLayer: (depth) => {
        drawActorsAtDepth(depth);
      },
    });
  } else {
    drawActorsAtDepth("background");
    drawActorsAtDepth("midground");
    drawActorsAtDepth("foreground");
  }

  ctx.restore();

  // Interactive Rig Overlay rendered in un-clipped screen canvas coords so handle sizes stay crisp
  if (opts.showRig && opts.selectedActorId) {
    const selActor = stage.actors.find((a) => a.id === opts.selectedActorId);
    const selSk = skeletons.get(opts.selectedActorId);
    if (selActor && selSk) {
      drawRigOverlay2D(
        ctx,
        selActor,
        selSk,
        stage,
        opts.controlMode ?? "ik",
        opts.activeHandleId ?? null,
      );
    }
  }

  ctx.restore();
  void cameraCanvasToStageWorldPoint;
  return skeletons;
}

export async function exportStage2DPng(
  stage: Stage2D,
  scene: Scene2D | null,
  deps: {
    customSceneObjects: SceneObjectAsset2D[];
    characters: Character2D[];
    customModels: BaseModel2D[];
    customParts: CustomPartAsset2D[];
    customHeads: HeadPack2D[];
  },
  scale = 1.5,
): Promise<string> {
  const { sceneImages, charImages } = await preloadStage2DImages(
    stage,
    scene,
    deps.customSceneObjects,
    deps.characters,
    deps.customModels,
    deps.customParts,
    deps.customHeads,
  );
  const c = document.createElement("canvas");
  c.width = Math.round(STAGE2D_W * scale);
  c.height = Math.round(STAGE2D_H * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.scale(scale, scale);
  renderStage2DSync(
    ctx,
    stage,
    scene,
    { ...deps, sceneImages, charImages },
    { showRig: false, transparentWhenNoScene: true },
  );
  return c.toDataURL("image/png");
}

export async function exportActor2DPng(
  actor: Stage2DActor,
  renderMode: RenderMode2D,
  deps: {
    characters: Character2D[];
    customModels: BaseModel2D[];
    customParts: CustomPartAsset2D[];
    customHeads: HeadPack2D[];
  },
  scale = 2,
): Promise<string> {
  const soloStage: Stage2D = {
    id: actor.id,
    name: actor.name,
    sceneId: null,
    renderMode,
    camera: { zoom: 1, panX: 0, panY: 0, tilt: 0 },
    actors: [
      { ...actor, x: STAGE2D_W / 2, y: Math.round(STAGE2D_H * 0.88), scale: 0.72, visible: true },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
  const { sceneImages, charImages } = await preloadStage2DImages(
    soloStage,
    null,
    [],
    deps.characters,
    deps.customModels,
    deps.customParts,
    deps.customHeads,
  );
  const c = document.createElement("canvas");
  c.width = Math.round(STAGE2D_W * scale);
  c.height = Math.round(STAGE2D_H * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.scale(scale, scale);
  renderStage2DSync(
    ctx,
    soloStage,
    null,
    { customSceneObjects: [], sceneImages, charImages, ...deps },
    { showRig: false, transparentWhenNoScene: true },
  );

  // Auto-crop tightly around opaque posed actor pixels
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width;
  let y0 = c.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if ((data[(y * c.width + x) * 4 + 3] ?? 0) > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return c.toDataURL("image/png");
  const pad = Math.round(14 * scale);
  const cx0 = Math.max(0, x0 - pad);
  const cy0 = Math.max(0, y0 - pad);
  const cx1 = Math.min(c.width - 1, x1 + pad);
  const cy1 = Math.min(c.height - 1, y1 + pad);
  const cw = cx1 - cx0 + 1;
  const ch = cy1 - cy0 + 1;

  const cropped = document.createElement("canvas");
  cropped.width = cw;
  cropped.height = ch;
  cropped.getContext("2d")!.drawImage(c, cx0, cy0, cw, ch, 0, 0, cw, ch);
  return cropped.toDataURL("image/png");
}

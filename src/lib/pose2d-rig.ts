import { CHAR2D_H, CHAR2D_W, type BodyAngleAnchors, type BodyPoint2D } from "./character2d-types";
import {
  STAGE2D_H,
  STAGE2D_W,
  type Pose2DState,
  type Stage2DActor,
  type Stage2DCamera,
} from "./pose2d-types";

export interface RestSkeleton2D {
  hips: BodyPoint2D;
  spine: BodyPoint2D;
  chest: BodyPoint2D;
  neck: BodyPoint2D;
  head: BodyPoint2D;
  shoulderL: BodyPoint2D;
  elbowL: BodyPoint2D;
  wristL: BodyPoint2D;
  handTipL: BodyPoint2D;
  shoulderR: BodyPoint2D;
  elbowR: BodyPoint2D;
  wristR: BodyPoint2D;
  handTipR: BodyPoint2D;
  hipL: BodyPoint2D;
  kneeL: BodyPoint2D;
  ankleL: BodyPoint2D;
  toeL: BodyPoint2D;
  hipR: BodyPoint2D;
  kneeR: BodyPoint2D;
  ankleR: BodyPoint2D;
  toeR: BodyPoint2D;
  armWidth: number;
  thighWidth: number;
  calfWidth: number;
}

export interface SkeletonWorld2D extends RestSkeleton2D {
  anglesDeg: {
    hips: number;
    spine: number;
    chest: number;
    head: number;
    upperArmL: number;
    forearmL: number;
    handL: number;
    upperArmR: number;
    forearmR: number;
    handR: number;
    thighL: number;
    shinL: number;
    footL: number;
    thighR: number;
    shinR: number;
    footR: number;
  };
  rest: RestSkeleton2D;
  lengths: {
    upperArmL: number;
    forearmL: number;
    upperArmR: number;
    forearmR: number;
    thighL: number;
    shinL: number;
    thighR: number;
    shinR: number;
  };
  restAnglesRad: {
    upperArmL: number;
    forearmL: number;
    handL: number;
    upperArmR: number;
    forearmR: number;
    handR: number;
    thighL: number;
    shinL: number;
    footL: number;
    thighR: number;
    shinR: number;
    footR: number;
  };
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function wrapRad(rad: number): number {
  let r = rad;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function add(a: BodyPoint2D, b: BodyPoint2D): BodyPoint2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a: BodyPoint2D, b: BodyPoint2D): BodyPoint2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

function rotateVec(v: BodyPoint2D, rad: number): BodyPoint2D {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function vecLen(v: BodyPoint2D): number {
  return Math.hypot(v.x, v.y);
}

function extendTip(a: BodyPoint2D, b: BodyPoint2D, tipLen: number): BodyPoint2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  return { x: b.x + (dx / len) * tipLen, y: b.y + (dy / len) * tipLen };
}

export function extractRestSkeleton2D(anchors: BodyAngleAnchors): RestSkeleton2D {
  const hips: BodyPoint2D = {
    x: (anchors.legLeft[0].x + anchors.legRight[0].x) / 2,
    y: anchors.hipY,
  };
  const spine: BodyPoint2D = {
    x: (anchors.waistL + anchors.waistR) / 2,
    y: anchors.waistY,
  };
  const chest: BodyPoint2D = {
    x: (anchors.torsoL + anchors.torsoR) / 2,
    y: anchors.chestY,
  };
  const neck: BodyPoint2D = {
    x: (anchors.neckL + anchors.neckR) / 2,
    y: anchors.neckY,
  };
  const head: BodyPoint2D = { x: anchors.headCx, y: anchors.headCy };

  const shoulderL = { ...anchors.armLeft[0] };
  const elbowL = { ...anchors.armLeft[1] };
  const wristL = { ...anchors.armLeft[2] };
  const handTipL = extendTip(elbowL, wristL, Math.max(26, anchors.armWidth * 1.15));

  const shoulderR = { ...anchors.armRight[0] };
  const elbowR = { ...anchors.armRight[1] };
  const wristR = { ...anchors.armRight[2] };
  const handTipR = extendTip(elbowR, wristR, Math.max(26, anchors.armWidth * 1.15));

  const hipL = { ...anchors.legLeft[0] };
  const kneeL = { ...anchors.legLeft[1] };
  const ankleL = { ...anchors.legLeft[2] };
  const toeL = { ...anchors.legLeft[3] };

  const hipR = { ...anchors.legRight[0] };
  const kneeR = { ...anchors.legRight[1] };
  const ankleR = { ...anchors.legRight[2] };
  const toeR = { ...anchors.legRight[3] };

  return {
    hips,
    spine,
    chest,
    neck,
    head,
    shoulderL,
    elbowL,
    wristL,
    handTipL,
    shoulderR,
    elbowR,
    wristR,
    handTipR,
    hipL,
    kneeL,
    ankleL,
    toeL,
    hipR,
    kneeR,
    ankleR,
    toeR,
    armWidth: anchors.armWidth,
    thighWidth: anchors.thighWidth,
    calfWidth: anchors.calfWidth,
  };
}

export function computeForwardKinematics2D(
  anchors: BodyAngleAnchors,
  pose: Pose2DState,
): SkeletonWorld2D {
  const rest = extractRestSkeleton2D(anchors);
  const j = pose.joints;

  const hipsDelta = j.hips || 0;
  const spineDelta = hipsDelta + (j.spine || 0);
  const chestDelta = spineDelta + (j.chest || 0);
  const headDelta = chestDelta + (j.head || 0);

  const upperArmLDelta = chestDelta + (j.upperArmL || 0);
  const forearmLDelta = upperArmLDelta + (j.forearmL || 0);
  const handLDelta = forearmLDelta + (j.handL || 0);

  const upperArmRDelta = chestDelta + (j.upperArmR || 0);
  const forearmRDelta = upperArmRDelta + (j.forearmR || 0);
  const handRDelta = forearmRDelta + (j.handR || 0);

  const thighLDelta = hipsDelta + (j.thighL || 0);
  const shinLDelta = thighLDelta + (j.shinL || 0);
  const footLDelta = shinLDelta + (j.footL || 0);

  const thighRDelta = hipsDelta + (j.thighR || 0);
  const shinRDelta = thighRDelta + (j.shinR || 0);
  const footRDelta = shinRDelta + (j.footR || 0);

  const hips: BodyPoint2D = {
    x: rest.hips.x,
    y: rest.hips.y + (pose.rootOffsetY || 0),
  };
  const spine = add(hips, rotateVec(sub(rest.spine, rest.hips), degToRad(hipsDelta)));
  const chest = add(spine, rotateVec(sub(rest.chest, rest.spine), degToRad(spineDelta)));
  const neck = add(chest, rotateVec(sub(rest.neck, rest.chest), degToRad(chestDelta)));
  const head = add(neck, rotateVec(sub(rest.head, rest.neck), degToRad(headDelta)));

  const shoulderL = add(chest, rotateVec(sub(rest.shoulderL, rest.chest), degToRad(chestDelta)));
  const elbowL = add(
    shoulderL,
    rotateVec(sub(rest.elbowL, rest.shoulderL), degToRad(upperArmLDelta)),
  );
  const wristL = add(elbowL, rotateVec(sub(rest.wristL, rest.elbowL), degToRad(forearmLDelta)));
  const handTipL = add(wristL, rotateVec(sub(rest.handTipL, rest.wristL), degToRad(handLDelta)));

  const shoulderR = add(chest, rotateVec(sub(rest.shoulderR, rest.chest), degToRad(chestDelta)));
  const elbowR = add(
    shoulderR,
    rotateVec(sub(rest.elbowR, rest.shoulderR), degToRad(upperArmRDelta)),
  );
  const wristR = add(elbowR, rotateVec(sub(rest.wristR, rest.elbowR), degToRad(forearmRDelta)));
  const handTipR = add(wristR, rotateVec(sub(rest.handTipR, rest.wristR), degToRad(handRDelta)));

  const hipL = add(hips, rotateVec(sub(rest.hipL, rest.hips), degToRad(hipsDelta)));
  const kneeL = add(hipL, rotateVec(sub(rest.kneeL, rest.hipL), degToRad(thighLDelta)));
  const ankleL = add(kneeL, rotateVec(sub(rest.ankleL, rest.kneeL), degToRad(shinLDelta)));
  const toeL = add(ankleL, rotateVec(sub(rest.toeL, rest.ankleL), degToRad(footLDelta)));

  const hipR = add(hips, rotateVec(sub(rest.hipR, rest.hips), degToRad(hipsDelta)));
  const kneeR = add(hipR, rotateVec(sub(rest.kneeR, rest.hipR), degToRad(thighRDelta)));
  const ankleR = add(kneeR, rotateVec(sub(rest.ankleR, rest.kneeR), degToRad(shinRDelta)));
  const toeR = add(ankleR, rotateVec(sub(rest.toeR, rest.ankleR), degToRad(footRDelta)));

  const upperVecL = sub(rest.elbowL, rest.shoulderL);
  const foreVecL = sub(rest.wristL, rest.elbowL);
  const handVecL = sub(rest.handTipL, rest.wristL);

  const upperVecR = sub(rest.elbowR, rest.shoulderR);
  const foreVecR = sub(rest.wristR, rest.elbowR);
  const handVecR = sub(rest.handTipR, rest.wristR);

  const thighVecL = sub(rest.kneeL, rest.hipL);
  const shinVecL = sub(rest.ankleL, rest.kneeL);
  const footVecL = sub(rest.toeL, rest.ankleL);

  const thighVecR = sub(rest.kneeR, rest.hipR);
  const shinVecR = sub(rest.ankleR, rest.kneeR);
  const footVecR = sub(rest.toeR, rest.ankleR);

  return {
    hips,
    spine,
    chest,
    neck,
    head,
    shoulderL,
    elbowL,
    wristL,
    handTipL,
    shoulderR,
    elbowR,
    wristR,
    handTipR,
    hipL,
    kneeL,
    ankleL,
    toeL,
    hipR,
    kneeR,
    ankleR,
    toeR,
    armWidth: rest.armWidth,
    thighWidth: rest.thighWidth,
    calfWidth: rest.calfWidth,
    rest,
    anglesDeg: {
      hips: hipsDelta,
      spine: spineDelta,
      chest: chestDelta,
      head: headDelta,
      upperArmL: upperArmLDelta,
      forearmL: forearmLDelta,
      handL: handLDelta,
      upperArmR: upperArmRDelta,
      forearmR: forearmRDelta,
      handR: handRDelta,
      thighL: thighLDelta,
      shinL: shinLDelta,
      footL: footLDelta,
      thighR: thighRDelta,
      shinR: shinRDelta,
      footR: footRDelta,
    },
    lengths: {
      upperArmL: vecLen(upperVecL),
      forearmL: vecLen(foreVecL),
      upperArmR: vecLen(upperVecR),
      forearmR: vecLen(foreVecR),
      thighL: vecLen(thighVecL),
      shinL: vecLen(shinVecL),
      thighR: vecLen(thighVecR),
      shinR: vecLen(shinVecR),
    },
    restAnglesRad: {
      upperArmL: Math.atan2(upperVecL.y, upperVecL.x),
      forearmL: Math.atan2(foreVecL.y, foreVecL.x),
      handL: Math.atan2(handVecL.y, handVecL.x),
      upperArmR: Math.atan2(upperVecR.y, upperVecR.x),
      forearmR: Math.atan2(foreVecR.y, foreVecR.x),
      handR: Math.atan2(handVecR.y, handVecR.x),
      thighL: Math.atan2(thighVecL.y, thighVecL.x),
      shinL: Math.atan2(shinVecL.y, shinVecL.x),
      footL: Math.atan2(footVecL.y, footVecL.x),
      thighR: Math.atan2(thighVecR.y, thighVecR.x),
      shinR: Math.atan2(shinVecR.y, shinVecR.x),
      footR: Math.atan2(footVecR.y, footVecR.x),
    },
  };
}

/**
 * Analytic Law-of-Cosines 2-Bone IK solver producing finite delta rotations (in degrees)
 * relative to rest limb segments and the parent world angle delta.
 */
export function solveTwoBoneIK2D(
  rootPos: BodyPoint2D,
  L1: number,
  L2: number,
  restUpperAngleRad: number,
  restLowerAngleRad: number,
  targetPos: BodyPoint2D,
  bendDir: 1 | -1,
  parentWorldDeltaRad: number,
): { upperDeg: number; lowerDeg: number } {
  const safeL1 = Math.max(8, L1);
  const safeL2 = Math.max(8, L2);
  const dx = targetPos.x - rootPos.x;
  const dy = targetPos.y - rootPos.y;
  const rawD = Math.hypot(dx, dy);
  const minD = Math.abs(safeL1 - safeL2) + 2;
  const maxD = (safeL1 + safeL2) * 0.998;
  const d = Math.max(minD, Math.min(maxD, rawD || minD));
  const alpha = rawD > 1e-4 ? Math.atan2(dy, dx) : restUpperAngleRad + parentWorldDeltaRad;

  const cosBeta = Math.max(
    -1,
    Math.min(1, (safeL1 * safeL1 + d * d - safeL2 * safeL2) / (2 * safeL1 * d)),
  );
  const beta = Math.acos(cosBeta);

  const cosInner = Math.max(
    -1,
    Math.min(1, (safeL1 * safeL1 + safeL2 * safeL2 - d * d) / (2 * safeL1 * safeL2)),
  );
  const elbowSup = Math.PI - Math.acos(cosInner);

  const upperWorldAngle = alpha + bendDir * beta;
  const lowerWorldAngle = upperWorldAngle - bendDir * elbowSup;

  const upperDeltaRad = wrapRad(upperWorldAngle - (restUpperAngleRad + parentWorldDeltaRad));
  const lowerDeltaRad = wrapRad(
    lowerWorldAngle - (restLowerAngleRad + parentWorldDeltaRad + upperDeltaRad),
  );

  return {
    upperDeg: Math.round(radToDeg(upperDeltaRad) * 10) / 10,
    lowerDeg: Math.round(radToDeg(lowerDeltaRad) * 10) / 10,
  };
}

/**
 * Computes direct single-bone local delta degree so `pivot -> child` points toward `targetPos`.
 */
export function solveSingleBoneRotationDeg(
  pivotPos: BodyPoint2D,
  restSegmentAngleRad: number,
  parentWorldDeltaRad: number,
  targetPos: BodyPoint2D,
): number {
  const dx = targetPos.x - pivotPos.x;
  const dy = targetPos.y - pivotPos.y;
  if (Math.hypot(dx, dy) < 2) return 0;
  const desiredWorldAngle = Math.atan2(dy, dx);
  return (
    Math.round(
      radToDeg(wrapRad(desiredWorldAngle - (restSegmentAngleRad + parentWorldDeltaRad))) * 10,
    ) / 10
  );
}

/** Converts a character-local `(0..480, 0..1000)` point into `1280x800` stage coordinates (before camera). */
export function characterToStageWorldPoint(pt: BodyPoint2D, actor: Stage2DActor): BodyPoint2D {
  const cx = CHAR2D_W / 2;
  const footAnchorY = 940;
  const lx = (actor.flipX ? -(pt.x - cx) : pt.x - cx) * actor.scale;
  const ly = (pt.y - footAnchorY) * actor.scale;
  return { x: actor.x + lx, y: actor.y + ly };
}

/** Converts a `1280x800` stage-world point into `(0..480, 0..1000)` character-local coordinates. */
export function stageWorldToCharacterPoint(pt: BodyPoint2D, actor: Stage2DActor): BodyPoint2D {
  const cx = CHAR2D_W / 2;
  const footAnchorY = 940;
  const s = Math.max(0.15, actor.scale);
  const dx = (pt.x - actor.x) / s;
  const dy = (pt.y - actor.y) / s;
  return {
    x: (actor.flipX ? -dx : dx) + cx,
    y: dy + footAnchorY,
  };
}

/** Converts a stage-world `(0..1280, 0..800)` point through `Stage2DCamera` into screen canvas `(0..1280, 0..800)`. */
export function stageWorldToCameraCanvasPoint(pt: BodyPoint2D, cam: Stage2DCamera): BodyPoint2D {
  const hw = STAGE2D_W / 2;
  const hh = STAGE2D_H / 2;
  const zoom = Math.max(0.3, cam.zoom || 1);
  const tilt = degToRad(cam.tilt || 0);
  const dx = (pt.x - hw) * zoom + cam.panX;
  const dy = (pt.y - hh) * zoom + cam.panY;
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  return {
    x: hw + (dx * c - dy * s),
    y: hh + (dx * s + dy * c),
  };
}

/** Converts a screen canvas `(0..1280, 0..800)` point back into `Stage2D` world coordinates. */
export function cameraCanvasToStageWorldPoint(pt: BodyPoint2D, cam: Stage2DCamera): BodyPoint2D {
  const hw = STAGE2D_W / 2;
  const hh = STAGE2D_H / 2;
  const zoom = Math.max(0.3, cam.zoom || 1);
  const tilt = -degToRad(cam.tilt || 0);
  const rx = pt.x - hw;
  const ry = pt.y - hh;
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  const ux = rx * c - ry * s;
  const uy = rx * s + ry * c;
  return {
    x: (ux - cam.panX) / zoom + hw,
    y: (uy - cam.panY) / zoom + hh,
  };
}

export function characterToStagePoint(
  pt: BodyPoint2D,
  actor: Stage2DActor,
  camera: Stage2DCamera,
): BodyPoint2D {
  return stageWorldToCameraCanvasPoint(characterToStageWorldPoint(pt, actor), camera);
}

export function stageToCharacterPoint(
  pt: BodyPoint2D,
  actor: Stage2DActor,
  camera: Stage2DCamera,
): BodyPoint2D {
  return stageWorldToCharacterPoint(cameraCanvasToStageWorldPoint(pt, camera), actor);
}

/**
 * Computes tight character-local bounding box around the posed FK skeleton (with padding for head, hair & limbs).
 * Used for tilt/crouch-accurate hit-testing and automatic camera framing.
 */
export function computeActorLocalBounds2D(sk: SkeletonWorld2D): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  const pts: BodyPoint2D[] = [
    { x: sk.head.x, y: sk.head.y - 88 },
    { x: sk.head.x - 52, y: sk.head.y },
    { x: sk.head.x + 52, y: sk.head.y },
    sk.neck,
    sk.chest,
    sk.spine,
    sk.hips,
    sk.shoulderL,
    sk.elbowL,
    sk.wristL,
    sk.handTipL,
    sk.shoulderR,
    sk.elbowR,
    sk.wristR,
    sk.handTipR,
    sk.hipL,
    sk.kneeL,
    sk.ankleL,
    { x: sk.toeL.x, y: sk.toeL.y + 18 },
    sk.hipR,
    sk.kneeR,
    sk.ankleR,
    { x: sk.toeR.x, y: sk.toeR.y + 18 },
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX: minX - 38,
    maxX: maxX + 38,
    minY: minY - 18,
    maxY: maxY + 22,
  };
}

/**
 * Computes the exact `rootOffsetY` value that plants the character's lowest foot directly on canonical floor `y = 940`.
 */
export function computeSnapFeetToFloorOffsetY(
  anchors: BodyAngleAnchors,
  pose: Pose2DState,
): number {
  const sk = computeForwardKinematics2D(anchors, pose);
  const lowestFootY = Math.max(sk.ankleL.y + 34, sk.ankleR.y + 34, sk.toeL.y + 6, sk.toeR.y + 6);
  const delta = 940 - lowestFootY;
  return Math.max(-180, Math.min(260, Math.round((pose.rootOffsetY || 0) + delta)));
}

/**
 * When Foot Pinning is enabled, moving the pelvis vertically (`targetRootOffsetY`) automatically solves
 * 2-bone IK for both legs so both ankles stay planted at their starting floor coordinates while knees bend naturally.
 */
export function solvePinnedFeetHipDrag2D(
  anchors: BodyAngleAnchors,
  startPose: Pose2DState,
  targetRootOffsetY: number,
): Pose2DState {
  const startSk = computeForwardKinematics2D(anchors, startPose);
  const pinnedAnkleL = startSk.ankleL;
  const pinnedAnkleR = startSk.ankleR;

  const clampedY = Math.max(-160, Math.min(240, Math.round(targetRootOffsetY)));
  const draft: Pose2DState = {
    ...startPose,
    joints: { ...startPose.joints },
    rootOffsetY: clampedY,
  };
  const nextSk = computeForwardKinematics2D(anchors, draft);
  const clampDeg = (d: number) => Math.max(-165, Math.min(165, Math.round(d * 10) / 10));

  const solL = solveTwoBoneIK2D(
    nextSk.hipL,
    nextSk.lengths.thighL,
    nextSk.lengths.shinL,
    nextSk.restAnglesRad.thighL,
    nextSk.restAnglesRad.shinL,
    pinnedAnkleL,
    draft.kneeBendL,
    degToRad(nextSk.anglesDeg.hips),
  );
  const solR = solveTwoBoneIK2D(
    nextSk.hipR,
    nextSk.lengths.thighR,
    nextSk.lengths.shinR,
    nextSk.restAnglesRad.thighR,
    nextSk.restAnglesRad.shinR,
    pinnedAnkleR,
    draft.kneeBendR,
    degToRad(nextSk.anglesDeg.hips),
  );

  draft.joints.thighL = clampDeg(solL.upperDeg);
  draft.joints.shinL = clampDeg(solL.lowerDeg);
  draft.joints.thighR = clampDeg(solR.upperDeg);
  draft.joints.shinR = clampDeg(solR.lowerDeg);
  // Keep feet level with floor as shins angle
  draft.joints.footL = Math.max(
    -45,
    Math.min(45, Math.round(-(draft.joints.hips + solL.upperDeg + solL.lowerDeg) * 0.45)),
  );
  draft.joints.footR = Math.max(
    -45,
    Math.min(45, Math.round(-(draft.joints.hips + solR.upperDeg + solR.lowerDeg) * 0.45)),
  );
  return draft;
}

/**
 * Computes a clean camera framing centered on the selected actor's posed bounding box.
 */
export function computeFrameActorCamera2D(actor: Stage2DActor, sk: SkeletonWorld2D): Stage2DCamera {
  const b = computeActorLocalBounds2D(sk);
  const tl = characterToStageWorldPoint({ x: b.minX, y: b.minY }, actor);
  const br = characterToStageWorldPoint({ x: b.maxX, y: b.maxY }, actor);
  const worldW = Math.max(80, Math.abs(br.x - tl.x));
  const worldH = Math.max(120, Math.abs(br.y - tl.y));
  const cx = (tl.x + br.x) / 2;
  const cy = (tl.y + br.y) / 2;
  const rawZoom = Math.min((STAGE2D_W * 0.72) / worldW, (STAGE2D_H * 0.82) / worldH);
  const zoom = Math.max(0.6, Math.min(2.4, Math.round(rawZoom * 20) / 20));
  const panX = Math.max(-480, Math.min(480, Math.round((STAGE2D_W / 2 - cx) * zoom)));
  const panY = Math.max(-340, Math.min(420, Math.round((STAGE2D_H / 2 - cy) * zoom)));
  return { zoom, panX, panY, tilt: 0 };
}

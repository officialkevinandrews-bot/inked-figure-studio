import * as THREE from "three";
import type { Rig } from "./rig";
import { DEFAULT_CALIBRATION, type FaceCalibration } from "./face-library";

export interface FaceRaySample {
  x: number; // metres relative to Head bone in head frame
  y: number; // metres relative to Head bone in head frame
  z: number; // metres forward from Head bone (+Z = face front)
  nz: number; // forward normal component in head frame
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Fits 2D face decal transform parameters (offsetY, offsetZ, size, tilt, curve)
 * from forward-facing ray hits on any normalized 1.8m character head mesh.
 */
export function solveFaceCalibrationFromSamples(
  samples: FaceRaySample[],
  base: FaceCalibration = DEFAULT_CALIBRATION,
): Pick<FaceCalibration, "offsetX" | "offsetY" | "offsetZ" | "size" | "tilt" | "curve"> {
  const valid = samples.filter((s) => Number.isFinite(s.z) && s.nz > 0.22);
  if (valid.length === 0) {
    return {
      offsetX: base.offsetX,
      offsetY: base.offsetY,
      offsetZ: base.offsetZ,
      size: base.size,
      tilt: base.tilt,
      curve: base.curve,
    };
  }

  // Center band (|x| <= 0.025) drives front depth, eye height, and chin-to-brow tilt
  const centerHits = valid.filter((s) => Math.abs(s.x) <= 0.025);
  const pool = centerHits.length >= 2 ? centerHits : valid;

  // Estimate vertical face span and place decal center slightly below brow ridge (lower-upper face balance)
  const ys = valid.map((s) => s.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  // Typical front-facing head hits span ~y=0.02..0.14; center around ~52% up from jaw/chin base
  const rawOffsetY = yMin + (yMax - yMin) * 0.52;
  const offsetY = Number(clamp(rawOffsetY, 0.03, 0.14).toFixed(3));

  // Estimate chin-to-forehead forward slope (degrees pitch)
  const lowBand = pool.filter((s) => s.y <= offsetY - 0.015);
  const highBand = pool.filter((s) => s.y >= offsetY + 0.015);
  const avg = (arr: FaceRaySample[], fn: (s: FaceRaySample) => number) =>
    arr.reduce((sum, s) => sum + fn(s), 0) / Math.max(1, arr.length);
  let tilt = 0;
  if (lowBand.length > 0 && highBand.length > 0) {
    const zBot = avg(lowBand, (s) => s.z);
    const zTop = avg(highBand, (s) => s.z);
    const yBot = avg(lowBand, (s) => s.y);
    const yTop = avg(highBand, (s) => s.y);
    const dy = yTop - yBot;
    if (dy > 0.02) {
      // Positive pitch tilts +Z normal upward (-Y), negative pitch tilts face toward +Y
      const rad = Math.atan2(zBot - zTop, dy);
      tilt = Math.round(clamp(THREE.MathUtils.radToDeg(rad), -15, 15));
    }
  }

  // Estimate effective frontal face width across mid-face height to choose decal size
  const midBand = valid.filter((s) => Math.abs(s.y - offsetY) <= 0.045 && s.nz > 0.35);
  const xs = (midBand.length >= 3 ? midBand : valid).map((s) => Math.abs(s.x));
  const halfWidth = Math.max(...xs, 0.04);
  const size = Number(clamp(halfWidth * 3.1, 0.14, 0.28).toFixed(3));

  // Measure horizontal curvature drop between center (x=0) and cheeks (|x| >= 0.035)
  const maxCenterZ = Math.max(...pool.map((s) => s.z));
  const sideHits = midBand.filter((s) => Math.abs(s.x) >= 0.035 && Math.abs(s.x) <= 0.065);
  let curve = base.curve;
  if (sideHits.length > 0) {
    const ratios = sideHits.map((s) => {
      const localX = Math.abs(s.x) / size;
      const drop = Math.max(0, maxCenterZ - s.z);
      return drop / Math.max(0.01, size * localX * localX);
    });
    const avgCurve = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    curve = Number(clamp(avgCurve * 0.72, 0.25, 0.85).toFixed(2));
  }

  // Compute safe forward offsetZ so the curved decal clears every front surface point by >= 5mm
  const tiltRad = THREE.MathUtils.degToRad(tilt);
  const clearance = 0.0055;
  let requiredOffsetZ = maxCenterZ + clearance;
  for (const s of midBand) {
    const localX = s.x / size;
    const localY = s.y - offsetY;
    const curveZ = -localX * localX * curve * size;
    const tiltZ = -localY * Math.sin(tiltRad);
    const needed = s.z + clearance - curveZ - tiltZ;
    if (needed > requiredOffsetZ) requiredOffsetZ = needed;
  }

  return {
    offsetX: 0,
    offsetY,
    offsetZ: Number(clamp(requiredOffsetZ, 0.04, 0.24).toFixed(3)),
    size,
    tilt,
    curve,
  };
}

/** Casts a 5x7 ray grid onto the character's head mesh in head bone frame to auto-fit the 2D face decal. */
export function computeAdaptiveFaceCalibration(
  rig: Rig,
  model: THREE.Object3D,
  base: FaceCalibration = DEFAULT_CALIBRATION,
): Pick<FaceCalibration, "offsetX" | "offsetY" | "offsetZ" | "size" | "tilt" | "curve"> | null {
  const head = rig.bones.get("Head");
  const rest = rig.restModel.get("Head");
  if (!head || !rest) return null;

  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton) sm.skeleton.update();
  });

  const headPos = head.getWorldPosition(new THREE.Vector3());
  const headQuat = head.getWorldQuaternion(new THREE.Quaternion()).multiply(rest.clone().invert());
  const invHeadQuat = headQuat.clone().invert();

  const meshes: THREE.Object3D[] = [];
  model.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData?.noOutline) meshes.push(o);
  });
  if (!meshes.length) return null;

  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(headQuat);
  const ray = new THREE.Raycaster();
  const samples: FaceRaySample[] = [];
  const xs = [-0.065, -0.04, -0.02, 0, 0.02, 0.04, 0.065];
  const ys = [0.02, 0.045, 0.07, 0.09, 0.11, 0.13, 0.15];

  for (const y of ys) {
    for (const x of xs) {
      const origin = headPos.clone().add(new THREE.Vector3(x, y, 0.6).applyQuaternion(headQuat));
      ray.set(origin, dir);
      const hit = ray.intersectObjects(meshes, false)[0];
      if (!hit || hit.distance > 0.72) continue;
      let nz = 0.8;
      if (hit.face) {
        nz = hit.face.normal
          .clone()
          .transformDirection(hit.object.matrixWorld)
          .applyQuaternion(invHeadQuat).z;
      }
      samples.push({
        x,
        y,
        z: 0.6 - hit.distance,
        nz,
      });
    }
  }

  if (!samples.some((s) => s.nz > 0.22)) return null;
  return solveFaceCalibrationFromSamples(samples, base);
}


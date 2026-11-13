import { describe, expect, it } from "vitest";
import {
  LIGHT_PRESETS,
  OUTLINE_SWATCHES,
  hexToOutlineRgb,
  lightCartesianToSpherical,
  lightSphericalToCartesian,
} from "./lighting";
import { HAND_PRESETS, applyHandPresetToPose, buildHandPreset } from "./hand-poses";
import { mirrorRot, type PoseData } from "./rig";

describe("Phase 2 Lighting & Ink Helpers", () => {
  it("converts spherical azimuth/elevation to Cartesian coordinates and back", () => {
    const front = lightSphericalToCartesian(0, 0, 5);
    expect(front[0]).toBeCloseTo(0, 2);
    expect(front[1]).toBeCloseTo(0, 2);
    expect(front[2]).toBeCloseTo(5, 2);

    const sideRight = lightSphericalToCartesian(90, 0, 5);
    expect(sideRight[0]).toBeCloseTo(5, 2);
    expect(sideRight[2]).toBeCloseTo(0, 2);

    const testAngles: [number, number][] = [
      [40, 46],
      [-80, 22],
      [162, 28],
      [12, -35],
    ];
    for (const [az, el] of testAngles) {
      const cart = lightSphericalToCartesian(az, el, 5.5);
      const back = lightCartesianToSpherical(cart);
      expect(back.azimuth).toBe(az);
      expect(back.elevation).toBe(el);
    }
  });

  it("clamps elevation and wraps azimuth outside bounds", () => {
    const clamped = lightSphericalToCartesian(200, 120, 4);
    const back = lightCartesianToSpherical(clamped);
    expect(back.azimuth).toBe(-160);
    expect(back.elevation).toBe(85);
  });

  it("parses outline ink hex codes including shorthand and invalid fallback", () => {
    expect(hexToOutlineRgb("#0d0d0d")).toEqual([0.051, 0.051, 0.051]);
    expect(hexToOutlineRgb("#fff")).toEqual([1, 1, 1]);
    expect(hexToOutlineRgb("7f1d1d")).toEqual([0.498, 0.114, 0.114]);
    expect(hexToOutlineRgb("invalid")).toEqual([0.05, 0.05, 0.05]);
  });

  it("provides valid lighting presets and ink swatches", () => {
    expect(LIGHT_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(OUTLINE_SWATCHES.length).toBeGreaterThanOrEqual(4);
    for (const preset of LIGHT_PRESETS) {
      expect(preset.lightIntensity).toBeGreaterThan(0);
      expect(preset.rimIntensity).toBeGreaterThanOrEqual(0);
      expect(preset.fillIntensity).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Phase 2 Hand Pose Presets", () => {
  it("builds symmetric mirrored finger rotations for Both hands", () => {
    const fist = buildHandPreset("Both", "fist");
    expect(fist.LeftHandIndex1).toBeDefined();
    expect(fist.RightHandIndex1).toEqual(mirrorRot(fist.LeftHandIndex1));
    expect(fist.RightHandThumb2).toEqual(mirrorRot(fist.LeftHandThumb2));
    expect(Object.keys(fist)).toHaveLength(30); // 5 digits * 3 phalanges * 2 hands
  });

  it("builds single-hand maps only affecting the targeted side", () => {
    const leftOnly = buildHandPreset("Left", "point");
    expect(Object.keys(leftOnly).every((k) => k.startsWith("LeftHand"))).toBe(true);
    expect(leftOnly.LeftHandIndex1).toEqual([0, 0, 0]);
    expect(leftOnly.LeftHandMiddle2).toEqual([0, 0, -90]);

    const rightOnly = buildHandPreset("Right", "peace");
    expect(Object.keys(rightOnly).every((k) => k.startsWith("RightHand"))).toBe(true);
    expect(rightOnly.RightHandIndex2).toEqual([0, 0, 0]);
    expect(rightOnly.RightHandRing2).toEqual(mirrorRot([0, 0, -90]));
  });

  it("merges hand presets onto an existing body pose without clobbering limbs", () => {
    const basePose: PoseData = {
      Hips: [0, 20, 0],
      LeftArm: [-40, 0, -60],
      RightLeg: [35, 0, 0],
    };
    const next = applyHandPresetToPose(basePose, "Right", "grip");
    expect(next.Hips).toEqual([0, 20, 0]);
    expect(next.LeftArm).toEqual([-40, 0, -60]);
    expect(next.RightLeg).toEqual([35, 0, 0]);
    expect(next.LeftHandIndex1).toBeUndefined();
    expect(next.RightHandIndex1).toBeDefined();
    expect(HAND_PRESETS.some((p) => p.id === "grip")).toBe(true);
  });
});


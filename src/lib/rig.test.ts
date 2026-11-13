import { describe, expect, it } from "vitest";
import { canonicalBoneName, mirrorPose } from "./rig";

describe("bone mapping", () => {
  it("maps Mixamo name variants to canonical bones", () => {
    expect(canonicalBoneName("mixamorig:LeftForeArm")).toBe("LeftForeArm");
    expect(canonicalBoneName("mixamorig1:RightHandIndex2")).toBe("RightHandIndex2");
    expect(canonicalBoneName("mixamorigHips")).toBe("Hips");
  });
});

describe("pose mirroring", () => {
  it("swaps left/right and flips Y/Z rotation", () => {
    expect(mirrorPose({ LeftArm: [10, 20, -75], Head: [5, 30, 0] })).toEqual({
      RightArm: [10, -20, 75],
      Head: [5, -30, 0],
    });
  });
});

import * as THREE_G from "three";
import { buildRig as buildRigG, groundedHipsDrop as gHD } from "./rig";
describe("groundedHipsDrop", () => {
  it("lowers hips by how much the bent leg raised the foot", () => {
    const root = new THREE_G.Group();
    const hips = new THREE_G.Bone(); hips.name = "Hips"; hips.position.y = 1; root.add(hips);
    const up = new THREE_G.Bone(); up.name = "LeftUpLeg"; hips.add(up);
    const leg = new THREE_G.Bone(); leg.name = "LeftLeg"; leg.position.y = -0.5; up.add(leg);
    const foot = new THREE_G.Bone(); foot.name = "LeftFoot"; foot.position.y = -0.5; leg.add(foot);
    const rig = buildRigG(root, 1);
    // thigh forward 90°: whole straight leg swings horizontal, foot rises 1m
    const hd = gHD(rig, { LeftUpLeg: [-90, 0, 0] }, 0);
    expect(hd).toBeCloseTo(1, 2);
  });
});

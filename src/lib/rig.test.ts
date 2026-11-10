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

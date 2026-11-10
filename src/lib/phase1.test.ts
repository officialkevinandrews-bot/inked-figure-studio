import { describe, expect, it, beforeEach } from "vitest";
import { saveCustomPose, loadCustomPoses, deleteCustomPose } from "./pose-storage";
import { canonicalBoneName, mirrorPose } from "./rig";
import { CAMERA_PRESETS } from "@/components/studio/Viewport";

describe("Phase 1: Pose & Rigging verification", () => {
  it("maps standard Mixamo FBX bones correctly", () => {
    expect(canonicalBoneName("mixamorig:Hips")).toBe("Hips");
    expect(canonicalBoneName("mixamorig:Spine")).toBe("Spine");
    expect(canonicalBoneName("mixamorig:LeftArm")).toBe("LeftArm");
    expect(canonicalBoneName("mixamorig:RightHand")).toBe("RightHand");
    expect(canonicalBoneName("mixamorig:RightUpLeg")).toBe("RightUpLeg");
  });

  it("mirrors complex poses with symmetry inversion", () => {
    const original = {
      LeftArm: [20, 45, -60] as [number, number, number],
      RightArm: [-10, -30, 40] as [number, number, number],
      Head: [5, 15, 0] as [number, number, number],
    };
    const mirrored = mirrorPose(original);
    expect(mirrored.RightArm).toEqual([20, -45, 60]);
    expect(mirrored.LeftArm).toEqual([-10, 30, -40]);
    expect(mirrored.Head).toEqual([5, -15, 0]);
  });
});

describe("Phase 1: Custom Pose Storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves, loads, and deletes custom poses in storage", () => {
    expect(loadCustomPoses()).toEqual([]);

    const saved = saveCustomPose("Test Pose", "Action", { LeftArm: [10, 0, 0] }, 0.05);
    expect(saved.name).toBe("Test Pose");
    expect(saved.category).toBe("Action");
    expect(saved.hipsDrop).toBe(0.05);

    const loaded = loadCustomPoses();
    expect(loaded.length).toBe(1);
    expect(loaded[0].name).toBe("Test Pose");

    deleteCustomPose(saved.id);
    expect(loadCustomPoses().length).toBe(0);
  });
});

describe("Phase 1: Camera & Perspective Presets", () => {
  it("provides essential manga camera angles with foreshortening FOV", () => {
    expect(CAMERA_PRESETS["Front"]).toBeDefined();
    expect(CAMERA_PRESETS["Low Angle (Worm)"]).toBeDefined();
    expect(CAMERA_PRESETS["Low Angle (Worm)"].fov).toBeGreaterThanOrEqual(60);
    expect(CAMERA_PRESETS["3/4 Dynamic"]).toBeDefined();
  });
});

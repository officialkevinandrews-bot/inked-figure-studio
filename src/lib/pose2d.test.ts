import { beforeEach, describe, expect, it } from "vitest";
import { ANGLES_2D } from "./character2d-types";
import { MODEL1_ANCHORS } from "./character2d-model1";
import {
  BUILTIN_POSE_PRESETS_2D,
  DEFAULT_POSE_2D,
  clonePose2D,
  createDefaultStage2D,
  mirrorPose2D,
} from "./pose2d-types";
import {
  characterToStagePoint,
  computeForwardKinematics2D,
  degToRad,
  solveTwoBoneIK2D,
  stageToCharacterPoint,
} from "./pose2d-rig";
import {
  POSES_2D_STORAGE_KEY,
  STAGES_2D_STORAGE_KEY,
  ensureStages2DInitialized,
  loadCustomPoses2D,
  loadStages2D,
  removeCustomPose2D,
  removeStage2D,
  upsertCustomPose2D,
  upsertStage2D,
} from "./pose2d-store";
import { setActiveStorageUser } from "./user-storage";

describe("2D Articulated Pose & Stage Library", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActiveStorageUser("user-pose2d-test");
  });

  it("ships 18 distinct curated poses covering everyday, action, and drama categories", () => {
    expect(BUILTIN_POSE_PRESETS_2D.length).toBe(18);
    const cats = new Set(BUILTIN_POSE_PRESETS_2D.map((p) => p.category));
    expect(cats.has("everyday")).toBe(true);
    expect(cats.has("action")).toBe(true);
    expect(cats.has("drama")).toBe(true);
    const ids = new Set(BUILTIN_POSE_PRESETS_2D.map((p) => p.id));
    expect(ids.size).toBe(18);
  });

  it("computes exact zero-drift rest skeleton at zero rotation across all 8 angles", () => {
    for (const angle of ANGLES_2D) {
      const a = MODEL1_ANCHORS[angle];
      const sk = computeForwardKinematics2D(a, DEFAULT_POSE_2D);
      expect(
        Math.hypot(sk.shoulderL.x - a.armLeft[0].x, sk.shoulderL.y - a.armLeft[0].y),
      ).toBeLessThan(0.01);
      expect(Math.hypot(sk.elbowL.x - a.armLeft[1].x, sk.elbowL.y - a.armLeft[1].y)).toBeLessThan(
        0.01,
      );
      expect(Math.hypot(sk.wristL.x - a.armLeft[2].x, sk.wristL.y - a.armLeft[2].y)).toBeLessThan(
        0.01,
      );
      expect(Math.hypot(sk.kneeR.x - a.legRight[1].x, sk.kneeR.y - a.legRight[1].y)).toBeLessThan(
        0.01,
      );
      expect(Math.hypot(sk.ankleR.x - a.legRight[2].x, sk.ankleR.y - a.legRight[2].y)).toBeLessThan(
        0.01,
      );
      expect(Math.hypot(sk.head.x - a.headCx, sk.head.y - a.headCy)).toBeLessThan(0.01);
    }
  });

  it("solves 2-bone IK accurately for reachable targets and clamps unreachable targets without NaN", () => {
    const a = MODEL1_ANCHORS[0];
    const restSk = computeForwardKinematics2D(a, DEFAULT_POSE_2D);
    const target = { x: restSk.shoulderL.x - 95, y: restSk.shoulderL.y - 35 };

    const sol = solveTwoBoneIK2D(
      restSk.shoulderL,
      restSk.lengths.upperArmL,
      restSk.lengths.forearmL,
      restSk.restAnglesRad.upperArmL,
      restSk.restAnglesRad.forearmL,
      target,
      -1,
      degToRad(restSk.anglesDeg.chest),
    );
    expect(Number.isFinite(sol.upperDeg)).toBe(true);
    expect(Number.isFinite(sol.lowerDeg)).toBe(true);

    const posed = clonePose2D(DEFAULT_POSE_2D);
    posed.joints.upperArmL = sol.upperDeg;
    posed.joints.forearmL = sol.lowerDeg;
    const resultSk = computeForwardKinematics2D(a, posed);
    expect(Math.hypot(resultSk.wristL.x - target.x, resultSk.wristL.y - target.y)).toBeLessThan(
      1.5,
    );

    // Pole flip changes elbow X/Y smoothly while still reaching the same wrist target
    const flippedSol = solveTwoBoneIK2D(
      restSk.shoulderL,
      restSk.lengths.upperArmL,
      restSk.lengths.forearmL,
      restSk.restAnglesRad.upperArmL,
      restSk.restAnglesRad.forearmL,
      target,
      1,
      degToRad(restSk.anglesDeg.chest),
    );
    const posedFlip = clonePose2D(DEFAULT_POSE_2D);
    posedFlip.joints.upperArmL = flippedSol.upperDeg;
    posedFlip.joints.forearmL = flippedSol.lowerDeg;
    const flipSk = computeForwardKinematics2D(a, posedFlip);
    expect(Math.hypot(flipSk.wristL.x - target.x, flipSk.wristL.y - target.y)).toBeLessThan(1.5);
    expect(
      Math.hypot(flipSk.elbowL.x - resultSk.elbowL.x, flipSk.elbowL.y - resultSk.elbowL.y),
    ).toBeGreaterThan(25);

    // Unreachable far point clamps cleanly without NaN
    const farSol = solveTwoBoneIK2D(
      restSk.shoulderL,
      restSk.lengths.upperArmL,
      restSk.lengths.forearmL,
      restSk.restAnglesRad.upperArmL,
      restSk.restAnglesRad.forearmL,
      { x: -1200, y: -800 },
      -1,
      0,
    );
    expect(Number.isNaN(farSol.upperDeg)).toBe(false);
    expect(Number.isNaN(farSol.lowerDeg)).toBe(false);
  });

  it("mirrors poses cleanly across left and right joints and round-trips stage <-> character coordinates", () => {
    const kick = BUILTIN_POSE_PRESETS_2D.find((p) => p.id === "high-kick")!.pose;
    const mirrored = mirrorPose2D(kick);
    expect(mirrored.joints.thighR).toBe(-kick.joints.thighL);
    expect(mirrored.joints.thighL).toBe(-kick.joints.thighR);
    expect(mirrored.joints.upperArmR).toBe(-kick.joints.upperArmL);
    expect(mirrored.joints.hips).toBe(-kick.joints.hips);

    const stage = createDefaultStage2D("Test Stage", null, "c1", "Hero");
    stage.camera = { zoom: 1.45, panX: 35, panY: -22, tilt: -8 };
    stage.actors[0]!.flipX = true;
    const sample = { x: 184, y: 412 };
    const screen = characterToStagePoint(sample, stage.actors[0]!, stage.camera);
    const back = stageToCharacterPoint(screen, stage.actors[0]!, stage.camera);
    expect(Math.hypot(back.x - sample.x, back.y - sample.y)).toBeLessThan(0.01);
  });

  it("persists stages and custom poses isolated per user account", () => {
    const list1 = ensureStages2DInitialized("c1", "Hero #1", "scene-cozy-bedroom");
    expect(list1.length).toBe(1);
    const extra = createDefaultStage2D("Rooftop Duel", "scene-school-rooftop", "c1", "Hero #1");
    const updated = upsertStage2D(list1, extra);
    expect(loadStages2D().length).toBe(2);
    expect(window.localStorage.getItem(STAGES_2D_STORAGE_KEY)).toBeNull();

    removeStage2D(updated, extra.id);
    expect(loadStages2D().length).toBe(1);

    const customPose = {
      id: "pose-custom-1",
      name: "My Power Stance",
      category: "custom" as const,
      builtIn: false,
      createdAt: Date.now(),
      pose: clonePose2D(BUILTIN_POSE_PRESETS_2D[8]!.pose),
    };
    const pList = upsertCustomPose2D([], customPose);
    expect(loadCustomPoses2D().length).toBe(1);
    expect(window.localStorage.getItem(POSES_2D_STORAGE_KEY)).toBeNull();
    removeCustomPose2D(pList, customPose.id);
    expect(loadCustomPoses2D().length).toBe(0);
  });
});

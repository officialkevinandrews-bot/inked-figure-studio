import { describe, expect, it, beforeEach } from "vitest";
import * as THREE from "three";
import {
  BUILTIN_MODELS,
  builtinModel,
  detectSkinMaterials,
  loadBaseModels,
  reconcileBaseModels,
  removeBaseModel,
  renameBaseModel,
  saveBaseModels,
  shouldTintMaterial,
  uploadedBodies,
  upsertBaseModel,
  type CustomBaseModel,
} from "./base-models";
import { CANONICAL_BONES, buildRig, rigCoverage } from "./rig";
import { normaliseModel } from "./model-loader";
import { solveFaceCalibrationFromSamples } from "./face-autofit";
import { DEFAULT_CALIBRATION, loadModelCalibration, saveModelCalibration } from "./face-library";
import { bindSkinned } from "@/components/studio/WardrobeRig";
import { parseBackup, referencedFileIds } from "./backup";
import { newCharacter } from "./characters";

describe("Universal Base Model Library", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("includes both X Bot and Shonen Hero Base presets with local + Lovable fallback", () => {
    expect(BUILTIN_MODELS.map((m) => m.key)).toEqual(["builtin:xbot", "builtin:shonen-base"]);
    const shonen = builtinModel("builtin:shonen-base");
    expect(shonen).toBeDefined();
    expect(shonen?.ext).toBe("fbx");
    expect(shonen?.url).toBe("/models/shonen_base.fbx");
    expect(shonen?.fallbackUrl).toContain("/__l5e/assets-v1/");
  });

  it("persists uploaded base models independently of characters and reconciles legacy refs", () => {
    const m1: CustomBaseModel = {
      id: "file:hero-v2",
      key: "file:hero-v2",
      name: "hero_v2.fbx",
      ext: "fbx",
      addedAt: 1000,
      boneCount: 52,
      hasFullHands: true,
    };
    saveBaseModels([m1]);
    expect(loadBaseModels()).toHaveLength(1);

    // Even with zero characters referencing file:hero-v2, uploadedBodies keeps it available
    expect(uploadedBodies([], loadBaseModels())).toEqual([{ key: "file:hero-v2", name: "hero_v2.fbx" }]);

    const renamed = renameBaseModel(loadBaseModels(), "file:hero-v2", "Tall Rival Base");
    expect(renamed[0]?.name).toBe("Tall Rival Base");

    const charUsingOther = { ...newCharacter("Other"), model: "file:other-body", modelName: "other.vrm" };
    const reconciled = reconcileBaseModels(renamed, [charUsingOther]);
    expect(reconciled.map((m) => m.key).sort()).toEqual(["file:hero-v2", "file:other-body"]);

    const afterDelete = removeBaseModel(upsertBaseModel(reconciled, m1), "file:other-body");
    expect(afterDelete.map((m) => m.key)).toEqual(["file:hero-v2"]);
  });

  it("detects skin materials accurately for single-material sculpted bases and multi-material models", () => {
    const singleGroup = new THREE.Group();
    const singleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: "Materialmat" }),
    );
    singleGroup.add(singleMesh);
    const singleDet = detectSkinMaterials(singleGroup);
    expect(singleDet.isSingleMaterial).toBe(true);
    expect(singleDet.targets).toEqual(["Materialmat"]);
    expect(shouldTintMaterial("Materialmat", singleDet.all)).toBe(true);

    const multiGroup = new THREE.Group();
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: "Beta_Surface" }),
    );
    const jointMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: "Beta_Joints_MAT" }),
    );
    const eyeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ name: "Eyes_Iris" }),
    );
    multiGroup.add(bodyMesh, jointMesh, eyeMesh);
    const multiDet = detectSkinMaterials(multiGroup);
    expect(multiDet.isSingleMaterial).toBe(false);
    expect(multiDet.targets).toEqual(["Beta_Surface"]);
    expect(shouldTintMaterial("Beta_Surface", multiDet.all)).toBe(true);
    expect(shouldTintMaterial("Beta_Joints_MAT", multiDet.all)).toBe(false);
    expect(shouldTintMaterial("Eyes_Iris", multiDet.all)).toBe(false);
    // Explicit override always wins
    expect(shouldTintMaterial("Beta_Joints_MAT", multiDet.all, ["Beta_Joints_MAT"])).toBe(true);
  });
});

describe("Universal Auto-Calibration Pipeline", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normalises arbitrary-height rigs to 1.8m with feet at Y=0 and classifies full 65-bone Mixamo skeletons", () => {
    const root = new THREE.Group();
    const hips = new THREE.Bone();
    hips.name = "mixamorigHips";
    hips.position.set(0, 100, 0);
    root.add(hips);
    let parent: THREE.Bone = hips;
    for (const bName of CANONICAL_BONES.slice(1)) {
      const b = new THREE.Bone();
      b.name = `mixamorig${bName}`;
      b.position.set(0, bName.includes("Head") ? 80 : 10, 0);
      parent.add(b);
      if (["Spine", "Spine1", "Spine2", "Neck", "Head"].includes(bName)) parent = b;
    }
    // Add typical 13 Mixamo leaf/end bones (HeadTop_End, Toe_End, *4 tips)
    for (const leaf of ["mixamorigHeadTop_End", "mixamorigLeftToe_End", "mixamorigRightToe_End", "mixamorigLeftHandIndex4"]) {
      const lb = new THREE.Bone();
      lb.name = leaf;
      hips.add(lb);
    }
    // Add a 200-unit tall mesh sitting at Y=[20..220]
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(40, 200, 30));
    mesh.position.set(5, 120, -3);
    root.add(mesh);

    const scale = normaliseModel(root, 1.8);
    expect(scale).toBeCloseTo(1.8 / 200, 5);
    const box = new THREE.Box3().setFromObject(root);
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(box.max.y).toBeCloseTo(1.8, 3);
    expect(box.getCenter(new THREE.Vector3()).x).toBeCloseTo(0, 3);
    expect(box.getCenter(new THREE.Vector3()).z).toBeCloseTo(0, 3);

    const rig = buildRig(root, scale);
    const cov = rigCoverage(rig);
    expect(cov.mapped).toBe(52);
    expect(cov.hasFullHands).toBe(true);
    expect(cov.leafBones).toBe(4);
    expect(cov.unmapped).toBe(0);
  });

  it("fits face decal calibration per model curvature/tilt and persists calibration by modelKey", () => {
    const shonenSamples = [
      { x: 0, y: 0.03, z: 0.119, nz: 0.96 },
      { x: 0, y: 0.07, z: 0.124, nz: 1.0 },
      { x: -0.04, y: 0.07, z: 0.109, nz: 0.79 },
      { x: 0.04, y: 0.07, z: 0.109, nz: 0.77 },
      { x: 0, y: 0.11, z: 0.127, nz: 1.0 },
      { x: -0.06, y: 0.11, z: 0.091, nz: 0.44 },
      { x: 0.06, y: 0.11, z: 0.091, nz: 0.35 },
    ];
    const fit = solveFaceCalibrationFromSamples(shonenSamples, DEFAULT_CALIBRATION);
    expect(fit.offsetZ).toBeGreaterThan(0.127);
    expect(fit.offsetY).toBeGreaterThanOrEqual(0.06);
    expect(fit.curve).toBeGreaterThan(0.3);

    saveModelCalibration("builtin:shonen-base", { ...DEFAULT_CALIBRATION, ...fit });
    const loaded = loadModelCalibration("builtin:shonen-base");
    expect(loaded?.offsetZ).toBe(fit.offsetZ);
    expect(loaded?.curve).toBe(fit.curve);
  });

  it("rebinds skinned clothing cleanly across different Mixamo armature scales without scale blowup", () => {
    // Source garment from a 0.01-scaled Armature (like X Bot)
    const srcArm = new THREE.Group();
    srcArm.scale.setScalar(0.01);
    const srcHips = new THREE.Bone();
    srcHips.name = "mixamorig:Hips";
    srcHips.position.set(0, 100, 0);
    const srcHead = new THREE.Bone();
    srcHead.name = "mixamorig:Head";
    srcHead.position.set(0, 60, 0);
    srcHips.add(srcHead);
    srcArm.add(srcHips);
    srcArm.updateMatrixWorld(true);

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 100, 0, 10, 120, 0, -10, 120, 0], 3));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const sm = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial());
    srcArm.add(sm);
    sm.updateMatrixWorld(true);
    sm.bind(new THREE.Skeleton([srcHips, srcHead]), sm.matrixWorld.clone());

    // Target rig at 1.0 scale (normalized 1.8m Shonen style, Hips=0.95, Head=1.60)
    const tgtRoot = new THREE.Group();
    const tgtHips = new THREE.Bone();
    tgtHips.name = "mixamorigHips";
    tgtHips.position.set(0, 0.95, 0);
    const tgtHead = new THREE.Bone();
    tgtHead.name = "mixamorigHead";
    tgtHead.position.set(0, 0.65, 0);
    tgtHips.add(tgtHead);
    tgtRoot.add(tgtHips);
    const tgtRig = buildRig(tgtRoot, 1);

    const wrap = new THREE.Group();
    wrap.add(sm);
    bindSkinned(wrap, tgtRig);

    const v0 = new THREE.Vector3();
    sm.updateMatrixWorld(true);
    sm.skeleton.update();
    sm.getVertexPosition(0, v0);
    // Vertex anchored near Hips should land cleanly around target Hips (y ~ 0.95), NOT 100m away!
    expect(v0.y).toBeCloseTo(0.95, 2);
  });

  it("includes unreferenced custom base models in studio backup export/import", () => {
    const lib: CustomBaseModel[] = [
      { id: "file:unused-base", key: "file:unused-base", name: "villain_base.fbx", ext: "fbx", addedAt: 123 },
    ];
    const files = referencedFileIds([newCharacter("Hero")], [], [], lib);
    expect(files).toEqual(["file:unused-base"]);

    const parsed = parseBackup(
      JSON.stringify({
        app: "koma-studio",
        version: 1,
        exported: 100,
        characters: [],
        baseModels: lib,
        facePacks: [],
        files: [],
      }),
    );
    expect(parsed.baseModels).toHaveLength(1);
    expect(parsed.baseModels?.[0]?.name).toBe("villain_base.fbx");
  });
});


import { describe, expect, it } from "vitest";
import { nextStagePosition, serializeCastForSnapshot, type StagedActor } from "./scene-cast";
import { snapPropToHand } from "./prop-grips";
import { createActiveProp } from "./props";
import {
  deleteCustomPropMeta,
  detectPropExtension,
  upsertCustomPropMeta,
  type CustomPropMeta,
} from "./custom-props";
import { referencedFileIds } from "./backup";
import { DEFAULT_FACE } from "./face-library";

describe("Phase 3 Multi-Actor Scene Cast Helpers", () => {
  it("computes staggered non-overlapping floor positions for up to 6 actors", () => {
    const positions = Array.from({ length: 6 }, (_, i) => nextStagePosition(i));
    const unique = new Set(positions.map((p) => p.join(",")));
    expect(unique.size).toBe(6);
    expect(positions[0]).toEqual([0, 0, 0]);
    expect(positions[1][0]).not.toBe(0);
    expect(positions[2][0]).toBe(-positions[1][0]);
  });

  it("serializes multi-actor scene cast cleanly for non-destructive source3d restore", () => {
    const actors: StagedActor[] = [
      {
        id: "actor-1",
        characterId: "char-a",
        name: "Hero",
        modelKey: "builtin:xbot",
        position: [0, 0, 0],
        rotationY: 15,
        pose: { Hips: [0, 10, 0] },
        hipsDrop: 0.05,
        face: DEFAULT_FACE,
        outfit: {},
        props: [],
        vrmExpressions: {},
        visible: true,
        model: null,
        rig: null,
        vrm: null,
        wardrobeAssets: {},
      },
      {
        id: "actor-2",
        characterId: null,
        name: "Rival",
        modelKey: "builtin:xbot",
        position: [0.85, 0, -0.25],
        rotationY: -165,
        pose: { LeftArm: [-40, 0, -70] },
        hipsDrop: 0,
        face: DEFAULT_FACE,
        outfit: {},
        props: [],
        vrmExpressions: {},
        visible: true,
        model: null,
        rig: null,
        vrm: null,
        wardrobeAssets: {},
      },
    ];
    const cast = serializeCastForSnapshot(actors);
    expect(cast).toHaveLength(2);
    expect(cast[0]).toMatchObject({ id: "actor-1", characterId: "char-a", rotationY: 15, hipsDrop: 0.05 });
    expect(cast[1]).toMatchObject({ id: "actor-2", position: [0.85, 0, -0.25], rotationY: -165 });
  });
});

describe("Phase 3 Smart Prop Grip & Custom Prop Helpers", () => {
  it("snaps weapon props cleanly to RightHand or LeftHand with natural finger curl", () => {
    const katana = createActiveProp("katana");
    const rightSnap = snapPropToHand(katana, "RightHand");
    expect(rightSnap.propPatch.attachedBone).toBe("RightHand");
    expect(Object.keys(rightSnap.posePatch).every((b) => b.startsWith("RightHand"))).toBe(true);
    expect(rightSnap.posePatch.RightHandIndex2).toBeDefined();

    const leftSnap = snapPropToHand(katana, "LeftHand");
    expect(leftSnap.propPatch.attachedBone).toBe("LeftHand");
    expect(Object.keys(leftSnap.posePatch).every((b) => b.startsWith("LeftHand"))).toBe(true);
    expect(leftSnap.propPatch.transform?.position[0]).toBe(-rightSnap.propPatch.transform!.position[0]);
  });

  it("supports custom prop fallback grip and handgun trigger pose", () => {
    const gun = createActiveProp("handgun");
    const gunSnap = snapPropToHand(gun, "RightHand");
    expect(gunSnap.posePatch.RightHandIndex1).toEqual([0, 0, 0]);
    expect(gunSnap.posePatch.RightHandMiddle2?.[2]).toBeGreaterThan(0); // mirrored -90 curl

    const custom = createActiveProp("customprop:shield");
    const customSnap = snapPropToHand(custom, "LeftHand");
    expect(customSnap.propPatch.attachedBone).toBe("LeftHand");
    expect(customSnap.posePatch.LeftHandThumb1).toBeDefined();
  });

  it("detects valid 3D prop extensions, updates metadata list, and includes prop files in backup refs", () => {
    expect(detectPropExtension("Shield.GLB")).toBe("glb");
    expect(detectPropExtension("sword.fbx")).toBe("fbx");
    expect(detectPropExtension("vase.obj")).toBe("obj");
    expect(detectPropExtension("notes.txt")).toBeNull();

    const meta: CustomPropMeta = {
      id: "customprop:1",
      name: "Shield",
      fileId: "propfile:1",
      ext: "glb",
      defaultBone: "RightHand",
    };
    const added = upsertCustomPropMeta([], meta);
    expect(added).toHaveLength(1);
    expect(referencedFileIds([], [], added.map((x) => x.fileId))).toContain("propfile:1");
    expect(deleteCustomPropMeta(added, "customprop:1")).toHaveLength(0);
  });
});


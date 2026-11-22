import { beforeEach, describe, expect, it } from "vitest";
import {
  ANGLES_2D,
  CHAR2D_H,
  CHAR2D_W,
  MIRROR_PAIRS_2D,
  createDefaultCharacter2D,
  isBackFacingAngle2D,
  stepAngle2D,
} from "./character2d-types";
import { BUILTIN_MODEL_MALE_ATHLETIC_V1, MODEL1_ANCHORS } from "./character2d-model1";
import { BUILTIN_HEAD_PACKS_2D, DEFAULT_HEAD_SHAPE_ID, resolveHeadPack2D } from "./character2d-heads";
import { resolveEffectiveAnchors } from "./character2d-draw";
import {
  BASE_MODELS_2D_STORAGE_KEY,
  CHAR2D_STORAGE_KEY,
  HEADS_2D_STORAGE_KEY,
  PARTS_2D_STORAGE_KEY,
  ensureCharacters2DInitialized,
  loadCharacters2D,
  loadCustomHeads2D,
  removeCharacter2D,
  resolveBaseModel2D,
  saveCustomBaseModels2D,
  saveCustomHeads2D,
  saveCustomParts2D,
  upsertCharacter2D,
} from "./character2d-store";
import { LEGACY_EXACT_KEYS, setActiveStorageUser } from "./user-storage";

describe("2D Character Creator Studio data model & Model #1", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActiveStorageUser("test-uid-2d");
  });

  it("defines 8 aligned 45-degree turnaround angles and complete Model #1 landmarks", () => {
    expect(CHAR2D_W).toBe(480);
    expect(CHAR2D_H).toBe(1000);
    expect([...ANGLES_2D]).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(MIRROR_PAIRS_2D).toEqual([
      [45, 315],
      [90, 270],
      [135, 225],
    ]);

    for (const angle of ANGLES_2D) {
      expect(BUILTIN_MODEL_MALE_ATHLETIC_V1.frames[angle]).toBe(
        `/characters/male-athletic-v1/angle-${angle}.png`,
      );
      const anchor = MODEL1_ANCHORS[angle];
      expect(anchor).toBeDefined();
      expect(anchor.headCx).toBeGreaterThan(150);
      expect(anchor.headCx).toBeLessThan(330);
      expect(anchor.torsoR).toBeGreaterThan(anchor.torsoL);
      expect(anchor.armLeft).toHaveLength(3);
      expect(anchor.legLeft).toHaveLength(4);
    }
  });

  it("steps rotation angles smoothly and identifies rear-facing views accurately", () => {
    expect(stepAngle2D(0, 1)).toBe(45);
    expect(stepAngle2D(0, -1)).toBe(315);
    expect(stepAngle2D(315, 1)).toBe(0);
    expect(isBackFacingAngle2D(0)).toBe(false);
    expect(isBackFacingAngle2D(90)).toBe(false);
    expect(isBackFacingAngle2D(135)).toBe(true);
    expect(isBackFacingAngle2D(180)).toBe(true);
    expect(isBackFacingAngle2D(225)).toBe(true);
  });

  it("persists 2D characters, custom models, and custom parts per user and registers sync keys", () => {
    expect(LEGACY_EXACT_KEYS).toContain(CHAR2D_STORAGE_KEY);
    expect(LEGACY_EXACT_KEYS).toContain(BASE_MODELS_2D_STORAGE_KEY);
    expect(LEGACY_EXACT_KEYS).toContain(PARTS_2D_STORAGE_KEY);

    const seeded = ensureCharacters2DInitialized();
    expect(seeded).toHaveLength(1);
    const char1 = seeded[0]!;
    expect(char1.baseModelId).toBe("male-athletic-v1");
    expect(char1.renderMode).toBe("color");

    const updatedList = upsertCharacter2D(seeded, {
      ...char1,
      renderMode: "manga",
      angle: 90,
    });
    expect(loadCharacters2D()[0]?.renderMode).toBe("manga");
    expect(loadCharacters2D()[0]?.angle).toBe(90);

    const second = createDefaultCharacter2D("Rival #2");
    const twoChars = upsertCharacter2D(updatedList, second);
    expect(twoChars).toHaveLength(2);
    const afterRemove = removeCharacter2D(twoChars, second.id);
    expect(afterRemove).toHaveLength(1);

    saveCustomBaseModels2D([]);
    saveCustomHeads2D([]);
    saveCustomParts2D([]);
    expect(resolveBaseModel2D("non-existent").id).toBe("male-athletic-v1");
  });

  it("exposes all 8 built-in head+neck packs, adapts neck/jaw landmarks, and supports cross-body fit", () => {
    expect(LEGACY_EXACT_KEYS).toContain(HEADS_2D_STORAGE_KEY);
    expect(BUILTIN_HEAD_PACKS_2D).toHaveLength(8);
    expect(DEFAULT_HEAD_SHAPE_ID).toBe("classic-oval");

    const ids = BUILTIN_HEAD_PACKS_2D.map((h) => h.id);
    expect(ids).toEqual([
      "classic-oval",
      "slim-tapered",
      "soft-oval",
      "round-youthful",
      "angular-chiseled",
      "long-slender",
      "strong-square",
      "sharp-v",
    ]);

    for (const pack of BUILTIN_HEAD_PACKS_2D) {
      expect(pack.builtIn).toBe(true);
      expect(pack.thumbnail).toBe(`/characters/heads/${pack.id}/thumb.webp`);
      for (const angle of ANGLES_2D) {
        expect(pack.overlayFrames[angle]).toBe(`/characters/heads/${pack.id}/angle-${angle}.webp`);
        const expectedBodyVar =
          pack.id === "classic-oval"
            ? `/characters/male-athletic-v1/angle-${angle}.png`
            : `/characters/male-athletic-v1/heads/${pack.id}/angle-${angle}.webp`;
        expect(pack.bodyVariants?.["male-athletic-v1"]?.[angle]).toBe(expectedBodyVar);
        const ha = pack.anchors[angle];
        expect(ha.headRx).toBeGreaterThan(24);
        expect(ha.chinY).toBeGreaterThan(190);
        expect(ha.neckAttachX).toBe(110);
      }
    }

    const baseChar = createDefaultCharacter2D("Head Tester");
    const classicA = resolveEffectiveAnchors(BUILTIN_MODEL_MALE_ATHLETIC_V1, baseChar, 0);
    const squareA = resolveEffectiveAnchors(BUILTIN_MODEL_MALE_ATHLETIC_V1, {
      ...baseChar,
      headShapeId: "strong-square",
    }, 0);
    expect(squareA.neckR - squareA.neckL).toBeGreaterThan(classicA.neckR - classicA.neckL);

    // Cross-body fit transforms head/face positions relative to collarbone pivot
    const raisedFitA = resolveEffectiveAnchors(
      BUILTIN_MODEL_MALE_ATHLETIC_V1,
      { ...baseChar, headShapeId: "sharp-v", headFit: { scale: 1.1, offsetY: -10 } },
      0,
    );
    const defaultFitA = resolveEffectiveAnchors(
      BUILTIN_MODEL_MALE_ATHLETIC_V1,
      { ...baseChar, headShapeId: "sharp-v", headFit: { scale: 1, offsetY: 0 } },
      0,
    );
    expect(raisedFitA.eyeY).toBeLessThan(defaultFitA.eyeY);
    expect(raisedFitA.headRx).toBeGreaterThan(defaultFitA.headRx);

    // Custom head persistence + graceful fallback for missing/legacy headShapeId
    const customHead = {
      ...BUILTIN_HEAD_PACKS_2D[0]!,
      id: "custom-head-test",
      name: "Custom Test Head",
      builtIn: false,
    };
    saveCustomHeads2D([customHead]);
    expect(loadCustomHeads2D()).toHaveLength(1);
    expect(resolveHeadPack2D(undefined, loadCustomHeads2D()).id).toBe("classic-oval");
    expect(resolveHeadPack2D("custom-head-test", loadCustomHeads2D()).name).toBe("Custom Test Head");
    expect(resolveHeadPack2D("unknown-head-id", loadCustomHeads2D()).id).toBe("classic-oval");
  });
});

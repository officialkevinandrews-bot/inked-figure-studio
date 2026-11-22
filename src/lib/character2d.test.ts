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
import {
  BASE_MODELS_2D_STORAGE_KEY,
  CHAR2D_STORAGE_KEY,
  PARTS_2D_STORAGE_KEY,
  ensureCharacters2DInitialized,
  loadCharacters2D,
  removeCharacter2D,
  resolveBaseModel2D,
  saveCustomBaseModels2D,
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
    saveCustomParts2D([]);
    expect(resolveBaseModel2D("non-existent").id).toBe("male-athletic-v1");
  });
});

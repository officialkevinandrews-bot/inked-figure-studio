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
  BUILTIN_HEAD_PACKS_2D,
  DEFAULT_HEAD_SHAPE_ID,
  resolveHeadPack2D,
} from "./character2d-heads";
import { resolveEffectiveAnchors } from "./character2d-draw";
import { processMangaGpenPixels } from "./character2d-slicer";
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
import {
  ILLUSTRATED_FACE_PACKS_2D,
  MODEL1_ART_TEMPLATES_2D,
  resolveIllustratedBottomPack2D,
  resolveIllustratedFacePack2D,
  resolveIllustratedFootwearPack2D,
  resolveIllustratedHairPack2D,
  resolveIllustratedTopPack2D,
} from "./character2d-catalog";

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
    const squareA = resolveEffectiveAnchors(
      BUILTIN_MODEL_MALE_ATHLETIC_V1,
      {
        ...baseChar,
        headShapeId: "strong-square",
      },
      0,
    );
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
    expect(resolveHeadPack2D("custom-head-test", loadCustomHeads2D()).name).toBe(
      "Custom Test Head",
    );
    expect(resolveHeadPack2D("unknown-head-id", loadCustomHeads2D()).id).toBe("classic-oval");
  });

  it("registers illustrated Set 1 defaults, resolves legacy IDs cleanly, and exposes Model #1 art templates", () => {
    const def = createDefaultCharacter2D("Set 1 Tester");
    expect(def.shadingDepth).toBe("cel");
    expect(def.hair.style).toBe("spiky");
    expect(def.clothes.top).toBe("zip_hoodie_tee");
    expect(def.clothes.bottom).toBe("cargo");
    expect(def.clothes.footwear).toBe("sneakers");
    expect(def.face.eyeStyle).toBe("sharp");
    expect(def.face.browStyle).toBe("sharp");
    expect(def.face.noseStyle).toBe("sharp");
    expect(def.face.mouthStyle).toBe("sharp");

    expect(resolveIllustratedHairPack2D("none")).toBeNull();
    expect(resolveIllustratedTopPack2D("none")).toBeNull();
    expect(resolveIllustratedBottomPack2D("none")).toBeNull();
    expect(resolveIllustratedFootwearPack2D("none")).toBeNull();
    expect(resolveIllustratedFacePack2D("none")).toBeNull();

    // Legacy procedural IDs resolve gracefully to illustrated Set 1 packs
    expect(resolveIllustratedHairPack2D("messy")?.id).toBe("spiky");
    expect(resolveIllustratedTopPack2D("hoodie")?.id).toBe("zip_hoodie_tee");
    expect(resolveIllustratedTopPack2D("tshirt")?.id).toBe("zip_hoodie_tee");
    expect(resolveIllustratedBottomPack2D("jeans")?.id).toBe("cargo");
    expect(resolveIllustratedFootwearPack2D("boots")?.id).toBe("sneakers");
    expect(resolveIllustratedFacePack2D("round")?.id).toBe("sharp");

    expect(MODEL1_ART_TEMPLATES_2D).toHaveLength(3);
    for (const tpl of MODEL1_ART_TEMPLATES_2D) {
      expect(tpl.href.startsWith("/characters/templates/")).toBe(true);
      expect(tpl.href.endsWith(".png")).toBe(true);
    }

    const sharpFace = ILLUSTRATED_FACE_PACKS_2D[0]!;
    expect(sharpFace.angles[0]?.eyeLeftBase).toContain("eye-left-base-angle-0.webp");
    expect(sharpFace.angles[0]?.eyeRightBase).toContain("eye-right-base-angle-0.webp");
    expect(sharpFace.angles[45]?.eyeRightBase).toContain("eye-right-base-angle-45.webp");
    expect(sharpFace.angles[90]?.eyeLeftBase).toContain("eye-left-base-angle-90.webp");
    expect(sharpFace.angles[90]?.eyeRightBase).toBeUndefined();
    expect(sharpFace.angles[270]?.browRight).toBeUndefined();
    expect(sharpFace.angles[315]?.mouth).toContain("mouth-angle-315.webp");
  });

  it("extracts closed G-Pen outer contours, rejects 1-sided cel shadows, keeps interior lines & briefs seams, and avoids white halos", () => {
    const w = 64;
    const h = 64;
    const buf = new Uint8ClampedArray(w * h * 4);
    const setPx = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
      const i = (y * w + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    };

    // Draw a bright peach skin rectangle (10..53, 8..55) with NO dark outer border painted in source,
    // a 1-sided cel-shadow plane on the right half (x >= 36), a delicate collarbone valley line at y = 20,
    // solid dark charcoal briefs at y = 38..54, a 1px isolated dust dot at (18, 28), and semi-transparent outer fringe at x = 9.
    for (let y = 8; y <= 55; y++) {
      setPx(9, y, 245, 200, 170, 50); // semi-transparent outer fringe
      for (let x = 10; x <= 53; x++) {
        if (y >= 38) {
          setPx(x, y, 42, 44, 48, 255); // solid dark charcoal briefs
        } else if (x >= 36) {
          setPx(x, y, 215, 172, 146, 255); // broad 1-sided cel shadow
        } else {
          setPx(x, y, 248, 208, 178, 255); // lit peach skin
        }
      }
    }
    // Delicate warm-brown collarbone anatomy stroke (lum ~145) across lit skin
    for (let x = 16; x <= 32; x++) {
      setPx(x, 20, 175, 132, 108, 255);
      setPx(x, 21, 175, 132, 108, 255);
    }
    // Isolated 1px noise speck
    setPx(18, 28, 135, 100, 82, 255);

    processMangaGpenPixels(buf, w, h, { kind: "body", pixelScale: 1 });

    const pxAt = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      return { r: buf[i]!, g: buf[i + 1]!, b: buf[i + 2]!, a: buf[i + 3]! };
    };

    // 1. Exterior stays transparent
    expect(pxAt(2, 2).a).toBe(0);
    // 2. Guaranteed closed jet-black outer contour even though source outer pixels were bright peach
    expect(pxAt(10, 15).r).toBeLessThan(30);
    expect(pxAt(53, 15).r).toBeLessThan(30);
    expect(pxAt(25, 8).r).toBeLessThan(30);
    expect(pxAt(25, 55).r).toBeLessThan(30);
    // 3. Semi-transparent exterior fringe uses pure black ink (zero white halo when stamped on dark panels)
    expect(pxAt(9, 25).r).toBe(0);
    expect(pxAt(9, 25).a).toBeGreaterThan(0);
    // 4. Lit interior & 1-sided cel-shadow boundary stay pure opaque white (#FFFFFF)
    expect(pxAt(22, 14)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(pxAt(36, 14)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(pxAt(42, 14)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    // 5. Delicate bilateral collarbone valley line is preserved cleanly as dark ink
    expect(pxAt(24, 20).r).toBeLessThan(90);
    // 6. Isolated 1px noise speck is pruned to pure white
    expect(pxAt(18, 28)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    // 7. Dark briefs interior turns pure opaque white while waistband boundary gets a continuous black seam
    expect(pxAt(28, 38).r).toBeLessThan(40);
    expect(pxAt(28, 46)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });
});

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
import { mapCollarWarpDstXToSrcX, resolveEffectiveAnchors } from "./character2d-draw";
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
  ACCESSORY_CATALOG_2D,
  ACCESSORY_SLOTS_2D,
  countEquippedAccessories2D,
  getAccessoriesForSlot2D,
  serializeAccessoriesSignature2D,
} from "./character2d-accessories";
import {
  CHARACTER_STYLE_PRESETS_2D,
  ILLUSTRATED_FACE_PACKS_2D,
  ILLUSTRATED_TOP_PACKS_2D,
  MODEL1_ART_TEMPLATES_2D,
  getAvailableStylePresets2D,
  resolveIllustratedBottomPack2D,
  resolveIllustratedFacePack2D,
  resolveIllustratedFacePacks2D,
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

  it("maps bidirectional collar & hood coordinates monotonically with locked shoulders and exact rim alignment", () => {
    const cases: Array<{
      name: string;
      srcL: number;
      srcR: number;
      dL: number;
      dR: number;
      reachL: number;
      reachR: number;
    }> = [
      // Strong Square 0°: wide muscular outward expansion on both sides
      { name: "wide-0", srcL: 220, srcR: 263, dL: -16, dR: 15, reachL: 64, reachR: 64 },
      // Slim neck inward contraction on both sides
      { name: "slim-0", srcL: 220, srcR: 263, dL: 7, dR: -7, reachL: 64, reachR: 64 },
      // 45° shifted nape + wide throat (Strong Square / Sharp V)
      { name: "shift-45", srcL: 203, srcR: 245, dL: 10, dR: 21, reachL: 82, reachR: 64 },
      // 315° extreme left shift (Sharp V / Strong Square)
      { name: "shift-315", srcL: 237, srcR: 279, dL: -24, dR: -18, reachL: 64, reachR: 82 },
    ];

    for (const c of cases) {
      const anchorL = c.srcL - c.reachL;
      const anchorR = c.srcR + c.reachR;

      // 1. Outer shoulders remain 100% locked outside [anchorL, anchorR] and whenever yFac = 0
      expect(
        mapCollarWarpDstXToSrcX(anchorL, 1, c.srcL, c.srcR, c.dL, c.dR, anchorL, anchorR),
      ).toBe(anchorL);
      expect(
        mapCollarWarpDstXToSrcX(anchorL - 12, 1, c.srcL, c.srcR, c.dL, c.dR, anchorL, anchorR),
      ).toBe(anchorL - 12);
      expect(
        mapCollarWarpDstXToSrcX(anchorR, 1, c.srcL, c.srcR, c.dL, c.dR, anchorL, anchorR),
      ).toBe(anchorR);
      expect(
        mapCollarWarpDstXToSrcX(anchorR + 12, 1, c.srcL, c.srcR, c.dL, c.dR, anchorL, anchorR),
      ).toBe(anchorR + 12);
      expect(mapCollarWarpDstXToSrcX(c.srcL, 0, c.srcL, c.srcR, c.dL, c.dR, anchorL, anchorR)).toBe(
        c.srcL,
      );

      // 2. Destination collar rims map back to the exact original collar rims at yFac = 1
      expect(
        mapCollarWarpDstXToSrcX(c.srcL + c.dL, 1, c.srcL, c.srcR, c.dL, c.dR, anchorL, anchorR),
      ).toBeCloseTo(c.srcL, 6);
      expect(
        mapCollarWarpDstXToSrcX(c.srcR + c.dR, 1, c.srcL, c.srcR, c.dL, c.dR, anchorL, anchorR),
      ).toBeCloseTo(c.srcR, 6);

      // 3. Smooth vertical decay at yFac = 0.5 halves the shift
      expect(
        mapCollarWarpDstXToSrcX(
          c.srcL + c.dL * 0.5,
          0.5,
          c.srcL,
          c.srcR,
          c.dL,
          c.dR,
          anchorL,
          anchorR,
        ),
      ).toBeCloseTo(c.srcL, 6);

      // 4. Strictly monotonic across the entire shoulder-to-shoulder span (zero folds or tears)
      let prev = -Infinity;
      for (let x = anchorL; x <= anchorR; x += 1) {
        const sx = mapCollarWarpDstXToSrcX(x, 1, c.srcL, c.srcR, c.dL, c.dR, anchorL, anchorR);
        expect(sx).toBeGreaterThan(prev);
        prev = sx;
      }
    }
  });

  it("resolves Set 2 packs, supports per-feature Sharp/Cool face mix-and-match, and unlocks Set 2 presets", () => {
    // Independent per-feature face pack resolution (mix Shonen Sharp + Cool Narrow + none freely)
    const mixed = resolveIllustratedFacePacks2D({
      eyeStyle: "cool",
      browStyle: "sharp",
      noseStyle: "cool",
      mouthStyle: "none",
    });
    expect(mixed.eyes?.id).toBe("cool");
    expect(mixed.brows?.id).toBe("sharp");
    expect(mixed.nose?.id).toBe("cool");
    expect(mixed.mouth).toBeNull();

    // All 5 Set 2 packs are ready and resolve cleanly
    expect(resolveIllustratedHairPack2D("curtains")?.id).toBe("curtains");
    const blazerPack = resolveIllustratedTopPack2D("blazer");
    expect(blazerPack?.id).toBe("blazer");
    expect(blazerPack?.shortSleeve).toBe(false);
    expect(blazerPack?.openCollar).toBe(true);
    expect(blazerPack?.accentLabel).toBe("Dress Shirt (RGB)");
    expect(blazerPack?.accentMasks?.[0]).toContain("mask-angle-0.webp");
    expect(blazerPack?.accentMasks?.[180]).toContain("mask-angle-180.webp");
    expect(resolveIllustratedBottomPack2D("trousers")?.id).toBe("trousers");
    const loafersPack = resolveIllustratedFootwearPack2D("loafers");
    expect(loafersPack?.id).toBe("loafers");
    expect(loafersPack?.lowCut).toBe(true);
    expect(resolveIllustratedFacePack2D("cool")?.id).toBe("cool");

    const blazerMeta = ILLUSTRATED_TOP_PACKS_2D.find((p) => p.id === "blazer");
    expect(blazerMeta?.ready).toBe(true);

    // Data-driven presets unlock all Set 1 + Set 2 outfits once their packs are ready
    const availablePresets = getAvailableStylePresets2D();
    expect(CHARACTER_STYLE_PRESETS_2D.length).toBeGreaterThanOrEqual(5);
    expect(availablePresets.length).toBe(CHARACTER_STYLE_PRESETS_2D.length);
    expect(availablePresets.some((p) => p.clothes.top === "blazer")).toBe(true);
  });

  it("provides a complete 6-slot modular manga accessories catalog with deterministic cache signatures", () => {
    expect(ACCESSORY_SLOTS_2D).toHaveLength(6);
    expect(ACCESSORY_CATALOG_2D.length).toBeGreaterThanOrEqual(20);
    for (const slot of ACCESSORY_SLOTS_2D) {
      expect(getAccessoriesForSlot2D(slot.id).length).toBeGreaterThanOrEqual(2);
    }

    const equipped = {
      eyewear: { id: "glasses_rect" as const, color: "#18181b", accentColor: "#bae6fd" },
      neck: { id: "necktie" as const, color: "#991b1b", accentColor: "#f8fafc" },
      faceMark: { id: "scar_eye" as const, color: "#b4534a" },
      back: { id: "katana_back" as const, color: "#18181b", accentColor: "#eab308" },
    };
    expect(countEquippedAccessories2D(equipped)).toBe(4);
    expect(countEquippedAccessories2D(undefined)).toBe(0);

    const sig1 = serializeAccessoriesSignature2D(equipped);
    const sig2 = serializeAccessoriesSignature2D({
      ...equipped,
      neck: { id: "scarf", color: "#b91c1c", accentColor: "#f8fafc" },
    });
    expect(sig1).toContain("eyewear:glasses_rect");
    expect(sig1).toContain("neck:necktie");
    expect(sig2).not.toBe(sig1);
  });
});

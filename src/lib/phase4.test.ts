import { describe, it, expect } from "vitest";
import {
  BUILTIN_PROPS,
  getPropById,
  createActiveProp,
  ATTACHABLE_BONES,
} from "./props";
import {
  processMangaFilterImageData,
  DEFAULT_FILTER_OPTIONS,
} from "./photo-filter";

describe("Phase 4: 3D Props & Bone Parenting", () => {
  it("provides built-in anime/manga prop catalog with expected categories", () => {
    expect(BUILTIN_PROPS.length).toBeGreaterThanOrEqual(10);

    const categories = new Set(BUILTIN_PROPS.map((p) => p.category));
    expect(categories.has("weapons")).toBe(true);
    expect(categories.has("items")).toBe(true);
    expect(categories.has("furniture")).toBe(true);
    expect(categories.has("primitives")).toBe(true);

    const katana = getPropById("katana");
    expect(katana).toBeDefined();
    expect(katana?.defaultBone).toBe("RightHand");

    const bag = getPropById("school_bag");
    expect(bag).toBeDefined();
    expect(bag?.defaultBone).toBe("LeftHand");

    const desk = getPropById("classroom_desk");
    expect(desk).toBeDefined();
    expect(desk?.defaultBone).toBe("None");
  });

  it("creates active prop instances with default bone attachments and transforms", () => {
    const prop = createActiveProp("katana");
    expect(prop.id).toMatch(/^prop-/);
    expect(prop.propDefId).toBe("katana");
    expect(prop.name).toBe("Katana");
    expect(prop.attachedBone).toBe("RightHand");
    expect(prop.transform.scale).toEqual([1, 1, 1]);
    expect(prop.visible).toBe(true);
  });

  it("lists attachable standard bones for character rig parenting", () => {
    const boneIds = ATTACHABLE_BONES.map((b) => b.id);
    expect(boneIds).toContain("None");
    expect(boneIds).toContain("RightHand");
    expect(boneIds).toContain("LeftHand");
    expect(boneIds).toContain("Head");
    expect(boneIds).toContain("Spine");
  });

  it("builds valid Three.js mesh objects for procedural props", () => {
    const katanaDef = getPropById("katana");
    expect(katanaDef).toBeDefined();
    const mesh = katanaDef!.buildMesh();
    expect(mesh.children.length).toBeGreaterThan(0);

    const phoneDef = getPropById("smartphone");
    expect(phoneDef).toBeDefined();
    const phoneMesh = phoneDef!.buildMesh();
    expect(phoneMesh.children.length).toBeGreaterThan(0);
  });
});

describe("Phase 4: Photo-to-Manga Inking & Screentone Filter", () => {
  it("processes synthetic image data through Sobel edge detection and screentone", () => {
    // Create a 20x20 test image with a high-contrast vertical edge in the center
    const width = 20;
    const height = 20;
    const input = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        // Left half is black (0), right half is bright white (255)
        const val = x < 10 ? 10 : 250;
        input[idx] = val;
        input[idx + 1] = val;
        input[idx + 2] = val;
        input[idx + 3] = 255;
      }
    }

    const output = processMangaFilterImageData(
      { data: input, width, height },
      DEFAULT_FILTER_OPTIONS
    );

    expect(output.length).toBe(width * height * 4);

    // Pixels at the vertical boundary (x=9 or x=10) should have high edge magnitude and be inked black (0)
    const midIdx = (10 * width + 9) * 4;
    expect(output[midIdx]).toBe(0); // Inked edge line

    // Pixels in pure white right half (e.g. x=18) should be white (255)
    const whiteIdx = (10 * width + 18) * 4;
    expect(output[whiteIdx]).toBe(255);
  });

  it("supports different screentone patterns (crosshatch, lines, posterize)", () => {
    const width = 10;
    const height = 10;
    const input = new Uint8ClampedArray(width * height * 4);
    // Midtone gray image
    for (let i = 0; i < width * height * 4; i += 4) {
      input[i] = 120;
      input[i + 1] = 120;
      input[i + 2] = 120;
      input[i + 3] = 255;
    }

    const dots = processMangaFilterImageData(
      { data: input, width, height },
      { toneStyle: "dots" }
    );
    const crosshatch = processMangaFilterImageData(
      { data: input, width, height },
      { toneStyle: "crosshatch" }
    );
    const posterize = processMangaFilterImageData(
      { data: input, width, height },
      { toneStyle: "posterize" }
    );

    expect(dots.length).toBe(width * height * 4);
    expect(crosshatch.length).toBe(width * height * 4);
    expect(posterize.length).toBe(width * height * 4);
  });
});


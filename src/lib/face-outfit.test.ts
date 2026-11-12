import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { BROW_MORPH, EYE_MORPH, MOUTH_MORPH, PART_IDS, TEMPLATE_BOXES, alphaBounds, clampBox, knockOutPaper, mouthWarpOffset, removePack, upsertPack, type FacePack } from "./face-parts";
import { BROW_STATES, EYE_STATES, MOUTH_STATES } from "./face-library";
import { classifyIsland, subsetGeometry, triangleIslands, type IslandStats } from "./outfit-extract";

describe("face slicer", () => {
  it("has six template parts that fit inside the 1024 sheet and don't overlap", () => {
    expect(PART_IDS).toHaveLength(6);
    const bs = PART_IDS.map((id) => TEMPLATE_BOXES[id]);
    for (const b of bs) expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= 1024 && b.y + b.h <= 1024).toBe(true);
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i]!, b = bs[j]!;
      expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
    }
  });
  it("trims a part to its ink", () => {
    const w = 20, d = new Uint8ClampedArray(w * w * 4);
    for (const [x, y] of [[5, 6], [9, 11]]) d[(y! * w + x!) * 4 + 3] = 255;
    expect(alphaBounds(d, w, { x: 0, y: 0, w, h: w })).toEqual({ x: 5, y: 6, w: 5, h: 6 });
    expect(alphaBounds(d, w, { x: 12, y: 12, w: 8, h: 8 })).toBeNull();
  });
  it("removes white paper from opaque uploads but keeps ink", () => {
    const d = new Uint8ClampedArray([255, 255, 255, 255, 10, 10, 10, 255]);
    expect(knockOutPaper(d)).toBe(true);
    expect(d[3]).toBe(0); expect(d[7]).toBe(255);
  });
  it("keeps moved boxes on the sheet", () => {
    expect(clampBox({ x: 1000, y: -5, w: 100, h: 50 })).toEqual({ x: 924, y: 0, w: 100, h: 50 });
  });
  it("has a morph for every eye, brow and mouth expression state", () => {
    expect(Object.keys(EYE_MORPH).sort()).toEqual(Object.keys(EYE_STATES).sort());
    expect(Object.keys(BROW_MORPH).sort()).toEqual(Object.keys(BROW_STATES).sort());
    expect(Object.keys(MOUTH_MORPH).sort()).toEqual(Object.keys(MOUTH_STATES).sort());
  });
  it("bends a smile's corners up and leaves neutral untouched", () => {
    expect(mouthWarpOffset(MOUTH_MORPH.smile, 1)).toBeLessThan(mouthWarpOffset(MOUTH_MORPH.smile, 0));
    expect(mouthWarpOffset(MOUTH_MORPH.neutral, 0.7)).toBe(0);
  });
  it("adds, replaces and deletes packs in the library", () => {
    const p: FacePack = { id: "a", name: "A", created: 1, parts: {} };
    let lib = upsertPack([], p); lib = upsertPack(lib, { ...p, name: "B" });
    expect(lib).toHaveLength(1); expect(lib[0]!.name).toBe("B");
    expect(removePack(lib, "a")).toHaveLength(0);
  });
});

describe("outfit extractor", () => {
  const stats = (r: Partial<IslandStats["regions"]>, minY: number, maxY: number): IslandStats => ({
    tris: 100, minY, maxY, modelMinY: 0, modelHeight: 1.8,
    regions: { head: 0, neck: 0, torso: 0, arms: 0, hands: 0, hips: 0, legs: 0, feet: 0, ...r },
  });
  it("finds separate pieces in one mesh", () => {
    const a = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(); const b = a.clone().translate(5, 0, 0);
    const pos = new Float32Array([...(a.attributes["position"]!.array as Float32Array), ...(b.attributes["position"]!.array as Float32Array)]);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    expect(triangleIslands(g).count).toBe(2);
  });
  it("suggests slots from the bones a piece follows", () => {
    expect(classifyIsland(stats({ head: 50 }, 1.6, 1.8), false)).toBe("hair");
    expect(classifyIsland(stats({ torso: 40, arms: 30 }, 0.9, 1.5), false)).toBe("top");
    expect(classifyIsland(stats({ legs: 60, hips: 20 }, 0.1, 1.0), false)).toBe("bottom");
    expect(classifyIsland(stats({ feet: 40 }, 0, 0.12), false)).toBe("shoes");
    expect(classifyIsland(stats({ hands: 40 }, 0.8, 1.0), false)).toBe("hands");
    expect(classifyIsland(stats({ head: 20, torso: 50, legs: 40, feet: 10 }, 0, 1.8), true)).toBe("body");
  });
  it("copies only the chosen triangles", () => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const sub = subsetGeometry(g, [0, 1]);
    expect(sub.getIndex()!.count).toBe(6);
    expect(sub.getAttribute("position").count).toBe(4);
  });
});

import { describe, it, expect } from "vitest";
import { GRID_TEMPLATES, mergeRectPanels, polygonArea } from "./manga-grid";

describe("extended template library", () => {
  it("has at least 3x the original 45 templates", () => {
    expect(GRID_TEMPLATES.length).toBeGreaterThanOrEqual(135);
  });
  it("is mostly 5-6 panel pages", () => {
    const n = GRID_TEMPLATES.filter((t) => [5, 6].includes(t.build().length)).length;
    expect(n).toBeGreaterThanOrEqual(120);
  });
  it("ids are unique and every non-floating page tiles fully", () => {
    expect(new Set(GRID_TEMPLATES.map((t) => t.id)).size).toBe(GRID_TEMPLATES.length);
    for (const t of GRID_TEMPLATES.filter((g) => g.id.startsWith("st-") || g.id.startsWith("wr-"))) {
      const area = t.build().reduce((s, p) => s + Math.abs(polygonArea(p.points)), 0);
      expect(area).toBeCloseTo(1, 3);
    }
  });
});

describe("mergeRectPanels", () => {
  const r = (x0: number, y0: number, x1: number, y1: number) => ({ id: "x", points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] }) as any;
  it("merges side-by-side panels", () => {
    expect(mergeRectPanels(r(0, 0, 0.5, 1), r(0.5, 0, 1, 1))).toHaveLength(4);
  });
  it("refuses panels that don't form a rectangle", () => {
    expect(mergeRectPanels(r(0, 0, 0.5, 0.5), r(0.5, 0, 1, 1))).toBeNull();
  });
});

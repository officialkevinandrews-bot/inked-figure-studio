import { describe, it, expect } from "vitest";
import { GRID_TEMPLATES, insetPanelPoints, knifeCut, cutPolygon, moveSharedVertex, readingOrder, polygonArea, mirrorPanels } from "./manga-grid";
import { toneTile } from "./screentone";
import { generateBalloonPath } from "./manga-effects";

describe("manga grid", () => {
  it("ships at least 40 templates with unique ids", () => {
    expect(GRID_TEMPLATES.length).toBeGreaterThanOrEqual(40);
    expect(new Set(GRID_TEMPLATES.map((t) => t.id)).size).toBe(GRID_TEMPLATES.length);
  });

  it("non-webtoon grid templates tile the whole page", () => {
    for (const t of GRID_TEMPLATES.filter((g) => g.category !== "webtoon")) {
      const area = t.build().filter((p) => !p.floating).reduce((s, p) => s + Math.abs(polygonArea(p.points)), 0);
      expect(area, t.id).toBeCloseTo(1, 3);
    }
  });

  it("leaves exactly one column gutter and one tier gutter between neighbours", () => {
    const left = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 }];
    const right = [{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 0.5 }];
    const below = [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const L = insetPanelPoints(left, 840, 1240, 20, 10, 24);
    const R = insetPanelPoints(right, 840, 1240, 20, 10, 24);
    const B = insetPanelPoints(below, 840, 1240, 20, 10, 24);
    expect(R[0].x - L[1].x).toBeCloseTo(10);
    expect(B[0].y - L[3].y).toBeCloseTo(24);
    expect(L[0]).toEqual({ x: 20, y: 20 }); // page edges stay on the margin
  });

  it("bleed pushes page-edge sides past the trim", () => {
    const pts = insetPanelPoints([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], 800, 1200, 30, 10, 10, { bleed: true });
    expect(pts[0].x).toBeLessThan(0);
    expect(pts[2].y).toBeGreaterThan(1200);
  });

  it("knife stroke slices only the panels it crosses", () => {
    const panels = GRID_TEMPLATES.find((t) => t.id === "2-vert")!.build();
    const { panels: out, cut } = knifeCut(panels, { x: -0.1, y: 0.2 }, { x: 1.1, y: 0.3 });
    expect(cut).toEqual(["p1"]);
    expect(out).toHaveLength(3);
  });

  it("diagonal cut preserves area", () => {
    const sq = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const [a, b] = cutPolygon(sq, { x: 0, y: 0.3 }, { x: 1, y: 0.7 })!;
    expect(Math.abs(polygonArea(a)) + Math.abs(polygonArea(b))).toBeCloseTo(1);
  });

  it("moving a shared corner moves it in every panel", () => {
    const panels = GRID_TEMPLATES.find((t) => t.id === "c-4grid")!.build();
    const out = moveSharedVertex(panels, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.4 });
    expect(out.filter((p) => p.points.some((q) => q.x === 0.6 && q.y === 0.4))).toHaveLength(4);
  });

  it("reads manga right-to-left and comics left-to-right", () => {
    const panels = GRID_TEMPLATES.find((t) => t.id === "c-4grid")!.build(); // p1 TL, p2 TR, p3 BL, p4 BR
    expect(readingOrder(panels, true)).toEqual(["p2", "p1", "p4", "p3"]);
    expect(readingOrder(panels, false)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(readingOrder(mirrorPanels(panels), true)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("denser screentones draw bigger dots", () => {
    const r = (d: number) => Number(/r="([\d.]+)"/.exec(toneTile({ kind: "dots", density: d, cell: 6, angle: 45, color: "#000", fade: "none" }).body)![1]);
    expect(r(0.6)).toBeGreaterThan(r(0.1));
  });

  it("every balloon shape produces a path", () => {
    for (const s of ["oval", "rounded", "scream", "wavy", "flash", "icy", "burst", "cloud"] as const) {
      expect(generateBalloonPath(s, 200, 120, 0, 80, true).length).toBeGreaterThan(20);
    }
  });
});

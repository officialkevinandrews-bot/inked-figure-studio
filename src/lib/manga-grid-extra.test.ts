import { describe, it, expect, beforeEach } from "vitest";
import {
  GRID_TEMPLATES,
  buildTemplate,
  findSharedDividers,
  mergeCandidates,
  mergeRectPanels,
  moveDivider,
  polygonArea,
  splitPanelGrid,
} from "./manga-grid";
import { PAGE_FORMATS, swapPanelContents, type PageLayout, type PanelPolygon } from "./manga-layout";
import { addCustomTemplate, loadCustomTemplates, removeCustomTemplate, saveCustomTemplates } from "./custom-templates";

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

describe("mergeRectPanels & mergeCandidates", () => {
  const r = (x0: number, y0: number, x1: number, y1: number, id = "x"): PanelPolygon => ({
    id,
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    borderWidth: 3,
    borderColor: "#000",
    borderStyle: "solid",
    backgroundColor: "#fff",
  });

  it("merges side-by-side panels", () => {
    expect(mergeRectPanels(r(0, 0, 0.5, 1), r(0.5, 0, 1, 1))).toHaveLength(4);
  });

  it("refuses panels that don't form a rectangle", () => {
    expect(mergeRectPanels(r(0, 0, 0.5, 0.5), r(0.5, 0, 1, 1))).toBeNull();
  });

  it("detects valid directional merge neighbors cleanly", () => {
    const panels = [
      r(0, 0, 0.5, 0.5, "tl"),
      r(0.5, 0, 1, 0.5, "tr"),
      r(0, 0.5, 0.5, 1, "bl"),
      r(0.5, 0.5, 1, 1, "br"),
    ];
    const cands = mergeCandidates(panels[0], panels);
    expect(cands.map((c) => `${c.direction}:${c.neighborId}`).sort()).toEqual(["down:bl", "right:tr"]);
  });
});

describe("draggable dividers, grid split & panel content swap", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("extracts staggered dividers on Reference Stagger (wr-kitchen) and slides independently with clamping", () => {
    const panels = buildTemplate("wr-kitchen")!;
    expect(panels).toHaveLength(5);

    const divs = findSharedDividers(panels);
    expect(divs.length).toBe(4);

    // Horizontal top banner divider (y=0.35 across full width)
    const topDiv = divs.find((d) => d.axis === "h" && Math.abs(d.a.y - 0.35) < 0.01)!;
    expect(topDiv).toBeDefined();
    expect(topDiv.panelIds.length).toBe(3);

    const { panels: movedTop } = moveDivider(panels, topDiv, 0.05, { disableSnap: true });
    expect(Math.max(...movedTop[0].points.map((p) => p.y))).toBeCloseTo(0.4, 3);
    expect(Math.min(...movedTop[1].points.map((p) => p.y))).toBeCloseTo(0.4, 3);
    expect(Math.min(...movedTop[2].points.map((p) => p.y))).toBeCloseTo(0.4, 3);

    // Left staggered sub-divider (y=0.72) moves without affecting right column (y=0.60)
    const leftDiv = divs.find((d) => d.axis === "h" && Math.abs(d.a.y - 0.72) < 0.01)!;
    expect(leftDiv).toBeDefined();
    const { panels: movedLeft } = moveDivider(panels, leftDiv, -0.1, { disableSnap: true });
    expect(Math.max(...movedLeft[1].points.map((p) => p.y))).toBeCloseTo(0.62, 3);
    expect(Math.max(...movedLeft[2].points.map((p) => p.y))).toBeCloseTo(0.6, 3);

    // Sliding past opposite boundary clamps safely so no panel vanishes
    const { panels: clamped } = moveDivider(panels, leftDiv, 0.9, { disableSnap: true });
    for (const p of clamped) {
      expect(Math.abs(polygonArea(p.points))).toBeGreaterThan(0.003);
    }
  });

  it("splits a single panel into an N x M sub-grid covering exact bounds", () => {
    const panels = buildTemplate("1-splash")!;
    const grid = splitPanelGrid(panels[0], 2, 2);
    expect(grid).toHaveLength(4);
    const total = grid.reduce((s, p) => s + Math.abs(polygonArea(p.points)), 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("swaps panel backgrounds and child items cleanly between panels", () => {
    const panels = buildTemplate("2-vert")!;
    const layout: PageLayout = {
      id: "pg",
      pageNumber: 1,
      format: PAGE_FORMATS[0],
      panels: panels.map((p, i) => ({ ...p, backgroundColor: i === 0 ? "#111111" : "#ffffff" })),
      elements: [
        {
          id: "e1",
          panelId: panels[0].id,
          type: "character",
          imageUrl: "x.png",
          x: 100,
          y: 100,
          width: 120,
          height: 180,
          rotation: 0,
          flipX: false,
          flipY: false,
          zIndex: 5,
          breakout: false,
        },
      ],
      balloons: [],
      sfxStamps: [],
      comicMarks: [],
      speedLines: [],
    };
    const swapped = swapPanelContents(layout, panels[0].id, panels[1].id);
    expect(swapped.panels[0].backgroundColor).toBe("#ffffff");
    expect(swapped.panels[1].backgroundColor).toBe("#111111");
    expect(swapped.elements[0].panelId).toBe(panels[1].id);
    expect(swapped.elements[0].y).toBeGreaterThan(layout.elements[0].y);
  });

  it("saves, loads, and removes custom layout templates", () => {
    const saved = addCustomTemplate([], "My Kitchen Grid", buildTemplate("wr-kitchen")!);
    expect(saveCustomTemplates(saved)).toBe(true);
    expect(loadCustomTemplates()).toHaveLength(1);
    expect(loadCustomTemplates()[0].label).toBe("My Kitchen Grid");

    const afterDel = removeCustomTemplate(loadCustomTemplates(), saved[0].id);
    expect(afterDel).toHaveLength(0);
  });
});

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
import {
  PAGE_FORMATS,
  PAGE_LAYER_ID,
  applyManualElementPatch,
  panelBounds,
  swapPanelContents,
  syncPanelBoundElements,
  type PageLayout,
  type PanelPolygon,
  type PlacedElement,
} from "./manga-layout";
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

describe("panel-bound backgrounds & whole-page elements", () => {
  it("syncs fitMode fill-panel backgrounds to new panel bounds after moveDivider while leaving free & whole-page elements untouched", () => {
    const panels = buildTemplate("wr-kitchen")!;
    const format = PAGE_FORMATS[0];
    const p0 = panelBounds(panels[0], format);

    const boundBg: PlacedElement = {
      id: "bg-1",
      panelId: panels[0].id,
      type: "background",
      imageUrl: "bg.png",
      x: p0.minX,
      y: p0.minY,
      width: p0.width,
      height: p0.height,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 1,
      breakout: false,
      fitMode: "fill-panel",
    };
    const freeChar: PlacedElement = {
      id: "ch-1",
      panelId: panels[0].id,
      type: "character",
      imageUrl: "ch.png",
      x: p0.minX + 10,
      y: p0.minY + 10,
      width: 90,
      height: 140,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 5,
      breakout: false,
      fitMode: "free",
    };
    const wholePage: PlacedElement = {
      id: "wp-1",
      panelId: PAGE_LAYER_ID,
      type: "background",
      imageUrl: "page-bg.png",
      x: 50,
      y: 60,
      width: 512,
      height: 384,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 2,
      breakout: false,
      fitMode: "free",
      pageLayer: { kind: "behind" },
    };

    const dividers = findSharedDividers(panels);
    const horizontalDiv = dividers.find((d) => d.axis === "h" && Math.abs(d.a.y - 0.35) < 0.01)!;
    const { panels: movedPanels } = moveDivider(panels, horizontalDiv, 0.1, { disableSnap: true });
    const synced = syncPanelBoundElements({
      id: "p-sync",
      pageNumber: 1,
      format,
      panels: movedPanels,
      elements: [boundBg, freeChar, wholePage],
      balloons: [],
      sfxStamps: [],
      comicMarks: [],
      speedLines: [],
    });

    const newP0 = panelBounds(movedPanels[0], format);
    const syncedBg = synced.elements.find((e) => e.id === "bg-1")!;
    const syncedChar = synced.elements.find((e) => e.id === "ch-1")!;
    const syncedPage = synced.elements.find((e) => e.id === "wp-1")!;

    expect(syncedBg.x).toBe(Math.round(newP0.minX));
    expect(syncedBg.y).toBe(Math.round(newP0.minY));
    expect(syncedBg.width).toBe(Math.round(newP0.width));
    expect(syncedBg.height).toBe(Math.round(newP0.height));
    expect(syncedBg.height).not.toBeCloseTo(p0.height, 1);
    expect(syncedChar.x).toBe(freeChar.x);
    expect(syncedChar.width).toBe(90);
    expect(syncedPage.panelId).toBe(PAGE_LAYER_ID);
    expect(syncedPage.width).toBe(512);
    expect(syncedPage.height).toBe(384);
  });

  it("preserves PAGE_LAYER_ID elements across splitPanelGrid rehoming and swaps bound backgrounds cleanly in swapPanelContents", () => {
    const panels = buildTemplate("2-vert")!;
    const format = PAGE_FORMATS[0];
    const p0 = panelBounds(panels[0], format);
    const p1 = panelBounds(panels[1], format);

    const boundBg0: PlacedElement = {
      id: "bg-swap",
      panelId: panels[0].id,
      type: "background",
      imageUrl: "bg0.png",
      x: p0.minX,
      y: p0.minY,
      width: p0.width,
      height: p0.height,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 1,
      breakout: false,
      fitMode: "fill-panel",
    };
    const wholePage: PlacedElement = {
      id: "wp-keep",
      panelId: PAGE_LAYER_ID,
      type: "background",
      imageUrl: "whole.png",
      x: 25,
      y: 35,
      width: 400,
      height: 300,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 2,
      breakout: false,
      pageLayer: { kind: "above-panel", panelId: panels[0].id },
    };

    const layout: PageLayout = {
      id: "p-swap",
      pageNumber: 1,
      format,
      panels,
      elements: [boundBg0, wholePage],
      balloons: [],
      sfxStamps: [],
      comicMarks: [],
      speedLines: [],
    };

    const swapped = swapPanelContents(layout, panels[0].id, panels[1].id);
    const swappedBg = swapped.elements.find((e) => e.id === "bg-swap")!;
    const keptWhole = swapped.elements.find((e) => e.id === "wp-keep")!;

    expect(swappedBg.panelId).toBe(panels[1].id);
    expect(swappedBg.width).toBeCloseTo(p1.width, 3);
    expect(swappedBg.height).toBeCloseTo(p1.height, 3);
    expect(swappedBg.x).toBeCloseTo(p1.minX, 3);
    expect(swappedBg.y).toBeCloseTo(p1.minY, 3);
    expect(keptWhole.panelId).toBe(PAGE_LAYER_ID);
    expect(keptWhole.width).toBe(400);

    // Split panel 0 into a 2x1 sub-grid and ensure PAGE_LAYER_ID survives syncPanelBoundElements
    const subPanels = splitPanelGrid(panels[0], 2, 1);
    expect(subPanels).toHaveLength(2);
    const splitPanels = [...subPanels, ...panels.slice(1)];
    const afterSplit = syncPanelBoundElements({ ...swapped, panels: splitPanels });
    const wholeAfterSplit = afterSplit.elements.find((e) => e.id === "wp-keep")!;
    expect(wholeAfterSplit.panelId).toBe(PAGE_LAYER_ID);
    expect(wholeAfterSplit.x).toBe(25);
    expect(wholeAfterSplit.height).toBe(300);
  });

  it("releases fill-panel lock on breakout or manual resize and scopes syncPanelBoundElements to targeted panel only", () => {
    const panels = buildTemplate("2-vert")!;
    const format = PAGE_FORMATS[0];
    const p0 = panelBounds(panels[0], format);

    const bg0: PlacedElement = {
      id: "bg-p0",
      panelId: panels[0].id,
      type: "background",
      imageUrl: "bg0.png",
      x: Math.round(p0.minX),
      y: Math.round(p0.minY),
      width: Math.round(p0.width),
      height: Math.round(p0.height),
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 1,
      breakout: false,
      fitMode: "fill-panel",
    };
    const bg1: PlacedElement = {
      id: "bg-p1",
      panelId: panels[1].id,
      type: "background",
      imageUrl: "bg1.png",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 1,
      breakout: false,
      fitMode: "fill-panel",
    };

    // Enabling breakout or manually resizing releases fill-panel lock on bg0 only
    const popped = applyManualElementPatch(bg0, { breakout: true });
    expect(popped.fitMode).toBe("free");
    const resized = applyManualElementPatch(popped, { width: 520, height: 610 });
    expect(resized.fitMode).toBe("free");
    expect(resized.width).toBe(520);

    // Syncing only Panel 2 never alters Panel 1's image even if format or other panel changed
    const synced = syncPanelBoundElements(
      {
        id: "p-iso",
        pageNumber: 1,
        format,
        panels,
        elements: [resized, bg1],
        balloons: [],
        sfxStamps: [],
        comicMarks: [],
        speedLines: [],
      },
      [panels[1].id],
    );
    const untouched0 = synced.elements.find((e) => e.id === "bg-p0")!;
    const updated1 = synced.elements.find((e) => e.id === "bg-p1")!;
    expect(untouched0.width).toBe(520);
    expect(untouched0.height).toBe(610);
    expect(updated1.width).toBeGreaterThan(100);
  });
});

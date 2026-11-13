import { describe, expect, it } from "vitest";
import {
  getPresetPanels,
  getPanelPixelBounds,
  splitPanel,
  PAGE_FORMATS,
  type PanelPolygon,
} from "./manga-layout";

describe("Phase 2: Manga Layout & Templates", () => {
  it("generates correct panel counts for manga templates", () => {
    expect(getPresetPanels("1-splash").length).toBe(1);
    expect(getPresetPanels("2-vert").length).toBe(2);
    expect(getPresetPanels("4-koma").length).toBe(4);
    expect(getPresetPanels("action-5").length).toBe(5);
    expect(getPresetPanels("classic-6").length).toBe(6);
  });

  it("calculates panel pixel bounds respecting page margins and gutters", () => {
    const format = PAGE_FORMATS[0]; // Tankobon 800x1200, margin 32, gutter 16
    const panels = getPresetPanels("1-splash");
    const bounds = getPanelPixelBounds(
      panels[0],
      format.width,
      format.height,
      format.margin,
      format.gutter
    );

    expect(bounds.minX).toBe(format.margin); // page edges sit on the margin; gutters only between panels
    expect(bounds.minY).toBe(format.margin);
    expect(bounds.width).toBeGreaterThan(600);
    expect(bounds.height).toBeGreaterThan(1000);
  });
});

describe("Phase 2: Interactive Knife Split Tool", () => {
  const panel: PanelPolygon = {
    id: "test-p1",
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    borderWidth: 3,
    borderColor: "#000000",
    borderStyle: "solid",
    backgroundColor: "#ffffff",
  };

  it("splits a panel horizontally into two half-panels", () => {
    const [top, bottom] = splitPanel(panel, "horizontal", 0.5);
    expect(top.id).toBe("test-p1_top");
    expect(bottom.id).toBe("test-p1_bot");

    expect(top.points[2].y).toBe(0.5);
    expect(bottom.points[0].y).toBe(0.5);
  });

  it("splits a panel vertically into two side-by-side panels", () => {
    const [left, right] = splitPanel(panel, "vertical", 0.5);
    expect(left.id).toBe("test-p1_left");
    expect(right.id).toBe("test-p1_right");

    expect(left.points[1].x).toBe(0.5);
    expect(right.points[0].x).toBe(0.5);
  });

  it("cuts a dynamic diagonal action slash across a panel", () => {
    const [p1, p2] = splitPanel(panel, "diagonal");
    expect(p1.id).toBe("test-p1_diag1");
    expect(p2.id).toBe("test-p1_diag2");
    expect(p1.points.length).toBe(4);
    expect(p2.points.length).toBe(4);
  });
});


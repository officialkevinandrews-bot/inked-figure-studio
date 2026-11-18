import { beforeEach, describe, expect, it } from "vitest";
import {
  arrowHeadPolygon,
  lineDashArray,
  lineSegmentsForStyle,
  snapLineAngle,
  taperedNibPolygon,
} from "./drawn-lines";
import { buildTemplate } from "./manga-grid";
import {
  PAGE_FORMATS,
  PAGE_LAYER_ID,
  loadPanelOverlapPreference,
  panelBounds,
  panelPointsForTargetRect,
  savePanelOverlapPreference,
  transformPanelWithContents,
  type PageLayout,
} from "./manga-layout";

describe("Panel Move/Resize + Contained Scaling & Straight-Line Pen", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults panel overlap preference to float above and persists permanent toggle", () => {
    expect(loadPanelOverlapPreference()).toBe("float");
    savePanelOverlapPreference("keep");
    expect(loadPanelOverlapPreference()).toBe("keep");
  });

  it("moves & resizes a panel and proportionally transforms every contained item without touching other panels", () => {
    const panels = buildTemplate("2-vert")!;
    const format = PAGE_FORMATS[0];
    const p0 = panels[0];
    const p1 = panels[1];
    const box0 = panelBounds(p0, format);

    const layout: PageLayout = {
      id: "page-tx",
      pageNumber: 1,
      format,
      panels,
      elements: [
        {
          id: "char-0",
          panelId: p0.id,
          type: "character",
          imageUrl: "c0.png",
          x: box0.minX + 20,
          y: box0.minY + 30,
          width: 100,
          height: 160,
          rotation: 0,
          flipX: false,
          flipY: false,
          zIndex: 5,
          breakout: false,
          fitMode: "free",
        },
        {
          id: "char-1",
          panelId: p1.id,
          type: "character",
          imageUrl: "c1.png",
          x: 500,
          y: 200,
          width: 80,
          height: 120,
          rotation: 0,
          flipX: false,
          flipY: false,
          zIndex: 5,
          breakout: false,
          fitMode: "free",
        },
        {
          id: "page-bg",
          panelId: PAGE_LAYER_ID,
          type: "background",
          imageUrl: "bg.png",
          x: 0,
          y: 0,
          width: 300,
          height: 200,
          rotation: 0,
          flipX: false,
          flipY: false,
          zIndex: 1,
          breakout: false,
          pageLayer: { kind: "behind" },
        },
      ],
      balloons: [
        {
          id: "b-0",
          panelId: p0.id,
          shape: "oval",
          text: "Hey!",
          x: box0.minX + 40,
          y: box0.minY + 20,
          width: 120,
          height: 70,
          hasTail: true,
          tail: { x: 60, y: 95 },
          fontSize: 16,
          backgroundColor: "#ffffff",
          zIndex: 20,
        },
      ],
      comicMarks: [
        {
          id: "m-0",
          panelId: p0.id,
          type: "💢",
          markType: "anger",
          x: box0.minX + 50,
          y: box0.minY + 40,
          size: 40,
          rotation: 0,
          zIndex: 30,
        },
      ],
      sfxStamps: [
        {
          id: "sfx-0",
          panelId: p0.id,
          text: "BAM!",
          x: box0.minX + 60,
          y: box0.minY + 80,
          fontSize: 32,
          fillColor: "#ffffff",
          strokeColor: "#000000",
          strokeWidth: 4,
          rotation: 0,
          skewX: 0,
          zIndex: 35,
        },
      ],
      speedLines: [
        {
          id: "sp-0",
          panelId: p0.id,
          type: "radial",
          centerX: box0.minX + box0.width / 2,
          centerY: box0.minY + box0.height / 2,
          angle: 0,
          density: 40,
          innerRadius: 40,
          outerRadius: 120,
          strokeWidth: 2,
          color: "#000000",
          zIndex: 10,
        },
      ],
      drawnLines: [
        {
          id: "ln-0",
          panelId: p0.id,
          x1: box0.minX + 10,
          y1: box0.minY + 10,
          x2: box0.minX + 110,
          y2: box0.minY + 60,
          color: p0.borderColor,
          matchPanelBorder: true,
          width: 3,
          style: "dotted",
          zIndex: 25,
        },
      ],
    };

    const targetRect = {
      x: box0.minX + 40,
      y: box0.minY + 50,
      width: box0.width * 1.5,
      height: box0.height * 0.5,
    };
    const nextPts = panelPointsForTargetRect(p0, targetRect, format, true);
    const updated = transformPanelWithContents(layout, p0.id, nextPts, { forceFloating: true });

    const movedPanel = updated.panels.find((p) => p.id === p0.id)!;
    expect(movedPanel.floating).toBe(true);
    const newBox0 = panelBounds(movedPanel, format);
    expect(newBox0.minX).toBeCloseTo(targetRect.x, 1);
    expect(newBox0.width).toBeCloseTo(targetRect.width, 1);
    expect(newBox0.height).toBeCloseTo(targetRect.height, 1);

    const movedChar = updated.elements.find((e) => e.id === "char-0")!;
    expect(movedChar.x).toBeCloseTo(newBox0.minX + 20 * 1.5, 1);
    expect(movedChar.y).toBeCloseTo(newBox0.minY + 30 * 0.5, 1);
    expect(movedChar.width).toBeCloseTo(150, 1);
    expect(movedChar.height).toBeCloseTo(80, 1);

    const movedBalloon = updated.balloons!.find((b) => b.id === "b-0")!;
    expect(movedBalloon.width).toBeCloseTo(180, 1);
    expect(movedBalloon.height).toBeCloseTo(35, 1);
    expect(movedBalloon.tail?.x).toBeCloseTo(90, 1);

    const movedLine = updated.drawnLines!.find((l) => l.id === "ln-0")!;
    expect(movedLine.x1).toBeCloseTo(newBox0.minX + 15, 1);
    expect(movedLine.x2).toBeCloseTo(newBox0.minX + 165, 1);

    // Other panels and page-layer assets are completely untouched
    const untouchedChar = updated.elements.find((e) => e.id === "char-1")!;
    expect(untouchedChar.x).toBe(500);
    expect(untouchedChar.width).toBe(80);
    const untouchedPageBg = updated.elements.find((e) => e.id === "page-bg")!;
    expect(untouchedPageBg.width).toBe(300);
  });

  it("computes straight-line geometry variants cleanly (angle snap, dashed/dotted, double, arrows, tapered)", () => {
    const snapped = snapLineAngle({ x: 100, y: 100 }, { x: 200, y: 112 });
    expect(snapped.y).toBeCloseTo(100, 1);

    const snappedDiag = snapLineAngle({ x: 0, y: 0 }, { x: 100, y: 95 });
    expect(snappedDiag.x).toBeCloseTo(snappedDiag.y, 1);

    expect(lineDashArray("solid", 4)).toBeUndefined();
    expect(lineDashArray("dashed", 4)).toEqual([Math.max(6, 4 * 2.6), Math.max(4, 4 * 1.6)]);
    expect(lineDashArray("dotted", 4)).toHaveLength(2);

    const doubled = lineSegmentsForStyle({ x1: 0, y1: 50, x2: 100, y2: 50, width: 4, style: "double" });
    expect(doubled).toHaveLength(2);
    expect(doubled[0].y1).not.toBe(doubled[1].y1);

    expect(arrowHeadPolygon(100, 100, 0, 100, 4)).toHaveLength(3);
    expect(taperedNibPolygon({ x1: 0, y1: 0, x2: 100, y2: 0, width: 6 })).toHaveLength(5);
  });
});

import { describe, expect, it } from "vitest";
import { extractPanelsFromRgba } from "./template-image-extractor";

function createCanvasBuffer(w: number, h: number, bg = [255, 255, 255]): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = bg[0];
    buf[i * 4 + 1] = bg[1];
    buf[i * 4 + 2] = bg[2];
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

function drawThickSegment(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color = [0, 0, 0],
  thickness = 3,
) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
  const r = Math.floor(thickness / 2);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(x0 + (x1 - x0) * t);
    const cy = Math.round(y0 + (y1 - y0) * t);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const idx = (py * w + px) * 4;
        buf[idx] = color[0];
        buf[idx + 1] = color[1];
        buf[idx + 2] = color[2];
      }
    }
  }
}

function drawPolygonOutline(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  pts: Array<[number, number]>,
  color = [0, 0, 0],
  thickness = 3,
) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    drawThickSegment(buf, w, h, a[0], a[1], b[0], b[1], color, thickness);
  }
}

describe("template-image-extractor", () => {
  it("extracts 3 stacked rectangular panels cleanly", () => {
    const w = 240;
    const h = 360;
    const buf = createCanvasBuffer(w, h);
    drawPolygonOutline(buf, w, h, [
      [18, 16],
      [222, 16],
      [222, 166],
      [18, 166],
    ]);
    drawPolygonOutline(buf, w, h, [
      [18, 174],
      [222, 174],
      [222, 250],
      [18, 250],
    ]);
    drawPolygonOutline(buf, w, h, [
      [18, 258],
      [222, 258],
      [222, 344],
      [18, 344],
    ]);

    const res = extractPanelsFromRgba(buf, w, h);
    expect(res.panels).toHaveLength(3);
    expect(res.droppedOuterFrame).toBe(false);
    // Top panel should be taller than middle panel
    const topYs = res.panels[0].points.map((p) => p.y);
    const midYs = res.panels[1].points.map((p) => p.y);
    expect(Math.max(...topYs) - Math.min(...topYs)).toBeGreaterThan(
      Math.max(...midYs) - Math.min(...midYs),
    );
  });

  it("ignores thin outer page frame and preserves slanted panels (Image 1 pattern)", () => {
    const w = 240;
    const h = 360;
    const buf = createCanvasBuffer(w, h);

    // Outer thin page border around all 3 panels
    drawPolygonOutline(
      buf,
      w,
      h,
      [
        [8, 10],
        [232, 10],
        [232, 350],
        [8, 350],
      ],
      [20, 20, 20],
      2,
    );

    // Top narrow vertical panel with diagonal bottom edge
    drawPolygonOutline(buf, w, h, [
      [88, 24],
      [152, 24],
      [152, 138],
      [88, 160],
    ]);
    // Middle slanted trapezoid
    drawPolygonOutline(buf, w, h, [
      [42, 180],
      [220, 120],
      [192, 248],
      [20, 248],
    ]);
    // Bottom wide rectangle
    drawPolygonOutline(buf, w, h, [
      [18, 258],
      [222, 258],
      [222, 338],
      [18, 338],
    ]);

    const res = extractPanelsFromRgba(buf, w, h);
    expect(res.droppedOuterFrame).toBe(true);
    expect(res.panels).toHaveLength(3);

    // Verify middle panel kept a noticeably slanted top edge
    const middlePts = res.panels[1].points;
    const topSortedY = [...middlePts].sort((a, b) => a.y - b.y);
    expect(Math.abs(topSortedY[0].y - topSortedY[1].y)).toBeGreaterThan(0.05);
  });

  it("strips dark gray screenshot margins, ignores light-gray label text, and orders 2x2 Manga RTL", () => {
    const w = 300;
    const h = 300;
    // Gray outer padding outside [40..260]
    const buf = createCanvasBuffer(w, h, [110, 110, 110]);
    for (let y = 12; y <= 288; y++) {
      for (let x = 44; x <= 256; x++) {
        const i = (y * w + x) * 4;
        buf[i] = 255;
        buf[i + 1] = 255;
        buf[i + 2] = 255;
      }
    }

    // Draw 4 dark boxes inside white sheet
    const boxes: Array<[number, number, number, number]> = [
      [58, 26, 146, 146],
      [154, 26, 242, 146],
      [58, 154, 146, 274],
      [154, 154, 242, 274],
    ];
    for (const [x0, y0, x1, y1] of boxes) {
      drawPolygonOutline(buf, w, h, [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ]);
      // Simulate light-gray placeholder watermark text inside box (luminance ~180)
      drawThickSegment(buf, w, h, x0 + 18, (y0 + y1) / 2, x1 - 18, (y0 + y1) / 2, [180, 180, 180], 4);
    }

    const rtlRes = extractPanelsFromRgba(buf, w, h, { readingDirection: "rtl" });
    expect(rtlRes.panels).toHaveLength(4);
    // Panel 1 (top-right) should have larger centroid X than Panel 2 (top-left)
    const cx = (idx: number) =>
      rtlRes.panels[idx].points.reduce((s, p) => s + p.x, 0) / rtlRes.panels[idx].points.length;
    expect(cx(0)).toBeGreaterThan(cx(1));
    expect(cx(2)).toBeGreaterThan(cx(3));

    const ltrRes = extractPanelsFromRgba(buf, w, h, { readingDirection: "ltr" });
    const lcx = (idx: number) =>
      ltrRes.panels[idx].points.reduce((s, p) => s + p.x, 0) / ltrRes.panels[idx].points.length;
    expect(lcx(0)).toBeLessThan(lcx(1));
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  buildPanelSvgPath,
  computeSnapPosition,
  tracePanelCanvasPath,
} from "./panel-geometry";
import {
  balloonPathFromSpec,
  generateSpeedWedges,
  type SpeechBalloon,
  type SpeedLinesEffect,
} from "./manga-effects";

const rectPts = [
  { x: 20, y: 20 },
  { x: 220, y: 20 },
  { x: 220, y: 180 },
  { x: 20, y: 180 },
];

describe("Phase 4 panel geometry & smart snapping", () => {
  it("builds sharp, rounded-corner, and scalloped SVG panel paths", () => {
    const sharp = buildPanelSvgPath(rectPts, 0, false);
    expect(sharp.startsWith("M 20.00 20.00")).toBe(true);
    expect(sharp.includes("Q ")).toBe(false);
    expect(sharp.endsWith("Z")).toBe(true);

    const rounded = buildPanelSvgPath(rectPts, 16, false);
    const qMatches = rounded.match(/\bQ /g) ?? [];
    expect(qMatches).toHaveLength(4);
    expect(rounded.endsWith("Z")).toBe(true);

    const scalloped = buildPanelSvgPath(rectPts, 0, true);
    const scallopQ = scalloped.match(/\bQ /g) ?? [];
    expect(scallopQ.length).toBeGreaterThanOrEqual(8);
    expect(scalloped.endsWith("Z")).toBe(true);
  });

  it("traces identical Canvas 2D path calls for rounded & scalloped panels", () => {
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    tracePanelCanvasPath(ctx, rectPts, 14, false);
    expect(ctx.beginPath).toHaveBeenCalledTimes(1);
    expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(4);
    expect(ctx.closePath).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    tracePanelCanvasPath(ctx, rectPts, 0, true);
    expect(ctx.beginPath).toHaveBeenCalledTimes(1);
    expect((ctx.quadraticCurveTo as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(ctx.closePath).toHaveBeenCalledTimes(1);
  });

  it("snaps dragged elements to panel centers and sibling edges with guides", () => {
    const panels = [{ minX: 40, minY: 40, width: 300, height: 200 }]; // center x=190, y=140
    const siblings = [{ x: 400, y: 80, width: 60, height: 60 }];

    // Near center X (190) and top edge (40)
    const snapped = computeSnapPosition(
      { x: 143, y: 42, width: 100, height: 80 }, // center x = 193 (within 6px of 190), top = 42 (within 6px of 40)
      panels,
      siblings,
      6,
    );
    expect(snapped.x).toBe(140); // centered on 190 -> 190 - 50
    expect(snapped.y).toBe(40);
    expect(snapped.guides).toEqual([
      { orientation: "v", pos: 190 },
      { orientation: "h", pos: 40 },
    ]);

    // Far away -> no snap
    const free = computeSnapPosition({ x: 250, y: 310, width: 50, height: 50 }, panels, siblings, 6);
    expect(free.x).toBe(250);
    expect(free.y).toBe(310);
    expect(free.guides).toHaveLength(0);
  });
});

describe("Phase 4 tapered focus lines & curved/dual speech tails", () => {
  it("generates deterministic tapered radial triangles and linear diamond wedges", () => {
    const radialSpec: SpeedLinesEffect = {
      id: "sp-1",
      panelId: "p-1",
      type: "radial",
      centerX: 200,
      centerY: 200,
      innerRadius: 60,
      outerRadius: 300,
      density: 24,
      strokeWidth: 2,
      angle: 0,
      color: "#000000",
      zIndex: 40,
    };

    const run1 = generateSpeedWedges(radialSpec);
    const run2 = generateSpeedWedges(radialSpec);
    expect(run1).toHaveLength(24);
    expect(run1).toEqual(run2);
    expect(run1.every((poly) => poly.length === 3)).toBe(true);

    const linearSpec: SpeedLinesEffect = {
      ...radialSpec,
      type: "linear",
      density: 16,
      angle: 35,
    };
    const linear = generateSpeedWedges(linearSpec);
    expect(linear).toHaveLength(16);
    expect(linear.every((poly) => poly.length === 4)).toBe(true);
  });

  it("builds curved bezier tails and secondary group tails on speech balloons", () => {
    const baseBalloon: SpeechBalloon = {
      id: "b-1",
      panelId: "p-1",
      shape: "oval",
      text: "Wait up!",
      x: 100,
      y: 100,
      width: 180,
      height: 110,
      fontSize: 16,
      backgroundColor: "#ffffff",
      zIndex: 50,
      hasTail: true,
      tailX: 40,
      tailY: 90,
      tailCurved: true,
      tailCurveX: 60,
      tailCurveY: 45,
      hasSecondaryTail: true,
      secondaryTail: { x: -55, y: 85, curved: false },
    };

    const dualCurvedPath = balloonPathFromSpec(baseBalloon);
    expect(dualCurvedPath).toContain("Q 150 100");
    // Primary + secondary tail each start with their own M subpath after body Z
    const mCount = (dualCurvedPath.match(/\bM /g) ?? []).length;
    expect(mCount).toBe(3);

    const straightSingle = balloonPathFromSpec({
      ...baseBalloon,
      tailCurved: false,
      hasSecondaryTail: false,
    });
    expect(straightSingle).not.toContain("Q 150 100");
    expect((straightSingle.match(/\bM /g) ?? []).length).toBe(2);
  });
});


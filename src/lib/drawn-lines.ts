import type { Point } from "./manga-layout";

export type LineStyleVariant = "solid" | "dashed" | "dotted" | "double";
export type LineCapStyle = "none" | "arrow" | "both" | "tapered";

export interface DrawnLine {
  id: string;
  panelId: string; // panel ID if drawn while a panel was selected, or PAGE_LAYER_ID
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  matchPanelBorder?: boolean;
  width: number;
  style: LineStyleVariant;
  cap?: LineCapStyle;
  opacity?: number;
  layer?: "above" | "behind";
  zIndex: number;
}

export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Snaps end point cleanly to 0°, 45°, 90°, 135°, 180° increments relative to start point. */
export function snapLineAngle(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return b;
  const step = Math.PI / 4; // 45 deg
  const snapped = Math.round(Math.atan2(dy, dx) / step) * step;
  return {
    x: a.x + Math.cos(snapped) * len,
    y: a.y + Math.sin(snapped) * len,
  };
}

/** Returns SVG/Canvas stroke dash pattern for the chosen line variation. */
export function lineDashArray(style: LineStyleVariant, width: number): number[] | undefined {
  if (style === "dashed") {
    return [Math.max(6, width * 2.6), Math.max(4, width * 1.6)];
  }
  if (style === "dotted") {
    return [0.01, Math.max(5, width * 2.2)];
  }
  return undefined;
}

/** Returns center line, or 2 parallel offset lines for `double` line style. */
export function lineSegmentsForStyle(line: Pick<DrawnLine, "x1" | "y1" | "x2" | "y2" | "width" | "style">): LineSegment[] {
  if (line.style !== "double") {
    return [{ x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 }];
  }
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy) || 1;
  const offset = Math.max(2, line.width * 0.9);
  const nx = (-dy / len) * offset;
  const ny = (dx / len) * offset;
  return [
    { x1: line.x1 + nx, y1: line.y1 + ny, x2: line.x2 + nx, y2: line.y2 + ny },
    { x1: line.x1 - nx, y1: line.y1 - ny, x2: line.x2 - nx, y2: line.y2 - ny },
  ];
}

/** Computes crisp triangular arrowhead vertices pointing from `from` into `tip`. */
export function arrowHeadPolygon(
  tipX: number,
  tipY: number,
  fromX: number,
  fromY: number,
  width: number,
): Point[] {
  const dx = tipX - fromX;
  const dy = tipY - fromY;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [];
  const ux = dx / len;
  const uy = dy / len;
  const headLen = Math.max(10, width * 3.4);
  const halfW = Math.max(5, width * 1.65);
  const baseX = tipX - ux * headLen;
  const baseY = tipY - uy * headLen;
  const px = -uy * halfW;
  const py = ux * halfW;
  return [
    { x: tipX, y: tipY },
    { x: baseX + px, y: baseY + py },
    { x: baseX - px, y: baseY - py },
  ];
}

/** Computes a comic ink-nib tapered stroke polygon from start width tapering to needle tip. */
export function taperedNibPolygon(line: Pick<DrawnLine, "x1" | "y1" | "x2" | "y2" | "width">): Point[] {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return [];
  const nx = -dy / len;
  const ny = dx / len;
  const rStart = Math.max(1.5, line.width * 0.65);
  const midX = line.x1 + dx * 0.45;
  const midY = line.y1 + dy * 0.45;
  const rMid = Math.max(0.8, line.width * 0.38);
  return [
    { x: line.x1 + nx * rStart, y: line.y1 + ny * rStart },
    { x: midX + nx * rMid, y: midY + ny * rMid },
    { x: line.x2, y: line.y2 },
    { x: midX - nx * rMid, y: midY - ny * rMid },
    { x: line.x1 - nx * rStart, y: line.y1 - ny * rStart },
  ];
}

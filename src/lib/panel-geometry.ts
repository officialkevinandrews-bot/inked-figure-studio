import type { Point } from "./manga-layout";

export interface SnapGuide {
  orientation: "v" | "h";
  pos: number;
}

export interface SnapBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Computes signed 2x area (positive = clockwise in screen Y-down coords). */
function signedArea2(pts: Point[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** Builds an SVG path string supporting rounded corners and scalloped memory panel borders. */
export function buildPanelSvgPath(
  pts: Point[],
  cornerRadius = 0,
  scalloped = false,
): string {
  if (pts.length < 3) return "";

  if (scalloped) {
    const orient = signedArea2(pts) >= 0 ? 1 : -1;
    const cmds: string[] = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) {
        cmds.push(`L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`);
        continue;
      }
      const steps = Math.max(2, Math.round(len / 24));
      // Outward normal in screen Y-down coords for CW winding is (dy/len, -dx/len)
      const nx = (dy / len) * orient;
      const ny = (-dx / len) * orient;
      const bulge = Math.min(9, len / (steps * 2.2));
      for (let s = 0; s < steps; s++) {
        const tMid = (s + 0.5) / steps;
        const tEnd = (s + 1) / steps;
        const cx = a.x + dx * tMid + nx * bulge;
        const cy = a.y + dy * tMid + ny * bulge;
        const ex = a.x + dx * tEnd;
        const ey = a.y + dy * tEnd;
        cmds.push(`Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}`);
      }
    }
    cmds.push("Z");
    return cmds.join(" ");
  }

  if (cornerRadius > 0.5) {
    const cmds: string[] = [];
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const cur = pts[i];
      const next = pts[(i + 1) % pts.length];
      const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      const d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
      const r = Math.min(cornerRadius, d1 * 0.45, d2 * 0.45);
      const ux1 = d1 > 0 ? (prev.x - cur.x) / d1 : 0;
      const uy1 = d1 > 0 ? (prev.y - cur.y) / d1 : 0;
      const ux2 = d2 > 0 ? (next.x - cur.x) / d2 : 0;
      const uy2 = d2 > 0 ? (next.y - cur.y) / d2 : 0;
      const inX = cur.x + ux1 * r;
      const inY = cur.y + uy1 * r;
      const outX = cur.x + ux2 * r;
      const outY = cur.y + uy2 * r;
      cmds.push(i === 0 ? `M ${inX.toFixed(2)} ${inY.toFixed(2)}` : `L ${inX.toFixed(2)} ${inY.toFixed(2)}`);
      cmds.push(`Q ${cur.x.toFixed(2)} ${cur.y.toFixed(2)} ${outX.toFixed(2)} ${outY.toFixed(2)}`);
    }
    cmds.push("Z");
    return cmds.join(" ");
  }

  return (
    pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(" ") +
    " Z"
  );
}

/** Traces identical panel geometry onto a Canvas 2D context for crisp export parity. */
export function tracePanelCanvasPath(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  cornerRadius = 0,
  scalloped = false,
): void {
  if (pts.length < 3) return;
  ctx.beginPath();

  if (scalloped) {
    const orient = signedArea2(pts) >= 0 ? 1 : -1;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) {
        ctx.lineTo(b.x, b.y);
        continue;
      }
      const steps = Math.max(2, Math.round(len / 24));
      const nx = (dy / len) * orient;
      const ny = (-dx / len) * orient;
      const bulge = Math.min(9, len / (steps * 2.2));
      for (let s = 0; s < steps; s++) {
        const tMid = (s + 0.5) / steps;
        const tEnd = (s + 1) / steps;
        ctx.quadraticCurveTo(
          a.x + dx * tMid + nx * bulge,
          a.y + dy * tMid + ny * bulge,
          a.x + dx * tEnd,
          a.y + dy * tEnd,
        );
      }
    }
    ctx.closePath();
    return;
  }

  if (cornerRadius > 0.5) {
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const cur = pts[i];
      const next = pts[(i + 1) % pts.length];
      const d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      const d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
      const r = Math.min(cornerRadius, d1 * 0.45, d2 * 0.45);
      const ux1 = d1 > 0 ? (prev.x - cur.x) / d1 : 0;
      const uy1 = d1 > 0 ? (prev.y - cur.y) / d1 : 0;
      const ux2 = d2 > 0 ? (next.x - cur.x) / d2 : 0;
      const uy2 = d2 > 0 ? (next.y - cur.y) / d2 : 0;
      const inX = cur.x + ux1 * r;
      const inY = cur.y + uy1 * r;
      const outX = cur.x + ux2 * r;
      const outY = cur.y + uy2 * r;
      if (i === 0) ctx.moveTo(inX, inY);
      else ctx.lineTo(inX, inY);
      ctx.quadraticCurveTo(cur.x, cur.y, outX, outY);
    }
    ctx.closePath();
    return;
  }

  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Snaps a dragged box to panel centers/edges and sibling boxes within threshold px. */
export function computeSnapPosition(
  box: SnapBox,
  panelBoundsList: { minX: number; minY: number; width: number; height: number }[],
  siblings: SnapBox[],
  threshold = 6,
): { x: number; y: number; guides: SnapGuide[] } {
  const xTargets: number[] = [];
  const yTargets: number[] = [];

  for (const b of panelBoundsList) {
    xTargets.push(b.minX, b.minX + b.width / 2, b.minX + b.width);
    yTargets.push(b.minY, b.minY + b.height / 2, b.minY + b.height);
  }
  for (const s of siblings) {
    xTargets.push(s.x, s.x + s.width / 2, s.x + s.width);
    yTargets.push(s.y, s.y + s.height / 2, s.y + s.height);
  }

  let bestDx = threshold + 1;
  let snapX = box.x;
  let guideX: number | null = null;
  const selfXs = [
    { offset: 0, val: box.x },
    { offset: box.width / 2, val: box.x + box.width / 2 },
    { offset: box.width, val: box.x + box.width },
  ];
  for (const t of xTargets) {
    for (const sx of selfXs) {
      const d = Math.abs(t - sx.val);
      if (d <= threshold && d < bestDx) {
        bestDx = d;
        snapX = t - sx.offset;
        guideX = t;
      }
    }
  }

  let bestDy = threshold + 1;
  let snapY = box.y;
  let guideY: number | null = null;
  const selfYs = [
    { offset: 0, val: box.y },
    { offset: box.height / 2, val: box.y + box.height / 2 },
    { offset: box.height, val: box.y + box.height },
  ];
  for (const t of yTargets) {
    for (const sy of selfYs) {
      const d = Math.abs(t - sy.val);
      if (d <= threshold && d < bestDy) {
        bestDy = d;
        snapY = t - sy.offset;
        guideY = t;
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (guideX !== null) guides.push({ orientation: "v", pos: guideX });
  if (guideY !== null) guides.push({ orientation: "h", pos: guideY });
  return { x: Math.round(snapX), y: Math.round(snapY), guides };
}


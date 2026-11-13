/**
 * Manga page geometry: gutter-aware panel insetting, free knife cuts, shared
 * vertex editing, reading order and a large catalogue of grid templates.
 * All panel points are normalised 0..1 over the page's printable area.
 */
import type { PanelPolygon, Point } from "./manga-layout";

const EPS = 1e-4;
const snap = (v: number) => {
  const r = Math.round(v * 1e6) / 1e6;
  if (Math.abs(r) < 1e-5) return 0;
  if (Math.abs(r - 1) < 1e-5) return 1;
  return r;
};

function onPageEdge(a: Point, b: Point) {
  return (
    (Math.abs(a.x) < EPS && Math.abs(b.x) < EPS) ||
    (Math.abs(a.x - 1) < EPS && Math.abs(b.x - 1) < EPS) ||
    (Math.abs(a.y) < EPS && Math.abs(b.y) < EPS) ||
    (Math.abs(a.y - 1) < EPS && Math.abs(b.y - 1) < EPS)
  );
}

export function polygonArea(pts: Point[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function centroid(pts: Point[]): Point {
  const n = pts.length || 1;
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
}

export interface InsetOptions {
  bleed?: boolean;
  floating?: boolean;
}

/**
 * Maps a normalised panel to page pixels and pulls each inner edge inward by
 * half the gutter (gutterX for near-vertical edges, gutterY for near-horizontal),
 * so neighbouring panels end up exactly one gutter apart even on diagonals.
 * Page-edge sides stay on the margin, or push past the trim when bled.
 */
export function insetPanelPoints(
  norm: Point[],
  W: number,
  H: number,
  margin: number,
  gutterX: number,
  gutterY: number,
  opts: InsetOptions = {},
): Point[] {
  const pw = W - margin * 2;
  const ph = H - margin * 2;
  const pts = norm.map((p) => ({ x: margin + p.x * pw, y: margin + p.y * ph }));
  const n = pts.length;
  if (n < 3) return pts;
  const sign = polygonArea(pts) >= 0 ? 1 : -1;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (sign * -dy) / len;
    const ny = (sign * dx) / len;
    let d: number;
    if (onPageEdge(norm[i], norm[(i + 1) % n])) d = opts.bleed ? -(margin + 8) : 0;
    else if (opts.floating) d = 0;
    else d = Math.abs(dx) >= Math.abs(dy) ? gutterY / 2 : gutterX / 2;
    return { px: p.x + nx * d, py: p.y + ny * d, dx: dx / len, dy: dy / len, d, nx, ny };
  });
  const maxD = Math.max(8, ...lines.map((l) => Math.abs(l.d))) * 4;
  return pts.map((p, i) => {
    const A = lines[(i - 1 + n) % n];
    const B = lines[i];
    const cross = A.dx * B.dy - A.dy * B.dx;
    const fallback = { x: p.x + (A.nx * A.d + B.nx * B.d) / 2, y: p.y + (A.ny * A.d + B.ny * B.d) / 2 };
    if (Math.abs(cross) < 1e-6) return fallback;
    const t = ((B.px - A.px) * B.dy - (B.py - A.py) * B.dx) / cross;
    const x = A.px + A.dx * t;
    const y = A.py + A.dy * t;
    if (Math.hypot(x - p.x, y - p.y) > maxD) return fallback;
    return { x, y };
  });
}

/** Splits a polygon by the infinite line through a→b. Returns null when the line misses it. */
export function cutPolygon(pts: Point[], a: Point, b: Point): [Point[], Point[]] | null {
  const side = (p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const left: Point[] = [];
  const right: Point[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const sp = side(p);
    const sq = side(q);
    if (sp >= -1e-9) left.push(p);
    if (sp <= 1e-9) right.push(p);
    if ((sp > 1e-9 && sq < -1e-9) || (sp < -1e-9 && sq > 1e-9)) {
      const t = sp / (sp - sq);
      const x = { x: snap(p.x + (q.x - p.x) * t), y: snap(p.y + (q.y - p.y) * t) };
      left.push(x);
      right.push({ ...x });
    }
  }
  if (left.length < 3 || right.length < 3) return null;
  if (Math.abs(polygonArea(left)) < 2e-4 || Math.abs(polygonArea(right)) < 2e-4) return null;
  return [left, right];
}

function segIntersects(a: Point, b: Point, c: Point, d: Point) {
  const o = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

export function pointInPolygon(p: Point, pts: Point[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

let cutSeq = 0;
/**
 * Knife stroke a→b (normalised). Every panel the stroke touches is sliced right
 * through; a stroke drawn wholly inside one panel slices that panel.
 */
export function knifeCut(panels: PanelPolygon[], a: Point, b: Point): { panels: PanelPolygon[]; cut: string[] } {
  if (Math.hypot(b.x - a.x, b.y - a.y) < 0.01) return { panels, cut: [] };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const cut: string[] = [];
  const out = panels.flatMap((p) => {
    const touches =
      p.points.some((pt, i) => segIntersects(a, b, pt, p.points[(i + 1) % p.points.length])) ||
      pointInPolygon(mid, p.points);
    if (!touches) return [p];
    const res = cutPolygon(p.points, a, b);
    if (!res) return [p];
    cut.push(p.id);
    const s = ++cutSeq;
    return [
      { ...p, id: `${p.id}-${s}a`, points: res[0] },
      { ...p, id: `${p.id}-${s}b`, points: res[1] },
    ];
  });
  return { panels: out, cut };
}

/** Cut one panel through its centre at an angle (0° = horizontal) and ratio along the perpendicular. */
export function angledSplit(panel: PanelPolygon, angleDeg: number, ratio = 0.5): [PanelPolygon, PanelPolygon] | null {
  const xs = panel.points.map((p) => p.x);
  const ys = panel.points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const r = (angleDeg * Math.PI) / 180;
  const dir = { x: Math.cos(r), y: Math.sin(r) };
  const nrm = { x: -dir.y, y: dir.x };
  // project corners on normal to place the line at `ratio`
  const proj = panel.points.map((p) => p.x * nrm.x + p.y * nrm.y);
  const lo = Math.min(...proj), hi = Math.max(...proj);
  const off = lo + (hi - lo) * ratio;
  const c = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const cOff = c.x * nrm.x + c.y * nrm.y;
  const base = { x: c.x + nrm.x * (off - cOff), y: c.y + nrm.y * (off - cOff) };
  const res = cutPolygon(panel.points, base, { x: base.x + dir.x, y: base.y + dir.y });
  if (!res) return null;
  const s = ++cutSeq;
  return [
    { ...panel, id: `${panel.id}-${s}a`, points: res[0] },
    { ...panel, id: `${panel.id}-${s}b`, points: res[1] },
  ];
}

/** Moves a vertex and every coincident vertex in other panels so the grid stays joined. */
export function moveSharedVertex(panels: PanelPolygon[], from: Point, to: Point): PanelPolygon[] {
  const t = { x: snap(Math.min(1, Math.max(0, to.x))), y: snap(Math.min(1, Math.max(0, to.y))) };
  return panels.map((p) => {
    let changed = false;
    const pts = p.points.map((pt) => {
      if (Math.abs(pt.x - from.x) < 2e-3 && Math.abs(pt.y - from.y) < 2e-3) {
        changed = true;
        return { ...t };
      }
      return pt;
    });
    return changed ? { ...p, points: pts } : p;
  });
}

/** Mirror the page horizontally (switch between right-to-left manga and left-to-right comics). */
export function mirrorPanels(panels: PanelPolygon[]): PanelPolygon[] {
  return panels.map((p) => ({ ...p, points: p.points.map((pt) => ({ x: snap(1 - pt.x), y: pt.y })).reverse() }));
}

/** Reading order: tiers top→bottom, then right→left (manga) or left→right (comic). */
export function readingOrder(panels: PanelPolygon[], rtl = true): string[] {
  const items = panels.map((p) => {
    const ys = p.points.map((q) => q.y);
    return { id: p.id, c: centroid(p.points), top: Math.min(...ys), bot: Math.max(...ys), floating: !!p.floating };
  });
  const base = items.filter((i) => !i.floating).sort((a, b) => a.c.y - b.c.y);
  const rows: (typeof items)[] = [];
  for (const it of base) {
    const row = rows[rows.length - 1];
    if (row && it.top < Math.min(...row.map((r) => r.bot)) - 0.02 && it.c.y < Math.max(...row.map((r) => r.bot))) row.push(it);
    else rows.push([it]);
  }
  const order = rows.flatMap((r) => r.sort((a, b) => (rtl ? b.c.x - a.c.x : a.c.x - b.c.x)).map((i) => i.id));
  return [...order, ...items.filter((i) => i.floating).map((i) => i.id)];
}

// ───────────────────────── Templates ─────────────────────────

export type TemplateCategory = "classic" | "action" | "shojo" | "cinematic" | "splash" | "koma" | "webtoon";

export const TEMPLATE_CATEGORIES: { id: TemplateCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "classic", label: "Classic" },
  { id: "action", label: "Action" },
  { id: "shojo", label: "Shojo / Drama" },
  { id: "cinematic", label: "Cinematic" },
  { id: "splash", label: "Splash" },
  { id: "koma", label: "4-Koma / Gag" },
  { id: "webtoon", label: "Webtoon" },
];

export interface GridTemplate {
  id: string;
  label: string;
  category: TemplateCategory;
  description: string;
  build: () => PanelPolygon[];
}

type Extra = Partial<PanelPolygon>;
const mk = (points: Point[], extra: Extra = {}, i = 0): PanelPolygon => ({
  id: `p${i + 1}`,
  points: points.map((p) => ({ x: snap(p.x), y: snap(p.y) })),
  borderWidth: 3,
  borderColor: "#000000",
  borderStyle: "solid",
  backgroundColor: "#ffffff",
  ...extra,
});
const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

interface Tier { h: number; cols?: number[]; slant?: number; skew?: number; extra?: Extra; colExtra?: (Extra | undefined)[] }

/** Builds rows of panels. `slant` tilts the tier's bottom edge, `skew` tilts its column dividers. */
function tiers(spec: Tier[]): { pts: Point[]; extra: Extra }[] {
  const total = spec.reduce((s, t) => s + t.h, 0);
  let acc = 0;
  let top = { l: 0, r: 0 };
  const out: { pts: Point[]; extra: Extra }[] = [];
  spec.forEach((t, ti) => {
    acc += t.h / total;
    const last = ti === spec.length - 1;
    const s = t.slant ?? 0;
    const bot = last ? { l: 1, r: 1 } : { l: acc + s, r: acc - s };
    const cols = t.cols ?? [1];
    const cs = cols.reduce((a, b) => a + b, 0);
    const xs = [0];
    cols.forEach((c) => xs.push(xs[xs.length - 1] + c / cs));
    xs[xs.length - 1] = 1;
    const sk = t.skew ?? 0;
    const xt = xs.map((x, i) => (i === 0 || i === xs.length - 1 ? x : x + sk));
    const xb = xs.map((x, i) => (i === 0 || i === xs.length - 1 ? x : x - sk));
    const yAt = (ln: { l: number; r: number }, x: number) => ln.l + (ln.r - ln.l) * x;
    for (let j = 0; j < cols.length; j++) {
      out.push({
        pts: [
          { x: xt[j], y: yAt(top, xt[j]) },
          { x: xt[j + 1], y: yAt(top, xt[j + 1]) },
          { x: xb[j + 1], y: yAt(bot, xb[j + 1]) },
          { x: xb[j], y: yAt(bot, xb[j]) },
        ],
        extra: { ...(t.extra ?? {}), ...(t.colExtra?.[j] ?? {}) },
      });
    }
    top = bot;
  });
  return out;
}

const fromTiers = (spec: Tier[], more: { pts: Point[]; extra?: Extra }[] = []) => () =>
  [...tiers(spec), ...more].map((p, i) => mk(p.pts, p.extra ?? {}, i));
const fromRects = (rs: ([number, number, number, number] | [number, number, number, number, Extra])[]) => () =>
  rs.map((r, i) => mk(rect(r[0], r[1], r[2], r[3]), (r[4] as Extra) ?? {}, i));
const FLOAT: Extra = { floating: true, borderWidth: 3.5 };
const OPEN: Extra = { borderStyle: "none", borderWidth: 0 };
const BLEED: Extra = { bleed: true };

function shatter(): PanelPolygon[] {
  const c = { x: 0.56, y: 0.44 };
  const ring: Point[] = [
    { x: 0, y: 0 }, { x: 0.38, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.3 }, { x: 1, y: 0.72 },
    { x: 1, y: 1 }, { x: 0.62, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0.58 },
  ];
  const cuts = [1, 3, 4, 6, 8];
  const shards: Point[][] = [];
  for (let k = 0; k < cuts.length; k++) {
    const a = cuts[k];
    const b = cuts[(k + 1) % cuts.length];
    const pts: Point[] = [c];
    let i = a;
    pts.push(ring[i]);
    while (i !== b) { i = (i + 1) % ring.length; pts.push(ring[i]); }
    shards.push(pts);
  }
  return shards.map((s, i) => mk(s, {}, i));
}

export const GRID_TEMPLATES: GridTemplate[] = [
  // Classic
  { id: "classic-6", label: "Classic 6", category: "classic", description: "Standard shonen chapter grid", build: fromTiers([{ h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }]) },
  { id: "c-4grid", label: "Even 4", category: "classic", description: "Simple 2×2 conversation grid", build: fromTiers([{ h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }]) },
  { id: "c-9grid", label: "Nine Grid", category: "classic", description: "Tight 3×3 rhythm page", build: fromTiers([{ h: 1, cols: [1, 1, 1] }, { h: 1, cols: [1, 1, 1] }, { h: 1, cols: [1, 1, 1] }]) },
  { id: "c-establish", label: "Establishing 5", category: "classic", description: "Wide scene-setter then beats", build: fromTiers([{ h: 1.4 }, { h: 1, cols: [1, 1] }, { h: 1, cols: [2, 1] }]) },
  { id: "c-dialogue7", label: "Dialogue 7", category: "classic", description: "Back-and-forth talk scene", build: fromTiers([{ h: 1, cols: [1, 1] }, { h: 1, cols: [2, 1] }, { h: 1, cols: [1, 1, 1] }]) },
  { id: "c-mixed8", label: "Mixed 8", category: "classic", description: "Four tiers with varied widths", build: fromTiers([{ h: 0.9 }, { h: 1, cols: [1, 1] }, { h: 1, cols: [2, 1] }, { h: 0.9, cols: [1, 1, 1, 1] }]) },
  { id: "c-Lshape", label: "Hero L", category: "classic", description: "Big hero panel wrapped by beats", build: fromRects([[0, 0, 0.62, 0.66], [0.62, 0, 1, 0.33], [0.62, 0.33, 1, 0.66], [0, 0.66, 0.5, 1], [0.5, 0.66, 1, 1]]) },
  { id: "c-column", label: "Hero Column", category: "classic", description: "Full-height figure + side beats", build: fromRects([[0.45, 0, 1, 1], [0, 0, 0.45, 0.34], [0, 0.34, 0.45, 0.67], [0, 0.67, 0.45, 1]]) },
  { id: "c-dense10", label: "Dense 10", category: "classic", description: "Fast-paced comedy or recap", build: fromTiers([{ h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1, 1] }, { h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1, 1] }]) },
  { id: "2-vert", label: "Two Tier", category: "classic", description: "Versus / two-character faceoff", build: fromTiers([{ h: 1 }, { h: 1 }]) },
  // Action
  { id: "a-slash3", label: "Slash 3", category: "action", description: "Three tiers cut by blade slants", build: fromTiers([{ h: 1, slant: 0.07 }, { h: 1.2, slant: -0.07 }, { h: 1 }]) },
  { id: "action-5", label: "Action 5", category: "action", description: "Dynamic diagonal battle cuts", build: fromTiers([{ h: 1, cols: [1, 1], skew: 0.06, slant: 0.06 }, { h: 1.2, slant: -0.05 }, { h: 1, cols: [1, 1], skew: -0.06 }]) },
  { id: "a-impact6", label: "Impact 6", category: "action", description: "Wind-up, giant hit, aftermath", build: fromTiers([{ h: 0.8, cols: [1, 1, 1], skew: 0.04, slant: 0.05 }, { h: 1.7, slant: -0.06 }, { h: 0.8, cols: [1, 1], skew: -0.05 }]) },
  { id: "a-shatter", label: "Shatter", category: "action", description: "Broken-glass explosion page", build: shatter },
  { id: "a-zigzag", label: "Zig-Zag 5", category: "action", description: "Alternating slants for a chase", build: fromTiers([{ h: 1, slant: 0.07 }, { h: 1, slant: -0.07, cols: [1, 1], skew: 0.05 }, { h: 1, slant: 0.07 }, { h: 1 }]) },
  { id: "a-versus", label: "Versus", category: "action", description: "Diagonal rival split", build: fromTiers([{ h: 1, cols: [1, 1], skew: 0.14 }]) },
  { id: "a-countdown", label: "Countdown", category: "action", description: "Tiny beats framing a big clash", build: fromTiers([{ h: 0.5, cols: [1, 1, 1, 1] }, { h: 2.5 }, { h: 0.5, cols: [1, 1, 1, 1] }]) },
  { id: "a-speed", label: "Speed Strips", category: "action", description: "Parallel slanted dash strips", build: fromTiers([{ h: 1, slant: 0.05 }, { h: 1, slant: 0.05 }, { h: 1, slant: 0.05 }, { h: 1, slant: 0.05 }, { h: 1 }]) },
  { id: "shonen-slash-7", label: "Shonen 7", category: "action", description: "High-intensity slashing cuts", build: fromTiers([{ h: 1, cols: [1, 1, 1], skew: 0.05, slant: 0.05 }, { h: 1.3, cols: [3, 2], skew: -0.08, slant: -0.05 }, { h: 1, cols: [1, 1], skew: 0.06 }]) },
  { id: "a-finisher", label: "Finisher", category: "action", description: "Huge bled strike with insets", build: () => [mk(rect(0, 0, 1, 1), BLEED, 0), mk(rect(0.05, 0.04, 0.4, 0.26), FLOAT, 1), mk(rect(0.6, 0.74, 0.95, 0.96), FLOAT, 2)] },
  // Shojo / drama
  { id: "shojo-focus-5", label: "Shojo 5", category: "shojo", description: "Full-body portrait with reactions", build: fromRects([[0, 0, 0.55, 1], [0.55, 0, 1, 0.25], [0.55, 0.25, 1, 0.5], [0.55, 0.5, 1, 0.75], [0.55, 0.75, 1, 1]]) },
  { id: "s-floating", label: "Floating Moments", category: "shojo", description: "Splash with floating memory insets", build: () => [mk(rect(0, 0, 1, 1), {}, 0), mk(rect(0.06, 0.07, 0.44, 0.3), FLOAT, 1), mk(rect(0.56, 0.68, 0.94, 0.91), FLOAT, 2)] },
  { id: "s-open", label: "Open Drama", category: "shojo", description: "Borderless emotional centre", build: fromTiers([{ h: 1, cols: [1, 1] }, { h: 1.5, extra: OPEN }, { h: 1, cols: [1, 1] }]) },
  { id: "s-closeups", label: "Close-ups", category: "shojo", description: "Big moment + reaction strip", build: fromTiers([{ h: 2 }, { h: 1, cols: [1, 1, 1] }, { h: 1, cols: [1, 1, 1] }]) },
  { id: "s-confession", label: "Confession", category: "shojo", description: "Eye-strip inset over a tall scene", build: () => [...fromTiers([{ h: 2.2 }, { h: 1, cols: [1, 1, 1] }])(), mk(rect(0.08, 0.5, 0.92, 0.6), FLOAT, 4)] },
  { id: "s-tall2", label: "Tall Pair", category: "shojo", description: "Two tall side-by-side figures", build: fromTiers([{ h: 1, cols: [1, 1] }]) },
  { id: "s-flashback", label: "Flashback", category: "shojo", description: "Dashed memory panel mid-page", build: fromTiers([{ h: 1 }, { h: 1.4, extra: { borderStyle: "dashed", backgroundColor: "#f4f4f5" } }, { h: 1, cols: [1, 1] }]) },
  // Cinematic
  { id: "3-cinema", label: "3-Cinema", category: "cinematic", description: "Letterbox widescreen panels", build: fromTiers([{ h: 1 }, { h: 1 }, { h: 1 }]) },
  { id: "cn-4", label: "4-Letterbox", category: "cinematic", description: "Four wide film strips", build: fromTiers([{ h: 1 }, { h: 1 }, { h: 1 }, { h: 1 }]) },
  { id: "cn-5", label: "5-Letterbox", category: "cinematic", description: "Slow-motion storyboard", build: fromTiers([{ h: 1 }, { h: 1 }, { h: 1 }, { h: 1 }, { h: 1 }]) },
  { id: "cn-panorama", label: "Panorama", category: "cinematic", description: "Wide shots bracketing details", build: fromTiers([{ h: 1.2 }, { h: 1, cols: [1, 1, 1] }, { h: 1.2 }]) },
  { id: "cn-zoom", label: "Zoom In", category: "cinematic", description: "Wide → medium → extreme close", build: fromTiers([{ h: 1 }, { h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1, 1] }, { h: 1, cols: [1, 1, 1, 1] }]) },
  // Splash
  { id: "1-splash", label: "Full Splash", category: "splash", description: "Full page hero shot", build: fromRects([[0, 0, 1, 1]]) },
  { id: "sp-bleed", label: "Bleed Splash", category: "splash", description: "Art runs off every edge", build: fromRects([[0, 0, 1, 1, BLEED]]) },
  { id: "sp-top", label: "Top Splash", category: "splash", description: "Bled hero + two beats below", build: fromTiers([{ h: 2.3, extra: BLEED }, { h: 1, cols: [1, 1] }]) },
  { id: "sp-bottom", label: "Bottom Reveal", category: "splash", description: "Build-up then a bled reveal", build: fromTiers([{ h: 1, cols: [1, 1] }, { h: 2.3, extra: BLEED }]) },
  { id: "sp-insets", label: "Splash + Insets", category: "splash", description: "Bled splash with stacked insets", build: () => [mk(rect(0, 0, 1, 1), BLEED, 0), mk(rect(0.66, 0.05, 0.95, 0.28), FLOAT, 1), mk(rect(0.66, 0.32, 0.95, 0.55), FLOAT, 2)] },
  { id: "sp-double", label: "Title Page", category: "splash", description: "Chapter title splash with caption", build: fromTiers([{ h: 4, extra: BLEED }, { h: 0.6 }]) },
  // 4-koma / gag
  { id: "4-koma", label: "4-Koma", category: "koma", description: "Traditional yonkoma strip", build: fromTiers([{ h: 1 }, { h: 1 }, { h: 1 }, { h: 1 }]) },
  { id: "k-double", label: "Double 4-Koma", category: "koma", description: "Two yonkoma side by side", build: fromTiers([{ h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }]) },
  { id: "k-gag3", label: "Gag 3", category: "koma", description: "Setup, setup, punchline", build: fromTiers([{ h: 1 }, { h: 1 }, { h: 1.5 }]) },
  { id: "k-punch", label: "Punchline", category: "koma", description: "Small beats + big payoff", build: fromTiers([{ h: 1, cols: [1, 1, 1] }, { h: 2.2 }]) },
  // Webtoon
  { id: "webtoon-3", label: "Webtoon 3", category: "webtoon", description: "Vertical scrolling panels", build: fromRects([[0, 0, 1, 0.3], [0.08, 0.36, 0.92, 0.64], [0, 0.7, 1, 1]]) },
  { id: "wt-stagger", label: "Staggered", category: "webtoon", description: "Zig-zag scroll rhythm", build: fromRects([[0, 0, 0.8, 0.18], [0.2, 0.22, 1, 0.4], [0, 0.44, 0.8, 0.62], [0.2, 0.66, 1, 0.84], [0, 0.88, 1, 1]]) },
  { id: "wt-scroll", label: "Long Scroll", category: "webtoon", description: "Breathing room between beats", build: fromRects([[0, 0, 1, 0.22], [0.1, 0.3, 0.9, 0.46], [0, 0.55, 1, 0.8], [0.15, 0.88, 0.85, 1]]) },
];

export function buildTemplate(id: string): PanelPolygon[] | null {
  const t = GRID_TEMPLATES.find((g) => g.id === id);
  return t ? t.build() : null;
}

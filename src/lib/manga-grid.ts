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

// ─────────── Extended classic library (staggered 5–6 panel pages) ───────────

type R4 = [number, number, number, number];
const geoKey = (rs: R4[]) => rs.map((r) => r.map((v) => v.toFixed(3)).join(",")).sort().join("|");
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Two columns between y0..y1, each column cut at its own heights so gutters never form a "+". */
function columnPair(y0: number, y1: number, split: number, left: number[], right: number[]): R4[] {
  const out: R4[] = [];
  const col = (x0: number, x1: number, cuts: number[]) => {
    const ys = [y0, ...cuts.map((c) => y0 + (y1 - y0) * c), y1];
    for (let i = 0; i < ys.length - 1; i++) out.push([x0, ys[i], x1, ys[i + 1]]);
  };
  col(0, split, left);
  col(split, 1, right);
  return out;
}

function staggeredTemplates(): GridTemplate[] {
  const bands: { name: string; top: number; bot: number }[] = [
    { name: "Top", top: 0.34, bot: 0 },
    { name: "Tall Top", top: 0.42, bot: 0 },
    { name: "Base", top: 0, bot: 0.32 },
    { name: "Frame", top: 0.27, bot: 0.25 },
    { name: "Open", top: 0, bot: 0 },
  ];
  const cuts: number[][] = [[], [0.42], [0.58], [0.5], [0.34, 0.68], [0.28, 0.6], [0.4, 0.72]];
  const splits = [0.5, 0.44, 0.58];
  const seen = new Set<string>();
  const out: GridTemplate[] = [];
  const count: Record<string, number> = {};
  for (const b of bands) for (const s of splits) for (const L of cuts) for (const Rc of cuts) {
    // Stagger rule: no shared cut heights between the columns.
    if (L.some((c) => Rc.some((d) => Math.abs(c - d) < 0.05))) continue;
    const rs: R4[] = [];
    if (b.top) rs.push([0, 0, 1, b.top]);
    rs.push(...columnPair(b.top, 1 - b.bot, s, L, Rc));
    if (b.bot) rs.push([0, 1 - b.bot, 1, 1]);
    if (rs.length < 5 || rs.length > 6) continue;
    const k = geoKey(rs);
    if (seen.has(k)) continue;
    seen.add(k);
    const n = rs.length;
    const tag = `${b.name} ${n}`;
    count[tag] = (count[tag] ?? 0) + 1;
    out.push({
      id: `st-${out.length + 1}`,
      label: `Stagger ${tag}${LETTERS[count[tag] - 1] ? " " + LETTERS[count[tag] - 1] : ""}`,
      category: "classic",
      description: `${n} panels, offset gutters${b.top ? ", wide opener" : ""}${b.bot ? ", wide closer" : ""}`,
      build: () => rs.map((r, i) => mk(rect(...r), {}, i)),
    });
  }
  // Keep variety but cap the count.
  return out.filter((_, i) => i % 2 === 0).slice(0, 48);
}

function tierTemplates(): GridTemplate[] {
  const rows: number[][] = [[1], [1, 1], [2, 1], [1, 2], [3, 2], [2, 3], [1, 1, 1]];
  const heights: number[][] = [[1, 1, 1], [1.3, 1, 1], [1, 1.3, 1], [1, 1, 1.4], [0.8, 1.4, 1]];
  const out: GridTemplate[] = [];
  const action: GridTemplate[] = [];
  const sameRatio = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  let idx = 0;
  for (const a of rows) for (const b of rows) for (const c of rows) {
    const n = a.length + b.length + c.length;
    if (n < 5 || n > 6) continue;
    // Gutters must not line up vertically between neighbouring tiers (except full-width rows).
    if ((a.length > 1 && sameRatio(a, b)) || (b.length > 1 && sameRatio(b, c))) continue;
    idx++;
    const h = heights[idx % heights.length];
    const spec: Tier[] = [{ h: h[0], cols: a }, { h: h[1], cols: b }, { h: h[2], cols: c }];
    if (idx % 3 === 0) {
      out.push({ id: `tr-${idx}`, label: `Rhythm ${n} · ${a.length}-${b.length}-${c.length}`, category: "classic", description: `${n} panels in three tiers`, build: fromTiers(spec) });
    }
    if (idx % 4 === 1) {
      const sk = (idx % 2 ? 0.05 : -0.05);
      action.push({
        id: `ta-${idx}`,
        label: `Clash ${n} · ${a.length}-${b.length}-${c.length}`,
        category: "action",
        description: `${n} panels with blade-cut dividers`,
        build: fromTiers([
          { ...spec[0], skew: sk, slant: 0.05 },
          { ...spec[1], skew: -sk, slant: -0.05 },
          { ...spec[2], skew: sk },
        ]),
      });
    }
  }
  return [...out, ...action];
}

function wrapTemplates(): GridTemplate[] {
  const out: GridTemplate[] = [];
  const mkT = (id: string, label: string, cat: TemplateCategory, desc: string, rs: R4[]) =>
    out.push({ id, label, category: cat, description: desc, build: () => rs.map((r, i) => mk(rect(...r), {}, i)) });
  for (const [side, w] of [["R", 0.58], ["L", 0.58], ["R", 0.5]] as const) {
    const x0 = side === "R" ? 1 - w : 0, x1 = side === "R" ? 1 : w;
    const ox0 = side === "R" ? 0 : w, ox1 = side === "R" ? 1 - w : 1;
    mkT(`wr-hero5-${side}${w}`, `Hero Wrap 5 ${side}${w === 0.5 ? " Even" : ""}`, "classic", "Tall hero panel with four beats", [
      [x0, 0, x1, 0.72], [ox0, 0, ox1, 0.24], [ox0, 0.24, ox1, 0.48], [ox0, 0.48, ox1, 0.72], [0, 0.72, 1, 1],
    ]);
    mkT(`wr-hero6-${side}${w}`, `Hero Wrap 6 ${side}${w === 0.5 ? " Even" : ""}`, "shojo", "Tall portrait with five reactions", [
      [x0, 0.25, x1, 1], [0, 0, 0.5, 0.25], [0.5, 0, 1, 0.25], [ox0, 0.25, ox1, 0.5], [ox0, 0.5, ox1, 0.75], [ox0, 0.75, ox1, 1],
    ]);
  }
  mkT("wr-kitchen", "Reference Stagger", "classic", "Wide opener, offset two-column story (like your kitchen page)", [
    [0, 0, 1, 0.35], [0, 0.35, 0.47, 0.72], [0.47, 0.35, 1, 0.6], [0, 0.72, 0.47, 1], [0.47, 0.6, 1, 1],
  ]);
  mkT("wr-center", "Centre Stage 5", "cinematic", "Big middle shot framed by four beats", [
    [0, 0, 0.55, 0.22], [0.55, 0, 1, 0.22], [0, 0.22, 1, 0.74], [0, 0.74, 0.45, 1], [0.45, 0.74, 1, 1],
  ]);
  mkT("wr-steps", "Staircase 6", "cinematic", "Panels step down across the page", [
    [0, 0, 0.66, 0.2], [0.66, 0, 1, 0.38], [0, 0.2, 0.66, 0.5], [0.66, 0.38, 1, 0.7], [0, 0.5, 0.66, 1], [0.66, 0.7, 1, 1],
  ]);
  return out;
}

GRID_TEMPLATES.push(...staggeredTemplates(), ...tierTemplates(), ...wrapTemplates());

/** Merge two rectangular panels whose union is itself a rectangle. Returns null when they don't fit together. */
export function mergeRectPanels(a: PanelPolygon, b: PanelPolygon): Point[] | null {
  const pts = [...a.points, ...b.points];
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const box = (x1 - x0) * (y1 - y0);
  const sum = Math.abs(polygonArea(a.points)) + Math.abs(polygonArea(b.points));
  if (Math.abs(box - sum) > 0.002) return null;
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

export type MergeDirection = "up" | "down" | "left" | "right";

export interface MergeCandidate {
  neighborId: string;
  direction: MergeDirection;
  mergedPoints: Point[];
}

/** Finds all neighboring rectangular panels that can merge cleanly with `target`, tagged by direction. */
export function mergeCandidates(target: PanelPolygon, panels: PanelPolygon[]): MergeCandidate[] {
  if (target.floating) return [];
  const tBox = {
    x0: Math.min(...target.points.map((p) => p.x)),
    x1: Math.max(...target.points.map((p) => p.x)),
    y0: Math.min(...target.points.map((p) => p.y)),
    y1: Math.max(...target.points.map((p) => p.y)),
  };
  const tCx = (tBox.x0 + tBox.x1) / 2;
  const tCy = (tBox.y0 + tBox.y1) / 2;
  const out: MergeCandidate[] = [];

  for (const other of panels) {
    if (other.id === target.id || other.floating) continue;
    const mergedPoints = mergeRectPanels(target, other);
    if (!mergedPoints) continue;
    const oCx = (Math.min(...other.points.map((p) => p.x)) + Math.max(...other.points.map((p) => p.x))) / 2;
    const oCy = (Math.min(...other.points.map((p) => p.y)) + Math.max(...other.points.map((p) => p.y))) / 2;
    const dx = oCx - tCx;
    const dy = oCy - tCy;
    const direction: MergeDirection =
      Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
    out.push({ neighborId: other.id, direction, mergedPoints });
  }
  return out;
}

export interface SharedDivider {
  id: string;
  a: Point;
  b: Point;
  nx: number;
  ny: number;
  c: number;
  tx: number;
  ty: number;
  tMin: number;
  tMax: number;
  axis: "h" | "v" | "angled";
  panelIds: string[];
}

/** Extracts contiguous interior dividing lines shared between non-floating panels (supports staggered T-junctions & slants). */
export function findSharedDividers(panels: PanelPolygon[]): SharedDivider[] {
  interface EdgeRec {
    panelId: string;
    t0: number;
    t1: number;
    side: 1 | -1;
  }
  interface LineGroup {
    nx: number;
    ny: number;
    c: number;
    tx: number;
    ty: number;
    edges: EdgeRec[];
  }

  const groups: LineGroup[] = [];
  for (const p of panels) {
    if (p.floating || p.points.length < 3) continue;
    const areaSign = polygonArea(p.points) >= 0 ? 1 : -1;
    const n = p.points.length;
    for (let i = 0; i < n; i++) {
      const a = p.points[i];
      const b = p.points[(i + 1) % n];
      if (onPageEdge(a, b)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.015) continue;
      // Canonical normal so coincident opposite edges land in the exact same bucket.
      let nx = -dy / len;
      let ny = dx / len;
      if (nx < -1e-4 || (Math.abs(nx) <= 1e-4 && ny < 0)) {
        nx = -nx;
        ny = -ny;
      }
      const c = nx * a.x + ny * a.y;
      const tx = -ny;
      const ty = nx;
      const p0 = a.x * tx + a.y * ty;
      const p1 = b.x * tx + b.y * ty;
      const t0 = Math.min(p0, p1);
      const t1 = Math.max(p0, p1);
      // Side compares edge normal vs canonical normal.
      const edgeNx = (areaSign * -dy) / len;
      const edgeNy = (areaSign * dx) / len;
      const side: 1 | -1 = edgeNx * nx + edgeNy * ny >= 0 ? 1 : -1;

      let grp = groups.find(
        (g) => Math.abs(g.nx - nx) < 2e-3 && Math.abs(g.ny - ny) < 2e-3 && Math.abs(g.c - c) < 3e-3,
      );
      if (!grp) {
        grp = { nx, ny, c, tx, ty, edges: [] };
        groups.push(grp);
      }
      grp.edges.push({ panelId: p.id, t0, t1, side });
    }
  }

  const out: SharedDivider[] = [];
  for (const g of groups) {
    // Collect sweep events along tangent t to find every maximal overlap where BOTH sides exist.
    const cuts = Array.from(
      new Set(g.edges.flatMap((e) => [Math.round(e.t0 * 10000) / 10000, Math.round(e.t1 * 10000) / 10000])),
    ).sort((x, y) => x - y);

    let spanStart: number | null = null;
    let spanEnd: number | null = null;
    const spanPanels = new Set<string>();

    const flush = () => {
      if (spanStart !== null && spanEnd !== null && spanEnd - spanStart > 0.015 && spanPanels.size >= 2) {
        const ax = snap(g.c * g.nx + spanStart * g.tx);
        const ay = snap(g.c * g.ny + spanStart * g.ty);
        const bx = snap(g.c * g.nx + spanEnd * g.tx);
        const by = snap(g.c * g.ny + spanEnd * g.ty);
        const axis: SharedDivider["axis"] = Math.abs(g.ny) > 0.995 ? "h" : Math.abs(g.nx) > 0.995 ? "v" : "angled";
        out.push({
          id: `div-${out.length + 1}`,
          a: { x: ax, y: ay },
          b: { x: bx, y: by },
          nx: g.nx,
          ny: g.ny,
          c: g.c,
          tx: g.tx,
          ty: g.ty,
          tMin: spanStart,
          tMax: spanEnd,
          axis,
          panelIds: [...spanPanels],
        });
      }
      spanStart = null;
      spanEnd = null;
      spanPanels.clear();
    };

    for (let i = 0; i < cuts.length - 1; i++) {
      const lo = cuts[i];
      const hi = cuts[i + 1];
      if (hi - lo < 1e-3) continue;
      const mid = (lo + hi) / 2;
      const active = g.edges.filter((e) => e.t0 <= mid && e.t1 >= mid);
      const hasPos = active.some((e) => e.side === 1);
      const hasNeg = active.some((e) => e.side === -1);
      if (hasPos && hasNeg) {
        if (spanStart === null) spanStart = lo;
        spanEnd = hi;
        for (const e of active) spanPanels.add(e.panelId);
      } else {
        flush();
      }
    }
    flush();
  }
  return out;
}

function tryShiftDivider(panels: PanelPolygon[], divider: SharedDivider, delta: number): PanelPolygon[] | null {
  const newC = divider.c + delta;
  const affected = new Set(divider.panelIds);
  const minDim = 0.05;
  const minArea = 0.003;

  const next = panels.map((p) => {
    if (!affected.has(p.id)) return p;
    let changed = false;
    const pts = p.points.map((pt) => {
      const dist = Math.abs(pt.x * divider.nx + pt.y * divider.ny - divider.c);
      const tVal = pt.x * divider.tx + pt.y * divider.ty;
      if (dist < 4e-3 && tVal >= divider.tMin - 4e-3 && tVal <= divider.tMax + 4e-3) {
        changed = true;
        if (divider.axis === "h") {
          return { x: pt.x, y: snap(Math.min(1, Math.max(0, pt.y + divider.ny * delta))) };
        }
        if (divider.axis === "v") {
          return { x: snap(Math.min(1, Math.max(0, pt.x + divider.nx * delta))), y: pt.y };
        }
        // Keep boundary corners pinned to their exact outer page edge along slanted lines.
        if (Math.abs(pt.x) < EPS && Math.abs(divider.ny) > 1e-3) {
          return { x: 0, y: snap(Math.min(1, Math.max(0, newC / divider.ny))) };
        }
        if (Math.abs(pt.x - 1) < EPS && Math.abs(divider.ny) > 1e-3) {
          return { x: 1, y: snap(Math.min(1, Math.max(0, (newC - divider.nx) / divider.ny))) };
        }
        if (Math.abs(pt.y) < EPS && Math.abs(divider.nx) > 1e-3) {
          return { x: snap(Math.min(1, Math.max(0, newC / divider.nx))), y: 0 };
        }
        if (Math.abs(pt.y - 1) < EPS && Math.abs(divider.nx) > 1e-3) {
          return { x: snap(Math.min(1, Math.max(0, (newC - divider.ny) / divider.nx))), y: 1 };
        }
        return {
          x: snap(Math.min(1, Math.max(0, pt.x + divider.nx * delta))),
          y: snap(Math.min(1, Math.max(0, pt.y + divider.ny * delta))),
        };
      }
      return pt;
    });
    if (!changed) return p;
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    if (Math.max(...xs) - Math.min(...xs) < minDim || Math.max(...ys) - Math.min(...ys) < minDim) return null;
    if (Math.abs(polygonArea(pts)) < minArea) return null;
    return { ...p, points: pts };
  });

  return next.some((p) => p === null) ? null : (next as PanelPolygon[]);
}

const DEFAULT_SNAP_TICKS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];

/**
 * Slides a shared divider along its normal (`delta` in normalized page units),
 * snapping cleanly to guides while clamping against neighboring panels so geometry never collapses.
 */
export function moveDivider(
  panels: PanelPolygon[],
  divider: SharedDivider,
  rawDelta: number,
  options: { snapTicks?: number[]; disableSnap?: boolean } = {},
): { panels: PanelPolygon[]; appliedDelta: number; snappedAt?: number } {
  let delta = rawDelta;
  let snappedAt: number | undefined;

  if (!options.disableSnap && divider.axis !== "angled") {
    const curPos = divider.axis === "h" ? divider.a.y : divider.a.x;
    const sign = divider.axis === "h" ? divider.ny : divider.nx;
    const target = curPos + delta * sign;
    const ticks = options.snapTicks ?? DEFAULT_SNAP_TICKS;
    let bestDiff = 0.015;
    for (const tk of ticks) {
      const diff = Math.abs(target - tk);
      if (diff < bestDiff) {
        bestDiff = diff;
        delta = (tk - curPos) * sign;
        snappedAt = tk;
      }
    }
  }

  const direct = tryShiftDivider(panels, divider, delta);
  if (direct) return { panels: direct, appliedDelta: delta, snappedAt };

  // Binary search maximum safe slide along delta direction.
  let lo = 0;
  let hi = delta;
  let best: PanelPolygon[] | null = null;
  let bestDelta = 0;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const attempt = tryShiftDivider(panels, divider, mid);
    if (attempt) {
      best = attempt;
      bestDelta = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { panels: best ?? panels, appliedDelta: bestDelta };
}

/** Splits a single rectangular or polygonal panel cleanly into a rows x cols sub-grid. */
export function splitPanelGrid(panel: PanelPolygon, rows: number, cols: number): PanelPolygon[] {
  const r = Math.max(1, Math.min(4, Math.round(rows)));
  const c = Math.max(1, Math.min(4, Math.round(cols)));
  if (r === 1 && c === 1) return [panel];
  const xs = panel.points.map((p) => p.x);
  const ys = panel.points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const out: PanelPolygon[] = [];
  const baseSeed = ++cutSeq;
  for (let ri = 0; ri < r; ri++) {
    const ty0 = snap(y0 + ((y1 - y0) * ri) / r);
    const ty1 = snap(y0 + ((y1 - y0) * (ri + 1)) / r);
    for (let ci = 0; ci < c; ci++) {
      const tx0 = snap(x0 + ((x1 - x0) * ci) / c);
      const tx1 = snap(x0 + ((x1 - x0) * (ci + 1)) / c);
      out.push({
        ...panel,
        id: `${panel.id}-g${baseSeed}-${ri}_${ci}`,
        points: rect(tx0, ty0, tx1, ty1),
      });
    }
  }
  return out;
}

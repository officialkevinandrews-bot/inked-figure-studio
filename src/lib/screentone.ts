/** Halftone screentones: one tile description shared by the live page (SVG pattern) and export (canvas pattern). */
export type ToneKind = "dots" | "lines" | "crosshatch" | "sand" | "checker" | "waves" | "speed";
export type ToneFade = "none" | "top" | "bottom" | "left" | "right" | "radial" | "edges";

export interface Screentone {
  kind: ToneKind;
  density: number; // 0.02..0.9 ink coverage
  cell: number; // tile pitch in page px (smaller = finer line count)
  angle: number; // degrees
  color: string;
  fade: ToneFade;
}

export const TONE_KINDS: { id: ToneKind; label: string }[] = [
  { id: "dots", label: "Dots" },
  { id: "lines", label: "Lines" },
  { id: "crosshatch", label: "Cross-hatch" },
  { id: "sand", label: "Sand / grain" },
  { id: "checker", label: "Checker" },
  { id: "waves", label: "Waves" },
  { id: "speed", label: "Speed streaks" },
];

export const TONE_FADES: { id: ToneFade; label: string }[] = [
  { id: "none", label: "Flat" },
  { id: "top", label: "Fade ↓" },
  { id: "bottom", label: "Fade ↑" },
  { id: "left", label: "Fade →" },
  { id: "right", label: "Fade ←" },
  { id: "radial", label: "Vignette" },
  { id: "edges", label: "Spotlight" },
];

const t = (kind: ToneKind, density: number, cell: number, angle: number, fade: ToneFade = "none"): Screentone => ({
  kind, density, cell, angle, fade, color: "#000000",
});

export const TONE_PRESETS: { id: string; label: string; tone: Screentone }[] = [
  { id: "fine10", label: "10% fine", tone: t("dots", 0.1, 5, 45) },
  { id: "dots20", label: "20% dots", tone: t("dots", 0.2, 6, 45) },
  { id: "dots35", label: "35% shadow", tone: t("dots", 0.35, 6, 45) },
  { id: "dots60", label: "60% dark", tone: t("dots", 0.6, 6, 45) },
  { id: "coarse", label: "Coarse pop", tone: t("dots", 0.25, 12, 45) },
  { id: "sky", label: "Sky gradient", tone: t("dots", 0.35, 6, 45, "bottom") },
  { id: "night", label: "Night sky", tone: t("dots", 0.7, 5, 45, "bottom") },
  { id: "vignette", label: "Vignette", tone: t("dots", 0.45, 6, 45, "edges") },
  { id: "lines", label: "Diag lines", tone: t("lines", 0.3, 6, 45) },
  { id: "tv", label: "Scanlines", tone: t("lines", 0.25, 5, 0) },
  { id: "hatch", label: "Cross-hatch", tone: t("crosshatch", 0.25, 7, 45) },
  { id: "sand", label: "Sand grain", tone: t("sand", 0.25, 6, 0) },
  { id: "check", label: "Checker", tone: t("checker", 0.5, 10, 0) },
  { id: "waves", label: "Waves", tone: t("waves", 0.25, 12, 0) },
  { id: "speed", label: "Speed streaks", tone: t("speed", 0.2, 10, 0) },
  { id: "gloom", label: "Gloom", tone: t("crosshatch", 0.45, 5, 30, "top") },
];

function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** SVG markup for one repeat tile (in tile space) + its size. */
export function toneTile(tone: Screentone): { w: number; h: number; body: string } {
  const c = Math.max(2, tone.cell);
  const d = Math.min(0.95, Math.max(0.01, tone.density));
  const col = tone.color || "#000";
  switch (tone.kind) {
    case "lines": {
      const h = Math.max(0.4, c * d);
      return { w: c, h: c, body: `<rect x="0" y="0" width="${c}" height="${h.toFixed(2)}" fill="${col}"/>` };
    }
    case "crosshatch": {
      const one = 1 - Math.sqrt(1 - d);
      const h = Math.max(0.4, c * one);
      return { w: c, h: c, body: `<rect x="0" y="0" width="${c}" height="${h.toFixed(2)}" fill="${col}"/><rect x="0" y="0" width="${h.toFixed(2)}" height="${c}" fill="${col}"/>` };
    }
    case "checker": {
      const s = (c / 2) * Math.sqrt(Math.min(1, d * 2));
      const o = (c / 2 - s) / 2;
      return { w: c, h: c, body: `<rect x="${o}" y="${o}" width="${s}" height="${s}" fill="${col}"/><rect x="${o + c / 2}" y="${o + c / 2}" width="${s}" height="${s}" fill="${col}"/>` };
    }
    case "waves": {
      const sw = Math.max(0.5, c * d * 0.8);
      const path = `M0 ${c / 2} Q ${c / 4} ${c / 4} ${c / 2} ${c / 2} T ${c} ${c / 2}`;
      return { w: c, h: c, body: `<path d="${path}" stroke="${col}" stroke-width="${sw.toFixed(2)}" fill="none"/>` };
    }
    case "sand": {
      const size = c * 6;
      const r = rand(7);
      const count = Math.round(size * size * d * 0.12);
      let body = "";
      for (let i = 0; i < count; i++) body += `<circle cx="${(r() * size).toFixed(1)}" cy="${(r() * size).toFixed(1)}" r="${(0.5 + r() * 0.6).toFixed(2)}" fill="${col}"/>`;
      return { w: size, h: size, body };
    }
    case "speed": {
      const size = c * 8;
      const r = rand(11);
      const n = Math.round(10 + d * 40);
      let body = "";
      for (let i = 0; i < n; i++) {
        const y = r() * size, x = r() * size, len = size * (0.2 + r() * 0.5), w = 0.4 + r() * 1.4 * d * 3;
        body += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${len.toFixed(1)}" height="${w.toFixed(2)}" fill="${col}"/><rect x="${(x - size).toFixed(1)}" y="${y.toFixed(1)}" width="${len.toFixed(1)}" height="${w.toFixed(2)}" fill="${col}"/>`;
      }
      return { w: size, h: size, body };
    }
    default: {
      // classic AM halftone: two dots per cell (corners + centre)
      const r = Math.min(c * 0.72, c * Math.sqrt(d / (2 * Math.PI)));
      const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${col}"/>`;
      return { w: c, h: c, body: dot(0, 0) + dot(c, 0) + dot(0, c) + dot(c, c) + dot(c / 2, c / 2) };
    }
  }
}

export function toneDataUrl(tone: Screentone): string {
  const { w, h, body } = toneTile(tone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface Box { minX: number; minY: number; width: number; height: number }

/** Gradient geometry for the fade mask: alpha 1 → 0 along the vector. */
export function fadeGeometry(fade: ToneFade, b: Box):
  | { type: "linear"; x1: number; y1: number; x2: number; y2: number }
  | { type: "radial"; cx: number; cy: number; r: number; invert: boolean }
  | null {
  const { minX: x, minY: y, width: w, height: h } = b;
  switch (fade) {
    case "top": return { type: "linear", x1: x, y1: y, x2: x, y2: y + h };
    case "bottom": return { type: "linear", x1: x, y1: y + h, x2: x, y2: y };
    case "left": return { type: "linear", x1: x, y1: y, x2: x + w, y2: y };
    case "right": return { type: "linear", x1: x + w, y1: y, x2: x, y2: y };
    case "radial": return { type: "radial", cx: x + w / 2, cy: y + h / 2, r: Math.hypot(w, h) / 2, invert: false };
    case "edges": return { type: "radial", cx: x + w / 2, cy: y + h / 2, r: Math.hypot(w, h) / 2, invert: true };
    default: return null;
  }
}

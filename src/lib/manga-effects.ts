export type BalloonShape =
  | "oval"
  | "burst" // Shout / scream
  | "cloud" // Thought
  | "box" // Narration
  | "whisper" // Dashed outline
  | "electric" // Radio / mechanical broadcast
  | "heart" // Romance / idol speech
  | "double_burst" // Mega impact explosion
  | "rounded" // Rounded-rectangle dialogue
  | "scream" // Ragged irregular scream
  | "wavy" // Nervous / weak / sick wobble
  | "flash" // Uni-flash inner-monologue burst
  | "icy" // Cold / menacing icicle edge
  | "narration"; // Caption box with inner keyline

export const MAX_BALLOON_TAILS = 6;
export const DEFAULT_TAIL_WIDTH = 24;

export interface BalloonTail {
  id?: string;
  x: number; // tip X relative to balloon center (width / 2)
  y: number; // tip Y relative to balloon center (height / 2)
  curved?: boolean;
  curveX?: number; // quadratic bezier control X relative to balloon center
  curveY?: number; // quadratic bezier control Y relative to balloon center
  width?: number; // tail base width in px (defaults to DEFAULT_TAIL_WIDTH)
}

export interface ThoughtCircle {
  cx: number;
  cy: number;
  r: number;
}

export interface BalloonRenderGeometry {
  bodyPath: string;
  pointedTailPaths: string[];
  thoughtCircles: ThoughtCircle[];
  combinedPath: string;
}

export interface SpeechBalloon {
  id: string;
  panelId: string;
  shape: BalloonShape;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tails?: BalloonTail[]; // Multi-tail group dialogue support (0..MAX_BALLOON_TAILS)
  tail?: BalloonTail;
  tailX?: number;
  tailY?: number;
  tailCurved?: boolean;
  tailCurveX?: number;
  tailCurveY?: number;
  secondaryTail?: BalloonTail; // Legacy 2-person group dialogue field
  hasTail: boolean;
  hasSecondaryTail?: boolean;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold";
  fontColor?: string;
  textAlign?: "left" | "center" | "right";
  writingMode?: "horizontal-tb" | "vertical-rl"; // Traditional Japanese vertical text
  isVertical?: boolean;
  borderWidth?: number;
  borderColor?: string;
  doubleBorder?: boolean;
  shadow?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  backgroundColor: string;
  opacity?: number;
  zIndex: number;
}

export type ComicMarkType =
  | "sweat"
  | "anger"
  | "sparkles"
  | "shock"
  | "question"
  | "exclamation"
  | "heart"
  | "spiral"
  | "tears"
  | "sleep"
  | "skull"
  | "impact";

export interface ComicMark {
  id: string;
  panelId: string;
  type: string;
  markType?: ComicMarkType;
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity?: number;
  zIndex: number;
}

export interface SpeedLinesEffect {
  id: string;
  panelId: string;
  type: "radial" | "linear";
  centerX: number;
  centerY: number;
  angle: number; // for linear lines
  density: number; // 20 to 120 lines
  innerRadius: number; // blank focal area in center
  outerRadius: number;
  strokeWidth: number;
  color: string;
  opacity?: number;
  zIndex: number;
}

export interface SFXStamp {
  id: string;
  panelId: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily?: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  haloColor?: string;
  haloWidth?: number;
  rotation: number;
  skewX: number;
  opacity?: number;
  zIndex: number;
}

export const SFX_PRESETS = [
  { text: "ドドド", label: "DODODO (Ominous Rumble)" },
  { text: "ゴゴゴ", label: "GOGOGO (Menacing Tension)" },
  { text: "ドン!", label: "DON! (Dramatic Impact)" },
  { text: "バキッ", label: "BAKI! (Punch / Crack)" },
  { text: "ザッ", label: "ZASH! (Dash / Rapid Step)" },
  { text: "ガーン", label: "GAAN! (Deep Shock)" },
  { text: "ドキドキ", label: "DOKI-DOKI (Heart Pounding)" },
  { text: "バシッ!", label: "BASHI! (Slap / Deflect)" },
  { text: "BOOM!", label: "BOOM! (Heavy Explosion)" },
  { text: "WHAM!", label: "WHAM! (Heavy Strike)" },
  { text: "SLASH!", label: "SLASH! (Blade Cut)" },
  { text: "WHOOSH!", label: "WHOOSH! (Air Gust)" },
  { text: "CRASH!", label: "CRASH! (Destruction)" },
  { text: "BANG!", label: "BANG! (Gunshot / Impact)" },
  { text: "シーン", label: "SHIIN (Dead silence)" },
  { text: "ザーッ", label: "ZAAA (Heavy rain)" },
  { text: "ゴォォ", label: "GOOO (Roaring fire / wind)" },
  { text: "ズギャーン", label: "ZUGYAAN (Dramatic entrance)" },
  { text: "バーン", label: "BAAN (Reveal / door slam)" },
  { text: "ピカッ", label: "PIKA (Flash / gleam)" },
  { text: "キラキラ", label: "KIRA-KIRA (Sparkle)" },
  { text: "ドカーン", label: "DOKAAN (Explosion)" },
  { text: "ズドド", label: "ZUDODO (Stampede)" },
  { text: "ヒュッ", label: "HYU (Swish / throw)" },
  { text: "ガシッ", label: "GASHI (Firm grab)" },
  { text: "ゴクリ", label: "GOKURI (Gulp)" },
  { text: "ジー", label: "JII (Intense stare)" },
  { text: "ニヤ", label: "NIYA (Smirk)" },
  { text: "ブチッ", label: "BUCHI (Snap / rage)" },
  { text: "ワクワク", label: "WAKU-WAKU (Excited)" },
  { text: "ゾクッ", label: "ZOKU (Chill down spine)" },
  { text: "パチパチ", label: "PACHI-PACHI (Clapping)" },
  { text: "KRAKOOM!", label: "KRAKOOM! (Thunder)" },
  { text: "THWIP!", label: "THWIP! (Quick shot)" },
  { text: "SNAP!", label: "SNAP!" },
  { text: "FWOOSH!", label: "FWOOSH! (Fire)" },
  { text: "CLANG!", label: "CLANG! (Metal)" },
  { text: "THUD", label: "THUD (Heavy fall)" },
  { text: "BA-DUMP", label: "BA-DUMP (Heartbeat)" },
  { text: "SSSH-HISS", label: "SSSH-HISS (Steam / Sizzle)" },
  { text: "K-CHAK", label: "K-CHAK (Lighter / Click)" },
  { text: "FWOOSH-FLIP", label: "FWOOSH-FLIP (Pan Toss)" },
  { text: "SFX STYLE", label: "(edit me)" },
];

/** One-click SFX looks: fill / stroke / font combos. */
export const SFX_STYLES: { id: string; label: string; patch: Partial<SFXStamp> }[] = [
  { id: "classic", label: "White + black", patch: { fillColor: "#ffffff", strokeColor: "#000000", strokeWidth: 4 } },
  { id: "solid", label: "Solid black", patch: { fillColor: "#000000", strokeColor: "#ffffff", strokeWidth: 3 } },
  { id: "ink", label: "Ink only", patch: { fillColor: "#000000", strokeColor: "#000000", strokeWidth: 0 } },
  { id: "hollow", label: "Hollow", patch: { fillColor: "transparent", strokeColor: "#000000", strokeWidth: 3 } },
  { id: "red", label: "Blood red", patch: { fillColor: "#d4141c", strokeColor: "#000000", strokeWidth: 4 } },
  { id: "gold", label: "Gold", patch: { fillColor: "#facc15", strokeColor: "#000000", strokeWidth: 4 } },
];

export const COMIC_MARK_PRESETS = [
  { mark: "💧", label: "Sweat Drop (Nervous)", type: "sweat" },
  { mark: "💢", label: "Anger Vein (Fury)", type: "anger" },
  { mark: "✨", label: "Sparkles (Aura / Idol)", type: "sparkles" },
  { mark: "///", label: "Blush Lines (Embarrassed)", type: "shock" },
  { mark: "❓", label: "Question (Confusion)", type: "question" },
  { mark: "❗", label: "Exclamation (Surprise)", type: "exclamation" },
  { mark: "❤️", label: "Love Heart", type: "heart" },
  { mark: "🌀", label: "Dizziness Spiral", type: "spiral" },
  { mark: "😭", label: "Tear Streams (Crying)", type: "tears" },
  { mark: "💤", label: "Sleep Bubbles", type: "sleep" },
  { mark: "💀", label: "Skull / Doom", type: "skull" },
  { mark: "💥", label: "Impact Star Burst", type: "impact" },
];

const FANNED_TAIL_ANGLES_DEG = [118, 62, 165, 15, -130, -50] as const;

export function supportsBalloonTails(shape: BalloonShape): boolean {
  return shape !== "box" && shape !== "icy" && shape !== "narration";
}

function normalizeSingleTail(tail: BalloonTail, fallbackId: string): BalloonTail {
  const normalized: BalloonTail = {
    id: tail.id && tail.id.trim() ? tail.id : fallbackId,
    x: Number.isFinite(tail.x) ? tail.x : 0,
    y: Number.isFinite(tail.y) ? tail.y : 80,
    curved: Boolean(tail.curved),
    width:
      typeof tail.width === "number" && Number.isFinite(tail.width)
        ? Math.max(8, Math.min(56, tail.width))
        : DEFAULT_TAIL_WIDTH,
  };
  if (typeof tail.curveX === "number" && Number.isFinite(tail.curveX)) {
    normalized.curveX = tail.curveX;
  }
  if (typeof tail.curveY === "number" && Number.isFinite(tail.curveY)) {
    normalized.curveY = tail.curveY;
  }
  return normalized;
}

/**
 * Returns normalized speaker tails (0..MAX_BALLOON_TAILS) for a speech/thought balloon.
 * Seamlessly migrates legacy single/secondary tail fields when `tails` is absent.
 */
export function getBalloonTails(b: SpeechBalloon): BalloonTail[] {
  if (Array.isArray(b.tails)) {
    const seenIds = new Set<string>();
    return b.tails.slice(0, MAX_BALLOON_TAILS).map((tail, idx) => {
      const candidate = normalizeSingleTail(tail, `tail-${idx}`);
      let uniqueId = candidate.id || `tail-${idx}`;
      while (seenIds.has(uniqueId)) {
        uniqueId = `${uniqueId}-${idx}`;
      }
      seenIds.add(uniqueId);
      return { ...candidate, id: uniqueId };
    });
  }

  const migrated: BalloonTail[] = [];
  if (b.hasTail) {
    migrated.push(
      normalizeSingleTail(
        {
          id: "tail-0",
          x: b.tailX ?? 0,
          y: b.tailY ?? b.height * 0.8,
          curved: Boolean(b.tailCurved),
          curveX: b.tailCurveX,
          curveY: b.tailCurveY,
          width: DEFAULT_TAIL_WIDTH,
        },
        "tail-0",
      ),
    );
  }
  if (b.hasSecondaryTail) {
    const sec = b.secondaryTail ?? { x: -48, y: b.height * 0.8 };
    migrated.push(
      normalizeSingleTail(
        {
          id: sec.id || "tail-1",
          x: sec.x,
          y: sec.y,
          curved: Boolean(sec.curved),
          curveX: sec.curveX,
          curveY: sec.curveY,
          width: sec.width ?? DEFAULT_TAIL_WIDTH,
        },
        "tail-1",
      ),
    );
  }
  return migrated.slice(0, MAX_BALLOON_TAILS);
}

/**
 * Builds a partial balloon update synchronizing `tails[]` and legacy tail fields
 * so old backups, exporters, and tests remain consistent.
 */
export function balloonPatchWithTails(
  b: SpeechBalloon,
  nextTails: BalloonTail[],
): Partial<SpeechBalloon> {
  const seenIds = new Set<string>();
  const normalized = nextTails.slice(0, MAX_BALLOON_TAILS).map((tail, idx) => {
    const entry = normalizeSingleTail(tail, `tail-${Date.now()}-${idx}`);
    let uniqueId = entry.id || `tail-${idx}`;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${uniqueId}-${idx}`;
    }
    seenIds.add(uniqueId);
    return { ...entry, id: uniqueId };
  });

  const first = normalized[0];
  const second = normalized[1];
  return {
    tails: normalized,
    hasTail: normalized.length > 0,
    tailX: first ? first.x : b.tailX,
    tailY: first ? first.y : b.tailY,
    tailCurved: first ? Boolean(first.curved) : false,
    tailCurveX: first?.curveX,
    tailCurveY: first?.curveY,
    hasSecondaryTail: normalized.length > 1,
    secondaryTail: second ? { ...second } : undefined,
  };
}

/** Returns existing curve handle coordinates or a clean perpendicular midpoint bend. */
export function defaultCurveControlForTail(tail: BalloonTail): { x: number; y: number } {
  if (
    typeof tail.curveX === "number" &&
    Number.isFinite(tail.curveX) &&
    typeof tail.curveY === "number" &&
    Number.isFinite(tail.curveY)
  ) {
    return { x: tail.curveX, y: tail.curveY };
  }
  const len = Math.hypot(tail.x, tail.y) || 1;
  const ux = tail.x / len;
  const uy = tail.y / len;
  const px = -uy;
  const py = ux;
  const bend = Math.max(22, Math.min(48, len * 0.25));
  return {
    x: Math.round((tail.x * 0.55 + px * bend) * 10) / 10,
    y: Math.round((tail.y * 0.55 + py * bend) * 10) / 10,
  };
}

/** Picks an unobstructed angular slot around the bubble so added tails fan cleanly outward. */
export function createNextFannedTail(
  b: SpeechBalloon,
  existingTails?: BalloonTail[],
): BalloonTail {
  const current = existingTails ?? getBalloonTails(b);
  let bestDeg: number = FANNED_TAIL_ANGLES_DEG[0];

  if (current.length > 0) {
    let bestSeparation = -1;
    for (const deg of FANNED_TAIL_ANGLES_DEG) {
      const rad = (deg * Math.PI) / 180;
      let minDiff = Infinity;
      for (const existing of current) {
        const existingRad = Math.atan2(existing.y, existing.x);
        let diff = Math.abs(rad - existingRad) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < minDiff) minDiff = diff;
      }
      if (minDiff > bestSeparation) {
        bestSeparation = minDiff;
        bestDeg = deg;
      }
    }
  }

  const bestRad = (bestDeg * Math.PI) / 180;
  const rx = b.width / 2;
  const ry = b.height / 2;
  const reachX = rx * 1.15 + 26;
  const reachY = ry * 1.15 + 26;
  const inheritedWidth = current[current.length - 1]?.width ?? DEFAULT_TAIL_WIDTH;
  const usedIds = new Set(current.map((t) => t.id).filter(Boolean));
  let idx = current.length;
  let newId = `tail-${Date.now()}-${idx}`;
  while (usedIds.has(newId)) {
    idx += 1;
    newId = `tail-${Date.now()}-${idx}`;
  }

  return {
    id: newId,
    x: Math.round(reachX * Math.cos(bestRad)),
    y: Math.round(reachY * Math.sin(bestRad)),
    curved: false,
    width: inheritedWidth,
  };
}

/** Appends a fanned speaker tail up to MAX_BALLOON_TAILS (returns null when at cap or unsupported). */
export function addBalloonTail(b: SpeechBalloon): Partial<SpeechBalloon> | null {
  if (!supportsBalloonTails(b.shape)) return null;
  const current = getBalloonTails(b);
  if (current.length >= MAX_BALLOON_TAILS) return null;
  const nextTail = createNextFannedTail(b, current);
  return balloonPatchWithTails(b, [...current, nextTail]);
}

function tailRootInsetForShape(shape: BalloonShape): number {
  switch (shape) {
    case "burst":
    case "double_burst":
    case "scream":
    case "flash":
    case "electric":
      return 0.62;
    case "heart":
      return 0.65;
    default:
      return 0.78;
  }
}

function buildTailSubpath(
  w: number,
  h: number,
  tipX: number,
  tipY: number,
  isCurved = false,
  curveX?: number,
  curveY?: number,
  baseWidth = DEFAULT_TAIL_WIDTH,
  rootInsetFactor = 0.78,
): string {
  const rx = w / 2;
  const ry = h / 2;
  const cx = rx;
  const cy = ry;
  const rootAngle = Math.atan2(tipY - cy, tipX - cx);
  const rootX = cx + rx * rootInsetFactor * Math.cos(rootAngle);
  const rootY = cy + ry * rootInsetFactor * Math.sin(rootAngle);
  const halfW = Math.max(4, Math.min(28, baseWidth / 2));
  const perpX = -Math.sin(rootAngle) * halfW;
  const perpY = Math.cos(rootAngle) * halfW;

  if (isCurved && curveX !== undefined && curveY !== undefined) {
    return `
      M ${rootX + perpX} ${rootY + perpY}
      Q ${curveX} ${curveY} ${tipX} ${tipY}
      Q ${curveX - perpX * 0.55} ${curveY - perpY * 0.55} ${rootX - perpX} ${rootY - perpY}
    `;
  }
  const midX = (rootX + tipX) / 2 + perpX * 0.3;
  const midY = (rootY + tipY) / 2 + perpY * 0.3;
  return `
    M ${rootX + perpX} ${rootY + perpY}
    Q ${midX} ${midY} ${tipX} ${tipY}
    Q ${midX - perpX * 0.5} ${midY - perpY * 0.5} ${rootX - perpX} ${rootY - perpY}
  `;
}

function clampNum(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Builds descending trailing thought-bubble circles (`O o .`) along one tail path. */
export function buildThoughtCirclesForTail(
  w: number,
  h: number,
  tail: BalloonTail,
): ThoughtCircle[] {
  const rx = w / 2;
  const ry = h / 2;
  const cx = rx;
  const cy = ry;
  const tipX = cx + tail.x;
  const tipY = cy + tail.y;
  const angle = Math.atan2(tipY - cy, tipX - cx);
  const startX = cx + rx * 1.08 * Math.cos(angle);
  const startY = cy + ry * 1.08 * Math.sin(angle);
  const dist = Math.max(24, Math.hypot(tipX - startX, tipY - startY));
  const scale = clampNum((tail.width ?? DEFAULT_TAIL_WIDTH) / DEFAULT_TAIL_WIDTH, 0.65, 1.5);
  const ctrl = tail.curved ? defaultCurveControlForTail(tail) : null;
  const ctrlX = ctrl ? cx + ctrl.x : (startX + tipX) / 2;
  const ctrlY = ctrl ? cy + ctrl.y : (startY + tipY) / 2;

  const evalPoint = (t: number): { cx: number; cy: number } => {
    if (!ctrl) {
      return {
        cx: startX + (tipX - startX) * t,
        cy: startY + (tipY - startY) * t,
      };
    }
    const u = 1 - t;
    return {
      cx: u * u * startX + 2 * u * t * ctrlX + t * t * tipX,
      cy: u * u * startY + 2 * u * t * ctrlY + t * t * tipY,
    };
  };

  const specs = [
    { t: 0.28, r: clampNum(dist * 0.14, 5.5, 12.5) * scale },
    { t: 0.6, r: clampNum(dist * 0.095, 4.0, 9.0) * scale },
    { t: 0.9, r: clampNum(dist * 0.06, 2.8, 6.0) * scale },
  ];

  return specs.map(({ t, r }) => {
    const pt = evalPoint(t);
    return {
      cx: Math.round(pt.cx * 10) / 10,
      cy: Math.round(pt.cy * 10) / 10,
      r: Math.round(r * 10) / 10,
    };
  });
}

function thoughtCircleToSvgPath(c: ThoughtCircle): string {
  const r = Number(c.r.toFixed(1));
  const left = (c.cx - r).toFixed(1);
  const right = (c.cx + r).toFixed(1);
  const cy = c.cy.toFixed(1);
  return `M ${left} ${cy} A ${r} ${r} 0 1 0 ${right} ${cy} A ${r} ${r} 0 1 0 ${left} ${cy} Z`;
}

function buildBalloonBodyPath(shape: BalloonShape, w: number, h: number): string {
  const rx = w / 2;
  const ry = h / 2;
  const cx = rx;
  const cy = ry;

  if (shape === "narration") {
    return `M 3 3 L ${w - 3} 3 L ${w - 3} ${h - 3} L 3 ${h - 3} Z`;
  }
  if (shape === "box") {
    return `M 4 4 L ${w - 4} 4 L ${w - 4} ${h - 4} L 4 ${h - 4} Z`;
  }
  if (shape === "burst") {
    const points = 16;
    const pts: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const radius = i % 2 === 0 ? 1 : 0.72;
      const x = cx + rx * radius * Math.cos(angle);
      const y = cy + ry * radius * Math.sin(angle);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(" ") + " Z";
  }
  if (shape === "double_burst") {
    const points = 24;
    const pts: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const radius = i % 3 === 0 ? 1.08 : i % 2 === 0 ? 0.65 : 0.95;
      const x = cx + rx * radius * Math.cos(angle);
      const y = cy + ry * radius * Math.sin(angle);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(" ") + " Z";
  }
  if (shape === "cloud") {
    const arcs = 10;
    const pts: string[] = [];
    for (let i = 0; i < arcs; i++) {
      const a1 = (i * 2 * Math.PI) / arcs;
      const a2 = ((i + 1) * 2 * Math.PI) / arcs;
      const x1 = cx + rx * Math.cos(a1);
      const y1 = cy + ry * Math.sin(a1);
      const x2 = cx + rx * Math.cos(a2);
      const y2 = cy + ry * Math.sin(a2);
      const r = (w / arcs) * 1.1;
      pts.push(
        `${i === 0 ? `M ${x1.toFixed(1)} ${y1.toFixed(1)}` : ""} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      );
    }
    return pts.join(" ") + " Z";
  }
  if (shape === "electric") {
    const jagged = 24;
    const pts: string[] = [];
    for (let i = 0; i < jagged; i++) {
      const angle = (i * 2 * Math.PI) / jagged;
      const variance = i % 3 === 0 ? 1.15 : i % 2 === 0 ? 0.88 : 1.05;
      const x = cx + rx * variance * Math.cos(angle);
      const y = cy + ry * variance * Math.sin(angle);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(" ") + " Z";
  }
  if (shape === "heart") {
    return `
      M ${cx} ${h * 0.85}
      C ${w * 0.15} ${h * 0.6}, ${w * 0.05} ${h * 0.25}, ${cx * 0.6} ${h * 0.12}
      C ${cx * 0.85} ${h * 0.05}, ${cx} ${h * 0.25}, ${cx} ${h * 0.3}
      C ${cx} ${h * 0.25}, ${cx * 1.15} ${h * 0.05}, ${w - cx * 0.6} ${h * 0.12}
      C ${w * 0.95} ${h * 0.25}, ${w * 0.85} ${h * 0.6}, ${cx} ${h * 0.85} Z
    `;
  }
  if (shape === "rounded") {
    const r = Math.min(w, h) * 0.28;
    return `M ${r + 3} 3 L ${w - r - 3} 3 Q ${w - 3} 3 ${w - 3} ${r + 3} L ${w - 3} ${h - r - 3} Q ${w - 3} ${h - 3} ${w - r - 3} ${h - 3} L ${r + 3} ${h - 3} Q 3 ${h - 3} 3 ${h - r - 3} L 3 ${r + 3} Q 3 3 ${r + 3} 3 Z`;
  }
  if (shape === "scream") {
    const n = 22;
    const pts: string[] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i * Math.PI) / n + Math.sin(i * 7.3) * 0.06;
      const rr = i % 2 === 0 ? 1 + Math.sin(i * 3.7) * 0.12 : 0.66 + Math.cos(i * 5.1) * 0.06;
      pts.push(
        `${i === 0 ? "M" : "L"} ${(cx + rx * rr * Math.cos(a)).toFixed(1)} ${(cy + ry * rr * Math.sin(a)).toFixed(1)}`,
      );
    }
    return pts.join(" ") + " Z";
  }
  if (shape === "wavy") {
    const n = 64;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = 0.9 + Math.sin(a * 14) * 0.035;
      pts.push(
        `${i === 0 ? "M" : "L"} ${(cx + rx * rr * Math.cos(a)).toFixed(1)} ${(cy + ry * rr * Math.sin(a)).toFixed(1)}`,
      );
    }
    return pts.join(" ") + " Z";
  }
  if (shape === "flash") {
    const n = 60;
    const pts: string[] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i * Math.PI) / n;
      const rr = i % 2 === 0 ? 1.05 + Math.abs(Math.sin(i * 2.3)) * 0.12 : 0.86;
      pts.push(
        `${i === 0 ? "M" : "L"} ${(cx + rx * rr * Math.cos(a)).toFixed(1)} ${(cy + ry * rr * Math.sin(a)).toFixed(1)}`,
      );
    }
    return pts.join(" ") + " Z";
  }
  if (shape === "icy") {
    const n = 9;
    let d = `M 4 ${h * 0.12} Q 4 4 ${w * 0.12} 4 L ${w * 0.88} 4 Q ${w - 4} 4 ${w - 4} ${h * 0.12} L ${w - 4} ${h * 0.7}`;
    for (let i = n; i >= 0; i--) {
      const x = 4 + ((w - 8) * i) / n;
      const drip = i % 2 === 0 ? h * 0.7 : h - 3 - (i % 3) * h * 0.08;
      d += ` L ${x.toFixed(1)} ${drip.toFixed(1)}`;
    }
    return d + " Z";
  }
  return `M ${cx} 2 A ${rx - 2} ${ry - 2} 0 1 1 ${cx} ${h - 2} A ${rx - 2} ${ry - 2} 0 1 1 ${cx} 2 Z`;
}

/**
 * Generates separated body, pointed tail, and thought-circle geometry so SVG & Canvas 2D
 * can render seamless merged outlines (`stroke-under-fill`) and trailing thought dots identically.
 */
export function buildBalloonRenderGeometry(b: SpeechBalloon): BalloonRenderGeometry {
  const w = b.width;
  const h = b.height;
  const bodyPath = buildBalloonBodyPath(b.shape, w, h);

  if (!supportsBalloonTails(b.shape)) {
    return {
      bodyPath,
      pointedTailPaths: [],
      thoughtCircles: [],
      combinedPath: bodyPath,
    };
  }

  const tails = getBalloonTails(b);
  if (tails.length === 0) {
    return {
      bodyPath,
      pointedTailPaths: [],
      thoughtCircles: [],
      combinedPath: bodyPath,
    };
  }

  if (b.shape === "cloud") {
    const thoughtCircles = tails.flatMap((t) => buildThoughtCirclesForTail(w, h, t));
    const circlePaths = thoughtCircles.map(thoughtCircleToSvgPath);
    return {
      bodyPath,
      pointedTailPaths: [],
      thoughtCircles,
      combinedPath: [bodyPath, ...circlePaths].join(" "),
    };
  }

  const cx = w / 2;
  const cy = h / 2;
  const inset = tailRootInsetForShape(b.shape);
  const pointedTailPaths = tails.map((t) => {
    const ctrl = t.curved ? defaultCurveControlForTail(t) : null;
    return buildTailSubpath(
      w,
      h,
      cx + t.x,
      cy + t.y,
      Boolean(t.curved),
      ctrl ? cx + ctrl.x : undefined,
      ctrl ? cy + ctrl.y : undefined,
      t.width ?? DEFAULT_TAIL_WIDTH,
      inset,
    );
  });

  return {
    bodyPath,
    pointedTailPaths,
    thoughtCircles: [],
    combinedPath: [bodyPath, ...pointedTailPaths].join(" "),
  };
}

/**
 * Generates an SVG path string for speech balloon contours with curved & multi-tail attachment.
 * Supports object tail, numeric (tailX, tailY, hasTail), plus optional curve / secondary / tails array.
 */
export function generateBalloonPath(
  shape: BalloonShape,
  w: number,
  h: number,
  tailArg?: BalloonTail | { x: number; y: number; curved?: boolean; curveX?: number; curveY?: number } | number,
  tailYArg?: number,
  hasTailArg?: boolean,
  extra?: {
    curved?: boolean;
    curveX?: number;
    curveY?: number;
    secondaryTail?: BalloonTail;
    tails?: BalloonTail[];
  },
): string {
  const rx = w / 2;
  const ry = h / 2;
  const cx = rx;
  const cy = ry;
  const bodyPath = buildBalloonBodyPath(shape, w, h);

  if (!supportsBalloonTails(shape)) return bodyPath;

  const inset = tailRootInsetForShape(shape);
  const collectedTails: BalloonTail[] = [];

  if (Array.isArray(extra?.tails)) {
    for (const t of extra.tails.slice(0, MAX_BALLOON_TAILS)) {
      collectedTails.push(t);
    }
  } else {
    if (typeof tailArg === "number") {
      if (hasTailArg !== false) {
        collectedTails.push({
          x: tailArg,
          y: tailYArg ?? 0,
          curved: Boolean(extra?.curved),
          curveX: extra?.curveX !== undefined ? extra.curveX - cx : undefined,
          curveY: extra?.curveY !== undefined ? extra.curveY - cy : undefined,
        });
      }
    } else if (tailArg && typeof tailArg === "object") {
      const explicitCurveX = tailArg.curveX ?? extra?.curveX;
      const explicitCurveY = tailArg.curveY ?? extra?.curveY;
      collectedTails.push({
        x: tailArg.x - cx,
        y: tailArg.y - cy,
        curved: Boolean(tailArg.curved ?? extra?.curved),
        curveX: explicitCurveX !== undefined ? explicitCurveX - cx : undefined,
        curveY: explicitCurveY !== undefined ? explicitCurveY - cy : undefined,
        width: (tailArg as BalloonTail).width,
      });
    }

    if (extra?.secondaryTail) {
      collectedTails.push(extra.secondaryTail);
    }
  }

  if (collectedTails.length === 0) return bodyPath;

  if (shape === "cloud") {
    const circlePaths = collectedTails
      .flatMap((t) => buildThoughtCirclesForTail(w, h, t))
      .map(thoughtCircleToSvgPath);
    return [bodyPath, ...circlePaths].join(" ");
  }

  const tailParts = collectedTails.slice(0, MAX_BALLOON_TAILS).map((t) => {
    const ctrl = t.curved ? defaultCurveControlForTail(t) : null;
    return buildTailSubpath(
      w,
      h,
      cx + t.x,
      cy + t.y,
      Boolean(t.curved),
      ctrl ? cx + ctrl.x : undefined,
      ctrl ? cy + ctrl.y : undefined,
      t.width ?? DEFAULT_TAIL_WIDTH,
      inset,
    );
  });

  return `${bodyPath} ${tailParts.join(" ")}`;
}

/** Convenience wrapper generating full balloon SVG path directly from a SpeechBalloon object. */
export function balloonPathFromSpec(b: SpeechBalloon): string {
  return buildBalloonRenderGeometry(b).combinedPath;
}

/** Deterministic PRNG in [0, 1) for crisp repeatable speed line geometry. */
function pseudoNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Generates radial speed lines (focus burst) deterministically. */
export function generateRadialSpeedLines(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  density: number,
  _strokeWidth: number,
  _color: string,
): string[] {
  const lines: string[] = [];
  const count = Math.max(10, density);

  for (let i = 0; i < count; i++) {
    const n1 = pseudoNoise(i + 1);
    const n2 = pseudoNoise(i * 3 + 7);
    const angle = (i * 2 * Math.PI) / count + (Math.sin(i * 3.1) * 0.35 * Math.PI) / count;
    const startR = innerR + n1 * (innerR * 0.3);
    const endR = outerR + n2 * 40;

    const x1 = cx + startR * Math.cos(angle);
    const y1 = cy + startR * Math.sin(angle);
    const x2 = cx + endR * Math.cos(angle);
    const y2 = cy + endR * Math.sin(angle);

    lines.push(`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  return lines;
}

/** Generates tapered wedge polygons for manga 集中線 radial focus lines & linear flash streaks. */
export function generateSpeedWedges(effect: SpeedLinesEffect): { x: number; y: number }[][] {
  const wedges: { x: number; y: number }[][] = [];
  const count = Math.max(10, effect.density);
  const sw = Math.max(0.8, effect.strokeWidth || 1.5);

  if (effect.type === "linear") {
    const rad = (effect.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const perpX = -sin;
    const perpY = cos;
    for (let i = 0; i < count; i++) {
      const n1 = pseudoNoise(i + 13);
      const n2 = pseudoNoise(i * 5 + 3);
      const off = (i - count / 2) * 12 + (n1 - 0.5) * 4;
      const lenScale = 0.65 + n2 * 0.55;
      const halfLen = effect.outerRadius * lenScale;
      const cx = effect.centerX + off * perpX;
      const cy = effect.centerY + off * perpY;
      const halfW = sw * (0.65 + n1 * 0.85);
      wedges.push([
        { x: cx - cos * halfLen, y: cy - sin * halfLen },
        { x: cx + perpX * halfW, y: cy + perpY * halfW },
        { x: cx + cos * halfLen, y: cy + sin * halfLen },
        { x: cx - perpX * halfW, y: cy - perpY * halfW },
      ]);
    }
    return wedges;
  }

  for (let i = 0; i < count; i++) {
    const n1 = pseudoNoise(i + 1);
    const n2 = pseudoNoise(i * 3 + 7);
    const angle = (i * 2 * Math.PI) / count + (Math.sin(i * 3.1) * 0.35 * Math.PI) / count;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const perpX = -sin;
    const perpY = cos;
    const startR = effect.innerRadius + n1 * (effect.innerRadius * 0.25);
    const endR = effect.outerRadius + n2 * 40;
    const baseHalf = Math.max(1.1, sw * (1.2 + n2 * 1.4));

    const tipX = effect.centerX + startR * cos;
    const tipY = effect.centerY + startR * sin;
    const outerX = effect.centerX + endR * cos;
    const outerY = effect.centerY + endR * sin;

    wedges.push([
      { x: outerX + perpX * baseHalf, y: outerY + perpY * baseHalf },
      { x: tipX, y: tipY },
      { x: outerX - perpX * baseHalf, y: outerY - perpY * baseHalf },
    ]);
  }
  return wedges;
}

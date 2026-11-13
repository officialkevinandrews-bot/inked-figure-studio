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
  | "icy"; // Cold / menacing icicle edge

export interface BalloonTail {
  x: number; // tip X relative to balloon top-left
  y: number; // tip Y relative to balloon top-left
  curved?: boolean;
  curveX?: number; // control point for quadratic bezier
  curveY?: number;
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
  tail?: BalloonTail;
  tailX?: number;
  tailY?: number;
  secondaryTail?: BalloonTail; // For 2-person group dialogue
  hasTail: boolean;
  hasSecondaryTail?: boolean;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: "normal" | "bold";
  fontColor?: string;
  writingMode?: "horizontal-tb" | "vertical-rl"; // Traditional Japanese vertical text
  isVertical?: boolean;
  borderWidth?: number;
  borderColor?: string;
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

/**
 * Generates an SVG path string for speech balloon contours with curved tail attachment.
 * Supports both object tail { x, y, curved, curveX, curveY } and numeric (tailX, tailY, hasTail).
 */
export function generateBalloonPath(
  shape: BalloonShape,
  w: number,
  h: number,
  tailArg?: BalloonTail | { x: number; y: number; curved?: boolean; curveX?: number; curveY?: number } | number,
  tailYArg?: number,
  hasTailArg?: boolean
): string {
  const rx = w / 2;
  const ry = h / 2;
  const cx = rx;
  const cy = ry;

  let bodyPath = "";

  if (shape === "box") {
    bodyPath = `M 4 4 L ${w - 4} 4 L ${w - 4} ${h - 4} L 4 ${h - 4} Z`;
  } else if (shape === "burst") {
    // Spiky shout burst
    const points = 16;
    const pts: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const radius = i % 2 === 0 ? 1 : 0.72;
      const x = cx + rx * radius * Math.cos(angle);
      const y = cy + ry * radius * Math.sin(angle);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    bodyPath = pts.join(" ") + " Z";
  } else if (shape === "double_burst") {
    // Extreme double explosion burst
    const points = 24;
    const pts: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points;
      const radius = i % 3 === 0 ? 1.08 : i % 2 === 0 ? 0.65 : 0.95;
      const x = cx + rx * radius * Math.cos(angle);
      const y = cy + ry * radius * Math.sin(angle);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    bodyPath = pts.join(" ") + " Z";
  } else if (shape === "cloud") {
    // Thought cloud with circular arcs
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
        `${i === 0 ? `M ${x1.toFixed(1)} ${y1.toFixed(1)}` : ""} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
      );
    }
    bodyPath = pts.join(" ") + " Z";
  } else if (shape === "electric") {
    // Jagged electric broadcast balloon
    const jagged = 24;
    const pts: string[] = [];
    for (let i = 0; i < jagged; i++) {
      const angle = (i * 2 * Math.PI) / jagged;
      const variance = i % 3 === 0 ? 1.15 : i % 2 === 0 ? 0.88 : 1.05;
      const x = cx + rx * variance * Math.cos(angle);
      const y = cy + ry * variance * Math.sin(angle);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    bodyPath = pts.join(" ") + " Z";
  } else if (shape === "heart") {
    // Soft heart balloon
    bodyPath = `
      M ${cx} ${h * 0.85}
      C ${w * 0.15} ${h * 0.6}, ${w * 0.05} ${h * 0.25}, ${cx * 0.6} ${h * 0.12}
      C ${cx * 0.85} ${h * 0.05}, ${cx} ${h * 0.25}, ${cx} ${h * 0.3}
      C ${cx} ${h * 0.25}, ${cx * 1.15} ${h * 0.05}, ${w - cx * 0.6} ${h * 0.12}
      C ${w * 0.95} ${h * 0.25}, ${w * 0.85} ${h * 0.6}, ${cx} ${h * 0.85} Z
    `;
  } else if (shape === "rounded") {
    const r = Math.min(w, h) * 0.28;
    bodyPath = `M ${r + 3} 3 L ${w - r - 3} 3 Q ${w - 3} 3 ${w - 3} ${r + 3} L ${w - 3} ${h - r - 3} Q ${w - 3} ${h - 3} ${w - r - 3} ${h - 3} L ${r + 3} ${h - 3} Q 3 ${h - 3} 3 ${h - r - 3} L 3 ${r + 3} Q 3 3 ${r + 3} 3 Z`;
  } else if (shape === "scream") {
    const n = 22;
    const pts: string[] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i * Math.PI) / n + Math.sin(i * 7.3) * 0.06;
      const rr = i % 2 === 0 ? 1 + Math.sin(i * 3.7) * 0.12 : 0.66 + Math.cos(i * 5.1) * 0.06;
      pts.push(`${i === 0 ? "M" : "L"} ${(cx + rx * rr * Math.cos(a)).toFixed(1)} ${(cy + ry * rr * Math.sin(a)).toFixed(1)}`);
    }
    bodyPath = pts.join(" ") + " Z";
  } else if (shape === "wavy") {
    const n = 64;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = 0.9 + Math.sin(a * 14) * 0.035;
      pts.push(`${i === 0 ? "M" : "L"} ${(cx + rx * rr * Math.cos(a)).toFixed(1)} ${(cy + ry * rr * Math.sin(a)).toFixed(1)}`);
    }
    bodyPath = pts.join(" ") + " Z";
  } else if (shape === "flash") {
    const n = 60;
    const pts: string[] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i * Math.PI) / n;
      const rr = i % 2 === 0 ? 1.05 + Math.abs(Math.sin(i * 2.3)) * 0.12 : 0.86;
      pts.push(`${i === 0 ? "M" : "L"} ${(cx + rx * rr * Math.cos(a)).toFixed(1)} ${(cy + ry * rr * Math.sin(a)).toFixed(1)}`);
    }
    bodyPath = pts.join(" ") + " Z";
  } else if (shape === "icy") {
    const n = 9;
    let d = `M 4 ${h * 0.12} Q 4 4 ${w * 0.12} 4 L ${w * 0.88} 4 Q ${w - 4} 4 ${w - 4} ${h * 0.12} L ${w - 4} ${h * 0.7}`;
    for (let i = n; i >= 0; i--) {
      const x = 4 + ((w - 8) * i) / n;
      const drip = i % 2 === 0 ? h * 0.7 : h - 3 - (i % 3) * h * 0.08;
      d += ` L ${x.toFixed(1)} ${drip.toFixed(1)}`;
    }
    bodyPath = d + " Z";
  } else {
    // Standard Oval & Whisper
    bodyPath = `M ${cx} 2 A ${rx - 2} ${ry - 2} 0 1 1 ${cx} ${h - 2} A ${rx - 2} ${ry - 2} 0 1 1 ${cx} 2 Z`;
  }

  // Determine tail parameters
  if (shape === "box" || shape === "icy") return bodyPath;

  let hasTail = true;
  let tipX = 0;
  let tipY = 0;
  let isCurved = false;
  let curveX: number | undefined;
  let curveY: number | undefined;

  if (typeof tailArg === "number") {
    // Numeric signature (w, h, tailX, tailY, hasTail)
    if (hasTailArg === false) return bodyPath;
    tipX = cx + tailArg;
    tipY = cy + (tailYArg ?? 0);
  } else if (tailArg && typeof tailArg === "object") {
    // Object signature
    tipX = tailArg.x;
    tipY = tailArg.y;
    isCurved = Boolean(tailArg.curved);
    curveX = tailArg.curveX;
    curveY = tailArg.curveY;
  } else {
    return bodyPath;
  }

  const rootAngle = Math.atan2(tipY - cy, tipX - cx);
  const rootX = cx + rx * 0.8 * Math.cos(rootAngle);
  const rootY = cy + ry * 0.8 * Math.sin(rootAngle);
  const perpX = -Math.sin(rootAngle) * 12;
  const perpY = Math.cos(rootAngle) * 12;

  let tailPath = "";
  if (isCurved && curveX !== undefined && curveY !== undefined) {
    tailPath = `
      M ${rootX + perpX} ${rootY + perpY}
      Q ${curveX} ${curveY} ${tipX} ${tipY}
      Q ${curveX + perpX * 0.5} ${curveY + perpY * 0.5} ${rootX - perpX} ${rootY - perpY}
    `;
  } else {
    // Quadratic smooth tapered tail
    const midX = (rootX + tipX) / 2 + perpX * 0.3;
    const midY = (rootY + tipY) / 2 + perpY * 0.3;
    tailPath = `
      M ${rootX + perpX} ${rootY + perpY}
      Q ${midX} ${midY} ${tipX} ${tipY}
      Q ${midX - perpX * 0.5} ${midY - perpY * 0.5} ${rootX - perpX} ${rootY - perpY}
    `;
  }

  return `${bodyPath} ${tailPath}`;
}

/** Generates radial speed lines (focus burst) */
export function generateRadialSpeedLines(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  density: number,
  strokeWidth: number,
  color: string
): string[] {
  const lines: string[] = [];
  const count = Math.max(10, density);

  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count + (Math.sin(i * 3.1) * 0.35 * Math.PI) / count;
    const startR = innerR + Math.random() * (innerR * 0.3);
    const endR = outerR + Math.random() * 40;

    const x1 = cx + startR * Math.cos(angle);
    const y1 = cy + startR * Math.sin(angle);
    const x2 = cx + endR * Math.cos(angle);
    const y2 = cy + endR * Math.sin(angle);

    lines.push(`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  return lines;
}

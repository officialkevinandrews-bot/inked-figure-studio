export type BalloonShape =
  | "oval"
  | "burst" // Shout / scream
  | "cloud" // Thought
  | "box" // Narration
  | "whisper" // Dashed outline
  | "electric"; // Radio / mechanical broadcast

export interface SpeechBalloon {
  id: string;
  panelId: string;
  shape: BalloonShape;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tailX: number; // Tail tip coordinates relative to balloon center
  tailY: number;
  hasTail: boolean;
  fontSize: number;
  fontFamily: string;
  isVertical: boolean; // Traditional Japanese vertical text
  borderWidth: number;
  borderColor: string;
  backgroundColor: string;
  zIndex: number;
}

export interface ComicMark {
  id: string;
  panelId: string;
  type: "sweat" | "anger" | "sparkles" | "shock" | "question" | "exclamation" | "heart" | "spiral";
  x: number;
  y: number;
  size: number;
  rotation: number;
  zIndex: number;
}

export interface SpeedLinesEffect {
  id: string;
  panelId: string;
  type: "radial" | "linear";
  centerX: number; // in px or %
  centerY: number;
  angle: number; // for linear lines
  density: number; // 20 to 120 lines
  innerRadius: number; // blank focal area in center
  outerRadius: number;
  strokeWidth: number;
  color: string;
  zIndex: number;
}

export interface SFXStamp {
  id: string;
  panelId: string;
  text: string; // e.g. "ドドド", "BOOM!"
  x: number;
  y: number;
  fontSize: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  rotation: number;
  skewX: number;
  zIndex: number;
}

export const SFX_PRESETS = [
  { text: "ドドド", label: "DODODO (Ominous Rumble)" },
  { text: "ゴゴゴ", label: "GOGOGO (Menacing Tension)" },
  { text: "ドン!", label: "DON! (Dramatic Impact)" },
  { text: "バキッ", label: "BAKI! (Punch / Crack)" },
  { text: "ザッ", label: "ZASH! (Dash / Rapid Step)" },
  { text: "BOOM!", label: "BOOM! (Explosion)" },
  { text: "WHAM!", label: "WHAM! (Heavy Strike)" },
  { text: "SLASH!", label: "SLASH! (Blade Cut)" },
  { text: "WHOOSH!", label: "WHOOSH! (Air Gust / Speed)" },
];

export const COMIC_MARK_PRESETS = [
  { type: "sweat" as const, label: "Sweat Drop 💧", symbol: "💧" },
  { type: "anger" as const, label: "Anger Mark 💢", symbol: "💢" },
  { type: "sparkles" as const, label: "Sparkles ✨", symbol: "✨" },
  { type: "shock" as const, label: "Shock Lines ⚡", symbol: "///" },
  { type: "question" as const, label: "Question ❓", symbol: "❓" },
  { type: "exclamation" as const, label: "Exclamation ❗", symbol: "❗" },
  { type: "heart" as const, label: "Love Heart ❤️", symbol: "❤️" },
  { type: "spiral" as const, label: "Dizziness 💫", symbol: "🌀" },
];

/** Generates SVG path data for speech balloon bodies */
export function generateBalloonPath(
  shape: BalloonShape,
  w: number,
  h: number,
  tailX: number,
  tailY: number,
  hasTail: boolean
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
  } else if (shape === "cloud") {
    // Thought cloud with multiple circular arcs
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
      pts.push(`${i === 0 ? `M ${x1.toFixed(1)} ${y1.toFixed(1)}` : ""} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`);
    }
    bodyPath = pts.join(" ") + " Z";
  } else if (shape === "electric") {
    // Jagged electric radio balloon
    const jagged = 24;
    const pts: string[] = [];
    for (let i = 0; i < jagged; i++) {
      const angle = (i * 2 * Math.PI) / jagged;
      const variance = (i % 3 === 0 ? 1.15 : i % 2 === 0 ? 0.9 : 1.05);
      const x = cx + rx * variance * Math.cos(angle);
      const y = cy + ry * variance * Math.sin(angle);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    bodyPath = pts.join(" ") + " Z";
  } else {
    // Standard Oval & Whisper
    bodyPath = `M ${cx} 2 A ${rx - 2} ${ry - 2} 0 1 1 ${cx} ${h - 2} A ${rx - 2} ${ry - 2} 0 1 1 ${cx} 2 Z`;
  }

  // Tail path attachment
  if (!hasTail || shape === "box") return bodyPath;

  const tailRootX = cx + Math.sign(tailX) * Math.min(rx * 0.4, 25);
  const tailRootY = cy + Math.sign(tailY) * Math.min(ry * 0.4, 25);
  const tailWidth = 14;

  const tailPath = `M ${tailRootX - tailWidth / 2} ${tailRootY} Q ${tailRootX + tailX * 0.4} ${tailRootY + tailY * 0.4} ${cx + tailX} ${cy + tailY} Q ${tailRootX + tailX * 0.6} ${tailRootY + tailY * 0.6} ${tailRootX + tailWidth / 2} ${tailRootY}`;

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
    const angle = (i * 2 * Math.PI) / count + (Math.random() - 0.5) * (Math.PI / count) * 0.5;
    const startR = innerR + Math.random() * (innerR * 0.35);
    const endR = outerR + Math.random() * 50;

    const x1 = cx + startR * Math.cos(angle);
    const y1 = cy + startR * Math.sin(angle);
    const x2 = cx + endR * Math.cos(angle);
    const y2 = cy + endR * Math.sin(angle);

    lines.push(`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  return lines;
}

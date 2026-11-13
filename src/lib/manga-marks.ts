/** Vector manga emotion marks, drawn in a 100×100 box centred on the mark position. */
export interface MarkPart { d: string; fill?: string; stroke?: string; width?: number }

const INK = "#000000";
export const MARK_PATHS: Record<string, MarkPart[]> = {
  anger: [
    { d: "M50 46 C40 30 30 26 18 30 M54 46 C60 30 70 26 82 30 M50 54 C40 70 30 74 18 70 M54 54 C60 70 70 74 82 70", stroke: "#d4141c", width: 9 },
  ],
  sweat: [{ d: "M50 8 C62 34 76 50 76 66 A26 26 0 0 1 24 66 C24 50 38 34 50 8 Z", fill: "#ffffff", stroke: INK, width: 5 }, { d: "M38 64 C38 72 44 78 50 79", stroke: INK, width: 3.5 }],
  sparkles: [
    { d: "M40 10 L46 38 L74 44 L46 50 L40 78 L34 50 L6 44 L34 38 Z", fill: INK },
    { d: "M76 54 L79 66 L91 69 L79 72 L76 84 L73 72 L61 69 L73 66 Z", fill: INK },
  ],
  shock: [{ d: "M20 20 L30 80 M38 20 L48 80 M56 20 L66 80 M74 20 L84 80", stroke: INK, width: 5 }],
  blush: [{ d: "M14 40 L30 62 M30 40 L46 62 M54 40 L70 62 M70 40 L86 62", stroke: "#e11d48", width: 5 }],
  question: [{ d: "M30 32 C30 12 70 10 70 32 C70 48 50 50 50 64 M50 80 L50 84", stroke: INK, width: 10 }],
  exclamation: [{ d: "M50 10 L50 62 M50 80 L50 86", stroke: INK, width: 12 }],
  heart: [{ d: "M50 86 C10 58 6 34 22 22 C34 14 46 20 50 32 C54 20 66 14 78 22 C94 34 90 58 50 86 Z", fill: "#e11d48", stroke: INK, width: 4 }],
  spiral: [{ d: "M50 50 m0 -4 a4 4 0 1 1 -4 4 a10 10 0 1 1 10 10 a18 18 0 1 1 -18 -18 a28 28 0 1 1 28 28 a38 38 0 1 1 -38 -38", stroke: INK, width: 5, fill: "none" }],
  tears: [{ d: "M30 10 C26 40 22 70 30 92 M70 10 C74 40 78 70 70 92", stroke: "#38bdf8", width: 10 }, { d: "M30 10 C26 40 22 70 30 92 M70 10 C74 40 78 70 70 92", stroke: INK, width: 2 }],
  sleep: [{ d: "M14 50 L34 50 L14 72 L34 72 M48 26 L64 26 L48 44 L64 44 M76 8 L88 8 L76 22 L88 22", stroke: INK, width: 5 }],
  skull: [{ d: "M50 12 C26 12 16 30 18 50 C20 62 28 64 30 72 L30 84 L70 84 L70 72 C72 64 80 62 82 50 C84 30 74 12 50 12 Z", fill: "#ffffff", stroke: INK, width: 5 }, { d: "M36 46 A7 8 0 1 0 36.1 46 Z M64 46 A7 8 0 1 0 64.1 46 Z M46 66 L50 58 L54 66 Z", fill: INK }],
  impact: [{ d: "M50 4 L58 34 L90 22 L68 46 L96 62 L62 62 L66 96 L48 68 L24 92 L32 60 L4 52 L34 40 L18 12 L44 30 Z", fill: "#ffffff", stroke: INK, width: 5 }],
  vein: [{ d: "M30 30 L45 45 M70 30 L55 45 M30 70 L45 55 M70 70 L55 55", stroke: INK, width: 10 }],
  music: [{ d: "M36 74 A10 8 0 1 1 36 73.9 Z M76 64 A10 8 0 1 1 76 63.9 Z", fill: INK }, { d: "M45 74 L45 20 L85 12 L85 64 M45 32 L85 24", stroke: INK, width: 6 }],
  gloom: [{ d: "M10 12 L10 60 M24 12 L24 74 M38 12 L38 54 M52 12 L52 80 M66 12 L66 62 M80 12 L80 72 M94 12 L94 50", stroke: INK, width: 3 }],
  lightbulb: [{ d: "M50 10 A26 26 0 0 1 64 58 L64 70 L36 70 L36 58 A26 26 0 0 1 50 10 Z", fill: "#fde047", stroke: INK, width: 5 }, { d: "M38 78 L62 78 M42 86 L58 86", stroke: INK, width: 5 }],
};

export const VECTOR_MARKS: { type: string; label: string }[] = [
  { type: "anger", label: "Anger cross" },
  { type: "vein", label: "Vein pop" },
  { type: "sweat", label: "Sweat drop" },
  { type: "blush", label: "Blush lines" },
  { type: "shock", label: "Shock lines" },
  { type: "gloom", label: "Gloom lines" },
  { type: "sparkles", label: "Sparkles" },
  { type: "heart", label: "Heart" },
  { type: "question", label: "Question" },
  { type: "exclamation", label: "Exclamation" },
  { type: "spiral", label: "Dizzy spiral" },
  { type: "tears", label: "Tear streams" },
  { type: "sleep", label: "Zzz" },
  { type: "skull", label: "Doom skull" },
  { type: "impact", label: "Impact star" },
  { type: "music", label: "Music notes" },
  { type: "lightbulb", label: "Idea!" },
];

export function markPath(type?: string): MarkPart[] | null {
  return (type && MARK_PATHS[type]) || null;
}

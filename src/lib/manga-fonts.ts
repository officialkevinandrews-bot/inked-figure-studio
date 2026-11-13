/** Lettering fonts for balloons and SFX. All load from Google Fonts in the root <head>. */
export interface MangaFont {
  id: string;
  label: string;
  family: string; // CSS family name
  use: "dialogue" | "sfx" | "both";
  jp?: boolean; // has Japanese glyphs
}

export const MANGA_FONTS: MangaFont[] = [
  { id: "comic-neue", label: "Comic Neue (classic letterer)", family: "Comic Neue", use: "dialogue" },
  { id: "kosugi-maru", label: "Kosugi Maru (round JP)", family: "Kosugi Maru", use: "dialogue", jp: true },
  { id: "zen-maru", label: "Zen Maru Gothic (soft JP)", family: "Zen Maru Gothic", use: "dialogue", jp: true },
  { id: "zen-kaku", label: "Zen Kaku Gothic (clean JP)", family: "Zen Kaku Gothic New", use: "dialogue", jp: true },
  { id: "sawarabi-mincho", label: "Sawarabi Mincho (narration)", family: "Sawarabi Mincho", use: "dialogue", jp: true },
  { id: "patrick-hand", label: "Patrick Hand (hand-lettered)", family: "Patrick Hand", use: "dialogue" },
  { id: "yusei-magic", label: "Yusei Magic (marker JP)", family: "Yusei Magic", use: "both", jp: true },
  { id: "bangers", label: "Bangers (shout)", family: "Bangers", use: "both" },
  { id: "permanent-marker", label: "Permanent Marker", family: "Permanent Marker", use: "both" },
  { id: "dela-gothic", label: "Dela Gothic One (heavy JP)", family: "Dela Gothic One", use: "sfx", jp: true },
  { id: "reggae-one", label: "Reggae One (impact JP)", family: "Reggae One", use: "sfx", jp: true },
  { id: "rocknroll-one", label: "RocknRoll One (punchy JP)", family: "RocknRoll One", use: "sfx", jp: true },
  { id: "mochiy-pop", label: "Mochiy Pop One (cute JP)", family: "Mochiy Pop One", use: "sfx", jp: true },
  { id: "potta-one", label: "Potta One (brush JP)", family: "Potta One", use: "sfx", jp: true },
  { id: "rampart-one", label: "Rampart One (3D outline JP)", family: "Rampart One", use: "sfx", jp: true },
  { id: "creepster", label: "Creepster (horror)", family: "Creepster", use: "sfx" },
];

export const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "Bangers", "Comic+Neue:wght@400;700", "Kosugi+Maru", "Zen+Maru+Gothic:wght@500;700", "Zen+Kaku+Gothic+New:wght@400;700",
    "Sawarabi+Mincho", "Patrick+Hand", "Yusei+Magic", "Permanent+Marker", "Dela+Gothic+One", "Reggae+One",
    "RocknRoll+One", "Mochiy+Pop+One", "Potta+One", "Rampart+One", "Creepster",
  ].map((f) => `family=${f}`).join("&") + "&display=swap";

/** A safe CSS font stack for a font id (or raw family) with sensible fallbacks. */
export function fontStack(idOrFamily?: string, kind: "dialogue" | "sfx" = "dialogue"): string {
  const f = MANGA_FONTS.find((m) => m.id === idOrFamily || m.family === idOrFamily);
  const fb = kind === "sfx" ? `"Dela Gothic One", Impact, "Arial Black", sans-serif` : `"Comic Neue", "Kosugi Maru", sans-serif`;
  if (f) return `"${f.family}", ${fb}`;
  if (idOrFamily && idOrFamily !== "inherit") return `${idOrFamily}, ${fb}`;
  return fb;
}

/** Wait for web fonts so canvas export letters with the right faces. */
export async function ensureFontsLoaded() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all(MANGA_FONTS.map((f) => document.fonts.load(`700 32px "${f.family}"`, "Aあア")));
    await document.fonts.ready;
  } catch {
    /* fall back to whatever is available */
  }
}

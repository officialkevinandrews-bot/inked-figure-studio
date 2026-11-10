import { describe, it, expect } from "vitest";
import { MANGA_BACKGROUNDS, getMangaBackgroundDataUrl } from "./manga-backgrounds";
import { PRESET_ROSTER, saveRosterItem, loadSavedRoster } from "./character-roster";
import { PRESET_LAYOUT_CATALOG, getPresetPanels } from "./manga-layout";

describe("Manga Pro Features: Background Plates & Screentones", () => {
  it("provides rich ComiPo-style manga backgrounds across scenery, action, mood, screentones", () => {
    expect(MANGA_BACKGROUNDS.length).toBeGreaterThanOrEqual(10);
    const categories = new Set(MANGA_BACKGROUNDS.map((b) => b.category));
    expect(categories.has("scenery")).toBe(true);
    expect(categories.has("action")).toBe(true);
    expect(categories.has("mood")).toBe(true);
    expect(categories.has("screentone")).toBe(true);

    const classroom = MANGA_BACKGROUNDS.find((b) => b.id === "classroom_day");
    expect(classroom).toBeDefined();
    const svg = classroom!.generateSvg(800, 1130);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("viewBox=\"0 0 800 1130\"");

    const dataUrl = getMangaBackgroundDataUrl(classroom!, 800, 1130);
    expect(dataUrl).toMatch(/^data:image\/svg\+xml/);
  });
});

describe("Manga Pro Features: Character Roster & Staging Shelf", () => {
  it("provides preset manga character archetypes ready for staging", () => {
    expect(PRESET_ROSTER.length).toBeGreaterThanOrEqual(4);
    const roles = PRESET_ROSTER.map((c) => c.role);
    expect(roles).toContain("Protagonist");
    expect(roles).toContain("Antagonist");
    expect(roles).toContain("Reaction");
  });

  it("persists rendered 3D character figures into local roster storage", () => {
    const customChar = {
      id: "test-char-1",
      name: "Custom Hero Inked",
      role: "Hero",
      previewUrl: "data:image/png;base64,fake",
    };
    saveRosterItem(customChar);
    const loaded = loadSavedRoster();
    expect(loaded.some((c) => c.id === "test-char-1")).toBe(true);
  });
});

describe("Manga Pro Features: Extended Grid Layout Catalog", () => {
  it("includes classic, action, cinematic, and webtoon layout templates", () => {
    expect(PRESET_LAYOUT_CATALOG.length).toBeGreaterThanOrEqual(8);

    const shonen7 = getPresetPanels("shonen-slash-7");
    expect(shonen7.length).toBe(7);

    const cinema3 = getPresetPanels("3-cinema");
    expect(cinema3.length).toBe(3);

    const shojo5 = getPresetPanels("shojo-focus-5");
    expect(shojo5.length).toBe(5);

    const webtoon3 = getPresetPanels("webtoon-3");
    expect(webtoon3.length).toBe(3);
  });
});

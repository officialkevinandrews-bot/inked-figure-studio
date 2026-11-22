import { describe, expect, it } from "vitest";
import {
  generateBalloonPath,
  generateRadialSpeedLines,
  SFX_CATEGORIES,
  SFX_PRESETS,
  COMIC_MARK_PRESETS,
} from "./manga-effects";

describe("Phase 3: Speech Balloon Paths", () => {
  it("generates valid SVG path data for all balloon shapes", () => {
    const shapes = ["oval", "burst", "cloud", "box", "whisper", "electric"] as const;
    shapes.forEach((s) => {
      const pathWithTail = generateBalloonPath(s, 200, 100, 30, 40, true);
      expect(pathWithTail).toContain("M");
      expect(pathWithTail).toContain("Z");
      expect(pathWithTail.length).toBeGreaterThan(10);

      const pathNoTail = generateBalloonPath(s, 200, 100, 0, 0, false);
      expect(pathNoTail).toContain("M");
    });
  });
});

describe("Phase 3: Manga Screentones & Speed Lines", () => {
  it("generates radial speed lines around a focal point", () => {
    const lines = generateRadialSpeedLines(400, 300, 50, 250, 40, 2, "#000000");
    expect(lines.length).toBe(40);
    expect(lines[0]).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? L \d+(\.\d+)? \d+(\.\d+)?$/);
  });
});

describe("Phase 3: Comic Marks & SFX Presets", () => {
  it("provides essential ComiPo emotion marks", () => {
    const types = COMIC_MARK_PRESETS.map((m) => m.type);
    expect(types).toContain("sweat");
    expect(types).toContain("anger");
    expect(types).toContain("shock");
    expect(types).toContain("sparkles");
  });

  it("provides 200+ categorized English onomatopoeia stamps with zero Japanese characters", () => {
    expect(SFX_PRESETS.length).toBeGreaterThanOrEqual(200);
    const texts = SFX_PRESETS.map((s) => s.text);
    for (const s of SFX_PRESETS) {
      expect(/[\u3040-\u30ff]/.test(s.text)).toBe(false);
    }
    for (const cat of SFX_CATEGORIES) {
      expect(SFX_PRESETS.some((s) => s.category === cat.id)).toBe(true);
    }
    expect(texts).toContain("BOOM!");
    expect(texts).toContain("SLASH!");
    expect(texts).toContain("WHOOSH!");
    expect(texts).toContain("GASP!");
    expect(texts).toContain("BA-DUMP");
  });
});

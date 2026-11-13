import { describe, expect, it } from "vitest";
import { PAGE_FORMATS, getPresetPanels, type PageLayout } from "./manga-layout";
import {
  WEBTOON_SLICE_HEIGHT,
  WEBTOON_WIDTH,
  adjustWebtoonSegmentHeight,
  createWebtoonBeatPage,
  createWebtoonSpacerPage,
  getWebtoonMetrics,
  getWebtoonSeams,
} from "./webtoon";

function makePage(id: string, formatIndex: number): PageLayout {
  return {
    id,
    pageNumber: 1,
    format: PAGE_FORMATS[formatIndex],
    panels: getPresetPanels("classic-6"),
    elements: [],
    balloons: [],
    comicMarks: [],
    speedLines: [],
    sfxStamps: [],
  };
}

describe("Phase 5 Infinite Webtoon Scroll & Mobile Slice Seams", () => {
  it("computes normalized 800px cumulative scroll metrics across mixed paper formats", () => {
    const tankobon = makePage("p1", 0); // 800x1200 -> 1200 scaled
    const yonkoma = makePage("p2", 3); // 500x1400 -> 1.6x -> 2240 scaled
    const metrics = getWebtoonMetrics([tankobon, yonkoma], WEBTOON_WIDTH);

    expect(metrics.sections).toHaveLength(2);
    expect(metrics.sections[0]).toEqual({
      pageIndex: 0,
      pageId: "p1",
      startY: 0,
      scaledHeight: 1200,
      scaleTo800: 1,
    });
    expect(metrics.sections[1]).toEqual({
      pageIndex: 1,
      pageId: "p2",
      startY: 1200,
      scaledHeight: 2240,
      scaleTo800: 1.6,
    });
    expect(metrics.totalHeight).toBe(3440);
  });

  it("maps 1280px Webtoon export slice seams into per-page local Y coordinates", () => {
    const beat1 = createWebtoonBeatPage(1); // 800x2400
    const spacer = createWebtoonSpacerPage(2, 420); // 800x420 -> total 2820
    const seams = getWebtoonSeams([beat1, spacer], WEBTOON_SLICE_HEIGHT, WEBTOON_WIDTH);

    // 2820 total -> cuts at y=1280 (on page 0) and y=2560 (on page 1, localY = 2560 - 2400 = 160)
    expect(seams).toHaveLength(2);
    expect(seams[0]).toEqual({
      sliceNumber: 1,
      globalY: 1280,
      pageIndex: 0,
      localY: 1280,
    });
    expect(seams[1]).toEqual({
      sliceNumber: 2,
      globalY: 2560,
      pageIndex: 1,
      localY: 160,
    });
  });

  it("adjusts segment height cleanly with clamping and builds borderless spacers & beats", () => {
    const beat = createWebtoonBeatPage(1);
    expect(beat.format.width).toBe(800);
    expect(beat.format.height).toBe(2400);
    expect(beat.panels.length).toBeGreaterThanOrEqual(3);

    const taller = adjustWebtoonSegmentHeight(beat, 360);
    expect(taller.format.height).toBe(2760);
    expect(beat.format.height).toBe(2400); // immutable

    const minClamped = adjustWebtoonSegmentHeight(beat, -5000);
    expect(minClamped.format.height).toBe(240);

    const maxClamped = adjustWebtoonSegmentHeight(beat, 10000);
    expect(maxClamped.format.height).toBe(4800);

    const spacer = createWebtoonSpacerPage(2, 360);
    expect(spacer.format.margin).toBe(0);
    expect(spacer.format.gutter).toBe(0);
    expect(spacer.panels[0].borderStyle).toBe("none");
  });
});


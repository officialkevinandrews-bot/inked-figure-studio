import {
  PAGE_FORMATS,
  getPresetPanels,
  type PageFormat,
  type PageLayout,
} from "./manga-layout";

export const WEBTOON_WIDTH = 800;
export const WEBTOON_SLICE_HEIGHT = 1280;

export interface WebtoonSectionMetric {
  pageIndex: number;
  pageId: string;
  startY: number;
  scaledHeight: number;
  scaleTo800: number;
}

export interface WebtoonSeam {
  sliceNumber: number;
  globalY: number;
  pageIndex: number;
  localY: number;
}

/**
 * Computes continuous vertical scroll metrics for a chapter normalized to 800px Webtoon width,
 * matching `exportWebtoonSlices` concatenation geometry pixel-for-pixel.
 */
export function getWebtoonMetrics(
  pages: PageLayout[],
  targetWidth = WEBTOON_WIDTH,
): { sections: WebtoonSectionMetric[]; totalHeight: number } {
  const sections: WebtoonSectionMetric[] = [];
  let y = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const scaleTo800 = targetWidth / Math.max(1, page.format.width);
    const scaledHeight = Math.round(page.format.height * scaleTo800);
    sections.push({
      pageIndex: i,
      pageId: page.id,
      startY: y,
      scaledHeight,
      scaleTo800,
    });
    y += scaledHeight;
  }

  return { sections, totalHeight: y };
}

/**
 * Computes all 800x1280 Webtoon export cut seams across stacked pages,
 * returning both global scroll Y and per-page local Y coordinates.
 */
export function getWebtoonSeams(
  pages: PageLayout[],
  sliceHeight = WEBTOON_SLICE_HEIGHT,
  targetWidth = WEBTOON_WIDTH,
): WebtoonSeam[] {
  const { sections, totalHeight } = getWebtoonMetrics(pages, targetWidth);
  const seams: WebtoonSeam[] = [];
  if (totalHeight <= sliceHeight) return seams;

  let sliceIndex = 1;
  for (let y = sliceHeight; y < totalHeight; y += sliceHeight) {
    const sec =
      sections.find((s) => y >= s.startY && y < s.startY + s.scaledHeight) ??
      sections[sections.length - 1];
    if (sec) {
      seams.push({
        sliceNumber: sliceIndex,
        globalY: y,
        pageIndex: sec.pageIndex,
        localY: (y - sec.startY) / sec.scaleTo800,
      });
    }
    sliceIndex += 1;
  }

  return seams;
}

/** Gets the canonical Webtoon format definition. */
export function getWebtoonFormat(height = 2400): PageFormat {
  const base = PAGE_FORMATS.find((f) => f.id === "webtoon") ?? PAGE_FORMATS[PAGE_FORMATS.length - 1];
  return { ...base, width: WEBTOON_WIDTH, height };
}

/** Adjusts a vertical page/segment's pixel height (clamped safely for print/webtoon pacing). */
export function adjustWebtoonSegmentHeight(
  page: PageLayout,
  deltaHeight: number,
  minHeight = 240,
  maxHeight = 4800,
): PageLayout {
  const nextHeight = Math.round(
    Math.max(minHeight, Math.min(maxHeight, page.format.height + deltaHeight)),
  );
  return {
    ...page,
    format: {
      ...page.format,
      height: nextHeight,
    },
  };
}

/** Creates a blank vertical whitespace beat for dramatic Webtoon scrolling pauses. */
export function createWebtoonSpacerPage(
  pageNumber: number,
  height = 420,
): PageLayout {
  const fmt: PageFormat = {
    id: "webtoon",
    name: "Webtoon Spacer",
    width: WEBTOON_WIDTH,
    height,
    gutter: 0,
    margin: 0,
  };
  return {
    id: `webtoon-spacer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pageNumber,
    format: fmt,
    panels: [
      {
        id: `spacer-panel-${Date.now()}`,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        borderWidth: 0,
        borderColor: "#000000",
        borderStyle: "none",
        backgroundColor: "#ffffff",
      },
    ],
    elements: [],
    balloons: [],
    comicMarks: [],
    speedLines: [],
    sfxStamps: [],
  };
}

/** Creates a new multi-panel Webtoon vertical beat page ready to draw into. */
export function createWebtoonBeatPage(pageNumber: number): PageLayout {
  return {
    id: `webtoon-beat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pageNumber,
    format: getWebtoonFormat(2400),
    panels: getPresetPanels("webtoon-3"),
    elements: [],
    balloons: [],
    comicMarks: [],
    speedLines: [],
    sfxStamps: [],
  };
}


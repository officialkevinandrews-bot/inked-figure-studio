import { describe, it, expect } from "vitest";
import { calculateWebtoonSlices } from "./export";
import { type PageLayout, PAGE_FORMATS, getPresetPanels } from "./manga-layout";
import { jsPDF } from "jspdf";

describe("Phase 5: Multi-Page & Chapter Export Engine", () => {
  it("calculates webtoon vertical strip slicing correctly", () => {
    // 3000px height split into 1280px slices
    const slices = calculateWebtoonSlices(3000, 1280);
    expect(slices).toHaveLength(3);
    expect(slices[0]).toEqual({ startY: 0, height: 1280 });
    expect(slices[1]).toEqual({ startY: 1280, height: 1280 });
    expect(slices[2]).toEqual({ startY: 2560, height: 440 });

    // Edge case: Exactly fits slice height
    const exactSlices = calculateWebtoonSlices(2560, 1280);
    expect(exactSlices).toHaveLength(2);
    expect(exactSlices[1]).toEqual({ startY: 1280, height: 1280 });

    // Edge case: Smaller than 1 slice
    const smallSlice = calculateWebtoonSlices(500, 1280);
    expect(smallSlice).toHaveLength(1);
    expect(smallSlice[0]).toEqual({ startY: 0, height: 500 });
  });

  it("initializes jsPDF with multi-page chapter structure", () => {
    const fmt = PAGE_FORMATS[0]; // Tankobon (800 x 1130)
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: [fmt.width, fmt.height],
    });

    expect(doc.getNumberOfPages()).toBe(1);

    // Add page 2 and page 3
    doc.addPage([fmt.width, fmt.height], "portrait");
    doc.addPage([fmt.width, fmt.height], "portrait");

    expect(doc.getNumberOfPages()).toBe(3);
  });

  it("manages multi-page array operations: add, duplicate, reorder, delete", () => {
    const page1: PageLayout = {
      id: "page-1",
      pageNumber: 1,
      format: PAGE_FORMATS[0],
      panels: getPresetPanels("classic-6"),
      elements: [],
      balloons: [],
      comicMarks: [],
      speedLines: [],
      sfxStamps: [],
    };

    const pages: PageLayout[] = [page1];

    // Add page
    const page2: PageLayout = {
      ...page1,
      id: "page-2",
      pageNumber: 2,
      panels: getPresetPanels("4-koma"),
    };
    pages.push(page2);
    expect(pages).toHaveLength(2);
    expect(pages[1].panels).toHaveLength(4);

    // Duplicate page 1
    const duplicated: PageLayout = {
      ...page1,
      id: `page-${Date.now()}`,
      pageNumber: 3,
    };
    pages.splice(1, 0, duplicated);
    expect(pages).toHaveLength(3);
    expect(pages[1].id).toBe(duplicated.id);

    // Reorder (move index 0 to 1)
    const [moved] = pages.splice(0, 1);
    pages.splice(1, 0, moved);
    expect(pages[1].id).toBe("page-1");

    // Delete
    pages.splice(0, 1);
    expect(pages).toHaveLength(2);
  });
});

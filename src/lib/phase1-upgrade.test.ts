import { describe, it, expect, beforeEach } from "vitest";
import { createDefaultPages, loadChapterState, saveChapterState } from "./chapter-storage";
import { parseBackup, referencedFileIds } from "./backup";
import { newCharacter } from "./characters";
import { createHistory, pushHistory, undoHistory, redoHistory } from "./history";
import { computeResizedBox } from "./transform-box";
import { layoutVerticalColumns } from "./export";

describe("Phase 1 upgrades", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("chapter-storage", () => {
    it("persists and restores chapter pages and activePageIndex", async () => {
      const pages = createDefaultPages();
      pages.push({
        ...pages[0],
        id: "page-2",
        pageNumber: 2,
        elements: [
          {
            id: "el-1",
            panelId: pages[0].panels[0].id,
            type: "character",
            imageUrl: "data:image/png;base64,AAAA",
            x: 10,
            y: 20,
            width: 120,
            height: 200,
            rotation: 0,
            flipX: false,
            flipY: false,
            zIndex: 10,
            breakout: false,
          },
        ],
      });

      await saveChapterState(pages, 1);
      const restored = await loadChapterState();
      expect(restored).not.toBeNull();
      expect(restored?.activePageIndex).toBe(1);
      expect(restored?.pages).toHaveLength(2);
      expect(restored?.pages[1].elements[0].imageUrl).toBe("data:image/png;base64,AAAA");
    });

    it("returns null on corrupt storage", async () => {
      localStorage.setItem("koma-chapter-v1", "{bad-json");
      expect(await loadChapterState()).toBeNull();
    });
  });

  describe("backup with pages", () => {
    it("collects panel imageFileId assets alongside character files", () => {
      const char = { ...newCharacter("Hero"), model: "file:hero-body" };
      const pages = createDefaultPages();
      pages[0].elements.push({
        id: "el-2",
        panelId: "p1",
        type: "character",
        imageUrl: "",
        imageFileId: "panelimg:el-2",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: 1,
        breakout: false,
      });

      expect(referencedFileIds([char], pages).sort()).toEqual(["file:hero-body", "panelimg:el-2"]);
    });

    it("preserves pages & activePageIndex while remaining backwards-compatible", () => {
      const pages = createDefaultPages();
      const withPages = parseBackup(
        JSON.stringify({
          app: "koma-studio",
          version: 1,
          exported: 1,
          characters: [],
          pages,
          activePageIndex: 0,
        }),
      );
      expect(withPages.pages).toHaveLength(1);
      expect(withPages.activePageIndex).toBe(0);

      const legacy = parseBackup(
        JSON.stringify({
          app: "koma-studio",
          version: 1,
          exported: 1,
          characters: [],
        }),
      );
      expect(legacy.pages).toBeUndefined();
    });
  });

  describe("history (undo/redo)", () => {
    it("supports push, undo, redo, and clearing future on branch edit", () => {
      let h = createHistory(0);
      h = pushHistory(h, 1, { now: 100 });
      h = pushHistory(h, 2, { now: 200 });
      expect(h.present).toBe(2);

      h = undoHistory(h);
      expect(h.present).toBe(1);
      h = redoHistory(h);
      expect(h.present).toBe(2);

      h = undoHistory(h);
      h = pushHistory(h, 99, { now: 300 });
      expect(h.present).toBe(99);
      expect(h.future).toEqual([]);
    });

    it("coalesces rapid updates inside coalesceMs into one undo step", () => {
      let h = createHistory(0);
      h = pushHistory(h, 10, { now: 1000, coalesceMs: 350 });
      h = pushHistory(h, 20, { now: 1100, coalesceMs: 350 });
      h = pushHistory(h, 30, { now: 1200, coalesceMs: 350 });
      expect(h.present).toBe(30);
      expect(h.past).toEqual([0]);

      h = undoHistory(h);
      expect(h.present).toBe(0);
    });
  });

  describe("transform-box", () => {
    const start = { x: 100, y: 100, width: 200, height: 100 };

    it("anchors opposite edges when dragging w, n, and nw handles", () => {
      const w = computeResizedBox(start, "w", 30, 0);
      expect(w).toEqual({ x: 130, y: 100, width: 170, height: 100 });
      expect(w.x + w.width).toBe(300);

      const n = computeResizedBox(start, "n", 0, -25);
      expect(n).toEqual({ x: 100, y: 75, width: 200, height: 125 });
      expect(n.y + n.height).toBe(200);

      const nwClamp = computeResizedBox(start, "nw", 500, 500);
      expect(nwClamp).toEqual({ x: 280, y: 180, width: 20, height: 20 });
    });

    it("preserves aspect ratio while anchoring opposite edge on nw resize", () => {
      const nwAspect = computeResizedBox(start, "nw", -40, 0, true);
      expect(nwAspect.width).toBe(240);
      expect(nwAspect.height).toBe(120);
      expect(nwAspect.x + nwAspect.width).toBe(300);
      expect(nwAspect.y + nwAspect.height).toBe(200);
    });
  });

  describe("vertical tategaki text layout", () => {
    it("splits explicit newlines and wraps long text across columns", () => {
      const cols = layoutVerticalColumns("あいう\nえおかきくけこ", 20, 90);
      expect(cols).toEqual([
        ["あ", "い", "う"],
        ["え", "お", "か", "き"],
        ["く", "け", "こ"],
      ]);
    });
  });
});


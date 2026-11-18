import { beforeEach, describe, expect, it } from "vitest";
import { parseBackup, referencedFileIds } from "./backup";
import { newCharacter } from "./characters";
import { createDefaultPages, saveChapterState } from "./chapter-storage";
import {
  addChapterToProject,
  collectLibraryFileIds,
  createDefaultLibrary,
  createProjectInLibrary,
  deleteChapterFromProject,
  deleteProjectFromLibrary,
  duplicateChapterInProject,
  duplicateProjectInLibrary,
  exportMangaProjectPackage,
  getActiveChapter,
  getActiveProject,
  importMangaProjectPackage,
  loadMangaLibrary,
  parseMangaProjectExport,
  renameChapterInProject,
  renameProjectInLibrary,
  saveMangaLibrary,
  selectChapterInLibrary,
  updateProjectChapterPages,
} from "./manga-projects";

describe("Multi-Series & Multi-Chapter Manga Library", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates legacy single-chapter storage into an initial project without losing pages", async () => {
    const pages = createDefaultPages();
    pages.push({ ...pages[0], id: "page-2", pageNumber: 2 });
    await saveChapterState(pages, 1);

    const migrated = await loadMangaLibrary();
    expect(migrated.projects).toHaveLength(1);
    const activeProj = getActiveProject(migrated);
    expect(activeProj.title).toBe("My Manga");
    expect(activeProj.chapters).toHaveLength(1);
    expect(activeProj.chapters[0].pages).toHaveLength(2);
    expect(activeProj.chapters[0].activePageIndex).toBe(1);
  });

  it("creates independent series, adds chapters separately, and switches cleanly without losing pages", async () => {
    let lib = createDefaultLibrary(null);
    const firstProjId = lib.activeProjectId;

    // Add a 2nd page to Series 1, Chapter 1
    const firstPages = [...getActiveChapter(getActiveProject(lib)).pages];
    firstPages.push({ ...firstPages[0], id: "s1-c1-p2", pageNumber: 2 });
    lib = updateProjectChapterPages(
      lib,
      firstProjId,
      getActiveChapter(getActiveProject(lib)).id,
      firstPages,
      1,
    );

    // Add Chapter 2 inside Series 1
    const addedCh = addChapterToProject(lib, firstProjId, "The Kitchen Beat")!;
    expect(addedCh).not.toBeNull();
    lib = addedCh.library;
    expect(getActiveProject(lib).chapters).toHaveLength(2);
    expect(getActiveChapter(getActiveProject(lib)).title).toBe("The Kitchen Beat");

    // Start a brand-new 2nd Manga Series
    const createdProj2 = createProjectInLibrary(lib, "Samurai Rain");
    lib = createdProj2.library;
    expect(lib.projects).toHaveLength(2);
    expect(getActiveProject(lib).title).toBe("Samurai Rain");
    expect(getActiveChapter(getActiveProject(lib)).pages).toHaveLength(1);

    // Save & reload from persistence
    await saveMangaLibrary(lib);
    const reloaded = await loadMangaLibrary();
    expect(reloaded.projects).toHaveLength(2);

    // Switch back to Series 1 Chapter 1 -> all 2 pages are intact
    const ch1Id = reloaded.projects.find((p) => p.id === firstProjId)!.chapters[0].id;
    const switchedBack = selectChapterInLibrary(reloaded, firstProjId, ch1Id);
    expect(getActiveProject(switchedBack).id).toBe(firstProjId);
    expect(getActiveChapter(getActiveProject(switchedBack)).pages).toHaveLength(2);
    expect(getActiveChapter(getActiveProject(switchedBack)).activePageIndex).toBe(1);
  });

  it("renames, duplicates, and deletes series and chapters safely", () => {
    let lib = createDefaultLibrary(null);
    const p1Id = lib.activeProjectId;
    const c1Id = getActiveProject(lib).chapters[0].id;

    lib = renameProjectInLibrary(lib, p1Id, "Blade Chronicle");
    lib = renameChapterInProject(lib, p1Id, c1Id, "Prologue");
    expect(getActiveProject(lib).title).toBe("Blade Chronicle");
    expect(getActiveChapter(getActiveProject(lib)).title).toBe("Prologue");

    const dupCh = duplicateChapterInProject(lib, p1Id, c1Id)!;
    lib = dupCh.library;
    expect(getActiveProject(lib).chapters).toHaveLength(2);
    expect(dupCh.chapter.title).toBe("Prologue (Copy)");

    const dupProj = duplicateProjectInLibrary(lib, p1Id)!;
    lib = dupProj.library;
    expect(lib.projects).toHaveLength(2);
    expect(dupProj.project.title).toBe("Blade Chronicle (Copy)");
    expect(dupProj.project.chapters).toHaveLength(2);

    // Delete duplicated chapter from original series (now 1 chapter left)
    const afterDelCh = deleteChapterFromProject(lib, p1Id, dupCh.chapter.id)!;
    expect(afterDelCh).not.toBeNull();
    expect(afterDelCh.projects.find((p) => p.id === p1Id)!.chapters).toHaveLength(1);

    // Deleting the last chapter in a series returns null
    expect(deleteChapterFromProject(afterDelCh, p1Id, c1Id)).toBeNull();

    // Deleting projects down to empty creates a clean default series
    let shrunk = deleteProjectFromLibrary(afterDelCh, dupProj.project.id);
    expect(shrunk.projects).toHaveLength(1);
    shrunk = deleteProjectFromLibrary(shrunk, p1Id);
    expect(shrunk.projects).toHaveLength(1);
  });

  it("exports & imports single projects cleanly and integrates with full studio backups", async () => {
    let lib = createDefaultLibrary(null);
    const p1 = getActiveProject(lib);
    p1.chapters[0].pages[0].elements.push({
      id: "el-art",
      panelId: p1.chapters[0].pages[0].panels[0].id,
      type: "background",
      imageUrl: "",
      imageFileId: "panelimg:el-art",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      rotation: 0,
      flipX: false,
      flipY: false,
      zIndex: 1,
      breakout: false,
    });
    const added = addChapterToProject(lib, p1.id, "Chapter 2")!;
    lib = added.library;

    const pkg = await exportMangaProjectPackage(getActiveProject(lib));
    const parsed = parseMangaProjectExport(JSON.stringify(pkg));
    expect(parsed.app).toBe("koma-project");
    expect(parsed.project.chapters).toHaveLength(2);

    const imported = await importMangaProjectPackage(lib, JSON.stringify(pkg));
    expect(imported.library.projects).toHaveLength(2);
    expect(imported.project.id).not.toBe(p1.id);
    expect(imported.project.chapters).toHaveLength(2);

    // Full studio backup preserves mangaLibrary & collects file refs across all series/chapters
    const hero = newCharacter("Hero");
    const refs = referencedFileIds([hero], [], [], [], lib);
    expect(refs).toContain("panelimg:el-art");
    expect(collectLibraryFileIds(lib)).toContain("panelimg:el-art");

    const parsedFull = parseBackup(
      JSON.stringify({
        app: "koma-studio",
        version: 1,
        exported: Date.now(),
        characters: [hero],
        facePacks: [],
        files: [],
        mangaLibrary: lib,
      }),
    );
    expect(parsedFull.mangaLibrary?.projects).toHaveLength(1);
    expect(parsedFull.mangaLibrary?.projects[0].chapters).toHaveLength(2);
  });
});

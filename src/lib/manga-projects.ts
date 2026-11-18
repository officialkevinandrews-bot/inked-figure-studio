import { b64ToBlob, blobToB64, type BackupFile } from "./backup";
import {
  createDefaultPages,
  externalizePageAssets,
  hydratePageAssets,
  loadChapterState,
  saveChapterState,
  type StoredChapterState,
} from "./chapter-storage";
import { deleteFile, getFile, getKv, putFile, putKv } from "./file-store";
import type { PageLayout } from "./manga-layout";

const LIBRARY_KV_KEY = "manga-library-v1";
const LIBRARY_LS_KEY = "koma-library-v1";

export interface MangaChapter {
  id: string;
  title: string;
  pages: PageLayout[];
  activePageIndex: number;
  updatedAt: number;
}

export interface MangaProject {
  id: string;
  title: string;
  activeChapterId: string;
  chapters: MangaChapter[];
  createdAt: number;
  updatedAt: number;
}

export interface MangaLibraryState {
  version: 1;
  activeProjectId: string;
  projects: MangaProject[];
}

export interface MangaProjectExport {
  app: "koma-project";
  version: 1;
  exported: number;
  project: MangaProject;
  files: BackupFile[];
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function makeUid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function clonePages(pages: PageLayout[]): PageLayout[] {
  return pages.map((page) => ({
    ...page,
    panels: page.panels.map((p) => ({ ...p, points: p.points.map((pt) => ({ ...pt })) })),
    elements: page.elements.map((el) => ({
      ...el,
      pageLayer: el.pageLayer ? { ...el.pageLayer } : undefined,
    })),
    balloons: (page.balloons ?? []).map((b) => ({ ...b })),
    comicMarks: (page.comicMarks ?? []).map((m) => ({ ...m })),
    speedLines: (page.speedLines ?? []).map((l) => ({ ...l })),
    sfxStamps: (page.sfxStamps ?? []).map((s) => ({ ...s })),
  }));
}

export function makeBlankChapter(title = "Chapter 1", pages?: PageLayout[]): MangaChapter {
  return {
    id: makeUid("ch"),
    title: title.trim() || "Chapter 1",
    pages: clonePages(pages && pages.length > 0 ? pages : createDefaultPages()),
    activePageIndex: 0,
    updatedAt: Date.now(),
  };
}

export function makeNewProject(
  title = "My Manga",
  firstChapterTitle = "Chapter 1",
  pages?: PageLayout[],
): MangaProject {
  const now = Date.now();
  const chapter = makeBlankChapter(firstChapterTitle, pages);
  return {
    id: makeUid("proj"),
    title: title.trim() || "Untitled Manga",
    activeChapterId: chapter.id,
    chapters: [chapter],
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultLibrary(initial?: StoredChapterState | null): MangaLibraryState {
  const project = makeNewProject(
    "My Manga",
    "Chapter 1",
    initial?.pages && initial.pages.length > 0 ? initial.pages : undefined,
  );
  if (initial && typeof initial.activePageIndex === "number") {
    project.chapters[0].activePageIndex = Math.max(
      0,
      Math.min(initial.activePageIndex, project.chapters[0].pages.length - 1),
    );
  }
  return {
    version: 1,
    activeProjectId: project.id,
    projects: [project],
  };
}

export function getActiveProject(lib: MangaLibraryState): MangaProject {
  return lib.projects.find((p) => p.id === lib.activeProjectId) ?? lib.projects[0];
}

export function getActiveChapter(project: MangaProject): MangaChapter {
  return project.chapters.find((c) => c.id === project.activeChapterId) ?? project.chapters[0];
}

export function collectProjectFileIds(project: MangaProject): string[] {
  const ids = new Set<string>();
  for (const ch of project.chapters) {
    for (const page of ch.pages) {
      for (const el of page.elements) {
        if (el.imageFileId) ids.add(el.imageFileId);
      }
    }
  }
  return [...ids];
}

export function collectLibraryFileIds(lib: MangaLibraryState): string[] {
  const ids = new Set<string>();
  for (const p of lib.projects) {
    for (const fid of collectProjectFileIds(p)) ids.add(fid);
  }
  return [...ids];
}

export function updateProjectChapterPages(
  lib: MangaLibraryState,
  projectId: string,
  chapterId: string,
  pages: PageLayout[],
  activePageIndex: number,
): MangaLibraryState {
  const now = Date.now();
  const safeIndex = Math.max(0, Math.min(activePageIndex, Math.max(0, pages.length - 1)));
  return {
    ...lib,
    projects: lib.projects.map((proj) => {
      if (proj.id !== projectId) return proj;
      return {
        ...proj,
        updatedAt: now,
        chapters: proj.chapters.map((ch) =>
          ch.id === chapterId
            ? { ...ch, pages: clonePages(pages), activePageIndex: safeIndex, updatedAt: now }
            : ch,
        ),
      };
    }),
  };
}

export function createProjectInLibrary(
  lib: MangaLibraryState,
  title: string,
): { library: MangaLibraryState; project: MangaProject; chapter: MangaChapter } {
  const project = makeNewProject(title || `Manga ${lib.projects.length + 1}`, "Chapter 1");
  return {
    library: {
      ...lib,
      activeProjectId: project.id,
      projects: [project, ...lib.projects],
    },
    project,
    chapter: project.chapters[0],
  };
}

export function addChapterToProject(
  lib: MangaLibraryState,
  projectId: string,
  title?: string,
): { library: MangaLibraryState; chapter: MangaChapter } | null {
  const target = lib.projects.find((p) => p.id === projectId);
  if (!target) return null;
  const chTitle = title?.trim() || `Chapter ${target.chapters.length + 1}`;
  const chapter = makeBlankChapter(chTitle);
  const now = Date.now();
  const library: MangaLibraryState = {
    ...lib,
    activeProjectId: target.id,
    projects: lib.projects.map((p) =>
      p.id === target.id
        ? {
            ...p,
            activeChapterId: chapter.id,
            updatedAt: now,
            chapters: [...p.chapters, chapter],
          }
        : p,
    ),
  };
  return { library, chapter };
}

export function renameProjectInLibrary(
  lib: MangaLibraryState,
  projectId: string,
  title: string,
): MangaLibraryState {
  const trimmed = title.trim();
  if (!trimmed) return lib;
  return {
    ...lib,
    projects: lib.projects.map((p) =>
      p.id === projectId ? { ...p, title: trimmed, updatedAt: Date.now() } : p,
    ),
  };
}

export function renameChapterInProject(
  lib: MangaLibraryState,
  projectId: string,
  chapterId: string,
  title: string,
): MangaLibraryState {
  const trimmed = title.trim();
  if (!trimmed) return lib;
  return {
    ...lib,
    projects: lib.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            updatedAt: Date.now(),
            chapters: p.chapters.map((c) =>
              c.id === chapterId ? { ...c, title: trimmed, updatedAt: Date.now() } : c,
            ),
          }
        : p,
    ),
  };
}

export function duplicateProjectInLibrary(
  lib: MangaLibraryState,
  projectId: string,
): { library: MangaLibraryState; project: MangaProject } | null {
  const src = lib.projects.find((p) => p.id === projectId);
  if (!src) return null;
  const now = Date.now();
  const chapters = src.chapters.map((ch) => ({
    ...ch,
    id: makeUid("ch"),
    pages: clonePages(ch.pages),
    updatedAt: now,
  }));
  const srcActiveIdx = Math.max(
    0,
    src.chapters.findIndex((c) => c.id === src.activeChapterId),
  );
  const copy: MangaProject = {
    id: makeUid("proj"),
    title: `${src.title} (Copy)`,
    activeChapterId: (chapters[srcActiveIdx] ?? chapters[0]).id,
    chapters,
    createdAt: now,
    updatedAt: now,
  };
  return {
    library: {
      ...lib,
      activeProjectId: copy.id,
      projects: [copy, ...lib.projects],
    },
    project: copy,
  };
}

export function duplicateChapterInProject(
  lib: MangaLibraryState,
  projectId: string,
  chapterId: string,
): { library: MangaLibraryState; chapter: MangaChapter } | null {
  const proj = lib.projects.find((p) => p.id === projectId);
  const src = proj?.chapters.find((c) => c.id === chapterId);
  if (!proj || !src) return null;
  const now = Date.now();
  const copy: MangaChapter = {
    ...src,
    id: makeUid("ch"),
    title: `${src.title} (Copy)`,
    pages: clonePages(src.pages),
    updatedAt: now,
  };
  const idx = proj.chapters.findIndex((c) => c.id === chapterId);
  const nextChapters = [...proj.chapters];
  nextChapters.splice(idx + 1, 0, copy);
  return {
    library: {
      ...lib,
      activeProjectId: proj.id,
      projects: lib.projects.map((p) =>
        p.id === proj.id
          ? { ...p, activeChapterId: copy.id, updatedAt: now, chapters: nextChapters }
          : p,
      ),
    },
    chapter: copy,
  };
}

export function deleteChapterFromProject(
  lib: MangaLibraryState,
  projectId: string,
  chapterId: string,
): MangaLibraryState | null {
  const proj = lib.projects.find((p) => p.id === projectId);
  if (!proj || proj.chapters.length <= 1) return null;
  const idx = proj.chapters.findIndex((c) => c.id === chapterId);
  if (idx === -1) return null;
  const remaining = proj.chapters.filter((c) => c.id !== chapterId);
  const nextActive =
    proj.activeChapterId === chapterId
      ? (remaining[Math.min(idx, remaining.length - 1)] ?? remaining[0]).id
      : proj.activeChapterId;
  return {
    ...lib,
    projects: lib.projects.map((p) =>
      p.id === projectId
        ? { ...p, activeChapterId: nextActive, updatedAt: Date.now(), chapters: remaining }
        : p,
    ),
  };
}

export function deleteProjectFromLibrary(
  lib: MangaLibraryState,
  projectId: string,
): MangaLibraryState {
  const remaining = lib.projects.filter((p) => p.id !== projectId);
  if (remaining.length === 0) {
    return createDefaultLibrary(null);
  }
  const activeProjectId =
    lib.activeProjectId === projectId ? remaining[0].id : lib.activeProjectId;
  return {
    ...lib,
    activeProjectId,
    projects: remaining,
  };
}

export function selectChapterInLibrary(
  lib: MangaLibraryState,
  projectId: string,
  chapterId?: string,
): MangaLibraryState {
  const target = lib.projects.find((p) => p.id === projectId);
  if (!target) return lib;
  const resolvedChapter =
    chapterId && target.chapters.some((c) => c.id === chapterId)
      ? chapterId
      : target.activeChapterId;
  return {
    ...lib,
    activeProjectId: target.id,
    projects: lib.projects.map((p) =>
      p.id === target.id ? { ...p, activeChapterId: resolvedChapter } : p,
    ),
  };
}

export async function externalizeLibraryAssets(
  lib: MangaLibraryState,
): Promise<MangaLibraryState> {
  return {
    ...lib,
    projects: await Promise.all(
      lib.projects.map(async (proj) => ({
        ...proj,
        chapters: await Promise.all(
          proj.chapters.map(async (ch) => ({
            ...ch,
            pages: await externalizePageAssets(ch.pages),
          })),
        ),
      })),
    ),
  };
}

export async function saveMangaLibrary(lib: MangaLibraryState): Promise<MangaLibraryState> {
  const stripped = await externalizeLibraryAssets(lib);
  if (hasIndexedDb()) {
    try {
      await putKv(LIBRARY_KV_KEY, stripped);
      const activeProj = getActiveProject(stripped);
      const activeCh = getActiveChapter(activeProj);
      await saveChapterState(activeCh.pages, activeCh.activePageIndex);
      return stripped;
    } catch {
      /* fall through to localStorage */
    }
  }
  try {
    localStorage.setItem(LIBRARY_LS_KEY, JSON.stringify(stripped));
  } catch {
    /* storage full */
  }
  return stripped;
}

function isValidLibrary(raw: unknown): raw is MangaLibraryState {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Partial<MangaLibraryState>;
  return (
    Array.isArray(r.projects) &&
    r.projects.length > 0 &&
    r.projects.every(
      (p) =>
        typeof p?.id === "string" &&
        Array.isArray(p?.chapters) &&
        p.chapters.length > 0 &&
        p.chapters.every((c) => typeof c?.id === "string" && Array.isArray(c?.pages) && c.pages.length > 0),
    )
  );
}

export async function loadMangaLibrary(): Promise<MangaLibraryState> {
  let raw: unknown = null;
  if (hasIndexedDb()) {
    raw = await getKv<MangaLibraryState>(LIBRARY_KV_KEY).catch(() => null);
  }
  if (!raw) {
    try {
      const txt = localStorage.getItem(LIBRARY_LS_KEY);
      if (txt) raw = JSON.parse(txt);
    } catch {
      raw = null;
    }
  }

  if (isValidLibrary(raw)) {
    return raw;
  }

  // Migrate existing single-chapter storage automatically so zero pages are lost
  const legacy = await loadChapterState();
  const migrated = createDefaultLibrary(legacy);
  await saveMangaLibrary(migrated);
  return migrated;
}

export async function hydrateChapter(chapter: MangaChapter): Promise<MangaChapter> {
  const pages = await hydratePageAssets(chapter.pages);
  const activePageIndex = Math.max(0, Math.min(chapter.activePageIndex ?? 0, pages.length - 1));
  return { ...chapter, pages, activePageIndex };
}

/** Deletes stored IndexedDB panel files (`panelimg:*`) that are no longer referenced anywhere in the library. */
export async function garbageCollectRemovedFiles(
  removedCandidateIds: string[],
  nextLibrary: MangaLibraryState,
): Promise<void> {
  if (!hasIndexedDb() || removedCandidateIds.length === 0) return;
  const stillUsed = new Set(collectLibraryFileIds(nextLibrary));
  for (const id of removedCandidateIds) {
    if ((id.startsWith("panelimg:") || id.startsWith("panelimg-")) && !stillUsed.has(id)) {
      await deleteFile(id).catch(() => {});
    }
  }
}

export async function exportMangaProjectPackage(
  project: MangaProject,
): Promise<MangaProjectExport> {
  const externalizedChapters = await Promise.all(
    project.chapters.map(async (ch) => ({
      ...ch,
      pages: await externalizePageAssets(ch.pages),
    })),
  );
  const externalProject: MangaProject = {
    ...project,
    chapters: externalizedChapters,
  };
  const files: BackupFile[] = [];
  for (const id of collectProjectFileIds(externalProject)) {
    const rec = await getFile(id).catch(() => null);
    if (rec) {
      files.push({
        id,
        name: rec.name,
        slot: rec.slot,
        type: rec.blob.type || "application/octet-stream",
        data: await blobToB64(rec.blob),
      });
    }
  }
  return {
    app: "koma-project",
    version: 1,
    exported: Date.now(),
    project: externalProject,
    files,
  };
}

export function parseMangaProjectExport(text: string): MangaProjectExport {
  const raw = JSON.parse(text) as Omit<Partial<MangaProjectExport>, "app"> & {
    app?: string;
    pages?: PageLayout[];
    activePageIndex?: number;
  };
  if (
    raw?.app === "koma-project" &&
    raw.project &&
    Array.isArray(raw.project.chapters) &&
    raw.project.chapters.length > 0
  ) {
    return {
      app: "koma-project",
      version: 1,
      exported: typeof raw.exported === "number" ? raw.exported : Date.now(),
      project: raw.project,
      files: Array.isArray(raw.files) ? raw.files : [],
    };
  }
  // Allow importing chapters cleanly from a legacy koma-studio backup file too
  if (raw?.app === "koma-studio" && Array.isArray(raw.pages) && raw.pages.length > 0) {
    const proj = makeNewProject("Imported Manga", "Chapter 1", raw.pages);
    proj.chapters[0].activePageIndex = Math.max(
      0,
      Math.min(raw.activePageIndex ?? 0, raw.pages.length - 1),
    );
    return {
      app: "koma-project",
      version: 1,
      exported: typeof raw.exported === "number" ? raw.exported : Date.now(),
      project: proj,
      files: Array.isArray(raw.files) ? raw.files : [],
    };
  }
  throw new Error("This isn't a valid Manga Project (.json) file.");
}

export async function importMangaProjectPackage(
  lib: MangaLibraryState,
  rawText: string,
): Promise<{ library: MangaLibraryState; project: MangaProject }> {
  const pkg = parseMangaProjectExport(rawText);
  const now = Date.now();
  const idMap = new Map<string, string>();
  const neededIds = new Set(collectProjectFileIds(pkg.project));

  for (const f of pkg.files) {
    if (!neededIds.has(f.id)) continue;
    const newFid = makeUid("panelimg");
    idMap.set(f.id, newFid);
    if (hasIndexedDb()) {
      await putFile(newFid, b64ToBlob(f.data, f.type), f.name, f.slot ?? "panel-image");
    }
  }

  const chapters: MangaChapter[] = pkg.project.chapters.map((ch) => ({
    id: makeUid("ch"),
    title: ch.title || "Chapter 1",
    activePageIndex: ch.activePageIndex ?? 0,
    updatedAt: now,
    pages: ch.pages.map((page) => ({
      ...page,
      elements: page.elements.map((el) => {
        if (!el.imageFileId) return el;
        const mapped = idMap.get(el.imageFileId);
        return mapped ? { ...el, imageFileId: mapped } : el;
      }),
    })),
  }));

  const srcActiveIdx = Math.max(
    0,
    pkg.project.chapters.findIndex((c) => c.id === pkg.project.activeChapterId),
  );
  const importedProject: MangaProject = {
    id: makeUid("proj"),
    title: pkg.project.title?.trim() || `Imported Manga ${lib.projects.length + 1}`,
    activeChapterId: (chapters[srcActiveIdx] ?? chapters[0]).id,
    chapters,
    createdAt: now,
    updatedAt: now,
  };

  const library: MangaLibraryState = {
    ...lib,
    activeProjectId: importedProject.id,
    projects: [importedProject, ...lib.projects],
  };
  await saveMangaLibrary(library);
  return { library, project: importedProject };
}

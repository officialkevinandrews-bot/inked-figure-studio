import { getFile, getKv, putFile, putKv } from "./file-store";
import { PAGE_FORMATS, getPresetPanels, type PageLayout } from "./manga-layout";

const CHAPTER_KV_KEY = "chapter-state";
const CHAPTER_LS_KEY = "koma-chapter-v1";

export interface StoredChapterState {
  pages: PageLayout[];
  activePageIndex: number;
}

export function createDefaultPages(): PageLayout[] {
  return [
    {
      id: "page-1",
      pageNumber: 1,
      format: PAGE_FORMATS[0],
      panels: getPresetPanels("classic-6"),
      elements: [],
      balloons: [],
      comicMarks: [],
      speedLines: [],
      sfxStamps: [],
    },
  ];
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body = ""] = dataUrl.split(",");
  const mimeMatch = header.match(/data:([^;]+)/i);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  if (header.includes(";base64")) {
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function urlToBlob(url: string): Promise<Blob | null> {
  if (url.startsWith("data:")) return dataUrlToBlob(url);
  if (url.startsWith("blob:")) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.blob();
    } catch {
      return null;
    }
  }
  return null;
}

const persistedFileIds = new Set<string>();

/**
 * Extracts binary `data:` / `blob:` element images into IndexedDB and returns lightweight
 * serializable `PageLayout[]` with `imageFileId` references intact.
 */
export async function externalizePageAssets(pages: PageLayout[]): Promise<PageLayout[]> {
  if (!hasIndexedDb()) return pages;
  return Promise.all(
    pages.map(async (page) => ({
      ...page,
      elements: await Promise.all(
        page.elements.map(async (el) => {
          const isEphemeral = el.imageUrl.startsWith("data:") || el.imageUrl.startsWith("blob:");
          if (!isEphemeral) return el;

          const fileId = el.imageFileId || `panelimg:${el.id}`;
          if (!persistedFileIds.has(fileId)) {
            const blob = await urlToBlob(el.imageUrl);
            if (!blob) return el;
            await putFile(fileId, blob, `${el.id}.png`, "panel-image");
            persistedFileIds.add(fileId);
          }
          return { ...el, imageFileId: fileId, imageUrl: "" };
        }),
      ),
    })),
  );
}

/**
 * Restores `imageUrl` from IndexedDB (`imageFileId`) so exported/rendered pages load cleanly across reloads.
 */
export async function hydratePageAssets(pages: PageLayout[]): Promise<PageLayout[]> {
  if (!hasIndexedDb()) return pages;
  const cache = new Map<string, string>();
  return Promise.all(
    pages.map(async (page) => ({
      ...page,
      elements: await Promise.all(
        page.elements.map(async (el) => {
          if (!el.imageFileId || el.imageUrl.startsWith("data:")) return el;
          let restored = cache.get(el.imageFileId);
          if (restored === undefined) {
            const rec = await getFile(el.imageFileId).catch(() => null);
            if (rec) {
              restored = await blobToDataUrl(rec.blob);
              persistedFileIds.add(el.imageFileId);
              cache.set(el.imageFileId, restored);
            }
          }
          return restored ? { ...el, imageUrl: restored } : el;
        }),
      ),
    })),
  );
}

export async function saveChapterState(pages: PageLayout[], activePageIndex: number): Promise<void> {
  const safeIndex = Math.max(0, Math.min(activePageIndex, Math.max(0, pages.length - 1)));
  const stripped = await externalizePageAssets(pages);
  const payload: StoredChapterState = { pages: stripped, activePageIndex: safeIndex };

  if (hasIndexedDb()) {
    try {
      await putKv(CHAPTER_KV_KEY, payload);
      return;
    } catch {
      /* fall through to localStorage */
    }
  }
  try {
    localStorage.setItem(CHAPTER_LS_KEY, JSON.stringify(payload));
  } catch {
    /* storage full */
  }
}

export async function loadChapterState(): Promise<StoredChapterState | null> {
  let raw: StoredChapterState | null = null;
  if (hasIndexedDb()) {
    raw = await getKv<StoredChapterState>(CHAPTER_KV_KEY).catch(() => null);
  }
  if (!raw) {
    try {
      const txt = localStorage.getItem(CHAPTER_LS_KEY);
      if (txt) raw = JSON.parse(txt) as StoredChapterState;
    } catch {
      raw = null;
    }
  }
  if (!raw || !Array.isArray(raw.pages) || raw.pages.length === 0) return null;
  const pages = await hydratePageAssets(raw.pages);
  const activePageIndex = Math.max(0, Math.min(raw.activePageIndex ?? 0, pages.length - 1));
  return { pages, activePageIndex };
}


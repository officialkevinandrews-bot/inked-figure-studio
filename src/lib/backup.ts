import type { Character } from "./characters";
import { customItemIds } from "./characters";
import type { CustomBaseModel } from "./base-models";
import type { RosterCharacter } from "./character-roster";
import type { CustomPropMeta } from "./custom-props";
import type { SavedCustomTemplate } from "./custom-templates";
import type { FacePack } from "./face-parts";
import type { PageLayout, PanelOverlapPreference } from "./manga-layout";
import type { MangaLibraryState } from "./manga-projects";
import type { CustomPose } from "./pose-storage";

export interface BackupFile {
  id: string;
  name: string;
  slot?: string;
  type: string;
  data: string;
}

export interface StudioBackup {
  app: "koma-studio";
  version: 1;
  exported: number;
  accountEmail?: string | null;
  characters: Character[];
  baseModels?: CustomBaseModel[];
  facePacks: FacePack[];
  customPoses?: CustomPose[];
  customProps?: CustomPropMeta[];
  customTemplates?: SavedCustomTemplate[];
  roster?: RosterCharacter[];
  faceConfigs?: Record<string, unknown>;
  faceCalibrations?: Record<string, unknown>;
  wardrobeOutfits?: Record<string, unknown>;
  panelOverlapPref?: PanelOverlapPreference;
  files: BackupFile[];
  pages?: PageLayout[];
  activePageIndex?: number;
  mangaLibrary?: MangaLibraryState;
}

/** Stored-file ids a set of characters, custom base models, and chapter pages need: uploaded bodies, custom clothing, and panel assets. */
export function referencedFileIds(
  chars: Character[],
  pages: PageLayout[] = [],
  extraFileIds: string[] = [],
  baseModels: CustomBaseModel[] = [],
  mangaLibrary?: MangaLibraryState,
): string[] {
  const s = new Set<string>();
  for (const c of chars) {
    if (!c.model.startsWith("builtin:")) s.add(c.model);
    for (const id of customItemIds(c)) s.add(id);
  }
  for (const m of baseModels) {
    if (m.key && !m.key.startsWith("builtin:")) s.add(m.key);
  }
  for (const page of pages) {
    for (const el of page.elements) {
      if (el.imageFileId) s.add(el.imageFileId);
    }
  }
  if (mangaLibrary) {
    for (const proj of mangaLibrary.projects) {
      for (const ch of proj.chapters) {
        for (const page of ch.pages) {
          for (const el of page.elements) {
            if (el.imageFileId) s.add(el.imageFileId);
          }
        }
      }
    }
  }
  for (const fid of extraFileIds) s.add(fid);
  return [...s];
}

export function parseBackup(text: string): StudioBackup {
  const b = JSON.parse(text) as StudioBackup;
  if (b?.app !== "koma-studio" || !Array.isArray(b.characters)) {
    throw new Error("This isn't a studio backup file.");
  }
  return {
    ...b,
    baseModels: Array.isArray(b.baseModels) ? b.baseModels : [],
    facePacks: b.facePacks ?? [],
    files: b.files ?? [],
    pages: Array.isArray(b.pages) ? b.pages : undefined,
    activePageIndex: typeof b.activePageIndex === "number" ? b.activePageIndex : undefined,
    mangaLibrary:
      b.mangaLibrary && Array.isArray(b.mangaLibrary.projects) && b.mangaLibrary.projects.length > 0
        ? b.mangaLibrary
        : undefined,
  };
}

/** Imported items replace same-id items; everything else is kept. */
export function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const ids = new Set(incoming.map((x) => x.id));
  return [...incoming, ...current.filter((x) => !ids.has(x.id))];
}

export const blobToB64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

export function b64ToBlob(data: string, type: string) {
  const bin = atob(data);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
}

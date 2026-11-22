import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { getBytes, ref as storageRef, uploadBytes } from "firebase/storage";
import type { User } from "firebase/auth";
import { blobToB64, referencedFileIds, type BackupFile, type StudioBackup } from "./backup";
import { loadBaseModels, type CustomBaseModel } from "./base-models";
import { resetChapterAssetCache } from "./chapter-storage";
import { loadSavedRoster, type RosterCharacter } from "./character-roster";
import { loadCharacters, type Character } from "./characters";
import {
  loadCharacters2D,
  loadCustomBaseModels2D,
  loadCustomHeads2D,
  loadCustomParts2D,
} from "./character2d-store";
import type { BaseModel2D, Character2D, CustomPartAsset2D, HeadPack2D } from "./character2d-types";
import {
  loadCustomSceneObjects2D,
  loadScenes2D,
} from "./scene2d-store";
import type { Scene2D, SceneObjectAsset2D } from "./scene2d-types";
import { loadCustomPoses2D, loadStages2D } from "./pose2d-store";
import type { Pose2DPreset, Stage2D } from "./pose2d-types";
import { loadCustomPropsMeta, type CustomPropMeta } from "./custom-props";
import { loadCustomTemplates, type SavedCustomTemplate } from "./custom-templates";
import { loadPacks, type FacePack } from "./face-parts";
import {
  getActiveFilesDbName,
  getLocalFile,
  listAllFiles,
  listAllKv,
  putFile,
  putKv,
  readLegacyIndexedDbSnapshot,
  registerCloudFileFetcher,
  type Stored,
} from "./file-store";
import { getFirebaseDb, getFirebaseStorage } from "./firebase";
import { isFirebaseConfigured } from "./firebase-config";
import { normalizeEmail } from "./allowlist";
import { loadPanelOverlapPreference, type PanelOverlapPreference } from "./manga-layout";
import {
  createDefaultLibrary,
  externalizeLibraryAssets,
  getActiveChapter,
  getActiveProject,
  loadMangaLibrary,
  type MangaLibraryState,
  type MangaProject,
} from "./manga-projects";
import { loadCustomPoses, type CustomPose } from "./pose-storage";
import {
  getActiveStorageUser,
  getLegacyPromptChoice,
  getOrCreateDeviceId,
  listUserKeysWithPrefix,
  readLegacyLocalStorageEntries,
  scopeStorageKey,
  setApplyingRemoteSync,
  setLegacyPromptChoice,
  subscribeUserStorageChanges,
  userLsGet,
  userLsSet,
  type StorageChangeEvent,
} from "./user-storage";

const SYNC_QUEUE_KEY = "__sync_queue_v1";
const CHUNK_CHAR_LIMIT = 680_000; // Well under firestore.rules 960_000 limit
const MAX_CHUNK_COUNT = 200;

export type SyncPhase = "idle" | "syncing" | "saved" | "offline" | "conflict" | "error";

export interface SyncConflictInfo {
  remoteUpdatedAt: number;
  remoteDeviceId: string | null;
  remoteProjectCount: number;
  localPendingCount: number;
}

export interface CloudSyncStatus {
  phase: SyncPhase;
  pendingCount: number;
  lastSyncedAt: number | null;
  legacyImportedCount: number;
  errorMessage: string | null;
  detail: string | null;
  conflict: SyncConflictInfo | null;
}

interface SyncQueueState {
  dirtyWorkspace: boolean;
  dirtyProjectIds: string[];
  deletedProjectIds: string[];
  dirtyFileIds: string[];
  lastSyncedCloudWorkspaceAt: number;
}

interface WorkspaceCloudDoc {
  version: number;
  schemaVersion: number;
  updatedAt: number;
  deviceId: string | null;
  activeProjectId: string | null;
  characters: Character[];
  characters2d?: Character2D[];
  baseModels: CustomBaseModel[];
  baseModels2d?: BaseModel2D[];
  heads2d?: HeadPack2D[];
  parts2d?: CustomPartAsset2D[];
  scenes2d?: Scene2D[];
  sceneObjects2d?: SceneObjectAsset2D[];
  stages2d?: Stage2D[];
  poses2d?: Pose2DPreset[];
  facePacks: FacePack[];
  customPoses: CustomPose[];
  customProps: CustomPropMeta[];
  customTemplates: SavedCustomTemplate[];
  roster: RosterCharacter[];
  faceConfigs: Record<string, unknown>;
  faceCalibrations: Record<string, unknown>;
  wardrobeOutfits: Record<string, unknown>;
  preferences: { panelOverlapPref: PanelOverlapPreference };
}

interface BlobMetaCloudDoc {
  id: string;
  name: string;
  type: string;
  slot: string | null;
  size: number;
  byteLength: number;
  chunkCount: number;
  storagePath: string | null;
  compressed: boolean;
  encoding: string;
  createdAt?: number;
  updatedAt: number;
}

let currentStatus: CloudSyncStatus = {
  phase: "idle",
  pendingCount: 0,
  lastSyncedAt: null,
  legacyImportedCount: 0,
  errorMessage: null,
  detail: null,
  conflict: null,
};

let activeSyncUid: string | null = null;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight: Promise<boolean> | null = null;
let unsubscribeStorageListener: (() => void) | null = null;
let listenersBound = false;
let cloudPullCallback: (() => void) | null = null;
let pendingRemoteSnapshot: {
  workspace: WorkspaceCloudDoc | null;
  projects: MangaProject[];
} | null = null;

const statusSubscribers = new Set<(status: CloudSyncStatus) => void>();
let statusFlushScheduled = false;

function notifyStatus(patch: Partial<CloudSyncStatus>): void {
  currentStatus = { ...currentStatus, ...patch };
  if (statusFlushScheduled) return;
  statusFlushScheduled = true;
  queueMicrotask(() => {
    statusFlushScheduled = false;
    const snap = currentStatus;
    for (const fn of statusSubscribers) {
      try {
        fn(snap);
      } catch {
        /* ignore subscriber error */
      }
    }
  });
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return currentStatus;
}

export function subscribeCloudSyncStatus(listener: (status: CloudSyncStatus) => void): () => void {
  statusSubscribers.add(listener);
  listener(currentStatus);
  return () => {
    statusSubscribers.delete(listener);
  };
}

export function registerOnCloudPullApplied(cb: (() => void) | null): void {
  cloudPullCallback = cb;
}

function emptyQueue(): SyncQueueState {
  return {
    dirtyWorkspace: false,
    dirtyProjectIds: [],
    deletedProjectIds: [],
    dirtyFileIds: [],
    lastSyncedCloudWorkspaceAt: 0,
  };
}

function loadSyncQueue(uid: string): SyncQueueState {
  if (typeof window === "undefined") return emptyQueue();
  try {
    const raw = window.localStorage.getItem(scopeStorageKey(SYNC_QUEUE_KEY, uid));
    if (!raw) return emptyQueue();
    const p = JSON.parse(raw) as Partial<SyncQueueState>;
    return {
      dirtyWorkspace: Boolean(p.dirtyWorkspace),
      dirtyProjectIds: Array.isArray(p.dirtyProjectIds) ? p.dirtyProjectIds : [],
      deletedProjectIds: Array.isArray(p.deletedProjectIds) ? p.deletedProjectIds : [],
      dirtyFileIds: Array.isArray(p.dirtyFileIds) ? p.dirtyFileIds : [],
      lastSyncedCloudWorkspaceAt:
        typeof p.lastSyncedCloudWorkspaceAt === "number" ? p.lastSyncedCloudWorkspaceAt : 0,
    };
  } catch {
    return emptyQueue();
  }
}

function saveSyncQueue(uid: string, q: SyncQueueState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopeStorageKey(SYNC_QUEUE_KEY, uid), JSON.stringify(q));
  } catch {
    /* ignore quota errors */
  }
  const pendingCount =
    (q.dirtyWorkspace ? 1 : 0) +
    q.dirtyProjectIds.length +
    q.deletedProjectIds.length +
    q.dirtyFileIds.length;
  notifyStatus({ pendingCount });
}

function countPending(q: SyncQueueState): number {
  return (
    (q.dirtyWorkspace ? 1 : 0) +
    q.dirtyProjectIds.length +
    q.deletedProjectIds.length +
    q.dirtyFileIds.length
  );
}

/** Recursively removes `undefined` fields so Firestore `setDoc` never rejects optional undefined properties. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function safeJsonMapFromPrefix(prefix: string, uid: string): Record<string, unknown> {
  const entries = listUserKeysWithPrefix(prefix, uid);
  const out: Record<string, unknown> = {};
  for (const entry of entries.slice(0, 200)) {
    const subKey = entry.logicalKey.slice(prefix.length);
    if (!subKey) continue;
    try {
      out[subKey] = JSON.parse(entry.value);
    } catch {
      /* ignore malformed entry */
    }
  }
  return out;
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read blob"));
    reader.readAsArrayBuffer(blob);
  });
  return new Uint8Array(buf);
}

function bytesToReadableStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export async function compressBlob(
  blob: Blob,
): Promise<{ bytes: Uint8Array; compressed: boolean }> {
  const rawBytes = await readBlobBytes(blob);
  if (
    typeof CompressionStream === "undefined" ||
    typeof ReadableStream === "undefined" ||
    rawBytes.byteLength < 1024
  ) {
    return { bytes: rawBytes, compressed: false };
  }
  try {
    // Pipe concurrently through CompressionStream so >64KB blobs never hit backpressure deadlock
    const compressedStream = bytesToReadableStream(rawBytes).pipeThrough(
      new CompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>,
    );
    const compressedBuf = await new Response(compressedStream).arrayBuffer();
    const compressedBytes = new Uint8Array(compressedBuf);
    if (compressedBytes.byteLength < rawBytes.byteLength) {
      return { bytes: compressedBytes, compressed: true };
    }
  } catch {
    /* fallback uncompressed */
  }
  return { bytes: rawBytes, compressed: false };
}

export async function decompressBytes(
  bytes: Uint8Array,
  compressed: boolean,
): Promise<Uint8Array> {
  if (!compressed || typeof DecompressionStream === "undefined" || typeof ReadableStream === "undefined") {
    return bytes;
  }
  const exactCopy = new Uint8Array(bytes.byteLength);
  exactCopy.set(bytes);
  const decompressedStream = bytesToReadableStream(exactCopy).pipeThrough(
    new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>,
  );
  const outBuf = await new Response(decompressedStream).arrayBuffer();
  return new Uint8Array(outBuf);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function isNetworkOrOfflineError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code ?? "").toLowerCase();
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return (
    code.includes("unavailable") ||
    code.includes("network") ||
    msg.includes("timed out") ||
    msg.includes("offline") ||
    msg.includes("network") ||
    msg.includes("failed to get document because the client is offline")
  );
}

async function ensureUserProfile(user: User): Promise<void> {
  const db = getFirebaseDb();
  const userDocRef = doc(db, "users", user.uid);
  const snap = await getDoc(userDocRef);
  const now = Date.now();
  if (!snap.exists()) {
    await setDoc(
      userDocRef,
      stripUndefined({
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        providerId: user.providerData?.[0]?.providerId ?? "google.com",
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      }),
    );
  } else {
    const existing = snap.data() ?? {};
    await setDoc(
      userDocRef,
      stripUndefined({
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        providerId: user.providerData?.[0]?.providerId ?? "google.com",
        createdAt: existing.createdAt ?? now,
        updatedAt: now,
        lastLoginAt: now,
        lastSyncAt: existing.lastSyncAt,
      }),
    );
  }
}

async function uploadBlobToCloud(uid: string, file: Stored): Promise<void> {
  const db = getFirebaseDb();
  const metaRef = doc(db, "users", uid, "blobs", file.id);
  const existingMetaSnap = await getDoc(metaRef).catch(() => null);
  const now = Date.now();
  const rawSize = file.blob.size;
  if (existingMetaSnap?.exists()) {
    const prev = existingMetaSnap.data() as Partial<BlobMetaCloudDoc>;
    if (prev.name === file.name && prev.byteLength === rawSize) {
      return; // Content-identical file already persisted
    }
  }

  const createdAt =
    existingMetaSnap?.exists() && typeof existingMetaSnap.data()?.createdAt === "number"
      ? (existingMetaSnap.data()?.createdAt as number)
      : now;

  // 1. Prefer Firebase Storage if configured and permitted
  const storage = getFirebaseStorage();
  if (storage) {
    const storagePath = `users/${uid}/files/${encodeURIComponent(file.id)}`;
    try {
      await uploadBytes(storageRef(storage, storagePath), file.blob, {
        contentType: file.blob.type || "application/octet-stream",
      });
      const meta: BlobMetaCloudDoc = {
        id: file.id,
        name: file.name.slice(0, 255) || "asset",
        type: (file.blob.type || "application/octet-stream").slice(0, 128),
        slot: file.slot ? file.slot.slice(0, 64) : null,
        size: rawSize,
        byteLength: rawSize,
        chunkCount: 0,
        storagePath,
        compressed: false,
        encoding: "storage",
        createdAt,
        updatedAt: now,
      };
      await setDoc(metaRef, stripUndefined(meta));
      return;
    } catch {
      /* Fall back seamlessly to compressed Firestore chunks (works even on free Spark plan!) */
    }
  }

  // 2. Fallback: gzip + base64 chunks in Firestore subcollection (parallel batched chunks + short timeouts)
  const { bytes, compressed } = await compressBlob(file.blob);
  const b64 = encodeBytesToBase64(bytes);
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += CHUNK_CHAR_LIMIT) {
    chunks.push(b64.slice(i, i + CHUNK_CHAR_LIMIT));
  }
  if (chunks.length > MAX_CHUNK_COUNT) {
    throw new Error(`File "${file.name}" exceeds maximum cloud sync size.`);
  }

  for (let i = 0; i < chunks.length; i += 4) {
    const batchSlice = chunks.slice(i, i + 4);
    await Promise.all(
      batchSlice.map((chunkData, offset) => {
        const index = i + offset;
        return withTimeout(
          setDoc(
            doc(db, "users", uid, "blobs", file.id, "chunks", `c-${index}`),
            stripUndefined({
              index,
              data: chunkData,
              fileId: file.id,
              size: chunkData.length,
              updatedAt: now,
            }),
          ),
          10_000,
          `Upload chunk ${index} of ${file.name}`,
        );
      }),
    );
  }

  const meta: BlobMetaCloudDoc = {
    id: file.id,
    name: file.name.slice(0, 255) || "asset",
    type: (file.blob.type || "application/octet-stream").slice(0, 128),
    slot: file.slot ? file.slot.slice(0, 64) : null,
    size: bytes.byteLength,
    byteLength: rawSize,
    chunkCount: chunks.length,
    storagePath: null,
    compressed,
    encoding: "base64",
    createdAt,
    updatedAt: now,
  };
  await withTimeout(setDoc(metaRef, stripUndefined(meta)), 10_000, `Save blob meta ${file.name}`);
}

export async function fetchCloudFileForUser(uid: string, fileId: string): Promise<Stored | null> {
  if (!isFirebaseConfigured()) return null;
  const db = getFirebaseDb();
  const metaSnap = await getDoc(doc(db, "users", uid, "blobs", fileId));
  if (!metaSnap.exists()) return null;
  const meta = metaSnap.data() as BlobMetaCloudDoc;
  const mime = meta.type || "application/octet-stream";

  if (meta.storagePath) {
    const storage = getFirebaseStorage();
    if (storage) {
      try {
        const buf = await getBytes(storageRef(storage, meta.storagePath));
        return {
          id: meta.id,
          name: meta.name,
          slot: meta.slot ?? undefined,
          blob: new Blob([buf], { type: mime }),
        };
      } catch {
        /* Try chunk fallback below if present */
      }
    }
  }

  if (meta.chunkCount > 0) {
    const chunkSnap = await getDocs(collection(db, "users", uid, "blobs", fileId, "chunks"));
    const rows: Array<{ index: number; data: string }> = [];
    chunkSnap.forEach((d) => {
      const val = d.data() as { index: number; data: string };
      if (typeof val.index === "number" && typeof val.data === "string") {
        rows.push(val);
      }
    });
    rows.sort((a, b) => a.index - b.index);
    const b64 = rows.map((r) => r.data).join("");
    const compressedBytes = decodeBase64ToBytes(b64);
    const rawBytes = await decompressBytes(compressedBytes, Boolean(meta.compressed));
    const exactBuf = new ArrayBuffer(rawBytes.byteLength);
    new Uint8Array(exactBuf).set(rawBytes);
    return {
      id: meta.id,
      name: meta.name,
      slot: meta.slot ?? undefined,
      blob: new Blob([exactBuf], { type: mime }),
    };
  }

  return null;
}

function compactWorkspaceForCloud(ws: WorkspaceCloudDoc): WorkspaceCloudDoc {
  try {
    if (JSON.stringify(ws).length <= 820_000) return ws;
    return {
      ...ws,
      customPoses: ws.customPoses.map((p) => ({
        ...p,
        thumbnail: p.thumbnail && p.thumbnail.length > 24_000 ? undefined : p.thumbnail,
      })),
      characters: ws.characters.map((c) => ({
        ...c,
        thumbnail: c.thumbnail && c.thumbnail.length > 24_000 ? undefined : c.thumbnail,
      })),
      roster: ws.roster.map((r) => ({
        ...r,
        previewUrl: r.previewUrl && r.previewUrl.length > 24_000 ? "" : r.previewUrl,
      })),
    };
  } catch {
    return ws;
  }
}

function collectWorkspaceDoc(uid: string, library: MangaLibraryState | null): WorkspaceCloudDoc {
  const raw = stripUndefined({
    version: 1,
    schemaVersion: 1,
    updatedAt: Date.now(),
    deviceId: getOrCreateDeviceId(),
    activeProjectId: library?.activeProjectId ?? null,
    characters: loadCharacters().slice(0, 500),
    characters2d: loadCharacters2D().slice(0, 500),
    baseModels: loadBaseModels().slice(0, 500),
    baseModels2d: loadCustomBaseModels2D().slice(0, 200),
    heads2d: loadCustomHeads2D().slice(0, 200),
    parts2d: loadCustomParts2D().slice(0, 500),
    scenes2d: loadScenes2D().slice(0, 200),
    sceneObjects2d: loadCustomSceneObjects2D().slice(0, 500),
    stages2d: loadStages2D().slice(0, 200),
    poses2d: loadCustomPoses2D().slice(0, 300),
    facePacks: loadPacks().slice(0, 500),
    customPoses: loadCustomPoses().slice(0, 500),
    customProps: loadCustomPropsMeta().slice(0, 500),
    customTemplates: loadCustomTemplates().slice(0, 500),
    roster: loadSavedRoster().slice(0, 500),
    faceConfigs: safeJsonMapFromPrefix("koma-face:", uid),
    faceCalibrations: safeJsonMapFromPrefix("koma-face-calib:", uid),
    wardrobeOutfits: safeJsonMapFromPrefix("koma-outfit:", uid),
    preferences: {
      panelOverlapPref: loadPanelOverlapPreference(),
    },
  });
  return compactWorkspaceForCloud(raw);
}

function serializeProjectDoc(
  proj: MangaProject,
  existingCreatedAt?: number,
): Record<string, unknown> {
  return stripUndefined({
    id: proj.id,
    title: (proj.title || "Untitled Series").slice(0, 200),
    activeChapterId: proj.activeChapterId,
    chapters: proj.chapters.slice(0, 200),
    createdAt: typeof existingCreatedAt === "number" ? existingCreatedAt : proj.createdAt || Date.now(),
    updatedAt: typeof proj.updatedAt === "number" ? proj.updatedAt : Date.now(),
    schemaVersion: 1,
    version: 1,
  });
}

async function applyRemoteStateToLocal(
  uid: string,
  remoteWorkspace: WorkspaceCloudDoc | null,
  remoteProjects: MangaProject[],
): Promise<void> {
  setApplyingRemoteSync(true);
  resetChapterAssetCache();
  try {
    if (remoteWorkspace) {
      userLsSet("koma-characters", JSON.stringify(remoteWorkspace.characters ?? []), "workspace");
      if (Array.isArray(remoteWorkspace.characters2d)) {
        userLsSet("koma-characters-2d", JSON.stringify(remoteWorkspace.characters2d), "workspace");
      }
      userLsSet("koma-base-models", JSON.stringify(remoteWorkspace.baseModels ?? []), "workspace");
      if (Array.isArray(remoteWorkspace.baseModels2d)) {
        userLsSet("koma-base-models-2d", JSON.stringify(remoteWorkspace.baseModels2d), "workspace");
      }
      if (Array.isArray(remoteWorkspace.heads2d)) {
        userLsSet("koma-heads-2d", JSON.stringify(remoteWorkspace.heads2d), "workspace");
      }
      if (Array.isArray(remoteWorkspace.parts2d)) {
        userLsSet("koma-parts-2d", JSON.stringify(remoteWorkspace.parts2d), "workspace");
      }
      if (Array.isArray(remoteWorkspace.scenes2d)) {
        userLsSet("koma-scenes-2d", JSON.stringify(remoteWorkspace.scenes2d), "workspace");
      }
      if (Array.isArray(remoteWorkspace.sceneObjects2d)) {
        userLsSet(
          "koma-scene-objects-2d",
          JSON.stringify(remoteWorkspace.sceneObjects2d),
          "workspace",
        );
      }
      if (Array.isArray(remoteWorkspace.stages2d)) {
        userLsSet("koma-stages-2d", JSON.stringify(remoteWorkspace.stages2d), "workspace");
      }
      if (Array.isArray(remoteWorkspace.poses2d)) {
        userLsSet("koma-poses-2d", JSON.stringify(remoteWorkspace.poses2d), "workspace");
      }
      userLsSet("koma-face-packs", JSON.stringify(remoteWorkspace.facePacks ?? []), "workspace");
      userLsSet(
        "inked_figure_studio_custom_poses_v1",
        JSON.stringify(remoteWorkspace.customPoses ?? []),
        "workspace",
      );
      userLsSet("koma-custom-props-v1", JSON.stringify(remoteWorkspace.customProps ?? []), "workspace");
      userLsSet(
        "koma-custom-templates",
        JSON.stringify(remoteWorkspace.customTemplates ?? []),
        "workspace",
      );
      userLsSet("inked_manga_roster_v1", JSON.stringify(remoteWorkspace.roster ?? []), "workspace");
      if (remoteWorkspace.preferences?.panelOverlapPref) {
        userLsSet(
          "koma-panel-overlap-pref",
          remoteWorkspace.preferences.panelOverlapPref,
          "workspace",
        );
      }

      for (const [k, v] of Object.entries(remoteWorkspace.faceConfigs ?? {})) {
        userLsSet(`koma-face:${k}`, JSON.stringify(v), "workspace");
      }
      for (const [k, v] of Object.entries(remoteWorkspace.faceCalibrations ?? {})) {
        userLsSet(`koma-face-calib:${k}`, JSON.stringify(v), "workspace");
      }
      for (const [k, v] of Object.entries(remoteWorkspace.wardrobeOutfits ?? {})) {
        userLsSet(`koma-outfit:${k}`, JSON.stringify(v), "workspace");
      }
    }

    if (remoteProjects.length > 0) {
      const sorted = [...remoteProjects].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      const activeProjectId =
        remoteWorkspace?.activeProjectId &&
        sorted.some((p) => p.id === remoteWorkspace.activeProjectId)
          ? remoteWorkspace.activeProjectId
          : sorted[0].id;
      const lib: MangaLibraryState = {
        version: 1,
        activeProjectId,
        projects: sorted,
      };
      const dbName = getActiveFilesDbName(uid);
      await putKv("manga-library-v1", lib, { dbName, silent: true }).catch(() => {});
      userLsSet("koma-library-v1", JSON.stringify(lib), "library");
    }
  } finally {
    setApplyingRemoteSync(false);
  }
}

export interface LegacyBrowserSummary {
  characterCount: number;
  projectCount: number;
  fileCount: number;
  poseCount: number;
  totalItems: number;
}

export async function inspectLegacyBrowserData(
  uid: string,
): Promise<LegacyBrowserSummary | null> {
  if (typeof window === "undefined") return null;
  if (getLegacyPromptChoice(uid) !== null) return null;

  const lsEntries = readLegacyLocalStorageEntries();
  const legacyIdb = await readLegacyIndexedDbSnapshot();
  const totalItems = lsEntries.length + legacyIdb.files.length + legacyIdb.kv.length;
  if (totalItems === 0) return null;

  const safeLen = (key: string): number => {
    const raw = lsEntries.find((e) => e.key === key)?.value;
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  let projectCount = 0;
  const libKv = legacyIdb.kv.find((k) => k.id === "manga-library-v1")?.value as
    | Partial<MangaLibraryState>
    | undefined;
  if (libKv && Array.isArray(libKv.projects)) {
    projectCount = libKv.projects.length;
  } else {
    const rawLib = lsEntries.find((e) => e.key === "koma-library-v1")?.value;
    if (rawLib) {
      try {
        const parsed = JSON.parse(rawLib) as Partial<MangaLibraryState>;
        projectCount = Array.isArray(parsed.projects) ? parsed.projects.length : 0;
      } catch {
        projectCount = 0;
      }
    }
  }

  return {
    characterCount: safeLen("koma-characters"),
    poseCount: safeLen("inked_figure_studio_custom_poses_v1"),
    projectCount,
    fileCount: legacyIdb.files.length,
    totalItems,
  };
}

async function copyLegacyDataLocally(uid: string): Promise<number> {
  const lsEntries = readLegacyLocalStorageEntries();
  const legacyIdb = await readLegacyIndexedDbSnapshot().catch(() => ({ files: [], kv: [] }));

  let importedItems = 0;
  setApplyingRemoteSync(true);
  try {
    for (const entry of lsEntries) {
      const scoped = scopeStorageKey(entry.key, uid);
      const existing = window.localStorage.getItem(scoped);
      if (existing === null || existing === "[]") {
        window.localStorage.setItem(scoped, entry.value);
        importedItems++;
      }
    }

    const targetDb = getActiveFilesDbName(uid);
    for (const file of legacyIdb.files) {
      const existing = await getLocalFile(file.id, targetDb).catch(() => null);
      if (!existing) {
        await putFile(file.id, file.blob, file.name, file.slot, {
          dbName: targetDb,
          silent: true,
        }).catch(() => {});
        importedItems++;
      }
    }
    for (const row of legacyIdb.kv) {
      await putKv(row.id, row.value, { dbName: targetDb, silent: true }).catch(() => {});
      importedItems++;
    }
  } finally {
    setApplyingRemoteSync(false);
  }

  setLegacyPromptChoice(uid, "imported");
  const q = loadSyncQueue(uid);
  q.dirtyWorkspace = true;
  const files = await listAllFiles(getActiveFilesDbName(uid)).catch(() => []);
  for (const f of files) {
    if (!q.dirtyFileIds.includes(f.id)) q.dirtyFileIds.push(f.id);
  }
  const lib = await loadMangaLibrary().catch(() => null);
  if (lib) {
    q.dirtyProjectIds = [...new Set([...q.dirtyProjectIds, ...lib.projects.map((p) => p.id)])];
  }
  saveSyncQueue(uid, q);
  notifyStatus({ legacyImportedCount: importedItems });
  return importedItems;
}

/** Imports existing unscoped browser work into the signed-in user's scoped cache and syncs in background. */
export async function importLegacyBrowserData(uid: string): Promise<number> {
  const importedItems = await copyLegacyDataLocally(uid);
  cloudPullCallback?.();
  void flushCloudSync(uid);
  return importedItems;
}

export function declineLegacyBrowserData(uid: string): void {
  setLegacyPromptChoice(uid, "declined");
}

export async function flushCloudSync(uid: string = activeSyncUid ?? ""): Promise<boolean> {
  if (!uid || !isFirebaseConfigured()) return false;
  if (flushInFlight) return flushInFlight;

  flushInFlight = (async () => {
    const q = loadSyncQueue(uid);
    if (countPending(q) === 0) {
      notifyStatus({ phase: "saved", pendingCount: 0, errorMessage: null, detail: null });
      return true;
    }

    notifyStatus({
      phase: "syncing",
      errorMessage: null,
      detail: "Saving manga series & 3D studio…",
    });
    try {
      const db = getFirebaseDb();
      const rawLib = await loadMangaLibrary().catch(() => createDefaultLibrary(null));
      const lib = await externalizeLibraryAssets(rawLib);

      // 1. Save lightweight MangaProjects & workspace metadata FIRST so core data lands in <1s
      const projectIdsToPush = new Set(q.dirtyProjectIds);
      for (const p of lib.projects) {
        if (projectIdsToPush.has(p.id) || q.dirtyWorkspace) {
          const projRef = doc(db, "users", uid, "projects", p.id);
          const existingSnap = await withTimeout(getDoc(projRef), 6000, "Read project meta").catch(
            () => null,
          );
          const existingCreatedAt = existingSnap?.exists()
            ? (existingSnap.data()?.createdAt as number | undefined)
            : undefined;
          await withTimeout(
            setDoc(projRef, serializeProjectDoc(p, existingCreatedAt)),
            10_000,
            `Save project ${p.title}`,
          );
        }
      }
      q.dirtyProjectIds = [];

      // 2. Delete explicitly deleted projects
      const activeIds = new Set(lib.projects.map((p) => p.id));
      for (const delId of q.deletedProjectIds) {
        if (!activeIds.has(delId)) {
          await withTimeout(
            deleteDoc(doc(db, "users", uid, "projects", delId)),
            6000,
            "Delete project",
          ).catch(() => {});
        }
      }
      q.deletedProjectIds = [];

      // 3. Upload workspace document (characters, base models, poses, props, face/outfit configs)
      const workspaceDoc = collectWorkspaceDoc(uid, lib);
      await withTimeout(
        setDoc(doc(db, "users", uid, "studio", "workspace"), workspaceDoc),
        10_000,
        "Save workspace",
      );
      q.dirtyWorkspace = false;
      q.lastSyncedCloudWorkspaceAt = workspaceDoc.updatedAt;
      saveSyncQueue(uid, q);

      // 4. Upload referenced or dirty binary assets (with local uploaded receipt cache)
      const allFiles = await listAllFiles(getActiveFilesDbName(uid)).catch(() => []);
      const fileMap = new Map(allFiles.map((f) => [f.id, f]));
      const neededIds = new Set<string>([
        ...q.dirtyFileIds,
        ...referencedFileIds(
          loadCharacters(),
          [],
          loadCustomPropsMeta().map((p) => p.fileId),
          loadBaseModels(),
          lib,
        ),
      ]);

      const uploadedCacheKey = scopeStorageKey("__uploaded_blobs_v1", uid);
      let uploadedMap: Record<string, number> = {};
      try {
        uploadedMap = JSON.parse(window.localStorage.getItem(uploadedCacheKey) || "{}") as Record<
          string,
          number
        >;
      } catch {
        uploadedMap = {};
      }

      const toUpload: Stored[] = [];
      for (const fid of neededIds) {
        if (!fid || fid.startsWith("builtin:")) continue;
        const file = fileMap.get(fid);
        if (!file) continue;
        if (uploadedMap[fid] === file.blob.size && !q.dirtyFileIds.includes(fid)) continue;
        toUpload.push(file);
      }

      const failedFileIds: string[] = [];
      let lastFileError: string | null = null;
      for (let i = 0; i < toUpload.length; i += 3) {
        const group = toUpload.slice(i, i + 3);
        notifyStatus({
          detail: `Syncing assets (${Math.min(i + group.length, toUpload.length)}/${toUpload.length})…`,
        });
        await Promise.all(
          group.map(async (file) => {
            try {
              await withTimeout(uploadBlobToCloud(uid, file), 20_000, `Upload ${file.name}`);
              uploadedMap[file.id] = file.blob.size;
            } catch (fileErr) {
              failedFileIds.push(file.id);
              lastFileError =
                fileErr instanceof Error ? fileErr.message : `Could not upload ${file.name}`;
            }
          }),
        );
      }
      try {
        window.localStorage.setItem(uploadedCacheKey, JSON.stringify(uploadedMap));
      } catch {
        /* ignore quota */
      }
      q.dirtyFileIds = failedFileIds;

      // 5. Update syncMeta
      const now = Date.now();
      await withTimeout(
        setDoc(
          doc(db, "users", uid, "studio", "syncMeta"),
          stripUndefined({
            updatedAt: now,
            lastSyncedAt: now,
            lastSyncAt: now,
            deviceId: getOrCreateDeviceId(),
            projectCount: lib.projects.length,
            blobCount: allFiles.length,
          }),
        ),
        6000,
        "Save syncMeta",
      ).catch(() => {});

      saveSyncQueue(uid, q);
      if (failedFileIds.length > 0) {
        notifyStatus({
          phase: "error",
          pendingCount: failedFileIds.length,
          lastSyncedAt: now,
          detail: null,
          errorMessage: lastFileError || `${failedFileIds.length} asset(s) queued to retry.`,
          conflict: null,
        });
        return false;
      }

      notifyStatus({
        phase: "saved",
        pendingCount: 0,
        lastSyncedAt: now,
        detail: null,
        errorMessage: null,
        conflict: null,
      });
      return true;
    } catch (err) {
      if (isNetworkOrOfflineError(err)) {
        notifyStatus({
          phase: "offline",
          detail: null,
          errorMessage: "Offline — all changes are saved safely on this device and will sync automatically.",
        });
      } else {
        notifyStatus({
          phase: "error",
          detail: null,
          errorMessage: err instanceof Error ? err.message : "Could not sync to cloud yet.",
        });
      }
      return false;
    } finally {
      flushInFlight = null;
    }
  })();

  return flushInFlight;
}

function scheduleBackgroundSync(uid: string, delayMs = 1100): void {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncDebounceTimer = null;
    if (getActiveStorageUser() === uid && !currentStatus.conflict) {
      void flushCloudSync(uid);
    }
  }, delayMs);
}

function handleLocalStorageMutation(event: StorageChangeEvent): void {
  const uid = event.uid;
  if (!uid || uid !== activeSyncUid) return;
  const q = loadSyncQueue(uid);
  if (event.domain === "workspace") {
    q.dirtyWorkspace = true;
  } else if (event.domain === "library") {
    q.dirtyWorkspace = true;
    const rawLibTxt = userLsGet("koma-library-v1");
    if (rawLibTxt) {
      try {
        const lib = JSON.parse(rawLibTxt) as MangaLibraryState;
        const nextIds = new Set(lib.projects.map((p) => p.id));
        q.dirtyProjectIds = [...new Set([...q.dirtyProjectIds, ...nextIds])];
      } catch {
        /* ignore */
      }
    }
    void loadMangaLibrary()
      .then((lib) => {
        const cur = loadSyncQueue(uid);
        const ids = new Set(cur.dirtyProjectIds);
        for (const p of lib.projects) ids.add(p.id);
        cur.dirtyProjectIds = [...ids];
        saveSyncQueue(uid, cur);
      })
      .catch(() => {});
  } else if (event.domain === "file" && event.fileId) {
    if (!q.dirtyFileIds.includes(event.fileId)) {
      q.dirtyFileIds.push(event.fileId);
    }
  }
  saveSyncQueue(uid, q);
  if (!currentStatus.conflict) {
    scheduleBackgroundSync(uid);
  }
}

export function markProjectDeletedForCloudSync(projectId: string): void {
  const uid = activeSyncUid ?? getActiveStorageUser();
  if (!uid || !projectId) return;
  const q = loadSyncQueue(uid);
  if (!q.deletedProjectIds.includes(projectId)) {
    q.deletedProjectIds.push(projectId);
  }
  q.dirtyProjectIds = q.dirtyProjectIds.filter((id) => id !== projectId);
  saveSyncQueue(uid, q);
  scheduleBackgroundSync(uid, 500);
}

function bindGlobalLifecycleListeners(): void {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;
  window.addEventListener("online", () => {
    if (activeSyncUid && !currentStatus.conflict) {
      void flushCloudSync(activeSyncUid);
    }
  });
  window.addEventListener("offline", () => {
    notifyStatus({
      phase: "offline",
      errorMessage: "Offline — changes saved locally and queued.",
    });
  });
  window.addEventListener("pagehide", () => {
    if (activeSyncUid && !currentStatus.conflict) {
      void flushCloudSync(activeSyncUid);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && activeSyncUid && !currentStatus.conflict) {
      void flushCloudSync(activeSyncUid);
    }
  });
}

export async function resolveCloudConflict(choice: "cloud" | "local"): Promise<void> {
  const uid = activeSyncUid;
  if (!uid) return;
  const snapshot = pendingRemoteSnapshot;
  pendingRemoteSnapshot = null;

  if (choice === "cloud" && snapshot) {
    await applyRemoteStateToLocal(uid, snapshot.workspace, snapshot.projects);
    const q = emptyQueue();
    q.lastSyncedCloudWorkspaceAt = snapshot.workspace?.updatedAt ?? Date.now();
    saveSyncQueue(uid, q);
    notifyStatus({ phase: "saved", conflict: null, lastSyncedAt: Date.now(), errorMessage: null });
    cloudPullCallback?.();
  } else {
    const q = loadSyncQueue(uid);
    const lib = await loadMangaLibrary().catch(() => createDefaultLibrary(null));
    q.dirtyWorkspace = true;
    q.dirtyProjectIds = lib.projects.map((p) => p.id);
    saveSyncQueue(uid, q);
    notifyStatus({ conflict: null });
    await flushCloudSync(uid);
  }
}

export async function initializeUserCloudSession(user: User): Promise<{
  legacyPrompt: LegacyBrowserSummary | null;
}> {
  activeSyncUid = user.uid;
  pendingRemoteSnapshot = null;
  resetChapterAssetCache();
  bindGlobalLifecycleListeners();

  registerCloudFileFetcher((fileId) => fetchCloudFileForUser(user.uid, fileId));

  if (unsubscribeStorageListener) {
    unsubscribeStorageListener();
  }
  unsubscribeStorageListener = subscribeUserStorageChanges(handleLocalStorageMutation);

  notifyStatus({ phase: "syncing", errorMessage: null, conflict: null });

  let legacyPrompt: LegacyBrowserSummary | null = null;
  try {
    legacyPrompt = await inspectLegacyBrowserData(user.uid);
  } catch {
    legacyPrompt = null;
  }

  // Ensure existing pre-login browser work is preserved cleanly for officialkevinandrews@gmail.com
  // right away while still prompting other accounts before importing.
  if (legacyPrompt && normalizeEmail(user.email) === "officialkevinandrews@gmail.com") {
    await copyLegacyDataLocally(user.uid).catch(() => 0);
    legacyPrompt = null;
  }

  const q = loadSyncQueue(user.uid);

  if (!isFirebaseConfigured()) {
    notifyStatus({
      phase: "error",
      errorMessage: "Firebase project is not connected yet.",
    });
    return { legacyPrompt };
  }

  try {
    // Update user profile in background so slow/offline auth doesn't delay opening the studio
    void ensureUserProfile(user).catch(() => {});

    const db = getFirebaseDb();
    const [wsSnap, projSnap] = await withTimeout(
      Promise.all([
        getDoc(doc(db, "users", user.uid, "studio", "workspace")),
        getDocs(collection(db, "users", user.uid, "projects")),
      ]),
      4000,
      "Initial cloud workspace fetch",
    );

    const remoteWorkspace = wsSnap.exists() ? (wsSnap.data() as WorkspaceCloudDoc) : null;
    const remoteProjects: MangaProject[] = [];
    projSnap.forEach((d: DocumentData) => {
      const data = d.data() as MangaProject;
      if (data && typeof data.id === "string" && Array.isArray(data.chapters)) {
        remoteProjects.push(data);
      }
    });

    const pendingTotal = countPending(q);
    const localHasProjects = await listAllKv(getActiveFilesDbName(user.uid))
      .then((rows) => rows.some((r) => r.id === "manga-library-v1"))
      .catch(() => false);
    const localHasData = loadCharacters().length > 0 || localHasProjects;
    const remoteHasData = Boolean(remoteWorkspace || remoteProjects.length > 0);
    const localDeviceId = getOrCreateDeviceId();

    if (!remoteHasData) {
      if (localHasData) {
        q.dirtyWorkspace = true;
        const lib = await loadMangaLibrary().catch(() => createDefaultLibrary(null));
        q.dirtyProjectIds = [...new Set([...q.dirtyProjectIds, ...lib.projects.map((p) => p.id)])];
        saveSyncQueue(user.uid, q);
        // Upload in background so large 3D models/images never block opening the studio
        void flushCloudSync(user.uid);
      } else {
        notifyStatus({
          phase: "saved",
          pendingCount: 0,
          lastSyncedAt: Date.now(),
        });
      }
    } else if (pendingTotal === 0) {
      await applyRemoteStateToLocal(user.uid, remoteWorkspace, remoteProjects);
      q.lastSyncedCloudWorkspaceAt = remoteWorkspace?.updatedAt ?? Date.now();
      saveSyncQueue(user.uid, q);
      notifyStatus({
        phase: "saved",
        pendingCount: 0,
        lastSyncedAt: Date.now(),
      });
    } else if (
      remoteWorkspace &&
      remoteWorkspace.deviceId &&
      remoteWorkspace.deviceId !== localDeviceId &&
      remoteWorkspace.updatedAt > q.lastSyncedCloudWorkspaceAt
    ) {
      pendingRemoteSnapshot = { workspace: remoteWorkspace, projects: remoteProjects };
      notifyStatus({
        phase: "conflict",
        conflict: {
          remoteUpdatedAt: remoteWorkspace.updatedAt,
          remoteDeviceId: remoteWorkspace.deviceId,
          remoteProjectCount: remoteProjects.length,
          localPendingCount: pendingTotal,
        },
      });
    } else {
      void flushCloudSync(user.uid);
    }
  } catch (err) {
    if (isNetworkOrOfflineError(err)) {
      notifyStatus({
        phase: "offline",
        errorMessage: "Loaded locally — cloud sync will retry automatically in the background.",
      });
      if (countPending(q) > 0) {
        scheduleBackgroundSync(user.uid, 3000);
      }
    } else {
      notifyStatus({
        phase: "error",
        errorMessage: err instanceof Error ? err.message : "Cloud sync failed.",
      });
    }
  }

  return { legacyPrompt };
}

/** Builds a self-contained JSON backup of the signed-in user's entire account (3D models, characters, poses, props, face/outfit settings, and all manga series/chapters/images). */
export async function buildFullAccountBackup(
  uid: string,
  accountEmail?: string | null,
  overrideLibrary?: MangaLibraryState,
): Promise<StudioBackup> {
  const rawLib = overrideLibrary ?? (await loadMangaLibrary().catch(() => createDefaultLibrary(null)));
  const externalLib = await externalizeLibraryAssets(rawLib);
  const activeProj = getActiveProject(externalLib);
  const activeCh = getActiveChapter(activeProj);
  const characters = loadCharacters();
  const characters2d = loadCharacters2D();
  const baseModels = loadBaseModels();
  const baseModels2d = loadCustomBaseModels2D();
  const heads2d = loadCustomHeads2D();
  const parts2d = loadCustomParts2D();
  const scenes2d = loadScenes2D();
  const sceneObjects2d = loadCustomSceneObjects2D();
  const stages2d = loadStages2D();
  const poses2d = loadCustomPoses2D();
  const facePacks = loadPacks();
  const customPoses = loadCustomPoses();
  const customProps = loadCustomPropsMeta();
  const customTemplates = loadCustomTemplates();
  const roster = loadSavedRoster();
  const faceConfigs = safeJsonMapFromPrefix("koma-face:", uid);
  const faceCalibrations = safeJsonMapFromPrefix("koma-face-calib:", uid);
  const wardrobeOutfits = safeJsonMapFromPrefix("koma-outfit:", uid);
  const panelOverlapPref = loadPanelOverlapPreference();

  const storedFiles = await listAllFiles(getActiveFilesDbName(uid)).catch(() => []);
  const storedMap = new Map(storedFiles.map((f) => [f.id, f]));
  const idsToInclude = new Set<string>([
    ...referencedFileIds(
      characters,
      activeCh.pages,
      customProps.map((p) => p.fileId),
      baseModels,
      externalLib,
    ),
    ...storedFiles.map((f) => f.id),
  ]);

  const files: BackupFile[] = [];
  for (const id of idsToInclude) {
    if (!id || id.startsWith("builtin:")) continue;
    const f = storedMap.get(id) ?? (await getLocalFile(id, getActiveFilesDbName(uid)).catch(() => null));
    if (!f) continue;
    files.push({
      id: f.id,
      name: f.name,
      slot: f.slot,
      type: f.blob.type || "application/octet-stream",
      data: await blobToB64(f.blob),
    });
  }

  return {
    app: "koma-studio",
    version: 1,
    exported: Date.now(),
    accountEmail: accountEmail ?? null,
    characters,
    characters2d,
    baseModels,
    baseModels2d,
    heads2d,
    parts2d,
    scenes2d,
    sceneObjects2d,
    stages2d,
    poses2d,
    facePacks,
    customPoses,
    customProps,
    customTemplates,
    roster,
    faceConfigs,
    faceCalibrations,
    wardrobeOutfits,
    panelOverlapPref,
    files,
    pages: activeCh.pages,
    activePageIndex: activeCh.activePageIndex,
    mangaLibrary: externalLib,
  };
}

export async function downloadFullAccountBackup(
  uid: string,
  accountEmail?: string | null,
  overrideLibrary?: MangaLibraryState,
): Promise<void> {
  const backup = await buildFullAccountBackup(uid, accountEmail, overrideLibrary);
  const slug = (accountEmail || "account")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mangakadesk-${slug || "account"}-backup-${dateStr}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function teardownUserCloudSession(): void {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }
  if (unsubscribeStorageListener) {
    unsubscribeStorageListener();
    unsubscribeStorageListener = null;
  }
  registerCloudFileFetcher(null);
  activeSyncUid = null;
  pendingRemoteSnapshot = null;
  resetChapterAssetCache();
  notifyStatus({
    phase: "idle",
    pendingCount: 0,
    errorMessage: null,
    conflict: null,
    legacyImportedCount: 0,
  });
}

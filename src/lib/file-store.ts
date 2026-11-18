import { emitStorageChange, getActiveStorageUser } from "./user-storage";

/** Keeps uploaded model, clothing, and chapter assets in account-scoped IndexedDB so projects survive reloads & sync offline. */
const LEGACY_DB = "koma-files";
const STORE = "files";
const KV_STORE = "kv";
const IDB_OPEN_TIMEOUT_MS = 2500;

export interface Stored {
  id: string;
  name: string;
  blob: Blob;
  slot?: string;
}

type CloudFileFetcher = (id: string) => Promise<Stored | null>;
let cloudFileFetcher: CloudFileFetcher | null = null;
const inflightCloudFetches = new Map<string, Promise<Stored | null>>();
const openDbs = new Map<string, Promise<IDBDatabase>>();

export function registerCloudFileFetcher(fetcher: CloudFileFetcher | null): void {
  cloudFileFetcher = fetcher;
}

export function getActiveFilesDbName(uid: string | null = getActiveStorageUser()): string {
  return uid ? `${LEGACY_DB}-${uid}` : LEGACY_DB;
}

function open(dbName: string = getActiveFilesDbName()): Promise<IDBDatabase> {
  const cached = openDbs.get(dbName);
  if (cached) return cached;

  const p = new Promise<IDBDatabase>((res, rej) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      openDbs.delete(dbName);
      rej(new Error(`IndexedDB open timed out for ${dbName}`));
    }, IDB_OPEN_TIMEOUT_MS);

    try {
      const r = indexedDB.open(dbName, 2);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) {
          r.result.createObjectStore(STORE, { keyPath: "id" });
        }
        if (!r.result.objectStoreNames.contains(KV_STORE)) {
          r.result.createObjectStore(KV_STORE, { keyPath: "id" });
        }
      };
      r.onblocked = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        openDbs.delete(dbName);
        rej(new Error(`IndexedDB blocked while opening ${dbName}`));
      };
      r.onsuccess = () => {
        if (settled) {
          try {
            r.result.close();
          } catch {
            /* ignore */
          }
          return;
        }
        settled = true;
        clearTimeout(timer);
        const db = r.result;
        db.onversionchange = () => {
          openDbs.delete(dbName);
          try {
            db.close();
          } catch {
            /* ignore */
          }
        };
        db.onclose = () => {
          openDbs.delete(dbName);
        };
        res(db);
      };
      r.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        openDbs.delete(dbName);
        rej(r.error ?? new Error(`IndexedDB error opening ${dbName}`));
      };
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        openDbs.delete(dbName);
        rej(err);
      }
    }
  });

  openDbs.set(dbName, p);
  return p;
}

export async function putFile(
  id: string,
  file: Blob,
  name: string,
  slot?: string,
  options?: { dbName?: string; silent?: boolean },
) {
  const db = await open(options?.dbName);
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id, name, blob: file, slot } satisfies Stored);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  if (!options?.silent) {
    emitStorageChange("file", { fileId: id });
  }
}

export async function getLocalFile(
  id: string,
  dbName: string = getActiveFilesDbName(),
): Promise<Stored | null> {
  const db = await open(dbName);
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(id);
    r.onsuccess = () => res((r.result as Stored) ?? null);
    r.onerror = () => rej(r.error);
  });
}

export async function getFile(id: string): Promise<Stored | null> {
  const local = await getLocalFile(id).catch(() => null);
  if (local) return local;

  const uid = getActiveStorageUser();
  if (!uid || !cloudFileFetcher) return null;

  const cacheKey = `${uid}:${id}`;
  const existing = inflightCloudFetches.get(cacheKey);
  if (existing) return existing;

  const promise = cloudFileFetcher(id)
    .then(async (remote) => {
      if (remote && getActiveStorageUser() === uid) {
        await putFile(remote.id, remote.blob, remote.name, remote.slot, {
          dbName: getActiveFilesDbName(uid),
          silent: true,
        }).catch(() => {});
      }
      return remote;
    })
    .catch(() => null)
    .finally(() => {
      inflightCloudFetches.delete(cacheKey);
    });

  inflightCloudFetches.set(cacheKey, promise);
  return promise;
}

export async function deleteFile(id: string): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  emitStorageChange("file", { fileId: id });
}

export async function listAllFiles(
  dbName: string = getActiveFilesDbName(),
): Promise<Stored[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await open(dbName);
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).getAll();
    r.onsuccess = () => res(Array.isArray(r.result) ? (r.result as Stored[]) : []);
    r.onerror = () => rej(r.error);
  });
}

export async function putKv<T>(
  id: string,
  value: T,
  options?: { dbName?: string; silent?: boolean },
): Promise<void> {
  const db = await open(options?.dbName);
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(KV_STORE, "readwrite");
    tx.objectStore(KV_STORE).put({ id, value });
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  if (!options?.silent) {
    emitStorageChange("library", { key: id });
  }
}

export async function getKv<T>(
  id: string,
  dbName: string = getActiveFilesDbName(),
): Promise<T | null> {
  const db = await open(dbName);
  return new Promise((res, rej) => {
    const r = db.transaction(KV_STORE).objectStore(KV_STORE).get(id);
    r.onsuccess = () => {
      const row = r.result as { id: string; value: T } | undefined;
      res(row ? row.value : null);
    };
    r.onerror = () => rej(r.error);
  });
}

export async function listAllKv(
  dbName: string = getActiveFilesDbName(),
): Promise<Array<{ id: string; value: unknown }>> {
  if (typeof indexedDB === "undefined") return [];
  const db = await open(dbName);
  return new Promise((res, rej) => {
    const r = db.transaction(KV_STORE).objectStore(KV_STORE).getAll();
    r.onsuccess = () =>
      res(Array.isArray(r.result) ? (r.result as Array<{ id: string; value: unknown }>) : []);
    r.onerror = () => rej(r.error);
  });
}

export async function hasLegacyIndexedDbData(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const [files, kvs] = await Promise.all([listAllFiles(LEGACY_DB), listAllKv(LEGACY_DB)]);
    return files.length > 0 || kvs.length > 0;
  } catch {
    return false;
  }
}

export async function readLegacyIndexedDbSnapshot(): Promise<{
  files: Stored[];
  kv: Array<{ id: string; value: unknown }>;
}> {
  if (typeof indexedDB === "undefined") return { files: [], kv: [] };
  const [files, kv] = await Promise.all([
    listAllFiles(LEGACY_DB).catch(() => []),
    listAllKv(LEGACY_DB).catch(() => []),
  ]);
  return { files, kv };
}

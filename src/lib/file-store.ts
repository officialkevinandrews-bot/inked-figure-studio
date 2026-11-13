/** Keeps uploaded model, clothing, and chapter assets in the browser (IndexedDB) so projects survive reloads. */
const DB = "koma-files";
const STORE = "files";
const KV_STORE = "kv";

export interface Stored {
  id: string;
  name: string;
  blob: Blob;
  slot?: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) {
        r.result.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!r.result.objectStoreNames.contains(KV_STORE)) {
        r.result.createObjectStore(KV_STORE, { keyPath: "id" });
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function putFile(id: string, file: Blob, name: string, slot?: string) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id, name, blob: file, slot } satisfies Stored);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getFile(id: string): Promise<Stored | null> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(id);
    r.onsuccess = () => res((r.result as Stored) ?? null);
    r.onerror = () => rej(r.error);
  });
}

export async function putKv<T>(id: string, value: T): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(KV_STORE, "readwrite");
    tx.objectStore(KV_STORE).put({ id, value });
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getKv<T>(id: string): Promise<T | null> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction(KV_STORE).objectStore(KV_STORE).get(id);
    r.onsuccess = () => {
      const row = r.result as { id: string; value: T } | undefined;
      res(row ? row.value : null);
    };
    r.onerror = () => rej(r.error);
  });
}

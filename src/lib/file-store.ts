/** Keeps uploaded model / clothing files in the browser (IndexedDB) so characters survive reloads. */
const DB = "koma-files", STORE = "files";
interface Stored { id: string; name: string; blob: Blob; slot?: string }

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function putFile(id: string, file: Blob, name: string, slot?: string) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id, name, blob: file, slot } satisfies Stored);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}
export async function getFile(id: string): Promise<Stored | null> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(id);
    r.onsuccess = () => res((r.result as Stored) ?? null); r.onerror = () => rej(r.error);
  });
}

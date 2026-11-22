/**
 * Account-scoped local persistence wrapper so every signed-in Google user gets
 * completely isolated localStorage & IndexedDB namespaces while keeping sync notifications instant.
 */

export type StorageChangeDomain = "workspace" | "library" | "file";

export interface StorageChangeEvent {
  uid: string;
  domain: StorageChangeDomain;
  key?: string;
  fileId?: string;
}

type StorageChangeListener = (event: StorageChangeEvent) => void;

export const LEGACY_EXACT_KEYS = [
  "koma-characters",
  "koma-characters-2d",
  "koma-base-models",
  "koma-base-models-2d",
  "koma-heads-2d",
  "koma-parts-2d",
  "koma-face-packs",
  "inked_figure_studio_custom_poses_v1",
  "koma-custom-props-v1",
  "koma-custom-templates",
  "inked_manga_roster_v1",
  "koma-panel-overlap-pref",
  "koma-chapter-v1",
  "koma-library-v1",
] as const;

export const LEGACY_PREFIX_KEYS = ["koma-face:", "koma-face-calib:", "koma-outfit:"] as const;

const USER_PREFIX = "koma:u:";
const DEVICE_ID_KEY = "koma-device-id-v1";

let activeUid: string | null = null;
let applyingRemote = false;
const listeners = new Set<StorageChangeListener>();

export function setActiveStorageUser(uid: string | null): void {
  activeUid = uid ? uid.trim() : null;
}

export function getActiveStorageUser(): string | null {
  return activeUid;
}

/** Suppresses change emissions while applying data downloaded from Firestore. */
export function setApplyingRemoteSync(applying: boolean): void {
  applyingRemote = applying;
}

export function isApplyingRemoteSync(): boolean {
  return applyingRemote;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `dev-${crypto.randomUUID()}`
        : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return "dev-ephemeral";
  }
}

export function scopeStorageKey(key: string, uid: string | null = activeUid): string {
  return uid ? `${USER_PREFIX}${uid}:${key}` : key;
}

export function subscribeUserStorageChanges(listener: StorageChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitStorageChange(
  domain: StorageChangeDomain,
  detail: { key?: string; fileId?: string } = {},
): void {
  if (!activeUid || applyingRemote) return;
  const event: StorageChangeEvent = { uid: activeUid, domain, ...detail };
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* ignore listener failure */
    }
  }
}

export function userLsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(scopeStorageKey(key));
  } catch {
    return null;
  }
}

export function userLsSet(
  key: string,
  value: string,
  domain: StorageChangeDomain = "workspace",
): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(scopeStorageKey(key), value);
    emitStorageChange(domain, { key });
    return true;
  } catch {
    return false;
  }
}

export function userLsRemove(
  key: string,
  domain: StorageChangeDomain = "workspace",
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(scopeStorageKey(key));
    emitStorageChange(domain, { key });
  } catch {
    /* ignore */
  }
}

/** Lists all unscoped logical keys matching a given prefix for the active user (or legacy scope when uid is null). */
export function listUserKeysWithPrefix(
  prefix: string,
  uid: string | null = activeUid,
): Array<{ logicalKey: string; value: string }> {
  if (typeof window === "undefined") return [];
  const results: Array<{ logicalKey: string; value: string }> = [];
  const scopePrefix = uid ? `${USER_PREFIX}${uid}:` : "";
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const rawKey = window.localStorage.key(i);
      if (!rawKey) continue;
      if (uid) {
        if (!rawKey.startsWith(scopePrefix)) continue;
        const logicalKey = rawKey.slice(scopePrefix.length);
        if (!logicalKey.startsWith(prefix)) continue;
        const value = window.localStorage.getItem(rawKey);
        if (value !== null) results.push({ logicalKey, value });
      } else {
        if (rawKey.startsWith(USER_PREFIX)) continue;
        if (!rawKey.startsWith(prefix)) continue;
        const value = window.localStorage.getItem(rawKey);
        if (value !== null) results.push({ logicalKey: rawKey, value });
      }
    }
  } catch {
    /* ignore */
  }
  return results;
}

/** Collects all unscoped legacy localStorage entries created before Google Sign-In was enabled. */
export function readLegacyLocalStorageEntries(): Array<{ key: string; value: string }> {
  if (typeof window === "undefined") return [];
  const found: Array<{ key: string; value: string }> = [];
  try {
    for (const key of LEGACY_EXACT_KEYS) {
      const val = window.localStorage.getItem(key);
      if (val !== null) found.push({ key, value: val });
    }
    for (const prefix of LEGACY_PREFIX_KEYS) {
      const matches = listUserKeysWithPrefix(prefix, null);
      for (const m of matches) {
        found.push({ key: m.logicalKey, value: m.value });
      }
    }
  } catch {
    /* ignore */
  }
  return found;
}

const LEGACY_PROMPT_CHOICE_KEY = "__legacy_prompt_choice_v1";

export type LegacyPromptChoice = "imported" | "declined";

export function getLegacyPromptChoice(uid: string): LegacyPromptChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const explicit = window.localStorage.getItem(`${USER_PREFIX}${uid}:${LEGACY_PROMPT_CHOICE_KEY}`);
    if (explicit === "imported" || explicit === "declined") return explicit;
    const migrated = window.localStorage.getItem(`${USER_PREFIX}${uid}:__legacy_migrated`);
    return migrated ? "imported" : null;
  } catch {
    return null;
  }
}

export function setLegacyPromptChoice(uid: string, choice: LegacyPromptChoice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${USER_PREFIX}${uid}:${LEGACY_PROMPT_CHOICE_KEY}`, choice);
    if (choice === "imported") {
      window.localStorage.setItem(`${USER_PREFIX}${uid}:__legacy_migrated`, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

export function hasUnmigratedLegacyData(uid: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (getLegacyPromptChoice(uid) !== null) return false;
    return readLegacyLocalStorageEntries().length > 0;
  } catch {
    return false;
  }
}

export function markLegacyMigrated(uid: string): void {
  setLegacyPromptChoice(uid, "imported");
}

import { beforeEach, describe, expect, it } from "vitest";
import {
  CORE_ALLOWED_EMAILS,
  isCoreAllowedEmail,
  normalizeAllowlistEmails,
  verifyUserAllowlistAccess,
} from "./allowlist";
import { loadCharacters, saveCharacters, newCharacter } from "./characters";
import { loadBaseModels, saveBaseModels } from "./base-models";
import { stripUndefined } from "./cloud-sync";
import { isFirebaseConfigured } from "./firebase-config";
import {
  hasUnmigratedLegacyData,
  listUserKeysWithPrefix,
  markLegacyMigrated,
  readLegacyLocalStorageEntries,
  setActiveStorageUser,
  setApplyingRemoteSync,
  subscribeUserStorageChanges,
  userLsGet,
  userLsSet,
  type StorageChangeEvent,
} from "./user-storage";

describe("per-user account storage & sync helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveStorageUser(null);
    setApplyingRemoteSync(false);
  });

  it("isolates characters and base models strictly by signed-in Google UID", () => {
    setActiveStorageUser("google-user-1");
    saveCharacters([newCharacter("Hero Alpha")]);
    saveBaseModels([
      {
        id: "bm-1",
        key: "file:body-1",
        name: "Alpha Body",
        ext: "glb",
        boneCount: 52,
        hasFullHands: true,
        addedAt: 1000,
      },
    ]);

    expect(loadCharacters()).toHaveLength(1);
    expect(loadBaseModels()).toHaveLength(1);

    setActiveStorageUser("google-user-2");
    expect(loadCharacters()).toEqual([]);
    expect(loadBaseModels()).toEqual([]);

    saveCharacters([newCharacter("Hero Beta")]);
    expect(loadCharacters()[0]?.name).toBe("Hero Beta");

    setActiveStorageUser("google-user-1");
    expect(loadCharacters()[0]?.name).toBe("Hero Alpha");
  });

  it("emits sync events for user writes and suppresses echoes during remote pull", () => {
    setActiveStorageUser("uid-sync");
    const events: StorageChangeEvent[] = [];
    const unsub = subscribeUserStorageChanges((e) => events.push(e));

    userLsSet("koma-face:Hero", JSON.stringify({ eyeStyle: "sharp" }), "workspace");
    expect(events).toEqual([{ uid: "uid-sync", domain: "workspace", key: "koma-face:Hero" }]);

    setApplyingRemoteSync(true);
    userLsSet("koma-outfit:Hero", JSON.stringify({}), "workspace");
    setApplyingRemoteSync(false);

    expect(events).toHaveLength(1);
    expect(listUserKeysWithPrefix("koma-face:", "uid-sync")).toHaveLength(1);
    unsub();
  });

  it("detects legacy localStorage work for first-login migration cleanly", () => {
    localStorage.setItem("koma-characters", JSON.stringify([newCharacter("Legacy Hero")]));
    localStorage.setItem("koma-face:Legacy Hero", JSON.stringify({ eyeStyle: "round" }));

    expect(hasUnmigratedLegacyData("uid-new")).toBe(true);
    const legacy = readLegacyLocalStorageEntries();
    expect(legacy.map((x) => x.key)).toContain("koma-characters");
    expect(legacy.map((x) => x.key)).toContain("koma-face:Legacy Hero");

    markLegacyMigrated("uid-new");
    expect(hasUnmigratedLegacyData("uid-new")).toBe(false);
    setActiveStorageUser("uid-new");
    expect(userLsGet("koma-characters")).toBeNull();
  });

  it("strips nested undefined fields before writing Firestore documents", () => {
    const cleaned = stripUndefined({
      id: "proj-1",
      optional: undefined,
      nested: { a: 1, b: undefined, list: [1, { x: "ok", y: undefined }] },
    });

    expect(cleaned).toEqual({
      id: "proj-1",
      nested: { a: 1, list: [1, { x: "ok" }] },
    });
    expect("optional" in cleaned).toBe(false);
  });

  it("validates required Firebase Web SDK configuration fields", () => {
    expect(
      isFirebaseConfigured({
        apiKey: "",
        authDomain: "app.firebaseapp.com",
        projectId: "proj",
        storageBucket: "",
        messagingSenderId: "",
        appId: "1:123:web:abc",
      }),
    ).toBe(false);
    expect(
      isFirebaseConfigured({
        apiKey: "AIza-public",
        authDomain: "app.firebaseapp.com",
        projectId: "proj",
        storageBucket: "proj.firebasestorage.app",
        messagingSenderId: "123",
        appId: "1:123:web:abc",
      }),
    ).toBe(true);
  });

  it("enforces core allowlisted emails and prevents removing owners", async () => {
    expect(isCoreAllowedEmail("  OfficialKevinAndrews@gmail.com ")).toBe(true);
    expect(isCoreAllowedEmail("careerdrivenkevin@gmail.com")).toBe(true);
    expect(isCoreAllowedEmail("CraigRees@Hotmail.com")).toBe(true);
    expect(isCoreAllowedEmail("stranger@example.com")).toBe(false);

    const normalized = normalizeAllowlistEmails([
      "Friend@Example.COM",
      "bad-email",
      "officialkevinandrews@gmail.com",
    ]);
    for (const core of CORE_ALLOWED_EMAILS) {
      expect(normalized).toContain(core);
    }
    expect(normalized).toContain("friend@example.com");
    expect(normalized).not.toContain("bad-email");

    const denied = await verifyUserAllowlistAccess("stranger@example.com");
    expect(denied.allowed).toBe(false);
    const allowed = await verifyUserAllowlistAccess("craigrees@hotmail.com");
    expect(allowed.allowed).toBe(true);
  });
});

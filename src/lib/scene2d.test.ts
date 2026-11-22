import { beforeEach, describe, expect, it } from "vitest";
import {
  BUILTIN_SCENE_OBJECTS,
  SCENE2D_H,
  SCENE2D_W,
  SCENE_BACKDROPS,
  SCENE_OBJECT_CATEGORIES,
  STARTER_SCENE_TEMPLATES,
  createScene2DFromTemplate,
} from "./scene2d-types";
import {
  SCENES_2D_STORAGE_KEY,
  SCENE_OBJECTS_2D_STORAGE_KEY,
  ensureScenes2DInitialized,
  loadScenes2D,
  removeScene2D,
  saveCustomSceneObjects2D,
  upsertScene2D,
} from "./scene2d-store";
import { LEGACY_EXACT_KEYS, setActiveStorageUser } from "./user-storage";

describe("2D Scene & Background Builder data model & store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActiveStorageUser("test-uid-scenes");
  });

  it("provides 12 backdrops, 60+ categorized objects across 7 categories, and starter furnished rooms", () => {
    expect(SCENE2D_W).toBe(1280);
    expect(SCENE2D_H).toBe(800);
    expect(SCENE_BACKDROPS.length).toBeGreaterThanOrEqual(12);
    expect(BUILTIN_SCENE_OBJECTS.length).toBeGreaterThanOrEqual(60);

    for (const cat of SCENE_OBJECT_CATEGORIES) {
      expect(BUILTIN_SCENE_OBJECTS.some((o) => o.category === cat.id)).toBe(true);
    }

    expect(STARTER_SCENE_TEMPLATES.length).toBeGreaterThanOrEqual(7);
    const bedroom = createScene2DFromTemplate("cozy-bedroom");
    expect(bedroom.backdropId).toBe("bedroom");
    expect(bedroom.objects.length).toBeGreaterThanOrEqual(8);
    expect(bedroom.renderMode).toBe("color");
  });

  it("persists 2D scenes and custom scene objects per user and registers sync keys", () => {
    expect(LEGACY_EXACT_KEYS).toContain(SCENES_2D_STORAGE_KEY);
    expect(LEGACY_EXACT_KEYS).toContain(SCENE_OBJECTS_2D_STORAGE_KEY);

    const seeded = ensureScenes2DInitialized();
    expect(seeded).toHaveLength(1);
    const first = seeded[0]!;

    const switched = upsertScene2D(seeded, {
      ...first,
      renderMode: "manga",
      lighting: "night",
    });
    expect(loadScenes2D()[0]?.renderMode).toBe("manga");
    expect(loadScenes2D()[0]?.lighting).toBe("night");

    const street = createScene2DFromTemplate("downtown-street", "Street Chase");
    const two = upsertScene2D(switched, street);
    expect(two).toHaveLength(2);
    expect(removeScene2D(two, first.id)).toHaveLength(1);

    saveCustomSceneObjects2D([]);
  });
});

import { describe, expect, it } from "vitest";
import { addOutfit, deleteOutfit, newCharacter, renameOutfit, updateActiveOutfit, activeOutfitOf, upsertCharacter, customItemIds, DUMMY_MODEL } from "./characters";

describe("characters", () => {
  it("new characters use the test dummy and start with Outfit 1", () => {
    const c = newCharacter("Kenji");
    expect(c.model).toBe(DUMMY_MODEL);
    expect(c.outfits.map((o) => o.name)).toEqual(["Outfit 1"]);
  });
  it("adds numbered outfits and makes the new one active", () => {
    let c = newCharacter();
    c = addOutfit(c);
    expect(c.outfits.map((o) => o.name)).toEqual(["Outfit 1", "Outfit 2"]);
    expect(activeOutfitOf(c).name).toBe("Outfit 2");
  });
  it("outfits keep their own clothes", () => {
    let c = newCharacter();
    c = updateActiveOutfit(c, { outfit: { hair: { itemId: "hair-bob", colors: { p: "#000000", s: "#000000" }, fit: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, inflate: 1 } } } });
    const first = c.activeOutfit;
    c = addOutfit(c);
    expect(activeOutfitOf(c).outfit).toEqual({});
    expect(c.outfits.find((o) => o.id === first)!.outfit.hair?.itemId).toBe("hair-bob");
    const dup = addOutfit({ ...c, activeOutfit: first }, first);
    expect(activeOutfitOf(dup).outfit.hair?.itemId).toBe("hair-bob");
  });
  it("never deletes the last outfit", () => {
    const c = newCharacter();
    expect(deleteOutfit(c, c.outfits[0].id).outfits).toHaveLength(1);
    const two = addOutfit(c);
    const after = deleteOutfit(two, two.activeOutfit);
    expect(after.outfits).toHaveLength(1);
    expect(after.activeOutfit).toBe(after.outfits[0].id);
  });
  it("renames outfits, ignoring blank names", () => {
    const c = newCharacter();
    const id = c.outfits[0].id;
    expect(renameOutfit(c, id, "School").outfits[0].name).toBe("School");
    expect(renameOutfit(c, id, "  ").outfits[0].name).toBe("Outfit 1");
  });
  it("upsert replaces by id", () => {
    const c = newCharacter("A");
    const list = upsertCharacter(upsertCharacter([], c), { ...c, name: "B" });
    expect(list).toHaveLength(1); expect(list[0].name).toBe("B");
  });
  it("lists custom clothing files used", () => {
    const c = updateActiveOutfit(newCharacter(), { outfit: { top: { itemId: "custom:abc", colors: { p: "#fff", s: "#fff" }, fit: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, inflate: 1 } } } });
    expect(customItemIds(c)).toEqual(["custom:abc"]);
  });
});

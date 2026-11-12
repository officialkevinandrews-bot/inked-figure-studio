import { describe, expect, it, beforeEach } from "vitest";
import {
  SLOTS, WARDROBE, OUTFIT_PRESETS, itemsForSlot, equip, unequip, setSlotColor, setSlotFit,
  applyPreset, loadOutfit, saveOutfit, serializeOutfit, itemById, HEX_RE,
} from "./wardrobe";
import { CANONICAL_BONES } from "./rig";

describe("wardrobe catalog", () => {
  it("has the 10 slots: hair, hats, eyewear, tops, bottoms, shoes, neck, back, waist, hands", () => {
    expect(SLOTS.map((s) => s.id)).toEqual(["hair", "headwear", "eyewear", "top", "bottom", "shoes", "neck", "back", "waist", "hands"]);
  });
  it("gives every slot at least 3 placeholder items", () => {
    for (const s of SLOTS) expect(itemsForSlot(s.id).length).toBeGreaterThanOrEqual(3);
  });
  it("uses unique ids, valid hex colours and real Mixamo bones", () => {
    expect(new Set(WARDROBE.map((i) => i.id)).size).toBe(WARDROBE.length);
    for (const i of WARDROBE) {
      expect(i.colors.p).toMatch(HEX_RE); expect(i.colors.s).toMatch(HEX_RE);
      for (const p of i.pieces) {
        const bones = p.k === "seg" ? [p.from, p.to] : [p.bone];
        for (const b of bones) expect(CANONICAL_BONES).toContain(b);
      }
    }
  });
  it("mirrors paired pieces onto the right side", () => {
    const sneakers = itemById("shoe-sneakers")!;
    const bones = sneakers.pieces.map((p) => (p.k === "shape" ? p.bone : p.from));
    expect(bones).toContain("LeftFoot"); expect(bones).toContain("RightFoot");
  });
});

describe("equipping", () => {
  it("equips with the item's default colours and changes one colour channel at a time", () => {
    let o = equip({}, "hair", "hair-spiky");
    expect(o.hair?.colors.p).toBe("#141414");
    o = setSlotColor(o, "hair", "p", "#e8c25a");
    expect(o.hair?.colors.p).toBe("#e8c25a");
    expect(o.hair?.colors.s).toBe("#141414");
  });
  it("keeps fit when re-equipping the same item but resets it for a new item", () => {
    let o = setSlotFit(equip({}, "top", "top-tshirt"), "top", { inflate: 1.3 });
    expect(equip(o, "top", "top-tshirt").top?.fit.inflate).toBe(1.3);
    expect(equip(o, "top", "top-coat").top?.fit.inflate).toBe(1);
    o = unequip(o, "top");
    expect(o.top).toBeUndefined();
  });
  it("applies outfit presets with their colour overrides", () => {
    const hero = applyPreset(OUTFIT_PRESETS.find((p) => p.name === "Hero")!);
    expect(hero.hair?.colors.p).toBe("#e8c25a");
    expect(hero.back?.itemId).toBe("back-cape");
  });
});

describe("saving", () => {
  beforeEach(() => localStorage.clear());
  it("saves built-in items per model and drops imported files", () => {
    let o = equip({}, "hair", "hair-bob");
    o = equip(o, "hats" as never, "x");
    o = { ...o, top: { itemId: "custom:abc", colors: { p: "#ffffff", s: "#ffffff" }, fit: o.hair!.fit } };
    expect(Object.keys(serializeOutfit(o))).toEqual(["hair"]);
    saveOutfit("Bot", o);
    expect(loadOutfit("Bot").hair?.itemId).toBe("hair-bob");
    expect(loadOutfit("Other")).toEqual({});
  });
});

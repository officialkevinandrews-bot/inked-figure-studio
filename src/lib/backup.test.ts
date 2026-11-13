import { describe, it, expect } from "vitest";
import { mergeById, parseBackup, referencedFileIds } from "./backup";
import { newCharacter } from "./characters";
import { sanitizeAiPose } from "./ai-pose";

describe("backup", () => {
  it("includes uploaded bodies and custom clothes, not the dummy", () => {
    const a = newCharacter("A"); const b = { ...newCharacter("B"), model: "file:body1" };
    b.outfits[0].outfit = { top: { itemId: "custom:shirt", color: "#fff" } } as never;
    expect(referencedFileIds([a, b]).sort()).toEqual(["custom:shirt", "file:body1"]);
  });
  it("imported characters replace same id and keep others", () => {
    expect(mergeById([{ id: "1", n: "old" }, { id: "2", n: "x" }], [{ id: "1", n: "new" }])).toEqual([{ id: "1", n: "new" }, { id: "2", n: "x" }]);
  });
  it("rejects non-backup files", () => { expect(() => parseBackup('{"a":1}')).toThrow(); });
});
describe("ai pose", () => {
  it("drops unknown bones and clamps angles", () => {
    const r = sanitizeAiPose({ bones: { LeftArm: [0, 0, -400], Tail: [1, 2, 3], Head: [1, 2] }, hipsDrop: 9 });
    expect(r.bones).toEqual({ LeftArm: [0, 0, -180] }); expect(r.hipsDrop).toBe(1.2);
  });
});

import { describe, it, expect } from "vitest";
import { DEFAULT_FACE, EXPRESSIONS, applyExpression, resolveFace, setPartOverride, toggleFx, variantCount } from "./face-library";

describe("face expressions", () => {
  it("applying a preset sets all parts and its manga FX", () => {
    const f = resolveFace(applyExpression(DEFAULT_FACE, "Angry"));
    expect([f.eye, f.brow, f.mouth]).toEqual(["glare", "angry", "gritted"]);
    expect(f.fx).toEqual(["anger"]);
  });
  it("mix and match overrides one part while keeping the rest of the preset", () => {
    const f = resolveFace(setPartOverride(applyExpression(DEFAULT_FACE, "Happy"), "mouth", "gasp"));
    expect(f.mouth).toBe("gasp");
    expect(f.brow).toBe("raised");
  });
  it("choosing a new preset clears overrides", () => {
    const c = applyExpression(setPartOverride(DEFAULT_FACE, "eye", "blank"), "Neutral");
    expect(resolveFace(c).eye).toBe("open");
  });
  it("FX can be toggled on and off", () => {
    const on = toggleFx(DEFAULT_FACE, "blush");
    expect(on.fx).toContain("blush");
    expect(toggleFx(on, "blush").fx).not.toContain("blush");
  });
  it("ships 12 expressions and a variant for every style/state", () => {
    expect(Object.keys(EXPRESSIONS)).toHaveLength(12);
    expect(variantCount()).toEqual({ eyes: 36, brows: 24, mouths: 36 });
  });
});

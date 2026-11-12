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

import { DEFAULT_FACE as DF, resolveFace as rf, loadFace as lf, saveFace as sf } from "./face-library";
describe("face colours", () => {
  it("defaults to dark eyes and keeps a custom eye colour through save/load", () => {
    expect(rf(DF).colors.eyes).toBe("#2a2a2a");
    localStorage.clear();
    sf("M", { ...DF, colors: { ...DF.colors, eyes: "#2f6fd6" } });
    expect(rf(lf("M")).colors.eyes).toBe("#2f6fd6");
    expect(rf(lf("M")).colors.mouth).toBe("#c9636b");
  });
});

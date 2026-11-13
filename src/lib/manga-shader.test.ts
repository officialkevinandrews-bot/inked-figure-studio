import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createMangaToonMaterial, ensureCreaseAttribute, updateMangaUniforms } from "./manga-shader";

describe("Manga Muscle Crease Shader & Skin Tinting", () => {
  it("computes seam-welded crease values on concave folds while keeping flat faces clean", () => {
    // High-res undulating grid with a crisp central concave furrow along x = 0.
    const geo = new THREE.PlaneGeometry(2, 2, 24, 24);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      // Carve a smooth V-shaped muscle groove down the center (z dips inward near x=0)
      const groove = -0.14 * Math.exp(-(x * x) / 0.025);
      pos.setZ(i, groove);
    }
    pos.needsUpdate = true;

    const crease = ensureCreaseAttribute(geo);
    expect(crease.length).toBe(pos.count * 2);
    expect(geo.getAttribute("aCrease")).toBeDefined();

    // Compare crease strength inside the central trough vs far flat wing
    let centerSum = 0;
    let centerCount = 0;
    let flatSum = 0;
    let flatCount = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = Math.abs(pos.getX(i));
      const y = Math.abs(pos.getY(i));
      if (y > 0.85) continue; // skip mesh boundary edge
      const v = crease[i * 2];
      if (x < 0.06) {
        centerSum += v;
        centerCount++;
      } else if (x > 0.65 && x < 0.88) {
        flatSum += v;
        flatCount++;
      }
    }

    const centerMean = centerSum / centerCount;
    const flatMean = flatSum / flatCount;
    expect(centerMean).toBeGreaterThan(0.35);
    expect(flatMean).toBeLessThan(0.08);
    expect(centerMean).toBeGreaterThan(flatMean * 5);

    // Calling again hits the cache cleanly
    const cached = ensureCreaseAttribute(geo);
    expect(cached).toBe(crease);
  });

  it("wires uniforms and updates muscleLines and inkColor dynamically without rebuilding materials", () => {
    const grad = new THREE.DataTexture(new Uint8Array([80, 80, 80, 255, 255, 255, 255, 255]), 2, 1, THREE.RGBAFormat);
    const mat = createMangaToonMaterial({
      gradientMap: grad,
      color: new THREE.Color("#ffffff"),
      map: null,
      hasSkinTint: true,
      skinColor: "#dfa57d",
      muscleLines: 4.5,
      inkColor: "#0d0d0d",
    });

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    const root = new THREE.Group();
    root.add(mesh);

    const uniforms = mat.userData["mangaUniforms"] as {
      uMuscleLines: { value: number };
      uInkColor: { value: THREE.Color };
      uHasSkinTint: { value: number };
      uSkinColor: { value: THREE.Color };
    };
    expect(uniforms.uMuscleLines.value).toBe(4.5);
    expect(uniforms.uHasSkinTint.value).toBe(1);
    expect(uniforms.uSkinColor.value.getHexString()).toBe("dfa57d");

    updateMangaUniforms(root, 7.0, "#1e3a8a");
    expect(uniforms.uMuscleLines.value).toBe(7.0);
    expect(uniforms.uInkColor.value.getHexString()).toBe("1e3a8a");
  });
});


import * as THREE from "three";

export interface MangaUniformSet {
  uMuscleLines: { value: number };
  uInkColor: { value: THREE.Color };
  uHasSkinTint: { value: number };
  uSkinColor: { value: THREE.Color };
  uShadowHatch: { value: number };
}

export interface MangaMaterialOptions {
  gradientMap: THREE.DataTexture;
  color: THREE.Color;
  map: THREE.Texture | null;
  transparent?: boolean;
  alphaTest?: number;
  side?: THREE.Side;
  hasSkinTint?: boolean;
  skinColor?: string;
  muscleLines?: number;
  inkColor?: string;
  shadowHatch?: boolean;
}

const QUANT = 10000;

function smoothMeshField(
  x: Float32Array,
  y: Float32Array,
  z: Float32Array,
  neighbors: number[][],
  passes: number,
  weight: number,
): [Float32Array, Float32Array, Float32Array] {
  const N = x.length;
  let cx = new Float32Array(x);
  let cy = new Float32Array(y);
  let cz = new Float32Array(z);
  const keep = 1 - weight;

  for (let p = 0; p < passes; p++) {
    const nx = new Float32Array(N);
    const ny = new Float32Array(N);
    const nz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const nb = neighbors[i];
      if (!nb.length) {
        nx[i] = cx[i];
        ny[i] = cy[i];
        nz[i] = cz[i];
        continue;
      }
      let ax = 0, ay = 0, az = 0;
      for (let k = 0; k < nb.length; k++) {
        const j = nb[k];
        ax += cx[j];
        ay += cy[j];
        az += cz[j];
      }
      const inv = weight / nb.length;
      nx[i] = keep * cx[i] + ax * inv;
      ny[i] = keep * cy[i] + ay * inv;
      nz[i] = keep * cz[i] + az * inv;
    }
    cx = nx;
    cy = ny;
    cz = nz;
  }
  return [cx, cy, cz];
}

/**
 * Computes seam-welded, denoised Difference-of-Surfaces anatomical concavity and ridge curvature
 * across any mesh geometry (`SkinnedMesh` or `Mesh`) into vertex attribute `aCrease` (`vec2`:
 * x = clean muscle groove depth, y = convex muscle ridge / sharp dihedral fold).
 */
export function ensureCreaseAttribute(geometry: THREE.BufferGeometry): Float32Array {
  const existing = geometry.getAttribute("aCrease") as THREE.BufferAttribute | undefined;
  if (geometry.userData["aCreaseComputed"] && existing) {
    return existing.array as Float32Array;
  }

  const pos = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos || pos.count < 3) {
    const empty = new Float32Array((pos?.count ?? 0) * 2);
    if (pos) geometry.setAttribute("aCrease", new THREE.BufferAttribute(empty, 2));
    geometry.userData["aCreaseComputed"] = true;
    return empty;
  }

  const idx = geometry.getIndex();
  const triCount = Math.floor((idx ? idx.count : pos.count) / 3);
  if (triCount < 8) {
    const flat = new Float32Array(pos.count * 2);
    geometry.setAttribute("aCrease", new THREE.BufferAttribute(flat, 2));
    geometry.userData["aCreaseComputed"] = true;
    return flat;
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const invStep = QUANT / diag;

  // 1. Weld coincident spatial vertices across UV & shading splits.
  const map = new Map<string, number>();
  const vertToCanon = new Int32Array(pos.count);
  let N = 0;
  for (let i = 0; i < pos.count; i++) {
    const qx = Math.round(pos.getX(i) * invStep);
    const qy = Math.round(pos.getY(i) * invStep);
    const qz = Math.round(pos.getZ(i) * invStep);
    const key = `${qx}_${qy}_${qz}`;
    let cid = map.get(key);
    if (cid === undefined) {
      cid = N++;
      map.set(key, cid);
    }
    vertToCanon[i] = cid;
  }

  const px = new Float32Array(N);
  const py = new Float32Array(N);
  const pz = new Float32Array(N);
  const nx = new Float32Array(N);
  const ny = new Float32Array(N);
  const nz = new Float32Array(N);
  const sharp = new Float32Array(N);
  const neighbors: number[][] = Array.from({ length: N }, () => []);
  const neighborSets: Set<number>[] = Array.from({ length: N }, () => new Set<number>());

  const edgeFaceNormals = new Map<string, [number, number, number]>();
  const getCorner = (k: number) => (idx ? idx.getX(k) : k);

  for (let t = 0; t < triCount; t++) {
    const i0 = getCorner(t * 3);
    const i1 = getCorner(t * 3 + 1);
    const i2 = getCorner(t * 3 + 2);
    const a = vertToCanon[i0];
    const b = vertToCanon[i1];
    const c = vertToCanon[i2];
    if (a === b || b === c || c === a) continue;

    px[a] = pos.getX(i0); py[a] = pos.getY(i0); pz[a] = pos.getZ(i0);
    px[b] = pos.getX(i1); py[b] = pos.getY(i1); pz[b] = pos.getZ(i1);
    px[c] = pos.getX(i2); py[c] = pos.getY(i2); pz[c] = pos.getZ(i2);

    const ex1 = px[b] - px[a], ey1 = py[b] - py[a], ez1 = pz[b] - pz[a];
    const ex2 = px[c] - px[a], ey2 = py[c] - py[a], ez2 = pz[c] - pz[a];
    const fnx = ey1 * ez2 - ez1 * ey2;
    const fny = ez1 * ex2 - ex1 * ez2;
    const fnz = ex1 * ey2 - ey1 * ex2;
    const fLen = Math.hypot(fnx, fny, fnz);
    if (fLen < 1e-12) continue;

    nx[a] += fnx; ny[a] += fny; nz[a] += fnz;
    nx[b] += fnx; ny[b] += fny; nz[b] += fnz;
    nx[c] += fnx; ny[c] += fny; nz[c] += fnz;

    const addEdge = (u: number, v: number) => {
      if (!neighborSets[u].has(v)) {
        neighborSets[u].add(v);
        neighbors[u].push(v);
      }
      if (!neighborSets[v].has(u)) {
        neighborSets[v].add(u);
        neighbors[v].push(u);
      }
      const ek = u < v ? `${u}_${v}` : `${v}_${u}`;
      const unx = fnx / fLen, uny = fny / fLen, unz = fnz / fLen;
      const prev = edgeFaceNormals.get(ek);
      if (!prev) {
        edgeFaceNormals.set(ek, [unx, uny, unz]);
      } else {
        const dot = Math.max(-1, Math.min(1, prev[0] * unx + prev[1] * uny + prev[2] * unz));
        // Sharp structural crease > ~34 degrees (ignores fine organic mesh tessellation steps)
        if (dot < 0.83) {
          const angle = Math.acos(dot);
          const creaseStrength = Math.min(1, Math.max(0, (angle - 0.59) / 1.05));
          if (creaseStrength > sharp[u]) sharp[u] = creaseStrength;
          if (creaseStrength > sharp[v]) sharp[v] = creaseStrength;
        }
      }
    };
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  // Compute global mean edge length so curvature sensitivity stays free of triangle-size jitter.
  let edgeSum = 0;
  let edgeCount = 0;
  for (let i = 0; i < N; i++) {
    const l = Math.hypot(nx[i], ny[i], nz[i]) || 1;
    nx[i] /= l;
    ny[i] /= l;
    nz[i] /= l;
    const nb = neighbors[i];
    for (let k = 0; k < nb.length; k++) {
      const j = nb[k];
      if (j > i) {
        edgeSum += Math.hypot(px[j] - px[i], py[j] - py[i], pz[j] - pz[i]);
        edgeCount++;
      }
    }
  }
  const meanEdge = Math.max(edgeSum / Math.max(1, edgeCount), diag * 1e-4);

  // 2. Band-pass Difference-of-Surfaces:
  //    fine = 2 passes (eliminates raw triangle triangulation noise / surface grain)
  //    macro = 5 further passes (smooth anatomical body envelope)
  const [fx, fy, fz] = smoothMeshField(px, py, pz, neighbors, 2, 0.6);
  const [mx, my, mz] = smoothMeshField(fx, fy, fz, neighbors, 5, 0.72);
  const [mnx, mny, mnz] = smoothMeshField(nx, ny, nz, neighbors, 4, 0.7);

  const rawValley = new Float32Array(N);
  const rawRidge = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const nb = neighbors[i];
    if (!nb.length) continue;

    const ml = Math.hypot(mnx[i], mny[i], mnz[i]) || 1;
    const snx = mnx[i] / ml, sny = mny[i] / ml, snz = mnz[i] / ml;

    // Signed valley depth: positive where denoised fine surface recesses inward beneath macro muscle envelope.
    const depth = (mx[i] - fx[i]) * snx + (my[i] - fy[i]) * sny + (mz[i] - fz[i]) * snz;
    const normDepth = depth / meanEdge;

    let nVar = 0;
    for (let k = 0; k < nb.length; k++) {
      const j = nb[k];
      const d = Math.max(-1, Math.min(1, nx[i] * nx[j] + ny[i] * ny[j] + nz[i] * nz[j]));
      nVar += 1 - d;
    }
    nVar /= nb.length;

    // Suppress tiny micro-ripples cleanly below noise floor while preserving true 1-3cm sculpted grooves.
    const pureGroove = Math.max(0, normDepth - 0.025);
    rawValley[i] = Math.max(pureGroove, sharp[i] * 0.25);

    // Convex ridge crest for view-grazing muscle contours (shoulder cap, bicep sweep, collarbone ridge, hair folds)
    const ridgeConv = Math.max(0, -normDepth - 0.09) * Math.sqrt(Math.max(0, nVar)) * 1.4;
    rawRidge[i] = Math.max(sharp[i] * 0.9, ridgeConv);
  }

  // Smooth the scalar valley attribute gently once to yield continuous stroke ribbons cleanly.
  const smoothValley = new Float32Array(N);
  const smoothRidge = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const nb = neighbors[i];
    if (!nb.length) {
      smoothValley[i] = rawValley[i];
      smoothRidge[i] = rawRidge[i];
      continue;
    }
    let accV = 0, accR = 0;
    for (let k = 0; k < nb.length; k++) {
      const j = nb[k];
      accV += rawValley[j];
      accR += rawRidge[j];
    }
    const invD = 1 / nb.length;
    smoothValley[i] = 0.65 * rawValley[i] + 0.35 * (accV * invD);
    smoothRidge[i] = 0.65 * rawRidge[i] + 0.35 * (accR * invD);
  }

  const sorted = Array.from(smoothValley).sort((a, b) => a - b);
  const p97 = sorted[Math.floor((sorted.length - 1) * 0.97)] ?? 0;
  const valleyScale = Math.max(p97, 0.26);

  const canonOut = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const vNorm = Math.min(1, Math.max(0, smoothValley[i] / valleyScale));
    canonOut[i * 2] = Math.pow(vNorm, 0.82);
    canonOut[i * 2 + 1] = Math.min(1, Math.max(0, smoothRidge[i] * 2.1));
  }

  const out = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const c = vertToCanon[i];
    out[i * 2] = canonOut[c * 2];
    out[i * 2 + 1] = canonOut[c * 2 + 1];
  }

  geometry.setAttribute("aCrease", new THREE.BufferAttribute(out, 2));
  geometry.userData["aCreaseComputed"] = true;
  return out;
}

/** Updates dynamic manga uniforms on every MeshToonMaterial under `root` in O(meshes) without recompiling. */
export function updateMangaUniforms(root: THREE.Object3D, muscleLines: number, inkColor?: string) {
  const ink = new THREE.Color(inkColor ?? "#0d0d0d");
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => {
      const uniforms = mat?.userData?.["mangaUniforms"] as MangaUniformSet | undefined;
      if (!uniforms) return;
      uniforms.uMuscleLines.value = muscleLines;
      uniforms.uInkColor.value.copy(ink);
    });
  });
}

/** Builds a MeshToonMaterial enhanced with skin hue re-mapping, 3D anatomical crease lines, and optional print hatching. */
export function createMangaToonMaterial(opts: MangaMaterialOptions): THREE.MeshToonMaterial {
  const toon = new THREE.MeshToonMaterial({
    color: opts.color,
    map: opts.map,
    gradientMap: opts.gradientMap,
    ...(opts.transparent !== undefined ? { transparent: opts.transparent } : {}),
    ...(opts.alphaTest !== undefined ? { alphaTest: opts.alphaTest } : {}),
    ...(opts.side !== undefined ? { side: opts.side } : {}),
  });

  const uniforms: MangaUniformSet = {
    uMuscleLines: { value: opts.muscleLines ?? 4.5 },
    uInkColor: { value: new THREE.Color(opts.inkColor ?? "#0d0d0d") },
    uHasSkinTint: { value: opts.hasSkinTint ? 1.0 : 0.0 },
    uSkinColor: { value: new THREE.Color(opts.skinColor ?? "#ffffff") },
    uShadowHatch: { value: opts.shadowHatch ? 1.0 : 0.0 },
  };
  toon.userData["mangaUniforms"] = uniforms;
  toon.customProgramCacheKey = () => "koma-manga-toon-v3";

  toon.onBeforeCompile = (shader) => {
    shader.uniforms["uMuscleLines"] = uniforms.uMuscleLines;
    shader.uniforms["uInkColor"] = uniforms.uInkColor;
    shader.uniforms["uHasSkinTint"] = uniforms.uHasSkinTint;
    shader.uniforms["uSkinColor"] = uniforms.uSkinColor;
    shader.uniforms["uShadowHatch"] = uniforms.uShadowHatch;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute vec2 aCrease;
        varying vec2 vCrease;
        varying vec3 vInkNormal;`,
      )
      .replace(
        "#include <defaultnormal_vertex>",
        `#include <defaultnormal_vertex>
        vInkNormal = normalize( transformedNormal );
        vCrease = aCrease;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uMuscleLines;
        uniform vec3 uInkColor;
        uniform float uHasSkinTint;
        uniform vec3 uSkinColor;
        uniform float uShadowHatch;
        varying vec2 vCrease;
        varying vec3 vInkNormal;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        if (uHasSkinTint > 0.5) {
          float texLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          // Replace baked base hue while keeping sculpted ambient texture subtle depth.
          float normLum = clamp(texLum / 0.66, 0.30, 1.06);
          diffuseColor.rgb = mix(diffuseColor.rgb, uSkinColor * mix(1.0, normLum, 0.68), 0.94);
        }`,
      )
      .replace(
        "#include <opaque_fragment>",
        `if (uMuscleLines > 0.01) {
          float strength = clamp(uMuscleLines / 8.0, 0.0, 1.0);
          float aa = max(fwidth(vCrease.x) * 1.15, 0.016);
          float primaryCut = mix(0.76, 0.22, strength);

          // Crisp G-pen line along anatomical muscle grooves; broad hollows outline along their walls cleanly.
          float grooveInk = smoothstep(primaryCut - aa, primaryCut + aa * 0.55, vCrease.x);

          // Grazing contour accents along prominent convex muscle crests & sharp stylized edges.
          vec3 viewDirInk = normalize(vViewPosition);
          vec3 normalInk = normalize(vInkNormal);
          float ndotv = clamp(abs(dot(normalInk, viewDirInk)), 0.0, 1.0);
          float ridgeCut = mix(0.78, 0.34, strength);
          float ridgeGate = smoothstep(ridgeCut - 0.08, ridgeCut + 0.10, vCrease.y);
          float graze = 1.0 - smoothstep(0.14, mix(0.24, 0.44, strength), ndotv);
          float ridgeInk = ridgeGate * graze * 0.90;

          float inkAlpha = clamp(max(grooveInk, ridgeInk) * mix(0.82, 0.98, strength), 0.0, 0.97);
          outgoingLight = mix(outgoingLight, uInkColor, inkAlpha);
        }
        #include <opaque_fragment>`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        if (uShadowHatch > 0.5) {
          float hatchLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
          if (hatchLum < 0.52) {
            float d1 = mod(gl_FragCoord.x + gl_FragCoord.y, 7.0);
            float d2 = mod(gl_FragCoord.x - gl_FragCoord.y + 700.0, 7.0);
            if (d1 < 2.2 || (hatchLum < 0.30 && d2 < 1.9)) {
              gl_FragColor.rgb *= 0.25;
            }
          }
        }`,
      );
  };

  return toon;
}

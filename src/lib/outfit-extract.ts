/**
 * "Clothing from outfit": splits a dressed, Mixamo-rigged character into wearable pieces.
 * 1) islands: disconnected mesh pieces (welded by position), 2) each island's skin weights say which
 * body region it hugs -> suggested outfit slot, 3) chosen islands become SkinnedMeshes that keep the
 * source skeleton's bind data, so the wardrobe rebinds them to any Mixamo character by bone name.
 */
import * as THREE from "three";
import { canonicalBoneName } from "./rig";
import type { SlotId } from "./wardrobe";

/** Rest-pose world position of a vertex (applies skinning, like Box3.setFromObject does). */
export function worldVertex(mesh: THREE.Mesh, i: number, out: THREE.Vector3) {
  if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) (mesh as THREE.SkinnedMesh).getVertexPosition(i, out);
  else out.fromBufferAttribute(mesh.geometry.getAttribute("position") as THREE.BufferAttribute, i);
  return out.applyMatrix4(mesh.matrixWorld);
}

/** Fills bone matrices so rest-pose vertex positions can be read before the model is ever rendered. */
export function prepSkin(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  root.traverse((o) => { const sm = o as THREE.SkinnedMesh; if (sm.isSkinnedMesh) sm.skeleton.update(); });
}

export type Region = "head" | "neck" | "torso" | "arms" | "hands" | "hips" | "legs" | "feet";
export type Target = SlotId | "body" | "skip";
export const REGIONS: Region[] = ["head", "neck", "torso", "arms", "hands", "hips", "legs", "feet"];

export function boneRegion(canon: string | null): Region | null {
  if (!canon) return null;
  if (canon === "Head") return "head";
  if (canon === "Neck") return "neck";
  if (canon.startsWith("Spine")) return "torso";
  if (canon === "Hips") return "hips";
  if (/Hand/.test(canon)) return "hands";
  if (/Shoulder|Arm/.test(canon)) return "arms";
  if (/UpLeg$|Leg$/.test(canon)) return "legs";
  if (/Foot|Toe/.test(canon)) return "feet";
  return null;
}

export interface IslandStats { tris: number; regions: Record<Region, number>; minY: number; maxY: number; modelMinY: number; modelHeight: number }

/** Suggests where an island belongs from the regions its skin weights point to. */
export function classifyIsland(s: IslandStats, isLargest: boolean): Target {
  const total = REGIONS.reduce((a, r) => a + s.regions[r], 0) || 1;
  const f = (r: Region) => s.regions[r] / total;
  const span = (s.maxY - s.minY) / (s.modelHeight || 1);
  if (span > 0.55 && f("head") > 0.03 && f("feet") > 0.02 && (isLargest || f("torso") > 0.05)) return "body";
  const top = f("torso") + f("arms") + f("neck") * 0.5;
  const legs = f("legs") + f("hips");
  const best = REGIONS.reduce((a, r) => (s.regions[r] > s.regions[a] ? r : a), "head" as Region);
  if (best === "head") {
    const rel = (s.minY - s.modelMinY) / (s.modelHeight || 1);
    return rel > 0.9 && span < 0.08 ? "headwear" : "hair";
  }
  if (best === "neck") return "neck";
  if (best === "hands") return "hands";
  if (best === "feet") return "shoes";
  if (best === "hips" && span < 0.12 && legs < 0.8) return "waist";
  if (top >= legs) return "top";
  return "bottom";
}

/** Union-find over triangles that share (welded) vertex positions. Returns island id per triangle. */
export function triangleIslands(geo: THREE.BufferGeometry, weldTol = 1e-4): { island: Int32Array; count: number } {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const index = geo.getIndex();
  const triCount = index ? index.count / 3 : pos.count / 3;
  const vid = new Int32Array(pos.count);
  const seen = new Map<string, number>(); const inv = 1 / weldTol;
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * inv)},${Math.round(pos.getY(i) * inv)},${Math.round(pos.getZ(i) * inv)}`;
    let v = seen.get(k); if (v === undefined) { v = seen.size; seen.set(k, v); } vid[i] = v;
  }
  const parent = new Int32Array(seen.size); for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]!]!; x = parent[x]!; } return x; };
  const vert = (t: number, c: number) => vid[index ? index.getX(t * 3 + c) : t * 3 + c]!;
  for (let t = 0; t < triCount; t++) {
    const a = find(vert(t, 0)), b = find(vert(t, 1)), c = find(vert(t, 2));
    parent[b] = a; parent[find(c)] = a;
  }
  const island = new Int32Array(triCount); const ids = new Map<number, number>();
  for (let t = 0; t < triCount; t++) { const r = find(vert(t, 0)); let id = ids.get(r); if (id === undefined) { id = ids.size; ids.set(r, id); } island[t] = id; }
  return { island, count: ids.size };
}

/** Spatial hash of the undressed base model's surface, used to recognise (and drop) body skin. */
export class BodyMatcher {
  private cells = new Map<string, number[]>(); private pts: number[] = [];
  constructor(base: THREE.Object3D, readonly tol: number) {
    prepSkin(base); const v = new THREE.Vector3();
    base.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const n = m.geometry.getAttribute("position").count;
      for (let i = 0; i < n; i++) { worldVertex(m, i, v); const id = this.pts.length / 3; this.pts.push(v.x, v.y, v.z); const k = this.key(v.x, v.y, v.z); const c = this.cells.get(k); if (c) c.push(id); else this.cells.set(k, [id]); }
    });
  }
  private key(x: number, y: number, z: number) { const t = this.tol; return `${Math.floor(x / t)},${Math.floor(y / t)},${Math.floor(z / t)}`; }
  near(v: THREE.Vector3) {
    const t = this.tol, cx = Math.floor(v.x / t), cy = Math.floor(v.y / t), cz = Math.floor(v.z / t), t2 = t * t;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const c = this.cells.get(`${cx + dx},${cy + dy},${cz + dz}`); if (!c) continue;
      for (const id of c) { const ex = this.pts[id * 3]! - v.x, ey = this.pts[id * 3 + 1]! - v.y, ez = this.pts[id * 3 + 2]! - v.z; if (ex * ex + ey * ey + ez * ez <= t2) return true; }
    }
    return false;
  }
}

export interface Island { id: string; mesh: THREE.Mesh; tris: number[]; stats: IslandStats; suggested: Target; label: string; colour: string }

const PALETTE = ["#e4572e", "#29335c", "#f3a712", "#669bbc", "#a8c686", "#7b2d26", "#2a9d8f", "#b56576", "#6d597a", "#e9c46a"];

/** Splits every mesh of a dressed character into islands (or, if it's all one piece, into body regions). */
export function analyseOutfit(root: THREE.Object3D, mode: "islands" | "regions" = "islands", base: THREE.Object3D | null = null): Island[] {
  prepSkin(root);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry?.getAttribute("position")) meshes.push(m); });
  const box = new THREE.Box3().setFromObject(root);
  const modelMinY = box.min.y, modelHeight = box.max.y - box.min.y || 1;
  const v = new THREE.Vector3();
  const matcher = base ? new BodyMatcher(base, modelHeight * 0.004) : null;
  const raw: (Omit<Island, "suggested" | "label" | "colour"> & { bodyFrac: number })[] = [];
  for (const mesh of meshes) {
    const geo = mesh.geometry; const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const index = geo.getIndex(); const triCount = index ? index.count / 3 : pos.count / 3;
    const sm = mesh as THREE.SkinnedMesh;
    const si = geo.getAttribute("skinIndex") as THREE.BufferAttribute | undefined, sw = geo.getAttribute("skinWeight") as THREE.BufferAttribute | undefined;
    const regionOfBone = sm.isSkinnedMesh ? sm.skeleton.bones.map((b) => { let cur: THREE.Object3D | null = b; while (cur) { const r = boneRegion(canonicalBoneName(cur.name)); if (r) return r; cur = cur.parent; } return null; }) : [];
    const vertRegion = (i: number): Region | null => {
      if (!si || !sw) return null;
      let best = -1, bw = 0; for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; best = si.getComponent(i, c); } }
      return best >= 0 ? regionOfBone[best] ?? null : null;
    };
    const vi = (t: number, c: number) => (index ? index.getX(t * 3 + c) : t * 3 + c);
    let groups: Int32Array, count: number;
    if (mode === "islands") ({ island: groups, count } = triangleIslands(geo));
    else {
      groups = new Int32Array(triCount); count = REGIONS.length + 1;
      for (let t = 0; t < triCount; t++) {
        const tally: Partial<Record<Region, number>> = {};
        for (let c = 0; c < 3; c++) { const r = vertRegion(vi(t, c)); if (r) tally[r] = (tally[r] ?? 0) + 1; }
        const r = (Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] as Region | undefined) ?? "torso";
        groups[t] = REGIONS.indexOf(r);
        if (matcher && [0, 1, 2].every((c) => matcher.near(worldVertex(mesh, vi(t, c), v)))) groups[t] = REGIONS.length; // body skin
      }
    }
    const buckets: number[][] = Array.from({ length: count }, () => []);
    for (let t = 0; t < triCount; t++) buckets[groups[t]!]!.push(t);
    buckets.forEach((tris, g) => {
      if (!tris.length) return;
      const regions = Object.fromEntries(REGIONS.map((r) => [r, 0])) as Record<Region, number>;
      let minY = Infinity, maxY = -Infinity; const used = new Set<number>();
      for (const t of tris) for (let c = 0; c < 3; c++) used.add(vi(t, c));
      for (const i of used) {
        worldVertex(mesh, i, v);
        if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
        const r = vertRegion(i); if (r) regions[r]++;
      }
      let bodyFrac = mode === "regions" && g === REGIONS.length ? 1 : 0;
      if (matcher && mode === "islands") { const arr = [...used]; const step = Math.max(1, Math.floor(arr.length / 300)); let hit = 0, n = 0; for (let j = 0; j < arr.length; j += step) { n++; if (matcher.near(worldVertex(mesh, arr[j]!, v))) hit++; } bodyFrac = hit / (n || 1); }
      raw.push({ id: `${mesh.uuid}:${g}`, mesh, tris, bodyFrac, stats: { tris: tris.length, regions, minY, maxY, modelMinY, modelHeight } });
    });
  }
  raw.sort((a, b) => b.stats.tris - a.stats.tris);
  const largest = raw[0]?.stats.tris ?? 0;
  const counts: Record<string, number> = {};
  return raw.map((r, i) => {
    let suggested = mode === "regions" ? regionTarget(r.stats) : classifyIsland(r.stats, r.stats.tris === largest);
    if (matcher) { if (r.bodyFrac >= 0.7) suggested = "body"; else if (suggested === "body") suggested = mode === "regions" ? regionTarget(r.stats) : "top"; }
    if (r.stats.tris < 4) suggested = "skip";
    const { bodyFrac: _b, ...rest } = r; void _b;
    counts[suggested] = (counts[suggested] ?? 0) + 1;
    return { ...rest, suggested, label: `${mode === "regions" ? "Region" : "Piece"} ${i + 1}`, colour: PALETTE[i % PALETTE.length]! };
  });
}
function regionTarget(s: IslandStats): Target {
  const best = REGIONS.reduce((a, r) => (s.regions[r] > s.regions[a] ? r : a), "head" as Region);
  return ({ head: "hair", neck: "neck", torso: "top", arms: "top", hands: "hands", hips: "bottom", legs: "bottom", feet: "shoes" } as const)[best];
}

/** Copies the chosen triangles of a mesh into a new geometry with all attributes (skin data included). */
export function subsetGeometry(geo: THREE.BufferGeometry, tris: number[]) {
  const index = geo.getIndex(); const map = new Map<number, number>(); const order: number[] = []; const out: number[] = [];
  for (const t of tris) for (let c = 0; c < 3; c++) {
    const i = index ? index.getX(t * 3 + c) : t * 3 + c;
    let n = map.get(i); if (n === undefined) { n = order.length; map.set(i, n); order.push(i); } out.push(n);
  }
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) {
    const a = attr as THREE.BufferAttribute; const Arr = a.array.constructor as new (n: number) => THREE.TypedArray;
    const arr = new Arr(order.length * a.itemSize);
    order.forEach((src, dst) => { for (let k = 0; k < a.itemSize; k++) arr[dst * a.itemSize + k] = a.array[src * a.itemSize + k]!; });
    g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
  }
  g.setIndex(out); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

/** Builds one wearable object per mesh-group of islands, keeping the source skeleton + bind matrix. */
export function buildPiece(islands: Island[]): { object: THREE.Group; skinned: boolean } {
  const group = new THREE.Group(); let skinned = false;
  const byMesh = new Map<THREE.Mesh, number[]>();
  for (const is of islands) byMesh.set(is.mesh, [...(byMesh.get(is.mesh) ?? []), ...is.tris]);
  for (const [mesh, tris] of byMesh) {
    const geo = subsetGeometry(mesh.geometry, tris);
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)!.clone() as THREE.MeshStandardMaterial;
    const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
    if (col && mat.color && !mat.map) { // painted-in colours (no texture): keep the piece's average colour
      let r = 0, g = 0, b = 0; for (let i = 0; i < col.count; i++) { r += col.getX(i); g += col.getY(i); b += col.getZ(i); }
      mat.color.setRGB(r / col.count, g / col.count, b / col.count, THREE.LinearSRGBColorSpace);
    }
    const src = mesh as THREE.SkinnedMesh;
    if (src.isSkinnedMesh) {
      const sm = new THREE.SkinnedMesh(geo, mat); sm.name = mesh.name;
      sm.bind(src.skeleton, src.bindMatrix.clone()); group.add(sm); skinned = true;
    } else {
      const m = new THREE.Mesh(geo, mat); m.applyMatrix4(mesh.matrixWorld); group.add(m);
    }
  }
  return { object: group, skinned };
}

/**
 * Test art: turns the plain demo character into a "Meshy-style" dressed single mesh by growing
 * shells over body regions (hair cap, jacket, trousers, boots, gloves) and merging everything.
 */
export function makeSampleDressed(root: THREE.Object3D): THREE.Object3D {
  prepSkin(root);
  let body: THREE.SkinnedMesh | null = null;
  root.traverse((o) => { const s = o as THREE.SkinnedMesh; if (s.isSkinnedMesh && (!body || s.geometry.getAttribute("position").count > body.geometry.getAttribute("position").count)) body = s; });
  if (!body) throw new Error("The demo character has no skinned body mesh.");
  const b = body as THREE.SkinnedMesh;
  const bIndex = b.geometry.index;
  const src = bIndex ? b.geometry.toNonIndexed() : b.geometry.clone();
  { // smooth normals per welded position so grown shells stay one connected piece
    const p = src.getAttribute("position") as THREE.BufferAttribute; const acc = new Map<string, THREE.Vector3>();
    const key = (i: number) => `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`;
    const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3();
    for (let t = 0; t < p.count / 3; t++) {
      A.fromBufferAttribute(p, t * 3); B.fromBufferAttribute(p, t * 3 + 1); Cc.fromBufferAttribute(p, t * 3 + 2);
      const n = B.sub(A).cross(Cc.sub(A));
      for (let c = 0; c < 3; c++) { const k = key(t * 3 + c); const v = acc.get(k) ?? new THREE.Vector3(); v.add(n); acc.set(k, v); }
    }
    const nn = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const v = acc.get(key(i))!.clone().normalize(); nn.set([v.x, v.y, v.z], i * 3); }
    src.setAttribute("normal", new THREE.BufferAttribute(nn, 3));
  }
  const pos = src.getAttribute("position") as THREE.BufferAttribute, nor = src.getAttribute("normal") as THREE.BufferAttribute;
  const si = src.getAttribute("skinIndex") as THREE.BufferAttribute, sw = src.getAttribute("skinWeight") as THREE.BufferAttribute;
  const region = b.skeleton.bones.map((bone) => boneRegion(canonicalBoneName(bone.name)));
  const wy = new Float32Array(pos.count); const tv = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) wy[i] = worldVertex(b, bIndex ? bIndex.getX(i) : i, tv).y;
  let minY = Infinity, maxY = -Infinity; for (const y of wy) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const box = { min: { y: minY } }; const Hw = maxY - minY;
  const lb = new THREE.Box3().setFromBufferAttribute(pos); const H = lb.getSize(tv).length() / 1.9; // local-units height-ish for shell thickness
  const vReg = (i: number) => { let best = 0, bw = 0; for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; best = si.getComponent(i, c); } } return region[best]; };
  const shells: { test: (i: number) => boolean; push: number; color: [number, number, number] }[] = [
    { test: (i) => vReg(i) === "head" && wy[i]! > box.min.y + Hw * 0.93, push: 0.018 * H, color: [0.18, 0.12, 0.1] }, // hair cap
    { test: (i) => { const r = vReg(i); return r === "torso" || r === "arms" || (r === "neck" && wy[i]! < box.min.y + Hw * 0.84); }, push: 0.012 * H, color: [0.85, 0.25, 0.2] }, // jacket
    { test: (i) => { const r = vReg(i); return r === "hips" || r === "legs"; }, push: 0.01 * H, color: [0.15, 0.2, 0.38] }, // trousers
    { test: (i) => vReg(i) === "feet", push: 0.016 * H, color: [0.3, 0.2, 0.12] }, // boots
    { test: (i) => vReg(i) === "hands" && !/Thumb|Index|Middle|Ring|Pinky/.test(b.skeleton.bones[si.getComponent(i, 0)]?.name ?? ""), push: 0.008 * H, color: [0.95, 0.95, 0.92] }, // gloves
  ];
  const out: Record<string, number[]> = { position: [], normal: [], skinIndex: [], skinWeight: [], color: [] };
  const add = (i: number, push: number, col: [number, number, number]) => {
    out.position!.push(pos.getX(i) + nor.getX(i) * push, pos.getY(i) + nor.getY(i) * push, pos.getZ(i) + nor.getZ(i) * push);
    out.normal!.push(nor.getX(i), nor.getY(i), nor.getZ(i));
    for (let c = 0; c < 4; c++) { out.skinIndex!.push(si.getComponent(i, c)); out.skinWeight!.push(sw.getComponent(i, c)); }
    out.color!.push(...col);
  };
  const tris = pos.count / 3;
  for (let i = 0; i < pos.count; i++) add(i, 0, [0.82, 0.72, 0.64]);
  for (const sh of shells) for (let t = 0; t < tris; t++) {
    if (sh.test(t * 3) && sh.test(t * 3 + 1) && sh.test(t * 3 + 2)) for (let c = 0; c < 3; c++) add(t * 3 + c, sh.push, sh.color);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out.position!, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(out.normal!, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(out.skinIndex!, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(out.skinWeight!, 4));
  g.setAttribute("color", new THREE.Float32BufferAttribute(out.color!, 3));
  const merged = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true }));
  merged.name = "SampleDressed_SingleMesh";
  b.parent!.add(merged); merged.position.copy(b.position); merged.quaternion.copy(b.quaternion); merged.scale.copy(b.scale);
  merged.bind(b.skeleton, b.bindMatrix.clone()); prepSkin(root);
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== merged) o.visible = false; });
  const kill: THREE.Object3D[] = []; root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== merged) kill.push(o); });
  kill.forEach((o) => o.removeFromParent());
  return root;
}

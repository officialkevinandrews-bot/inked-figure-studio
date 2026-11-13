import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { canonicalBoneName, type Rig } from "@/lib/rig";
import { itemById, slotDef, type Outfit, type Piece, type SlotId, type SlotState } from "@/lib/wardrobe";

export interface CustomAsset { id: string; name: string; object: THREE.Object3D; skinned: boolean; slot: SlotId }

const D = THREE.MathUtils.DEG2RAD;
const Y = new THREE.Vector3(0, 1, 0);

function gradient(tones: number) {
  const data = new Uint8Array(tones * 4);
  for (let i = 0; i < tones; i++) { const v = Math.round(70 + (185 * i) / Math.max(1, tones - 1)); data.set([v, v, v, 255], i * 4); }
  const t = new THREE.DataTexture(data, tones, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
export function inkColor(hex: string, mono: boolean) {
  const c = new THREE.Color(hex);
  if (mono) { const l = c.getHSL({ h: 0, s: 0, l: 0 }).l; c.setHSL(0, 0, 0.35 + l * 0.65); }
  return c;
}

/** Bone frame in model axes: world rotation with the rest offset removed (works for any bone roll). */
function frame(rig: Rig, bone: string, pos: THREE.Vector3, q: THREE.Quaternion) {
  const b = rig.bones.get(bone); const rest = rig.restModel.get(bone);
  if (!b || !rest) return false;
  b.getWorldPosition(pos);
  b.getWorldQuaternion(q).multiply(_inv.copy(rest).invert());
  return true;
}
const _inv = new THREE.Quaternion();

/** Capsule with different radii at each end, length h along +Y, centred. */
function taperedCapsule(r0: number, r1: number, h: number) {
  const pts: THREE.Vector2[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r0 + 1e-4, -h / 2 + Math.sin(a) * r0)); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r1 + 1e-4, h / 2 + Math.sin(a) * r1)); }
  return new THREE.LatheGeometry(pts, 20);
}

function shapeGeo(p: Extract<Piece, { k: "shape" }>) {
  const a = p.args;
  switch (p.geo) {
    case "sphere": return new THREE.SphereGeometry(a[0], 28, 18, a[1] ?? 0, a[2] ?? Math.PI * 2, a[3] ?? 0, a[4] ?? Math.PI);
    case "box": return new THREE.BoxGeometry(a[0], a[1], a[2]);
    case "cyl": return new THREE.CylinderGeometry(a[0], a[1], a[2], a[3] ?? 20, 1, a[4] === 1, a[5] ?? 0, a[6] ?? Math.PI * 2);
    case "cone": return new THREE.ConeGeometry(a[0], a[1], a[2] ?? 16);
    case "torus": return new THREE.TorusGeometry(a[0], a[1], 10, 32, a[2] || Math.PI * 2);
  }
}

interface Built {
  obj: THREE.Object3D;
  update: (fit: SlotState["fit"]) => void;
}

const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _e = new THREE.Euler(), _s = new THREE.Vector3();

function fitMatrix(fit: SlotState["fit"], mirror: boolean, out: THREE.Matrix4) {
  const sx = mirror ? -1 : 1;
  _e.set(fit.rx * D, fit.ry * D * sx, fit.rz * D * sx, "YXZ");
  return out.compose(_p2.set(fit.x * sx, fit.y, fit.z), _q2.setFromEuler(_e), _s.setScalar(fit.scale));
}

function buildPiece(p: Piece, rig: Rig, mats: Record<"p" | "s", THREE.Material>): Built | null {
  const mat = mats[p.ch ?? "p"];
  if (p.k === "seg") {
    const a = rig.bones.get(p.from), b = rig.bones.get(p.to);
    if (!a || !b) return null;
    const len = a.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3()));
    if (len < 1e-4) return null;
    const t0 = p.t0 ?? 0, t1 = p.t1 ?? 1;
    const mesh = new THREE.Mesh(taperedCapsule(p.r0, p.r1, len * (t1 - t0)), mat);
    mesh.matrixAutoUpdate = false;
    const restDir = new THREE.Vector3();
    return {
      obj: mesh,
      update: (fit) => {
        if (!frame(rig, p.from, _p, _q)) return;
        const end = b.getWorldPosition(new THREE.Vector3());
        const dir = end.sub(_p);
        restDir.copy(dir).applyQuaternion(_q2.copy(_q).invert()).normalize();
        const q = _q.clone().multiply(new THREE.Quaternion().setFromUnitVectors(Y, restDir));
        const centre = _p.clone().addScaledVector(dir, (t0 + t1) / 2);
        centre.add(new THREE.Vector3(fit.x * (p.m ?? 1), fit.y, fit.z));
        const k = fit.inflate * fit.scale;
        mesh.matrix.compose(centre, q, _s.set(k, 1, k * (p.depth ?? 1)));
        mesh.matrixWorldNeedsUpdate = true;
      },
    };
  }
  const geo = shapeGeo(p);
  const mesh = new THREE.Mesh(geo, mat);
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(...p.pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...((p.rot ?? [0, 0, 0]).map((v) => v * D) as [number, number, number]), "YXZ")),
    new THREE.Vector3(...(p.scl ?? [1, 1, 1])).multiplyScalar(1),
  );
  mesh.matrixAutoUpdate = false;
  return {
    obj: mesh,
    update: (fit) => {
      if (!frame(rig, p.bone, _p, _q)) return;
      _m.compose(_p, _q, _s.setScalar(1));
      fitMatrix({ ...fit, scale: fit.scale * fit.inflate }, p.m === -1, _m2);
      mesh.matrix.copy(_m).multiply(_m2).multiply(local);
      mesh.matrixWorldNeedsUpdate = true;
    },
  };
}

/** Rebinds a skinned clothing mesh onto the target Mixamo/VRM rig with scale & rest-pose alignment. */
export function bindSkinned(obj: THREE.Object3D, rig: Rig) {
  // Temporarily sample the target rig in its exact rest pose (model-local frame).
  const savedQuats = new Map<string, THREE.Quaternion>();
  rig.bones.forEach((b, k) => {
    savedQuats.set(k, b.quaternion.clone());
    const rest = rig.restLocal.get(k);
    if (rest) b.quaternion.copy(rest);
  });
  const tgtHips = rig.bones.get("Hips");
  const savedHipsPos = tgtHips?.position.clone() ?? null;
  if (tgtHips && rig.hipsRestLocal) tgtHips.position.copy(rig.hipsRestLocal);
  rig.root.updateMatrixWorld(true);

  const actorGroup = rig.root.parent;
  const actorInv = actorGroup ? actorGroup.matrixWorld.clone().invert() : new THREE.Matrix4();
  const targetRestActor = new Map<string, THREE.Matrix4>();
  rig.bones.forEach((b, k) => {
    targetRestActor.set(k, actorInv.clone().multiply(b.matrixWorld));
  });

  // Restore active pose immediately after sampling rest matrices.
  savedQuats.forEach((q, k) => rig.bones.get(k)?.quaternion.copy(q));
  if (tgtHips && savedHipsPos) tgtHips.position.copy(savedHipsPos);
  rig.root.updateMatrixWorld(true);

  const zeroTransforms = (node: THREE.Object3D) => {
    node.traverse((n) => {
      n.position.set(0, 0, 0);
      n.rotation.set(0, 0, 0);
      n.scale.set(1, 1, 1);
    });
    node.updateMatrixWorld(true);
  };

  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    const src = sm.skeleton;

    // Extract source rest-world positions of mapped Hips and Head/Foot to compute scale + anchor alignment.
    const srcRestPos = new Map<string, THREE.Vector3>();
    for (let i = 0; i < src.bones.length; i++) {
      const b = src.bones[i];
      if (!b) continue;
      const canon = canonicalBoneName(b.name);
      if (!canon) continue;
      const invMat = src.boneInverses[i];
      const worldMat = invMat ? invMat.clone().invert() : b.matrixWorld.clone();
      srcRestPos.set(canon, new THREE.Vector3().setFromMatrixPosition(worldMat));
    }
    const srcHipsPos = srcRestPos.get("Hips") ?? null;
    const srcHeadPos = srcRestPos.get("Head") ?? null;
    const srcFootPos = srcRestPos.get("LeftFoot") ?? srcRestPos.get("RightFoot") ?? null;

    const getTgtPos = (k: string) => {
      const m = targetRestActor.get(k);
      return m ? new THREE.Vector3().setFromMatrixPosition(m) : null;
    };
    const tgtHipsPos = getTgtPos("Hips");
    const tgtHeadPos = getTgtPos("Head");
    const tgtFootPos = getTgtPos("LeftFoot") ?? getTgtPos("RightFoot");

    let scaleRatio = 1;
    if (srcHipsPos && srcHeadPos && tgtHipsPos && tgtHeadPos) {
      const srcSpan = srcHeadPos.distanceTo(srcHipsPos);
      const tgtSpan = tgtHeadPos.distanceTo(tgtHipsPos);
      if (srcSpan > 1e-4 && tgtSpan > 1e-4) scaleRatio = tgtSpan / srcSpan;
    } else if (srcFootPos && srcHeadPos && tgtFootPos && tgtHeadPos) {
      const srcSpan = srcHeadPos.distanceTo(srcFootPos);
      const tgtSpan = tgtHeadPos.distanceTo(tgtFootPos);
      if (srcSpan > 1e-4 && tgtSpan > 1e-4) scaleRatio = tgtSpan / srcSpan;
    }

    const srcAnchor = srcHipsPos ?? new THREE.Vector3();
    const tgtAnchor = tgtHipsPos ?? new THREE.Vector3();
    // Map vertices from source geometry local -> source bind world -> scaled & anchored target actor rest space.
    const toTargetActorRest = new THREE.Matrix4()
      .makeTranslation(tgtAnchor.x, tgtAnchor.y, tgtAnchor.z)
      .multiply(new THREE.Matrix4().makeScale(scaleRatio, scaleRatio, scaleRatio))
      .multiply(new THREE.Matrix4().makeTranslation(-srcAnchor.x, -srcAnchor.y, -srcAnchor.z))
      .multiply(sm.bindMatrix);

    sm.geometry = sm.geometry.clone();
    sm.geometry.applyMatrix4(toTargetActorRest);

    const bones: THREE.Bone[] = [];
    const inverses: THREE.Matrix4[] = [];
    const fallbackHips = rig.bones.get("Hips")!;
    const fallbackInv = targetRestActor.get("Hips")?.clone().invert() ?? new THREE.Matrix4();

    src.bones.forEach((b) => {
      let cur: THREE.Object3D | null = b;
      let target: THREE.Bone | undefined;
      let canonFound: string | null = null;
      while (cur) {
        const n = canonicalBoneName(cur.name);
        const found = n ? rig.bones.get(n) : undefined;
        if (found) {
          target = found;
          canonFound = n;
          break;
        }
        cur = cur.parent;
      }
      bones.push(target ?? fallbackHips);
      const inv = canonFound ? targetRestActor.get(canonFound)?.clone().invert() : undefined;
      inverses.push(inv ?? fallbackInv.clone());
    });

    zeroTransforms(sm);
    sm.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
    sm.bindMode = THREE.AttachedBindMode;
    sm.frustumCulled = false;
  });
  zeroTransforms(obj);
}

function buildCustom(asset: CustomAsset, slot: SlotId, rig: Rig, tint: THREE.Material[]): Built[] {
  const toon = (root: THREE.Object3D) => root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    m.castShadow = true; m.frustumCulled = false;
    const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    const mat = new THREE.MeshToonMaterial({ map: src?.map ?? null, transparent: src?.transparent, alphaTest: src?.alphaTest ?? 0, side: THREE.DoubleSide });
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.userData["baseColor"] = src?.color && !src.map ? `#${src.color.getHexString()}` : null;
    tint.push(mat); m.material = mat;
  });
  if (asset.skinned) {
    const clone = cloneSkinned(asset.object);
    bindSkinned(clone, rig); toon(clone);
    return [{ obj: clone, update: () => {} }];
  }
  const def = slotDef(slot);
  const sides = def.pair ? [1, -1] : [1];
  return sides.map((sx) => {
    const g = new THREE.Group(); const inner = asset.object.clone(true); toon(inner); g.add(inner);
    g.matrixAutoUpdate = false;
    const bone = sx === 1 ? def.anchor.bone : def.anchor.bone.replace("Left", "Right");
    const local = new THREE.Matrix4().compose(new THREE.Vector3(def.anchor.pos[0] * sx, def.anchor.pos[1], def.anchor.pos[2]), new THREE.Quaternion(), new THREE.Vector3(sx, 1, 1));
    return {
      obj: g,
      update: (fit) => {
        if (!frame(rig, bone, _p, _q)) return;
        _m.compose(_p, _q, _s.setScalar(1));
        g.matrix.copy(_m).multiply(local).multiply(fitMatrix(fit, false, _m2));
        g.matrixWorldNeedsUpdate = true;
      },
    };
  });
}

function cloneSkinned(src: THREE.Object3D) {
  // SkinnedMesh clones share the skeleton; rebuild a fresh one each time so binds don't collide.
  const c = src.clone(true);
  c.traverse((o) => { const sm = o as THREE.SkinnedMesh; if (sm.isSkinnedMesh) sm.skeleton = sm.skeleton.clone(); });
  return c;
}

function SlotRig({ slot, state, rig, mono, tones, asset }: { slot: SlotId; state: SlotState; rig: Rig; mono: boolean; tones: number; asset?: CustomAsset }) {
  const grad = useMemo(() => gradient(tones), [tones]);
  const { group, built, mats, tinted } = useMemo(() => {
    const group = new THREE.Group(); group.name = `Wardrobe_${slot}`;
    const mats = {
      p: new THREE.MeshToonMaterial({ gradientMap: grad, side: THREE.DoubleSide }),
      s: new THREE.MeshToonMaterial({ gradientMap: grad, side: THREE.DoubleSide }),
    };
    const tinted: THREE.Material[] = [];
    let built: Built[] = [];
    const item = itemById(state.itemId);
    if (item) built = item.pieces.map((p) => buildPiece(p, rig, mats)).filter((b): b is Built => !!b);
    else if (asset) built = buildCustom(asset, slot, rig, tinted);
    built.forEach((b) => {
      b.obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false; o.userData["wardrobe"] = slot; } });
      group.add(b.obj);
    });
    return { group, built, mats, tinted };
  }, [slot, state.itemId, rig, asset, grad]);

  useEffect(() => () => {
    group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh) m.geometry.dispose(); });
    mats.p.dispose(); mats.s.dispose();
  }, [group, mats]);

  useEffect(() => {
    mats.p.color.copy(inkColor(state.colors.p, mono));
    mats.s.color.copy(inkColor(state.colors.s, mono));
    tinted.forEach((m) => {
      const tm = m as THREE.MeshToonMaterial;
      const base = (tm.userData["baseColor"] as string | null) ?? "#ffffff";
      tm.color.copy(inkColor(base, mono)).multiply(new THREE.Color(state.colors.p));
      if (mono && tm.map) tm.color.copy(inkColor(state.colors.p, true));
      tm.gradientMap = grad; tm.needsUpdate = true;
    });
  }, [mats, tinted, state.colors.p, state.colors.s, mono, grad]);

  useFrame(() => { for (const b of built) b.update(state.fit); }, -1);
  return <primitive object={group} />;
}

export function WardrobeRig({ outfit, rig, mono, tones, assets }: { outfit: Outfit; rig: Rig | null; mono: boolean; tones: number; assets: Record<string, CustomAsset> }) {
  if (!rig) return null;
  return (
    <>
      {(Object.entries(outfit) as [SlotId, SlotState][]).map(([slot, st]) => (
        <SlotRig key={`${slot}:${st.itemId}`} slot={slot} state={st} rig={rig} mono={mono} tones={tones} asset={assets[st.itemId]} />
      ))}
    </>
  );
}

/** Loads a clothing/hair file as-is (no resizing) so skinned pieces line up with the character's bones. */
export async function loadWardrobeAsset(file: File, slot: SlotId): Promise<CustomAsset> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const url = URL.createObjectURL(file);
  let object: THREE.Object3D;
  if (ext === "fbx") {
    const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
    const manager = new THREE.LoadingManager(); let pending = 0;
    const done = new Promise<void>((r) => { manager.onStart = () => { pending++; }; manager.onLoad = () => r(); });
    object = await new FBXLoader(manager).loadAsync(url);
    if (pending) await Promise.race([done, new Promise((r) => setTimeout(r, 8000))]);
  } else if (ext === "glb" || ext === "gltf") {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    object = (await new GLTFLoader().loadAsync(url)).scene;
  } else throw new Error("Use a .glb or .fbx file.");
  object.updateMatrixWorld(true);
  let skinned = false;
  object.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).skeleton.bones.some((b) => canonicalBoneName(b.name))) skinned = true; });
  if (!skinned) {
    // Rigid piece: centre it and size it to the slot.
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const k = slotDef(slot).targetSize / Math.max(size.x, size.y, size.z, 1e-6);
    const wrap = new THREE.Group();
    object.position.sub(c); wrap.add(object); wrap.scale.setScalar(k);
    object = wrap;
  }
  return { id: `custom:${crypto.randomUUID()}`, name: file.name.replace(/\.[^.]+$/, ""), object, skinned, slot };
}

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Rig } from "@/lib/rig";
import { resolveFace, type FaceConfig } from "@/lib/face-library";
import { drawFace } from "@/lib/face-draw";

const D = THREE.MathUtils.DEG2RAD;

/** Bent plane: z pulls back toward the edges so the decal hugs a rounded face. */
function bentPlane(curve: number) {
  const g = new THREE.PlaneGeometry(1, 1, 24, 1);
  const p = g.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, -x * x * curve); }
  p.needsUpdate = true;
  return g;
}

/** Face frame = head's world rotation with the rest offset removed, so +Z is "face forward" for any bone roll. */
export function faceFrame(rig: Rig, pos: THREE.Vector3, quat: THREE.Quaternion) {
  const head = rig.bones.get("Head");
  if (!head) return false;
  head.getWorldPosition(pos);
  head.getWorldQuaternion(quat).multiply(rig.restModel.get("Head")!.clone().invert());
  return true;
}

export function FaceRig({ rig, model, face, mono, fitRequest, onFit }: {
  rig: Rig | null; model: THREE.Object3D | null; face: FaceConfig; mono: boolean;
  fitRequest: number; onFit: (offsetZ: number, offsetY: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const canvas = useMemo(() => { const c = document.createElement("canvas"); c.width = c.height = 512; return c; }, []);
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }, [canvas]);
  const geo = useMemo(() => bentPlane(face.calib.curve), [face.calib.curve]);
  useEffect(() => () => geo.dispose(), [geo]);
  const resolved = resolveFace(face);
  const key = JSON.stringify([resolved, face.calib, mono, face.guide]);
  useEffect(() => {
    const c = canvas.getContext("2d")!;
    drawFace(c, resolved, face.calib, { mono, guide: face.guide });
    tex.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const pos = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const tiltQ = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const g = group.current;
    if (!g || !rig || !faceFrame(rig, pos, q)) return;
    const k = face.calib;
    g.position.copy(pos); g.quaternion.copy(q);
    g.translateX(k.offsetX); g.translateY(k.offsetY); g.translateZ(k.offsetZ);
    g.quaternion.multiply(tiltQ.setFromEuler(new THREE.Euler(k.tilt * D, 0, 0)));
    g.scale.setScalar(k.size);
  });

  // Auto-fit: ray from in front of the face back toward the head to find the skin surface.
  useEffect(() => {
    if (!fitRequest || !rig || !model) return;
    model.updateMatrixWorld(true);
    const p = new THREE.Vector3(), fq = new THREE.Quaternion();
    if (!faceFrame(rig, p, fq)) return;
    const meshes: THREE.Object3D[] = [];
    model.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o); });
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(fq);
    const ray = new THREE.Raycaster();
    let best: { y: number; z: number } | null = null;
    // sample eye height candidates; choose the frontmost hit around 6–10cm above the head bone
    for (const y of [0.06, 0.08, 0.1]) {
      const origin = p.clone().add(new THREE.Vector3(0, y, 1).applyQuaternion(fq));
      ray.set(origin, dir);
      const hit = ray.intersectObjects(meshes, false)[0];
      if (hit) { const z = 1 - hit.distance; if (!best || z > best.z) best = { y, z }; }
    }
    if (best) onFit(Math.max(0.01, best.z + 0.006), best.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);

  if (!rig || !face.visible || !rig.bones.get("Head")) return null;
  return (
    <group ref={group} name="FaceDecal">
      <mesh geometry={geo} userData={{ noOutline: true, keepInSnapshot: true }} renderOrder={10}>
        <meshBasicMaterial map={tex} transparent alphaTest={0.02} depthWrite={false} polygonOffset polygonOffsetFactor={-4} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

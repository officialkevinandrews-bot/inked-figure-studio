import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Rig } from "@/lib/rig";
import { resolveFace, type FaceCalibration, type FaceConfig } from "@/lib/face-library";
import { computeAdaptiveFaceCalibration } from "@/lib/face-autofit";
import { drawFace } from "@/lib/face-draw";
import type { FacePack } from "@/lib/face-parts";
import { onSpritesLoaded } from "@/lib/face-pack-draw";

const D = THREE.MathUtils.DEG2RAD;

/** Bent plane: pulls edges back horizontally and gently tapers top/bottom so the decal hugs a rounded head. */
function bentPlane(curve: number) {
  const g = new THREE.PlaneGeometry(1, 1, 24, 6);
  const p = g.attributes["position"] as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, -(x * x * curve + y * y * curve * 0.16));
  }
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

export function FaceRig({ rig, model, face, mono, fitRequest, onFit, pack = null }: {
  pack?: FacePack | null;
  rig: Rig | null; model: THREE.Object3D | null; face: FaceConfig; mono: boolean;
  fitRequest: number; onFit: (fit: Partial<FaceCalibration>) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const canvas = useMemo(() => { const c = document.createElement("canvas"); c.width = c.height = 512; return c; }, []);
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }, [canvas]);
  const geo = useMemo(() => bentPlane(face.calib.curve), [face.calib.curve]);
  useEffect(() => () => geo.dispose(), [geo]);
  const resolved = resolveFace(face);
  const [loaded, setLoaded] = useState(0);
  useEffect(() => onSpritesLoaded(() => setLoaded((n) => n + 1)), []);
  const key = JSON.stringify([resolved, face.calib, mono, face.guide, pack?.id, loaded]);
  useEffect(() => {
    const c = canvas.getContext("2d")!;
    drawFace(c, resolved, face.calib, { mono, guide: face.guide, pack });
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

  // Auto-fit: multi-ray surface grid cast toward the head to hug jaw, cheek, and brow depth.
  useEffect(() => {
    if (!fitRequest || !rig || !model) return;
    const fitted = computeAdaptiveFaceCalibration(rig, model, face.calib);
    if (fitted) onFit(fitted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest, rig, model]);

  if (!rig || !face.visible || !rig.bones.get("Head")) return null;
  return (
    <group ref={group} name="FaceDecal">
      <mesh geometry={geo} userData={{ noOutline: true, keepInSnapshot: true }} renderOrder={10}>
        <meshBasicMaterial map={tex} transparent alphaTest={0.02} depthWrite={false} polygonOffset polygonOffsetFactor={-4} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

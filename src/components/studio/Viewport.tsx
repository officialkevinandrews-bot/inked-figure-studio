import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Grid } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import type { Rig } from "@/lib/rig";

export interface ViewSettings {
  outline: number;
  mono: boolean;
  tones: number;
  showJoints: boolean;
}

function makeGradient(tones: number) {
  const data = new Uint8Array(tones * 4);
  for (let i = 0; i < tones; i++) {
    const v = Math.round(70 + (185 * i) / Math.max(1, tones - 1));
    data.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, tones, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** Replaces the model's materials with toon materials (keeps original colour maps). */
export function toonify(root: THREE.Object3D, tones: number, mono: boolean) {
  const grad = makeGradient(tones);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.frustumCulled = false;
    const orig = (m.userData.origMat ??= m.material) as THREE.Material | THREE.Material[];
    const conv = (mat: THREE.Material) => {
      const src = mat as THREE.MeshStandardMaterial;
      const color = src.color ? src.color.clone() : new THREE.Color(0xdddddd);
      if (mono) { const l = color.getHSL({ h: 0, s: 0, l: 0 }).l; color.setHSL(0, 0, 0.55 + l * 0.45); }
      return new THREE.MeshToonMaterial({
        color, map: mono ? null : src.map ?? null, gradientMap: grad,
        transparent: src.transparent, alphaTest: src.alphaTest, side: src.side,
      });
    };
    m.material = Array.isArray(orig) ? orig.map(conv) : conv(orig);
  });
}

function MangaRenderer({ outline }: { outline: number }) {
  const { gl, scene, camera } = useThree();
  const effect = useMemo(() => new OutlineEffect(gl, { defaultThickness: 0.004, defaultColor: [0, 0, 0] }), [gl]);
  useEffect(() => {
    (effect as unknown as { setSize: (w: number, h: number) => void }).setSize(gl.domElement.width, gl.domElement.height);
  }, [effect, gl]);
  useFrame(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Line).isLine) return;
      const show = outline > 0 && !m.userData.noOutline && m.isMesh;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => (mat.userData.outlineParameters = { thickness: outline * 0.0015, color: [0.05, 0.05, 0.05], visible: show }));
    });
    gl.autoClear = true;
    gl.clear();
    effect.render(scene, camera);
  }, 1);
  return null;
}

function Joints({ rig, selected, onSelect }: { rig: Rig; selected: string | null; onSelect: (b: string) => void }) {
  const refs = useRef<Map<string, THREE.Mesh>>(new Map());
  const names = useMemo(() => Array.from(rig.bones.keys()), [rig]);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    names.forEach((n) => {
      const m = refs.current.get(n);
      if (m) m.position.copy(rig.bones.get(n)!.getWorldPosition(v));
    });
  });
  return (
    <group>
      {names.map((n) => {
        const finger = /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(n);
        return (
          <mesh
            key={n}
            ref={(m) => { if (m) refs.current.set(n, m); }}
            renderOrder={999}
            userData={{ noOutline: true }}
            onClick={(e) => { e.stopPropagation(); onSelect(n); }}
          >
            <sphereGeometry args={[finger ? 0.008 : 0.022, 12, 12]} />
            <meshBasicMaterial color={selected === n ? "#e11d2e" : "#1d4ed8"} depthTest={false} transparent opacity={0.85} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Viewport({
  model, rig, selected, onSelect, onBoneDrag, settings,
}: {
  model: THREE.Object3D | null;
  rig: Rig | null;
  selected: string | null;
  onSelect: (b: string | null) => void;
  onBoneDrag: () => void;
  settings: ViewSettings;
}) {
  const bone = rig && selected ? rig.bones.get(selected) ?? null : null;
  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.3, 3.6], fov: 35 }}
      gl={{ antialias: true }}
      onPointerMissed={() => onSelect(null)}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color("#f7f4ec"))}
    >
      <MangaRenderer outline={settings.outline} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} />
      {model && <primitive object={model} />}
      <mesh rotation-x={-Math.PI / 2} receiveShadow userData={{ noOutline: true }}>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.18} />
      </mesh>
      <Grid args={[10, 10]} cellColor="#cfc8b8" sectionColor="#a39a86" fadeDistance={12} infiniteGrid userData={{ noOutline: true }} />
      {rig && settings.showJoints && <Joints rig={rig} selected={selected} onSelect={onSelect} />}
      {bone && (
        <TransformControls object={bone} mode="rotate" space="local" size={0.6} onObjectChange={onBoneDrag} />
      )}
      <OrbitControls makeDefault target={[0, 0.95, 0]} enableDamping />
    </Canvas>
  );
}

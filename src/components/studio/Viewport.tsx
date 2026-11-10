import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls, Grid } from "@react-three/drei";
import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from "react";
import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import type { Rig } from "@/lib/rig";
import { captureTransparentSnapshot, type SnapshotOptions, type SnapshotResult } from "@/lib/snapshot";

export interface ViewSettings {
  outline: number;
  mono: boolean;
  tones: number;
  showJoints: boolean;
  fov?: number;
  lightIntensity?: number;
  lightAngle?: [number, number, number];
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

export const CAMERA_PRESETS: Record<string, CameraPose> = {
  Front: { position: [0, 1.25, 3.4], target: [0, 0.95, 0], fov: 35 },
  "3/4 Dynamic": { position: [1.8, 1.35, 2.6], target: [0, 0.95, 0], fov: 42 },
  Profile: { position: [3.4, 1.25, 0], target: [0, 0.95, 0], fov: 35 },
  "Low Angle (Worm)": { position: [0, 0.25, 2.2], target: [0, 1.1, 0], fov: 65 },
  "High Angle (Bird)": { position: [0, 3.2, 2.0], target: [0, 0.7, 0], fov: 45 },
  "Close-Up": { position: [0, 1.48, 1.1], target: [0, 1.45, 0], fov: 32 },
  "Full Body": { position: [0, 0.95, 4.0], target: [0, 0.9, 0], fov: 35 },
};

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
    const orig = (m.userData["origMat"] ??= m.material) as THREE.Material | THREE.Material[];
    const conv = (mat: THREE.Material) => {
      const src = mat as THREE.MeshStandardMaterial;
      const color = src.color ? src.color.clone() : new THREE.Color(0xdddddd);
      if (mono) {
        const l = color.getHSL({ h: 0, s: 0, l: 0 }).l;
        color.setHSL(0, 0, 0.55 + l * 0.45);
      }
      return new THREE.MeshToonMaterial({
        color,
        map: mono ? null : src.map ?? null,
        gradientMap: grad,
        transparent: src.transparent,
        alphaTest: src.alphaTest,
        side: src.side,
      });
    };
    m.material = Array.isArray(orig) ? orig.map(conv) : conv(orig);
  });
}

function MangaRenderer({ outline }: { outline: number }) {
  const { gl, scene, camera } = useThree();
  const effect = useMemo(
    () => new OutlineEffect(gl, { defaultThickness: 0.004, defaultColor: [0.05, 0.05, 0.05] }),
    [gl]
  );
  useEffect(() => {
    (effect as unknown as { setSize: (w: number, h: number) => void }).setSize(
      gl.domElement.width,
      gl.domElement.height
    );
  }, [effect, gl]);

  useFrame(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Line).isLine) return;
      const show = outline > 0 && !m.userData["noOutline"] && m.isMesh;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        mat.userData["outlineParameters"] = {
          thickness: outline * 0.0015,
          color: [0.05, 0.05, 0.05],
          visible: show,
        };
      });
    });
    gl.autoClear = true;
    gl.clear();
    effect.render(scene, camera);
  }, 1);
  return null;
}

function Joints({
  rig,
  selected,
  onSelect,
}: {
  rig: Rig;
  selected: string | null;
  onSelect: (b: string) => void;
}) {
  const refs = useRef<Map<string, THREE.Mesh>>(new Map());
  const names = useMemo(() => Array.from(rig.bones.keys()), [rig]);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    names.forEach((n) => {
      const m = refs.current.get(n);
      const b = rig.bones.get(n);
      if (m && b) m.position.copy(b.getWorldPosition(v));
    });
  });
  return (
    <group userData={{ noOutline: true }} name="JointsHelperGroup">
      {names.map((n) => {
        const finger = /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(n);
        return (
          <mesh
            key={n}
            ref={(m) => {
              if (m) refs.current.set(n, m);
            }}
            renderOrder={999}
            userData={{ noOutline: true }}
            name={`Joint-${n}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(n);
            }}
          >
            <sphereGeometry args={[finger ? 0.008 : 0.022, 12, 12]} />
            <meshBasicMaterial
              color={selected === n ? "#e11d2e" : "#1d4ed8"}
              depthTest={false}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export interface ViewportHandle {
  captureSnapshot: (options?: SnapshotOptions) => SnapshotResult | null;
}

function SceneBridge({
  handleRef,
  outline,
}: {
  handleRef: React.ForwardedRef<ViewportHandle>;
  outline: number;
}) {
  const { gl, scene, camera } = useThree();

  useImperativeHandle(handleRef, () => ({
    captureSnapshot: (options = {}) => {
      return captureTransparentSnapshot(gl, scene, camera, {
        outlineThickness: outline,
        ...options,
      });
    },
  }));

  return null;
}

function CameraController({
  cameraPose,
  fov = 35,
}: {
  cameraPose?: CameraPose | null;
  fov?: number;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [fov, camera]);

  useEffect(() => {
    if (cameraPose && controlsRef.current) {
      camera.position.set(...cameraPose.position);
      controlsRef.current.target.set(...cameraPose.target);
      if (cameraPose.fov && camera instanceof THREE.PerspectiveCamera) {
        camera.fov = cameraPose.fov;
        camera.updateProjectionMatrix();
      }
      controlsRef.current.update();
    }
  }, [cameraPose, camera]);

  return <OrbitControls ref={controlsRef} makeDefault target={[0, 0.95, 0]} enableDamping />;
}

export const Viewport = forwardRef<
  ViewportHandle,
  {
    model: THREE.Object3D | null;
    rig: Rig | null;
    selected: string | null;
    onSelect: (b: string | null) => void;
    onBoneDrag: () => void;
    settings: ViewSettings;
    cameraPose?: CameraPose | null;
  }
>(function Viewport(
  { model, rig, selected, onSelect, onBoneDrag, settings, cameraPose },
  ref
) {
  const bone = rig && selected ? rig.bones.get(selected) ?? null : null;
  const fov = settings.fov ?? 35;
  const lightIntensity = settings.lightIntensity ?? 2.2;
  const lightAngle = settings.lightAngle ?? [2.5, 4, 3];

  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.3, 3.6], fov }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => onSelect(null)}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color("#f7f4ec"))}
    >
      <SceneBridge handleRef={ref} outline={settings.outline} />
      <MangaRenderer outline={settings.outline} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={lightAngle}
        intensity={lightIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} />
      {model && <primitive object={model} />}
      <mesh rotation-x={-Math.PI / 2} receiveShadow userData={{ noOutline: true }} name="FloorShadowMesh">
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.18} />
      </mesh>
      <Grid
        args={[10, 10]}
        cellColor="#cfc8b8"
        sectionColor="#a39a86"
        fadeDistance={12}
        infiniteGrid
        userData={{ noOutline: true }}
        name="GridHelper"
      />
      {rig && settings.showJoints && <Joints rig={rig} selected={selected} onSelect={onSelect} />}
      {bone && (
        <TransformControls object={bone} mode="rotate" space="local" size={0.6} onObjectChange={onBoneDrag} />
      )}
      <CameraController cameraPose={cameraPose} fov={fov} />
    </Canvas>
  );
});

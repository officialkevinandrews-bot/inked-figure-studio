import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, TransformControls, Grid } from "@react-three/drei";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import * as THREE from "three";
import "@/lib/r3f-devtools-shim";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import type { Rig } from "@/lib/rig";
import { IK_EFFECTORS, effectorForBone } from "@/lib/ik";
import { captureTransparentSnapshot, type SnapshotOptions, type SnapshotResult } from "@/lib/snapshot";
import { FaceRig } from "./FaceRig";
import type { FaceCalibration, FaceConfig } from "@/lib/face-library";
import type { FacePack } from "@/lib/face-parts";
import { collectMaterialNames, shouldTintMaterial } from "@/lib/base-models";
import { WardrobeRig, type CustomAsset } from "./WardrobeRig";
import type { Outfit } from "@/lib/wardrobe";
import { type ActiveProp, type PropTransform, getPropById } from "@/lib/props";
import { hexToOutlineRgb } from "@/lib/lighting";
import { createMangaToonMaterial, ensureCreaseAttribute, updateMangaUniforms } from "@/lib/manga-shader";

export interface ViewSettings {
  outline: number;
  muscleLines?: number;
  outlineColor?: string;
  mono: boolean;
  tones: number;
  shadowHatch?: boolean;
  showJoints: boolean;
  fov?: number;
  lightIntensity?: number;
  rimIntensity?: number;
  fillIntensity?: number;
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

function makeGradient(tones: number, highContrast = false) {
  const count = highContrast ? 2 : tones;
  const data = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const v = highContrast
      ? i === 0
        ? 45
        : 255
      : Math.round(70 + (185 * i) / Math.max(1, count - 1));
    data.set([v, v, v, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, count, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** Replaces the model's materials with toon materials (keeps original colour maps + adds manga crease ink). */
export function toonify(
  root: THREE.Object3D,
  tones: number,
  mono: boolean,
  shadowHatch = false,
  tint?: string,
  skinMaterials?: string[],
  muscleLines = 4.5,
  outlineColor = "#0d0d0d",
) {
  const grad = makeGradient(tones, shadowHatch);
  const allMatNames = tint ? collectMaterialNames(root) : [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.frustumCulled = false;
    if (!m.userData["noOutline"] && m.geometry) {
      ensureCreaseAttribute(m.geometry);
    }
    const orig = (m.userData["origMat"] ??= m.material) as THREE.Material | THREE.Material[];
    const conv = (mat: THREE.Material, idx: number) => {
      const src = mat as THREE.MeshStandardMaterial;
      const matId = src.name?.trim() || `${m.name || "mesh"}#${idx}`;
      const hasMap = !!src.map;
      const isSkinTarget = !!tint && shouldTintMaterial(matId, allMatNames, skinMaterials);
      const color = hasMap
        ? new THREE.Color(0xffffff)
        : src.color ? src.color.clone() : new THREE.Color(0xdddddd);
      if (isSkinTarget && tint && (!hasMap || mono || shadowHatch)) {
        color.copy(new THREE.Color(tint));
      }
      if (src.map) src.map.colorSpace = THREE.SRGBColorSpace;
      if (mono || shadowHatch) {
        const l = color.getHSL({ h: 0, s: 0, l: 0 }).l;
        if (isSkinTarget && tint) {
          color.setHSL(0, 0, shadowHatch ? Math.min(1, 0.45 + l * 0.55) : 0.25 + l * 0.75);
        } else {
          color.setHSL(0, 0, shadowHatch ? Math.min(1, 0.72 + l * 0.28) : 0.55 + l * 0.45);
        }
      }
      return createMangaToonMaterial({
        color,
        map: mono || shadowHatch ? null : src.map ?? null,
        gradientMap: grad,
        transparent: src.transparent,
        alphaTest: src.alphaTest,
        side: src.side,
        hasSkinTint: isSkinTarget && hasMap && !mono && !shadowHatch,
        skinColor: tint,
        muscleLines,
        inkColor: outlineColor,
        shadowHatch,
      });
    };
    m.material = Array.isArray(orig) ? orig.map((mat, i) => conv(mat, i)) : conv(orig, 0);
  });
}

function MangaRenderer({ outline, muscleLines, outlineColor }: { outline: number; muscleLines?: number; outlineColor?: string }) {
  const { gl, scene, camera } = useThree();
  const rgb = useMemo(() => hexToOutlineRgb(outlineColor), [outlineColor]);
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
    updateMangaUniforms(scene, muscleLines ?? 4.5, outlineColor);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Line).isLine) return;
      const show = outline > 0 && !m.userData["noOutline"] && m.isMesh;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        mat.userData["outlineParameters"] = {
          thickness: outline * 0.0015,
          color: rgb,
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
  onGrab,
}: {
  rig: Rig;
  selected: string | null;
  onSelect: (b: string) => void;
  onGrab?: (b: string, e: ThreeEvent<PointerEvent>) => boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
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
            scale={hover === n ? 1.5 : 1}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(n);
              document.body.style.cursor = "grab";
            }}
            onPointerOut={() => {
              setHover((h) => (h === n ? null : h));
              document.body.style.cursor = "";
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(n);
              onGrab?.(n, e);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <sphereGeometry args={[finger ? 0.012 : 0.034, 12, 12]} />
            <meshBasicMaterial
              color={selected === n ? "#e11d2e" : hover === n ? "#f59e0b" : "#1d4ed8"}
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
  outlineColor,
}: {
  handleRef: React.ForwardedRef<ViewportHandle>;
  outline: number;
  outlineColor?: string;
}) {
  const { gl, scene, camera } = useThree();

  useImperativeHandle(handleRef, () => ({
    captureSnapshot: (options = {}) => {
      return captureTransparentSnapshot(gl, scene, camera, {
        outlineThickness: outline,
        outlineColor,
        ...options,
      });
    },
  }));

  return null;
}

function CameraController({
  cameraPose,
  fov = 35,
  locked = false,
}: {
  cameraPose?: CameraPose | null;
  fov?: number;
  locked?: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);

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

  return <OrbitControls ref={controlsRef} makeDefault target={[0, 0.95, 0]} enableDamping={false} enabled={!locked} />;
}

/** Press-and-drag posing: drags an IK effector on a camera-facing plane while the camera is frozen. */
function useDirectDrag(rig: Rig | null, onIkDrag: (eff: string, p: THREE.Vector3) => void, onSelect: (b: string) => void) {
  const { camera, gl, controls } = useThree();
  const cb = useRef(onIkDrag);
  cb.current = onIkDrag;
  return (boneName: string, e: ThreeEvent<PointerEvent>): boolean => {
    if (!rig || e.button !== 0) return false;
    const eff = effectorForBone(boneName);
    const bone = eff && rig.bones.get(eff);
    if (!eff || !bone) return false;
    e.stopPropagation();
    onSelect(eff);
    const ctl = controls as unknown as { enabled: boolean } | null;
    const wasEnabled = ctl?.enabled ?? true;
    if (ctl) ctl.enabled = false;
    const start = bone.getWorldPosition(new THREE.Vector3());
    const normal = camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, start);
    const grabOffset = start.clone().sub(e.point.clone().projectOnPlane(normal).add(normal.clone().multiplyScalar(normal.dot(start))));
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    document.body.style.cursor = "grabbing";
    const move = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1),
        camera
      );
      if (ray.ray.intersectPlane(plane, hit)) cb.current(eff, hit.clone().add(grabOffset));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (ctl) ctl.enabled = wasEnabled;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return true;
  };
}

function PoseScene({
  model,
  rig,
  selected,
  onSelect,
  showJoints,
  ikMode,
  onIkDrag,
}: {
  model: THREE.Object3D | null;
  rig: Rig | null;
  selected: string | null;
  onSelect: (b: string | null) => void;
  showJoints: boolean;
  ikMode: boolean;
  onIkDrag: (eff: string, p: THREE.Vector3) => void;
}) {
  const grab = useDirectDrag(rig, onIkDrag, onSelect);
  const v = useMemo(() => new THREE.Vector3(), []);
  const nearestBone = (p: THREE.Vector3) => {
    let best: string | null = null, bd = Infinity;
    rig?.bones.forEach((b, n) => {
      if (/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(n)) return;
      const d = b.getWorldPosition(v).distanceTo(p);
      if (d < bd) { bd = d; best = n; }
    });
    return best as string | null;
  };
  return (
    <>
      {model && (
        <primitive
          object={model}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (!rig) return;
            const n = nearestBone(e.point);
            if (!n) return;
            if (ikMode) grab(n, e);
            else { e.stopPropagation(); onSelect(n); }
          }}
          onPointerOver={() => rig && (document.body.style.cursor = "grab")}
          onPointerOut={() => (document.body.style.cursor = "")}
        />
      )}
      {rig && showJoints && (
        <Joints rig={rig} selected={selected} onSelect={onSelect} onGrab={ikMode ? grab : undefined} />
      )}
    </>
  );
}

function IkHandle({ bone, onDrag }: { bone: THREE.Bone; onDrag: (p: THREE.Vector3) => void }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const dragging = useRef(false);
  useFrame(() => {
    if (!dragging.current) bone.getWorldPosition(target.position);
  });
  return (
    <>
      <primitive object={target} />
      <TransformControls
        object={target}
        mode="translate"
        size={0.7}
        onMouseDown={() => (dragging.current = true)}
        onMouseUp={() => (dragging.current = false)}
        onObjectChange={() => dragging.current && onDrag(target.position.clone())}
      />
    </>
  );
}

function PropItem({
  prop,
  rig,
  isSelected,
  onSelect,
  customPropObjects,
}: {
  prop: ActiveProp;
  rig: Rig | null;
  isSelected: boolean;
  onSelect: () => void;
  customPropObjects?: Record<string, THREE.Object3D>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const customObj = customPropObjects?.[prop.propDefId];
  const mesh = useMemo(() => {
    if (customObj) return customObj.clone();
    const def = getPropById(prop.propDefId);
    return def ? def.buildMesh() : new THREE.Group();
  }, [prop.propDefId, customObj]);

  const vPos = useMemo(() => new THREE.Vector3(), []);
  const qRot = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    if (!groupRef.current) return;
    if (prop.attachedBone && prop.attachedBone !== "None" && rig) {
      const bone = rig.bones.get(prop.attachedBone);
      if (bone) {
        bone.getWorldPosition(vPos);
        bone.getWorldQuaternion(qRot);

        groupRef.current.position.copy(vPos);
        groupRef.current.quaternion.copy(qRot);

        // Apply local translation offset
        groupRef.current.translateX(prop.transform.position[0]);
        groupRef.current.translateY(prop.transform.position[1]);
        groupRef.current.translateZ(prop.transform.position[2]);

        // Apply local Euler rotation
        const rx = (prop.transform.rotation[0] * Math.PI) / 180;
        const ry = (prop.transform.rotation[1] * Math.PI) / 180;
        const rz = (prop.transform.rotation[2] * Math.PI) / 180;
        const offsetQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "XYZ"));
        groupRef.current.quaternion.multiply(offsetQ);

        // Apply scale
        groupRef.current.scale.set(...prop.transform.scale);
        return;
      }
    }

    // World placement (attachedBone === "None")
    groupRef.current.position.set(...prop.transform.position);
    groupRef.current.rotation.set(
      (prop.transform.rotation[0] * Math.PI) / 180,
      (prop.transform.rotation[1] * Math.PI) / 180,
      (prop.transform.rotation[2] * Math.PI) / 180
    );
    groupRef.current.scale.set(...prop.transform.scale);
  });

  if (!prop.visible) return null;

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <primitive object={mesh} />
      {isSelected && (
        <mesh userData={{ noOutline: true }}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshBasicMaterial wireframe color="#f59e0b" />
        </mesh>
      )}
    </group>
  );
}

export interface CoActorRender {
  id: string;
  model: THREE.Object3D | null;
  rig: Rig | null;
  position: [number, number, number];
  rotationY: number;
  face?: FaceConfig | null;
  facePack?: FacePack | null;
  outfit?: Outfit;
  wardrobeAssets?: Record<string, CustomAsset>;
  propsList?: ActiveProp[];
  visible: boolean;
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
    propsList?: ActiveProp[];
    selectedPropId?: string | null;
    onSelectProp?: (id: string | null) => void;
    customPropObjects?: Record<string, THREE.Object3D>;
    ikMode?: boolean;
    onIkDrag?: (effector: string, world: THREE.Vector3) => void;
    cameraLocked?: boolean;
    face?: FaceConfig | null;
    facePack?: FacePack | null;
    faceFitRequest?: number;
    onFaceFit?: (fit: Partial<FaceCalibration>) => void;
    outfit?: Outfit;
    wardrobeAssets?: Record<string, CustomAsset>;
    primaryStageTransform?: { position: [number, number, number]; rotationY: number };
    primaryVisible?: boolean;
    coActors?: CoActorRender[];
    onSelectActor?: (id: string) => void;
  }
>(function Viewport(
  {
    model,
    rig,
    selected,
    onSelect,
    onBoneDrag,
    settings,
    cameraPose,
    propsList = [],
    selectedPropId = null,
    onSelectProp = () => {},
    customPropObjects,
    ikMode = false,
    onIkDrag = () => {},
    cameraLocked = false,
    face = null,
    facePack = null,
    faceFitRequest = 0,
    onFaceFit = () => {},
    outfit = {},
    wardrobeAssets = {},
    primaryStageTransform = { position: [0, 0, 0], rotationY: 0 },
    primaryVisible = true,
    coActors = [],
    onSelectActor,
  },
  ref
) {
  const bone = rig && selected ? rig.bones.get(selected) ?? null : null;
  const fov = settings.fov ?? 35;
  const lightIntensity = settings.lightIntensity ?? 2.2;
  const rimIntensity = settings.rimIntensity ?? 0.5;
  const fillIntensity = settings.fillIntensity ?? 0.6;
  const lightAngle = settings.lightAngle ?? [2.5, 4, 3];
  const rimAngle: [number, number, number] = [
    -lightAngle[0],
    Math.max(1.5, lightAngle[1] * 0.55),
    -lightAngle[2],
  ];

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [0, 1.3, 3.6], fov }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => {
        onSelect(null);
        onSelectProp(null);
      }}
      onCreated={({ gl }) => gl.setClearColor(new THREE.Color("#f7f4ec"))}
    >
      <SceneBridge handleRef={ref} outline={settings.outline} outlineColor={settings.outlineColor} />
      <MangaRenderer outline={settings.outline} muscleLines={settings.muscleLines} outlineColor={settings.outlineColor} />
      <ambientLight intensity={fillIntensity} />
      <directionalLight
        position={lightAngle}
        intensity={lightIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={rimAngle} intensity={rimIntensity} />
      <group
        position={primaryStageTransform.position}
        rotation={[0, (primaryStageTransform.rotationY * Math.PI) / 180, 0]}
        visible={primaryVisible}
      >
        <PoseScene
          model={model}
          rig={rig}
          selected={selected}
          onSelect={onSelect}
          showJoints={settings.showJoints}
          ikMode={ikMode}
          onIkDrag={onIkDrag}
        />

        {face && (
          <FaceRig rig={rig} model={model} face={face} pack={facePack} mono={settings.mono} fitRequest={faceFitRequest} onFit={onFaceFit} />
        )}

        <WardrobeRig outfit={outfit} rig={rig} mono={settings.mono} tones={settings.tones} assets={wardrobeAssets} />

        {coActors.length > 0 && primaryVisible && (
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]} userData={{ noOutline: true }} name="ActiveActorRing">
            <ringGeometry args={[0.36, 0.42, 32]} />
            <meshBasicMaterial color="#e11d2e" side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>

      {/* Secondary staged characters in Scene Cast */}
      {coActors
        .filter((co) => co.visible)
        .map((co) => (
          <group
            key={co.id}
            position={co.position}
            rotation={[0, (co.rotationY * Math.PI) / 180, 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSelectActor?.(co.id);
            }}
          >
          {co.model && <primitive object={co.model} />}
          {co.face && co.model && (
            <FaceRig
              rig={co.rig}
              model={co.model}
              face={co.face}
              pack={co.facePack ?? facePack}
              mono={settings.mono}
              fitRequest={0}
              onFit={() => {}}
            />
          )}
          {co.outfit && (
            <WardrobeRig
              outfit={co.outfit}
              rig={co.rig}
              mono={settings.mono}
              tones={settings.tones}
              assets={co.wardrobeAssets ?? {}}
            />
          )}
        </group>
      ))}

      {/* 3D Props with Bone Parenting (Active + Co-Actors) */}
      {primaryVisible &&
        propsList.map((p) => (
          <PropItem
            key={p.id}
            prop={p}
            rig={rig}
            isSelected={selectedPropId === p.id}
            onSelect={() => onSelectProp(p.id)}
            customPropObjects={customPropObjects}
          />
        ))}
      {coActors.flatMap((co) =>
        co.visible
          ? (co.propsList ?? []).map((p) => (
              <PropItem
                key={`${co.id}-${p.id}`}
                prop={p}
                rig={co.rig}
                isSelected={false}
                onSelect={() => onSelectActor?.(co.id)}
                customPropObjects={customPropObjects}
              />
            ))
          : []
      )}

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
      {bone && (!ikMode || !IK_EFFECTORS.includes(selected!)) && (
        <TransformControls object={bone} mode="rotate" space="local" size={0.6} onObjectChange={onBoneDrag} />
      )}
      {bone && ikMode && IK_EFFECTORS.includes(selected!) && (
        <IkHandle key={selected!} bone={bone} onDrag={(p) => onIkDrag(selected!, p)} />
      )}
      <CameraController cameraPose={cameraPose} fov={fov} locked={cameraLocked} />
    </Canvas>
  );
});

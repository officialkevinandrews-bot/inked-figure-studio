import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { hexToOutlineRgb } from "./lighting";

export interface SnapshotOptions {
  pixelRatio?: number; // 1, 2, or 4
  outlineThickness?: number;
  outlineColor?: string;
}

export interface SnapshotResult {
  dataUrl: string;
  width: number;
  height: number;
}

/** Captures a clean, transparent PNG snapshot of the 3D character with manga ink outlines */
export function captureTransparentSnapshot(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: SnapshotOptions = {}
): SnapshotResult {
  const pixelRatio = options.pixelRatio ?? 2;
  const outline = options.outlineThickness ?? 3;
  const outlineRgb = hexToOutlineRgb(options.outlineColor);

  // 1. Hide UI helpers, grid, joints, and floor shadows during snapshot
  const hiddenObjects: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    // Helpers are flagged noOutline; the face decal opts back in. (Name matching on "Joint" hid real model meshes such as Beta_Joints.)
    const helper = (obj.userData?.["noOutline"] && !obj.userData?.["keepInSnapshot"]) || obj.name === "GridHelper" || obj.name === "JointsHelperGroup";
    if (helper) {
      if (obj.visible) {
        obj.visible = false;
        hiddenObjects.push(obj);
      }
    }
  });

  // 2. Remember original renderer state
  const prevClearColor = new THREE.Color();
  gl.getClearColor(prevClearColor);
  const prevClearAlpha = gl.getClearAlpha();
  const prevPixelRatio = gl.getPixelRatio();
  const origSize = new THREE.Vector2();
  gl.getSize(origSize);

  // 3. Configure transparent background & target pixel ratio
  gl.setClearColor(0x000000, 0);
  gl.setPixelRatio(pixelRatio);

  // 4. Render with OutlineEffect
  const effect = new OutlineEffect(gl, {
    defaultThickness: 0.004,
    defaultColor: outlineRgb,
  });

  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const show = outline > 0 && !m.userData["noOutline"];
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => {
      mat.userData["outlineParameters"] = {
        thickness: outline * 0.0015,
        color: outlineRgb,
        visible: show,
      };
    });
  });

  gl.clear();
  effect.render(scene, camera);

  // 5. Read data URL from canvas
  const dataUrl = gl.domElement.toDataURL("image/png");
  const width = Math.round(origSize.x * pixelRatio);
  const height = Math.round(origSize.y * pixelRatio);

  // 6. Restore original state
  gl.setClearColor(prevClearColor, prevClearAlpha);
  gl.setPixelRatio(prevPixelRatio);
  hiddenObjects.forEach((obj) => {
    obj.visible = true;
  });

  return { dataUrl, width, height };
}

/** Triggers a browser download of a data URL image */
export function downloadDataUrl(dataUrl: string, filename = "manga-pose-render.png") {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


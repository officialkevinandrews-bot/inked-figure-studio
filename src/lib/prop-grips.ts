import type { ActiveProp } from "./props";
import type { PoseData } from "./rig";
import { buildHandPreset, type HandPresetId } from "./hand-poses";

export type TargetHandBone = "RightHand" | "LeftHand";

export interface PropGripSpec {
  handPreset: HandPresetId;
  right: { position: [number, number, number]; rotation: [number, number, number] };
  left: { position: [number, number, number]; rotation: [number, number, number] };
}

export const PROP_GRIPS: Record<string, PropGripSpec> = {
  katana: {
    handPreset: "grip",
    right: { position: [0.02, -0.02, 0.03], rotation: [88, 0, 0] },
    left: { position: [-0.02, -0.02, 0.03], rotation: [88, 0, 180] },
  },
  broadsword: {
    handPreset: "grip",
    right: { position: [0.02, -0.02, 0.03], rotation: [88, 0, 0] },
    left: { position: [-0.02, -0.02, 0.03], rotation: [88, 0, 180] },
  },
  handgun: {
    handPreset: "point",
    right: { position: [0.01, -0.03, 0.05], rotation: [0, 0, 0] },
    left: { position: [-0.01, -0.03, 0.05], rotation: [0, 0, 0] },
  },
  magic_wand: {
    handPreset: "grip",
    right: { position: [0.01, -0.18, 0.02], rotation: [88, 0, 0] },
    left: { position: [-0.01, -0.18, 0.02], rotation: [88, 0, 180] },
  },
  smartphone: {
    handPreset: "open",
    right: { position: [0.01, 0, 0.03], rotation: [0, 85, 0] },
    left: { position: [-0.01, 0, 0.03], rotation: [0, -85, 0] },
  },
  school_bag: {
    handPreset: "grip",
    right: { position: [0, -0.2, 0], rotation: [0, 180, 0] },
    left: { position: [0, -0.2, 0], rotation: [0, 0, 0] },
  },
  book: {
    handPreset: "open",
    right: { position: [0.02, 0, 0.05], rotation: [0, 0, -45] },
    left: { position: [-0.02, 0, 0.05], rotation: [0, 0, 45] },
  },
  coffee_mug: {
    handPreset: "grip",
    right: { position: [0.02, -0.01, 0.03], rotation: [0, 0, 0] },
    left: { position: [-0.02, -0.01, 0.03], rotation: [0, 180, 0] },
  },
};

const DEFAULT_GRIP: PropGripSpec = {
  handPreset: "grip",
  right: { position: [0.01, -0.01, 0.03], rotation: [85, 0, 0] },
  left: { position: [-0.01, -0.01, 0.03], rotation: [85, 0, 180] },
};

/** Computes updated prop attachment + hand finger pose patch for 1-click snapping to Left/Right hand. */
export function snapPropToHand(
  prop: ActiveProp,
  hand: TargetHandBone,
): { propPatch: Partial<ActiveProp>; posePatch: PoseData } {
  const spec = PROP_GRIPS[prop.propDefId] ?? DEFAULT_GRIP;
  const sideSpec = hand === "RightHand" ? spec.right : spec.left;
  const posePatch = buildHandPreset(hand === "RightHand" ? "Right" : "Left", spec.handPreset);
  return {
    propPatch: {
      attachedBone: hand,
      transform: {
        position: [...sideSpec.position],
        rotation: [...sideSpec.rotation],
        scale: [...prop.transform.scale],
      },
    },
    posePatch,
  };
}


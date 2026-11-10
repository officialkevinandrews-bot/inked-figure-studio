import { mirrorRot, type Pose, type PoseData, type Rot } from "./rig";

/** Set a left-side value and auto-mirror it onto the right side. */
function sym(parts: Record<string, Rot>): PoseData {
  const out: PoseData = {};
  for (const [k, v] of Object.entries(parts)) {
    out["Left" + k] = v;
    out["Right" + k] = mirrorRot(v);
  }
  return out;
}
const R = (k: string, v: Rot): PoseData => ({ ["Right" + k]: mirrorRot(v) });
const L = (k: string, v: Rot): PoseData => ({ ["Left" + k]: v });

const FINGERS = ["Index", "Middle", "Ring", "Pinky"];
function hand(side: "Left" | "Right", curl: Record<string, number>, thumb: Rot = [0, 0, 0]): PoseData {
  const out: PoseData = {};
  const m = side === "Right";
  for (const f of FINGERS) {
    const c = curl[f] ?? 0;
    for (let n = 1; n <= 3; n++) {
      const v: Rot = [0, 0, -c * (n === 1 ? 0.8 : 1)];
      out[`${side}Hand${f}${n}`] = m ? mirrorRot(v) : v;
    }
  }
  for (let n = 1; n <= 3; n++) {
    const v: Rot = [thumb[0], thumb[1] * (n === 1 ? 1 : 0.5), thumb[2] * (n === 1 ? 1 : 0.7)];
    out[`${side}HandThumb${n}`] = m ? mirrorRot(v) : v;
  }
  return out;
}
const FIST = { Index: 85, Middle: 88, Ring: 90, Pinky: 90 };
const RELAX = { Index: 15, Middle: 20, Ring: 25, Pinky: 30 };
const fists = { ...hand("Left", FIST, [0, 30, -40]), ...hand("Right", FIST, [0, 30, -40]) };
const relaxed = { ...hand("Left", RELAX, [0, 10, -10]), ...hand("Right", RELAX, [0, 10, -10]) };

const armsDown = sym({ Arm: [0, 0, -75], ForeArm: [0, -10, 0] });

const p = (category: string, name: string, bones: PoseData, extra: Partial<Pose> = {}): Pose => ({
  id: `${category}-${name}`.toLowerCase().replace(/\W+/g, "-"),
  category, name, bones, ...extra,
});

export const POSES: Pose[] = [
  // ── Standing
  p("Standing", "T-Pose", {}),
  p("Standing", "A-Pose", sym({ Arm: [0, 0, -45] })),
  p("Standing", "Relaxed", { ...armsDown, ...relaxed, Head: [4, 0, 0] }),
  p("Standing", "Hands on Hips", { ...sym({ Arm: [0, 0, -50], ForeArm: [0, -110, 0], Hand: [0, 0, 20] }), Spine2: [-4, 0, 0] }),
  p("Standing", "Arms Crossed", { ...sym({ Arm: [-60, 0, -70], ForeArm: [0, -120, 0] }), ...relaxed, Head: [-5, 0, 0] }),
  p("Standing", "Contrapposto", { ...armsDown, ...relaxed, Hips: [0, 8, 6], Spine: [0, -4, -5], ...L("UpLeg", [-8, 0, 4]), ...L("Leg", [15, 0, 0]), Head: [0, 10, 4] }),
  p("Standing", "Looking Up", { ...armsDown, ...relaxed, Neck: [-15, 0, 0], Head: [-25, 0, 0], Spine2: [-6, 0, 0] }),
  p("Standing", "Wave", { ...sym({ Arm: [0, 0, -75] }), ...L("Arm", [0, 0, 20]), ...L("ForeArm", [0, -10, 70]), ...hand("Left", {}), Head: [0, 10, 0] }),

  // ── Walk & Run
  p("Walk & Run", "Walk Stride", { ...L("Arm", [25, 0, -78]), ...R("Arm", [-25, 0, -78]), ...sym({ ForeArm: [0, -25, 0] }), ...L("UpLeg", [25, 0, 0]), ...L("Leg", [10, 0, 0]), ...R("UpLeg", [-25, 0, 0]), ...R("Leg", [8, 0, 0]), Hips: [0, -5, 0], Spine1: [0, 8, 0], ...relaxed }, { hipsDrop: 0.03 }),
  p("Walk & Run", "Walk Passing", { ...armsDown, ...L("UpLeg", [-30, 0, 0]), ...L("Leg", [55, 0, 0]), ...relaxed }, { hipsDrop: 0.02 }),
  p("Walk & Run", "Sprint", { ...L("Arm", [60, 0, -70]), ...L("ForeArm", [0, -100, 0]), ...R("Arm", [-70, 0, -70]), ...R("ForeArm", [0, -90, 0]), ...L("UpLeg", [-75, 0, 0]), ...L("Leg", [90, 0, 0]), ...R("UpLeg", [25, 0, 0]), ...R("Leg", [40, 0, 0]), Spine: [15, 0, 0], Spine1: [8, -6, 0], Head: [-15, 0, 0], ...fists }, { hipsDrop: 0.08 }),
  p("Walk & Run", "Naruto Run", { ...sym({ Arm: [70, 0, -60], ForeArm: [0, 0, 0] }), ...L("UpLeg", [-60, 0, 0]), ...L("Leg", [80, 0, 0]), ...R("UpLeg", [20, 0, 0]), ...R("Leg", [50, 0, 0]), Spine: [30, 0, 0], Spine1: [15, 0, 0], Head: [-40, 0, 0] }, { hipsDrop: 0.15 }),
  p("Walk & Run", "Jump", { ...sym({ Arm: [0, 0, 40], ForeArm: [0, 0, 20] }), ...L("UpLeg", [-70, 0, 0]), ...L("Leg", [110, 0, 0]), ...R("UpLeg", [-20, 0, 0]), ...R("Leg", [70, 0, 0]), Spine: [-10, 0, 0], Head: [-10, 0, 0], ...hand("Left", {}), ...hand("Right", {}) }, { hipsDrop: -0.3 }),
  p("Walk & Run", "Landing", { ...sym({ Arm: [-30, 0, -30], ForeArm: [0, -20, 0], UpLeg: [-80, 0, 10], Leg: [110, 0, 0], Foot: [-30, 0, 0] }), Spine: [35, 0, 0], Head: [-30, 0, 0] }, { hipsDrop: 0.5 }),

  // ── Fighting
  p("Fighting", "Boxing Guard", { ...sym({ Arm: [-30, 0, -70], ForeArm: [0, -140, 0], UpLeg: [0, 0, 8], Leg: [15, 0, 0] }), ...L("UpLeg", [-15, 0, 8]), Hips: [0, 25, 0], Spine1: [10, -15, 0], Head: [10, -10, 0], ...fists }, { hipsDrop: 0.05 }),
  p("Fighting", "Straight Punch", { ...L("Arm", [-85, 0, -88]), ...L("ForeArm", [0, -5, 0]), ...R("Arm", [-30, 0, -70]), ...R("ForeArm", [0, -140, 0]), Hips: [0, -20, 0], Spine1: [10, -20, 0], ...L("UpLeg", [-20, 0, 6]), ...L("Leg", [20, 0, 0]), ...R("UpLeg", [20, 0, 6]), ...fists }, { hipsDrop: 0.06 }),
  p("Fighting", "Uppercut", { ...R("Arm", [-60, 0, -40]), ...R("ForeArm", [0, -110, 0]), ...L("Arm", [-30, 0, -70]), ...L("ForeArm", [0, -140, 0]), Hips: [0, 25, 0], Spine: [-10, 15, 0], Spine1: [-5, 10, 0], ...sym({ UpLeg: [-15, 0, 8], Leg: [30, 0, 0] }), ...fists }, { hipsDrop: 0.1 }),
  p("Fighting", "High Kick", { ...L("UpLeg", [-100, 0, 30]), ...L("Leg", [5, 0, 0]), ...R("UpLeg", [10, 0, 0]), ...sym({ Arm: [-20, 0, -40], ForeArm: [0, -100, 0] }), Spine: [-15, 0, -15], Head: [10, 0, 10], ...fists }),
  p("Fighting", "Side Kick", { ...L("UpLeg", [0, 0, 80]), ...L("Leg", [5, 0, 0]), ...R("UpLeg", [0, 0, 10]), Spine: [0, 0, -35], Spine1: [0, 0, -10], Head: [0, 0, 30], ...sym({ Arm: [-30, 0, -50], ForeArm: [0, -120, 0] }), ...fists }),
  p("Fighting", "Karate Stance", { ...L("Arm", [-80, 0, -85]), ...L("ForeArm", [0, 0, 0]), ...R("Arm", [0, 0, -60]), ...R("ForeArm", [0, -120, 0]), ...L("UpLeg", [-35, 0, 15]), ...L("Leg", [40, 0, 0]), ...R("UpLeg", [25, 0, 15]), Hips: [0, -15, 0], ...hand("Left", { Index: 5, Middle: 5, Ring: 5, Pinky: 5 }), ...hand("Right", FIST, [0, 30, -40]) }, { hipsDrop: 0.15 }),
  p("Fighting", "Sword Ready", { ...sym({ Arm: [-60, 0, -60], ForeArm: [0, -60, 0] }), ...L("Arm", [-55, 0, -80]), ...sym({ UpLeg: [0, 0, 12], Leg: [25, 0, 0] }), ...L("UpLeg", [-25, 0, 12]), Hips: [0, 20, 0], Spine1: [5, -20, 0], ...fists }, { hipsDrop: 0.1 }),
  p("Fighting", "Block", { ...sym({ Arm: [-80, 0, -50], ForeArm: [0, -130, 0] }), Spine: [10, 0, 0], Head: [20, 0, 0], ...sym({ UpLeg: [-10, 0, 8], Leg: [20, 0, 0] }), ...fists }, { hipsDrop: 0.05 }),
  p("Fighting", "Energy Blast", { ...sym({ Arm: [-85, 0, -80], ForeArm: [0, -10, 0], Hand: [0, 0, 70] }), ...L("UpLeg", [-30, 0, 15]), ...L("Leg", [35, 0, 0]), ...R("UpLeg", [25, 0, 15]), Spine: [10, 0, 0], ...hand("Left", { Index: 10, Middle: 10, Ring: 15, Pinky: 15 }), ...hand("Right", { Index: 10, Middle: 10, Ring: 15, Pinky: 15 }) }, { hipsDrop: 0.15 }),

  // ── Sitting & Kneeling
  p("Sitting", "Chair Sit", { ...sym({ UpLeg: [-88, 0, 4], Leg: [88, 0, 0], Arm: [-30, 0, -75], ForeArm: [0, -40, 0] }), ...relaxed }, { hipsDrop: 0.42 }),
  p("Sitting", "Cross-legged", { ...sym({ UpLeg: [-80, -45, 40], Leg: [140, 0, 0], Arm: [-20, 0, -78], ForeArm: [0, -50, 0] }), Spine: [10, 0, 0], ...relaxed }, { hipsDrop: 0.8 }),
  p("Sitting", "Seiza", { ...sym({ UpLeg: [-90, 0, 0], Leg: [160, 0, 0], Foot: [40, 0, 0], Arm: [-25, 0, -78], ForeArm: [0, -55, 0] }), ...relaxed }, { hipsDrop: 0.75 }),
  p("Sitting", "One Knee Down", { ...L("UpLeg", [-90, 0, 0]), ...L("Leg", [90, 0, 0]), ...R("UpLeg", [5, 0, 0]), ...R("Leg", [95, 0, 0]), ...R("Foot", [40, 0, 0]), ...L("Arm", [-40, 0, -75]), ...L("ForeArm", [0, -60, 0]), ...R("Arm", [0, 0, -78]), Spine: [10, 0, 0], ...relaxed }, { hipsDrop: 0.45 }),
  p("Sitting", "Hugging Knees", { ...sym({ UpLeg: [-120, 0, 5], Leg: [150, 0, 0], Arm: [-60, 0, -70], ForeArm: [0, -60, 0] }), Spine: [25, 0, 0], Spine1: [15, 0, 0], Head: [20, 0, 0], ...relaxed }, { hipsDrop: 0.8 }),
  p("Sitting", "Superhero Landing", { ...L("UpLeg", [-100, 0, 20]), ...L("Leg", [130, 0, 0]), ...R("UpLeg", [10, 0, 25]), ...R("Leg", [110, 0, 0]), ...R("Arm", [-60, 0, -85]), ...R("ForeArm", [0, -5, 0]), ...L("Arm", [20, 0, -40]), Spine: [40, 0, 0], Head: [-40, 0, 0], ...hand("Right", {}), ...hand("Left", FIST, [0, 30, -40]) }, { hipsDrop: 0.75 }),

  // ── Dramatic Manga
  p("Dramatic", "JoJo Stand", { Hips: [0, 30, 15], Spine: [-10, -20, -10], Spine1: [0, -15, -10], Head: [10, 30, 15], ...L("Arm", [-80, 0, -10]), ...L("ForeArm", [0, -130, 0]), ...L("Hand", [0, 0, 40]), ...R("Arm", [-30, 0, -50]), ...R("ForeArm", [0, -100, 0]), ...L("UpLeg", [-15, 0, 0]), ...L("Leg", [25, 0, 0]), ...hand("Left", { Index: 0, Middle: 40, Ring: 70, Pinky: 80 }), ...relaxed }),
  p("Dramatic", "Pointing Accusation", { ...L("Arm", [-80, 0, -90]), ...L("ForeArm", [0, 0, 0]), ...hand("Left", { Index: 0, Middle: 90, Ring: 90, Pinky: 90 }, [0, 30, -40]), ...R("Arm", [0, 0, -75]), Spine1: [-5, 20, 0], Head: [0, 20, 0], ...L("UpLeg", [-25, 0, 0]), ...L("Leg", [20, 0, 0]) }),
  p("Dramatic", "Victory Fist", { ...L("Arm", [0, 0, 70]), ...L("ForeArm", [0, -20, 0]), ...R("Arm", [0, 0, -75]), Spine: [-10, 0, 0], Head: [-25, 0, 0], ...fists }),
  p("Dramatic", "Despair (Kneel)", { ...sym({ UpLeg: [-5, 0, 0], Leg: [95, 0, 0], Foot: [40, 0, 0], Arm: [-70, 0, -80], ForeArm: [0, -10, 0] }), Spine: [40, 0, 0], Spine1: [20, 0, 0], Head: [30, 0, 0], ...relaxed }, { hipsDrop: 0.45 }),
  p("Dramatic", "Glasses Push", { ...armsDown, ...L("Arm", [-60, 0, -50]), ...L("ForeArm", [0, -150, 0]), ...hand("Left", { Index: 0, Middle: 0, Ring: 80, Pinky: 80 }), Head: [15, 0, 0], ...relaxed }),
  p("Dramatic", "Back Turn Glance", { ...armsDown, ...relaxed, Hips: [0, 160, 0], Spine1: [0, 20, 0], Neck: [0, 20, 0], Head: [0, 30, 0] }),
  p("Dramatic", "Hero Pose", { ...sym({ Arm: [0, 0, -50], ForeArm: [0, -110, 0], Hand: [0, 0, 20], UpLeg: [0, 0, 12] }), Spine2: [-8, 0, 0], Head: [-10, 15, 0], ...fists }),
  p("Dramatic", "Thinking", { ...R("Arm", [-40, 0, -70]), ...R("ForeArm", [0, -100, 0]), ...L("Arm", [-70, 0, -60]), ...L("ForeArm", [0, -150, 0]), ...hand("Left", { Index: 30, Middle: 70, Ring: 80, Pinky: 80 }), Head: [10, 0, 10], Spine1: [5, 0, 0], ...hand("Right", RELAX) }),

  // ── Emotions
  p("Emotions", "Shy", { ...sym({ Arm: [-30, 0, -80], ForeArm: [0, -40, 0] }), Spine: [5, 0, 0], Head: [25, -15, 10], ...sym({ UpLeg: [0, 0, -5] }), ...L("Leg", [15, 0, 0]), ...relaxed }),
  p("Emotions", "Angry", { ...sym({ Arm: [10, 0, -70], ForeArm: [0, -30, 0] }), Spine: [10, 0, 0], Head: [10, 0, 0], ...sym({ UpLeg: [0, 0, 10] }), ...fists }),
  p("Emotions", "Surprised", { ...sym({ Arm: [-50, 0, -30], ForeArm: [0, -70, 0] }), Spine: [-10, 0, 0], Head: [-10, 0, 0], ...hand("Left", {}), ...hand("Right", {}) }),
  p("Emotions", "Facepalm", { ...L("Arm", [-70, 0, -50]), ...L("ForeArm", [0, -150, 0]), ...R("Arm", [0, 0, -75]), Head: [25, 0, 0], Spine: [10, 0, 0], ...relaxed }),
  p("Emotions", "Exhausted", { ...sym({ Arm: [-15, 0, -88], ForeArm: [0, -5, 0], UpLeg: [-20, 0, 5], Leg: [30, 0, 0] }), Spine: [30, 0, 0], Spine1: [15, 0, 0], Head: [30, 0, 0], ...relaxed }, { hipsDrop: 0.12 }),
  p("Emotions", "Cheering", { ...sym({ Arm: [0, 0, 60], ForeArm: [0, 0, 15] }), Head: [-20, 0, 0], ...fists }),

  // ── Hand gestures (merge onto current pose)
  ...(
    [
      ["Fist", FIST, [0, 30, -40]],
      ["Open Hand", {}, [0, 0, 0]],
      ["Relaxed Hand", RELAX, [0, 10, -10]],
      ["Point", { Index: 0, Middle: 90, Ring: 90, Pinky: 90 }, [0, 30, -40]],
      ["Peace", { Index: 0, Middle: 0, Ring: 90, Pinky: 90 }, [0, 30, -40]],
      ["Thumbs Up", FIST, [0, -20, 20]],
      ["OK Sign", { Index: 55, Middle: 5, Ring: 10, Pinky: 15 }, [0, 30, -30]],
      ["Rock On", { Index: 0, Middle: 90, Ring: 90, Pinky: 0 }, [0, 30, -40]],
      ["Claw", { Index: 50, Middle: 50, Ring: 50, Pinky: 50 }, [0, 20, -20]],
    ] as [string, Record<string, number>, Rot][]
  ).flatMap(([name, curl, thumb]) => [
    p("Hands", `${name} (Both)`, { ...hand("Left", curl, thumb), ...hand("Right", curl, thumb) }, { partial: true }),
    p("Hands", `${name} (Left)`, hand("Left", curl, thumb), { partial: true }),
    p("Hands", `${name} (Right)`, hand("Right", curl, thumb), { partial: true }),
  ]),
];

export const CATEGORIES = Array.from(new Set(POSES.map((x) => x.category)));

import * as THREE from "three";

export type PropCategory = "weapons" | "items" | "furniture" | "primitives";

export interface PropTransform {
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles in degrees
  scale: [number, number, number];
}

export interface PropDefinition {
  id: string;
  name: string;
  category: PropCategory;
  defaultBone: string;
  defaultTransform: PropTransform;
  icon: string;
  buildMesh: () => THREE.Object3D;
}

export interface ActiveProp {
  id: string;
  propDefId: string;
  name: string;
  attachedBone: string; // "RightHand", "LeftHand", "Head", "Spine", "None", etc.
  transform: PropTransform;
  visible: boolean;
}

export const ATTACHABLE_BONES = [
  { id: "None", label: "World (Free Standing)" },
  { id: "RightHand", label: "Right Hand (Weapon / Tool / Mug)" },
  { id: "LeftHand", label: "Left Hand (Bag / Book / Shield)" },
  { id: "Head", label: "Head (Hat / Glasses / Mask)" },
  { id: "Spine", label: "Spine / Back (Backpack / Scabbard)" },
  { id: "Hips", label: "Hips / Waist (Holster / Belt)" },
  { id: "RightFoot", label: "Right Foot" },
  { id: "LeftFoot", label: "Left Foot" },
];

/** Standard materials with cel/manga ink styling */
function createMangaMaterial(colorHex: number, roughness = 0.5): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness,
    metalness: 0.1,
  });
}

// ==========================================
// PROCEDURAL MESH BUILDERS
// ==========================================

function buildKatanaMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Katana";

  const bladeMat = createMangaMaterial(0xe8ecf0, 0.2); // Steel
  const handleMat = createMangaMaterial(0x18181b, 0.8); // Black wrap
  const goldMat = createMangaMaterial(0xca8a04, 0.3); // Gold brass

  // Blade (curved slightly using a series or extruded shape)
  const bladeGeo = new THREE.BoxGeometry(0.015, 0.72, 0.035);
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.y = 0.36;
  blade.castShadow = true;
  group.add(blade);

  // Tip taper
  const tipGeo = new THREE.ConeGeometry(0.02, 0.1, 4);
  const tip = new THREE.Mesh(tipGeo, bladeMat);
  tip.position.y = 0.76;
  tip.rotation.y = Math.PI / 4;
  tip.scale.set(0.7, 1, 1.6);
  tip.castShadow = true;
  group.add(tip);

  // Tsuba (Circular Handguard)
  const tsubaGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.008, 16);
  const tsuba = new THREE.Mesh(tsubaGeo, goldMat);
  tsuba.position.y = 0.004;
  tsuba.castShadow = true;
  group.add(tsuba);

  // Tsuka (Handle / Grip)
  const handleGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.24, 12);
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.y = -0.12;
  handle.castShadow = true;
  group.add(handle);

  // Kashira (Pommel Cap)
  const kashiraGeo = new THREE.CylinderGeometry(0.02, 0.018, 0.02, 12);
  const kashira = new THREE.Mesh(kashiraGeo, goldMat);
  kashira.position.y = -0.245;
  kashira.castShadow = true;
  group.add(kashira);

  return group;
}

function buildSwordMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Broadsword";

  const steelMat = createMangaMaterial(0xd4d4d8, 0.2);
  const guardMat = createMangaMaterial(0x52525b, 0.4);
  const gripMat = createMangaMaterial(0x713f12, 0.7);

  // Blade
  const bladeGeo = new THREE.BoxGeometry(0.02, 0.8, 0.06);
  const blade = new THREE.Mesh(bladeGeo, steelMat);
  blade.position.y = 0.4;
  blade.castShadow = true;
  group.add(blade);

  // Crossguard
  const guardGeo = new THREE.BoxGeometry(0.03, 0.03, 0.24);
  const guard = new THREE.Mesh(guardGeo, guardMat);
  guard.position.y = 0.015;
  guard.castShadow = true;
  group.add(guard);

  // Grip
  const gripGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.2, 10);
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.position.y = -0.1;
  grip.castShadow = true;
  group.add(grip);

  // Pommel
  const pommelGeo = new THREE.SphereGeometry(0.03, 12, 12);
  const pommel = new THREE.Mesh(pommelGeo, guardMat);
  pommel.position.y = -0.22;
  pommel.castShadow = true;
  group.add(pommel);

  return group;
}

function buildPistolMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Handgun";

  const slideMat = createMangaMaterial(0x27272a, 0.3);
  const gripMat = createMangaMaterial(0x18181b, 0.8);

  // Slide & Barrel
  const slideGeo = new THREE.BoxGeometry(0.03, 0.04, 0.2);
  const slide = new THREE.Mesh(slideGeo, slideMat);
  slide.position.set(0, 0.04, 0.04);
  slide.castShadow = true;
  group.add(slide);

  // Grip
  const gripGeo = new THREE.BoxGeometry(0.028, 0.12, 0.045);
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.position.set(0, -0.04, -0.04);
  grip.rotation.x = 0.22;
  grip.castShadow = true;
  group.add(grip);

  // Trigger guard
  const guardGeo = new THREE.TorusGeometry(0.02, 0.005, 8, 12, Math.PI);
  const triggerGuard = new THREE.Mesh(guardGeo, slideMat);
  triggerGuard.position.set(0, 0, 0);
  triggerGuard.rotation.y = Math.PI / 2;
  group.add(triggerGuard);

  return group;
}

function buildSmartphoneMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Smartphone";

  const caseMat = createMangaMaterial(0x1e293b, 0.3);
  const screenMat = createMangaMaterial(0xf8fafc, 0.1);

  // Phone body
  const bodyGeo = new THREE.BoxGeometry(0.01, 0.15, 0.075);
  const body = new THREE.Mesh(bodyGeo, caseMat);
  body.castShadow = true;
  group.add(body);

  // Screen face
  const screenGeo = new THREE.PlaneGeometry(0.07, 0.14);
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.x = 0.0052;
  screen.rotation.y = Math.PI / 2;
  group.add(screen);

  return group;
}

function buildMagicWandMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "MagicWand";

  const shaftMat = createMangaMaterial(0x78350f, 0.6);
  const crystalMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x38bdf8),
    roughness: 0.1,
    metalness: 0.2,
    emissive: new THREE.Color(0x0284c7),
    emissiveIntensity: 0.4,
  });

  // Shaft
  const shaftGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.7, 12);
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = 0.35;
  shaft.castShadow = true;
  group.add(shaft);

  // Crystal Tip
  const crystalGeo = new THREE.OctahedronGeometry(0.06, 0);
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  crystal.position.y = 0.74;
  crystal.castShadow = true;
  group.add(crystal);

  return group;
}

function buildSchoolBagMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "SchoolBag";

  const leatherMat = createMangaMaterial(0x1c1917, 0.7);
  const metalMat = createMangaMaterial(0xd4d4d8, 0.3);

  // Bag Body
  const bodyGeo = new THREE.BoxGeometry(0.12, 0.28, 0.38);
  const body = new THREE.Mesh(bodyGeo, leatherMat);
  body.castShadow = true;
  group.add(body);

  // Handle
  const handleGeo = new THREE.TorusGeometry(0.08, 0.012, 8, 16, Math.PI);
  const handle = new THREE.Mesh(handleGeo, leatherMat);
  handle.position.y = 0.14;
  handle.rotation.x = Math.PI;
  handle.castShadow = true;
  group.add(handle);

  // Silver Buckles
  const buckleGeo = new THREE.BoxGeometry(0.01, 0.03, 0.04);
  const b1 = new THREE.Mesh(buckleGeo, metalMat);
  b1.position.set(0.062, -0.04, -0.1);
  group.add(b1);
  const b2 = b1.clone();
  b2.position.set(0.062, -0.04, 0.1);
  group.add(b2);

  return group;
}

function buildBookMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Book";

  const coverMat = createMangaMaterial(0x991b1b, 0.6); // Crimson cover
  const pagesMat = createMangaMaterial(0xfef3c7, 0.9); // Ivory pages

  // Pages core
  const pagesGeo = new THREE.BoxGeometry(0.18, 0.04, 0.24);
  const pages = new THREE.Mesh(pagesGeo, pagesMat);
  pages.castShadow = true;
  group.add(pages);

  // Cover
  const coverGeo = new THREE.BoxGeometry(0.185, 0.046, 0.245);
  const cover = new THREE.Mesh(coverGeo, coverMat);
  cover.position.x = -0.005;
  cover.castShadow = true;
  group.add(cover);

  return group;
}

function buildCoffeeMugMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "CoffeeMug";

  const ceramicMat = createMangaMaterial(0xfafafa, 0.3);

  // Cup body
  const cupGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.1, 16, 1, true);
  const cup = new THREE.Mesh(cupGeo, ceramicMat);
  cup.castShadow = true;
  group.add(cup);

  // Cup bottom
  const bottomGeo = new THREE.CircleGeometry(0.04, 16);
  const bottom = new THREE.Mesh(bottomGeo, ceramicMat);
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -0.05;
  group.add(bottom);

  // Handle
  const handleGeo = new THREE.TorusGeometry(0.03, 0.008, 8, 16, Math.PI * 1.2);
  const handle = new THREE.Mesh(handleGeo, ceramicMat);
  handle.position.set(0.048, 0, 0);
  handle.rotation.z = -Math.PI / 2;
  handle.castShadow = true;
  group.add(handle);

  return group;
}

function buildClassroomDeskMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "ClassroomDesk";

  const woodMat = createMangaMaterial(0xb45309, 0.7);
  const pipeMat = createMangaMaterial(0x3f3f46, 0.4);

  // Table top
  const topGeo = new THREE.BoxGeometry(0.65, 0.03, 0.45);
  const top = new THREE.Mesh(topGeo, woodMat);
  top.position.y = 0.74;
  top.castShadow = true;
  group.add(top);

  // 4 Legs
  const legGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.73, 8);
  const positions: [number, number][] = [
    [-0.28, -0.18],
    [0.28, -0.18],
    [-0.28, 0.18],
    [0.28, 0.18],
  ];
  positions.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, pipeMat);
    leg.position.set(x, 0.365, z);
    leg.castShadow = true;
    group.add(leg);
  });

  return group;
}

function buildChairMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = "Chair";

  const woodMat = createMangaMaterial(0x92400e, 0.7);
  const pipeMat = createMangaMaterial(0x3f3f46, 0.4);

  // Seat
  const seatGeo = new THREE.BoxGeometry(0.4, 0.025, 0.38);
  const seat = new THREE.Mesh(seatGeo, woodMat);
  seat.position.y = 0.44;
  seat.castShadow = true;
  group.add(seat);

  // Backrest
  const backGeo = new THREE.BoxGeometry(0.38, 0.18, 0.02);
  const back = new THREE.Mesh(backGeo, woodMat);
  back.position.set(0, 0.78, -0.18);
  back.castShadow = true;
  group.add(back);

  // Legs & Back supports
  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.43, 8);
  const legPos: [number, number][] = [
    [-0.17, -0.16],
    [0.17, -0.16],
    [-0.17, 0.16],
    [0.17, 0.16],
  ];
  legPos.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, pipeMat);
    leg.position.set(x, 0.215, z);
    leg.castShadow = true;
    group.add(leg);
  });

  // Back support poles
  const poleGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.4, 8);
  [-0.15, 0.15].forEach((x) => {
    const pole = new THREE.Mesh(poleGeo, pipeMat);
    pole.position.set(x, 0.64, -0.18);
    pole.castShadow = true;
    group.add(pole);
  });

  return group;
}

function buildPrimitiveMesh(type: "cube" | "cylinder" | "sphere"): THREE.Group {
  const group = new THREE.Group();
  const mat = createMangaMaterial(0x94a3b8, 0.5);

  let geo: THREE.BufferGeometry;
  if (type === "cube") geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  else if (type === "cylinder") geo = new THREE.CylinderGeometry(0.2, 0.2, 0.5, 16);
  else geo = new THREE.SphereGeometry(0.25, 16, 16);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.y = type === "cylinder" ? 0.25 : type === "cube" ? 0.2 : 0.25;
  group.add(mesh);
  return group;
}

// ==========================================
// CATALOG REGISTRY
// ==========================================

export const BUILTIN_PROPS: PropDefinition[] = [
  {
    id: "katana",
    name: "Katana",
    category: "weapons",
    defaultBone: "RightHand",
    defaultTransform: {
      position: [0, 0, 0],
      rotation: [90, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "🗡️",
    buildMesh: buildKatanaMesh,
  },
  {
    id: "broadsword",
    name: "Knight Sword",
    category: "weapons",
    defaultBone: "RightHand",
    defaultTransform: {
      position: [0, 0, 0],
      rotation: [90, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "⚔️",
    buildMesh: buildSwordMesh,
  },
  {
    id: "handgun",
    name: "Handgun",
    category: "weapons",
    defaultBone: "RightHand",
    defaultTransform: {
      position: [0, -0.02, 0.05],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "🔫",
    buildMesh: buildPistolMesh,
  },
  {
    id: "magic_wand",
    name: "Magic Staff",
    category: "weapons",
    defaultBone: "RightHand",
    defaultTransform: {
      position: [0, -0.2, 0],
      rotation: [90, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "🪄",
    buildMesh: buildMagicWandMesh,
  },
  {
    id: "smartphone",
    name: "Smartphone",
    category: "items",
    defaultBone: "RightHand",
    defaultTransform: {
      position: [0, 0, 0.02],
      rotation: [0, 90, 0],
      scale: [1, 1, 1],
    },
    icon: "📱",
    buildMesh: buildSmartphoneMesh,
  },
  {
    id: "school_bag",
    name: "School Bag",
    category: "items",
    defaultBone: "LeftHand",
    defaultTransform: {
      position: [0, -0.2, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "🎒",
    buildMesh: buildSchoolBagMesh,
  },
  {
    id: "book",
    name: "Grimoire / Book",
    category: "items",
    defaultBone: "LeftHand",
    defaultTransform: {
      position: [0, 0, 0.05],
      rotation: [0, 0, 45],
      scale: [1, 1, 1],
    },
    icon: "📖",
    buildMesh: buildBookMesh,
  },
  {
    id: "coffee_mug",
    name: "Coffee Mug",
    category: "items",
    defaultBone: "RightHand",
    defaultTransform: {
      position: [0, 0, 0.02],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "☕",
    buildMesh: buildCoffeeMugMesh,
  },
  {
    id: "classroom_desk",
    name: "Classroom Desk",
    category: "furniture",
    defaultBone: "None",
    defaultTransform: {
      position: [0, 0, 0.6],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "🏫",
    buildMesh: buildClassroomDeskMesh,
  },
  {
    id: "chair",
    name: "Chair",
    category: "furniture",
    defaultBone: "None",
    defaultTransform: {
      position: [0, 0, 0.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "🪑",
    buildMesh: buildChairMesh,
  },
  {
    id: "primitive_cube",
    name: "3D Block",
    category: "primitives",
    defaultBone: "None",
    defaultTransform: {
      position: [0.8, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "📦",
    buildMesh: () => buildPrimitiveMesh("cube"),
  },
  {
    id: "primitive_cylinder",
    name: "3D Cylinder",
    category: "primitives",
    defaultBone: "None",
    defaultTransform: {
      position: [-0.8, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "🥫",
    buildMesh: () => buildPrimitiveMesh("cylinder"),
  },
  {
    id: "primitive_sphere",
    name: "3D Sphere",
    category: "primitives",
    defaultBone: "None",
    defaultTransform: {
      position: [0, 0, 1.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    icon: "⚪",
    buildMesh: () => buildPrimitiveMesh("sphere"),
  },
];

export function getPropById(id: string): PropDefinition | undefined {
  return BUILTIN_PROPS.find((p) => p.id === id);
}

export function createActiveProp(propDefId: string, customName?: string): ActiveProp {
  const def = getPropById(propDefId);
  const now = Date.now();
  return {
    id: `prop-${now}-${Math.random().toString(36).slice(2, 6)}`,
    propDefId,
    name: customName || def?.name || "Prop",
    attachedBone: def?.defaultBone || "None",
    transform: {
      position: [...(def?.defaultTransform.position || [0, 0, 0])],
      rotation: [...(def?.defaultTransform.rotation || [0, 0, 0])],
      scale: [...(def?.defaultTransform.scale || [1, 1, 1])],
    },
    visible: true,
  };
}


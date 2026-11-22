export const SCENE2D_W = 1280;
export const SCENE2D_H = 800;

export type SceneRenderMode2D = "color" | "manga";
export type SceneLighting2D = "day" | "sunset" | "night" | "dramatic";
export type SceneDepthLayer = "background" | "midground" | "foreground";

export type SceneBackdropId =
  | "bedroom"
  | "classroom"
  | "living_room"
  | "hallway"
  | "cafe"
  | "rooftop"
  | "city_street"
  | "alleyway"
  | "park_path"
  | "forest_clearing"
  | "beach_cliff"
  | "blank";

export interface SceneBackdropDef {
  id: SceneBackdropId;
  name: string;
  environment: "indoor" | "outdoor" | "minimal";
  defaultWallColor: string;
  defaultFloorColor: string;
  defaultSkyColor: string;
  defaultAccentColor: string;
}

export const SCENE_BACKDROPS: SceneBackdropDef[] = [
  {
    id: "bedroom",
    name: "Bedroom Interior",
    environment: "indoor",
    defaultWallColor: "#f3ead8",
    defaultFloorColor: "#c5986a",
    defaultSkyColor: "#93c5fd",
    defaultAccentColor: "#64748b",
  },
  {
    id: "classroom",
    name: "School Classroom",
    environment: "indoor",
    defaultWallColor: "#f1efe6",
    defaultFloorColor: "#d2a875",
    defaultSkyColor: "#7dd3fc",
    defaultAccentColor: "#2e5a44",
  },
  {
    id: "living_room",
    name: "Living Room",
    environment: "indoor",
    defaultWallColor: "#efe7dc",
    defaultFloorColor: "#b88b5b",
    defaultSkyColor: "#93c5fd",
    defaultAccentColor: "#475569",
  },
  {
    id: "hallway",
    name: "School / Building Hallway",
    environment: "indoor",
    defaultWallColor: "#e6ebe6",
    defaultFloorColor: "#cbd5e1",
    defaultSkyColor: "#bae6fd",
    defaultAccentColor: "#5b7083",
  },
  {
    id: "cafe",
    name: "Neighborhood Café",
    environment: "indoor",
    defaultWallColor: "#ead8c3",
    defaultFloorColor: "#8c5b3e",
    defaultSkyColor: "#bae6fd",
    defaultAccentColor: "#7c2d12",
  },
  {
    id: "rooftop",
    name: "School Rooftop",
    environment: "outdoor",
    defaultWallColor: "#cbd5e1",
    defaultFloorColor: "#94a3b8",
    defaultSkyColor: "#60a5fa",
    defaultAccentColor: "#475569",
  },
  {
    id: "city_street",
    name: "Downtown Street",
    environment: "outdoor",
    defaultWallColor: "#d6dde6",
    defaultFloorColor: "#64748b",
    defaultSkyColor: "#7dd3fc",
    defaultAccentColor: "#334155",
  },
  {
    id: "alleyway",
    name: "Back Alley",
    environment: "outdoor",
    defaultWallColor: "#6b7280",
    defaultFloorColor: "#3f4654",
    defaultSkyColor: "#1e293b",
    defaultAccentColor: "#dc2626",
  },
  {
    id: "park_path",
    name: "Park Walkway",
    environment: "outdoor",
    defaultWallColor: "#a7f3d0",
    defaultFloorColor: "#d6c3a3",
    defaultSkyColor: "#60a5fa",
    defaultAccentColor: "#15803d",
  },
  {
    id: "forest_clearing",
    name: "Forest Clearing",
    environment: "outdoor",
    defaultWallColor: "#3f6212",
    defaultFloorColor: "#65833d",
    defaultSkyColor: "#7dd3fc",
    defaultAccentColor: "#78350f",
  },
  {
    id: "beach_cliff",
    name: "Coastline / Beach",
    environment: "outdoor",
    defaultWallColor: "#0ea5e9",
    defaultFloorColor: "#f3d8a3",
    defaultSkyColor: "#38bdf8",
    defaultAccentColor: "#0369a1",
  },
  {
    id: "blank",
    name: "Blank / Freehand",
    environment: "minimal",
    defaultWallColor: "#ffffff",
    defaultFloorColor: "#f8fafc",
    defaultSkyColor: "#ffffff",
    defaultAccentColor: "#1e293b",
  },
];

export type SceneObjectCategory =
  "furniture" | "architecture" | "nature" | "tech" | "urban" | "props" | "fx";

export const SCENE_OBJECT_CATEGORIES: { id: SceneObjectCategory; label: string }[] = [
  { id: "furniture", label: "Furniture" },
  { id: "architecture", label: "Architecture" },
  { id: "nature", label: "Nature" },
  { id: "tech", label: "Tech & Home" },
  { id: "urban", label: "Urban & School" },
  { id: "props", label: "Story Props" },
  { id: "fx", label: "FX & Drama" },
];

export interface BuiltinSceneObjectDef {
  id: string;
  name: string;
  category: SceneObjectCategory;
  defaultW: number;
  defaultH: number;
  defaultPrimary: string;
  defaultAccent: string;
  defaultDepth: SceneDepthLayer;
}

export const BUILTIN_SCENE_OBJECTS: BuiltinSceneObjectDef[] = [
  // Furniture (12)
  {
    id: "bed_single",
    name: "Single Bed",
    category: "furniture",
    defaultW: 360,
    defaultH: 190,
    defaultPrimary: "#3b82f6",
    defaultAccent: "#e2e8f0",
    defaultDepth: "midground",
  },
  {
    id: "bed_bunk",
    name: "Double / Cozy Bed",
    category: "furniture",
    defaultW: 410,
    defaultH: 210,
    defaultPrimary: "#6366f1",
    defaultAccent: "#f1f5f9",
    defaultDepth: "midground",
  },
  {
    id: "study_desk",
    name: "Study Desk",
    category: "furniture",
    defaultW: 280,
    defaultH: 170,
    defaultPrimary: "#b47846",
    defaultAccent: "#475569",
    defaultDepth: "midground",
  },
  {
    id: "school_desk",
    name: "School Desk + Chair",
    category: "furniture",
    defaultW: 175,
    defaultH: 175,
    defaultPrimary: "#c6925c",
    defaultAccent: "#64748b",
    defaultDepth: "midground",
  },
  {
    id: "office_chair",
    name: "Swivel Chair",
    category: "furniture",
    defaultW: 110,
    defaultH: 165,
    defaultPrimary: "#334155",
    defaultAccent: "#94a3b8",
    defaultDepth: "midground",
  },
  {
    id: "bookshelf",
    name: "Tall Bookshelf",
    category: "furniture",
    defaultW: 190,
    defaultH: 340,
    defaultPrimary: "#8b5a2b",
    defaultAccent: "#3b82f6",
    defaultDepth: "background",
  },
  {
    id: "sofa",
    name: "Living Sofa",
    category: "furniture",
    defaultW: 380,
    defaultH: 165,
    defaultPrimary: "#475569",
    defaultAccent: "#f59e0b",
    defaultDepth: "midground",
  },
  {
    id: "coffee_table",
    name: "Coffee Table",
    category: "furniture",
    defaultW: 240,
    defaultH: 105,
    defaultPrimary: "#a16207",
    defaultAccent: "#e2e8f0",
    defaultDepth: "foreground",
  },
  {
    id: "wardrobe",
    name: "Wardrobe Closet",
    category: "furniture",
    defaultW: 200,
    defaultH: 360,
    defaultPrimary: "#784c2a",
    defaultAccent: "#cbd5e1",
    defaultDepth: "background",
  },
  {
    id: "cafe_table",
    name: "Round Café Table",
    category: "furniture",
    defaultW: 190,
    defaultH: 170,
    defaultPrimary: "#9a6337",
    defaultAccent: "#334155",
    defaultDepth: "foreground",
  },
  {
    id: "cafe_chair",
    name: "Wooden Chair",
    category: "furniture",
    defaultW: 110,
    defaultH: 165,
    defaultPrimary: "#8c5228",
    defaultAccent: "#cbd5e1",
    defaultDepth: "midground",
  },
  {
    id: "floor_rug",
    name: "Woven Floor Rug",
    category: "furniture",
    defaultW: 380,
    defaultH: 95,
    defaultPrimary: "#991b1b",
    defaultAccent: "#fde68a",
    defaultDepth: "background",
  },

  // Architecture (10)
  {
    id: "window_day",
    name: "Curtained Window",
    category: "architecture",
    defaultW: 230,
    defaultH: 220,
    defaultPrimary: "#bae6fd",
    defaultAccent: "#f8fafc",
    defaultDepth: "background",
  },
  {
    id: "window_school",
    name: "Wide School Windows",
    category: "architecture",
    defaultW: 420,
    defaultH: 210,
    defaultPrimary: "#93c5fd",
    defaultAccent: "#cbd5e1",
    defaultDepth: "background",
  },
  {
    id: "wood_door",
    name: "Room Door",
    category: "architecture",
    defaultW: 155,
    defaultH: 355,
    defaultPrimary: "#9a6439",
    defaultAccent: "#eab308",
    defaultDepth: "background",
  },
  {
    id: "sliding_door",
    name: "Sliding Glass / Shoji",
    category: "architecture",
    defaultW: 290,
    defaultH: 340,
    defaultPrimary: "#f1f5f9",
    defaultAccent: "#78350f",
    defaultDepth: "background",
  },
  {
    id: "railing",
    name: "Safety Fence / Rail",
    category: "architecture",
    defaultW: 420,
    defaultH: 155,
    defaultPrimary: "#64748b",
    defaultAccent: "#94a3b8",
    defaultDepth: "foreground",
  },
  {
    id: "stairs_up",
    name: "Staircase Flight",
    category: "architecture",
    defaultW: 280,
    defaultH: 280,
    defaultPrimary: "#cbd5e1",
    defaultAccent: "#475569",
    defaultDepth: "background",
  },
  {
    id: "pillar",
    name: "Concrete Pillar",
    category: "architecture",
    defaultW: 100,
    defaultH: 520,
    defaultPrimary: "#94a3b8",
    defaultAccent: "#475569",
    defaultDepth: "foreground",
  },
  {
    id: "arch_gate",
    name: "School / Shrine Gate",
    category: "architecture",
    defaultW: 360,
    defaultH: 320,
    defaultPrimary: "#dc2626",
    defaultAccent: "#1e293b",
    defaultDepth: "background",
  },
  {
    id: "brick_wall",
    name: "Brick Half Wall",
    category: "architecture",
    defaultW: 400,
    defaultH: 190,
    defaultPrimary: "#b91c1c",
    defaultAccent: "#e2e8f0",
    defaultDepth: "background",
  },
  {
    id: "ceiling_lamp",
    name: "Pendant Lamp",
    category: "architecture",
    defaultW: 130,
    defaultH: 130,
    defaultPrimary: "#fef08a",
    defaultAccent: "#1e293b",
    defaultDepth: "foreground",
  },

  // Nature (9)
  {
    id: "tree_oak",
    name: "Lush Tree",
    category: "nature",
    defaultW: 280,
    defaultH: 390,
    defaultPrimary: "#16a34a",
    defaultAccent: "#78350f",
    defaultDepth: "midground",
  },
  {
    id: "tree_sakura",
    name: "Cherry Blossom Tree",
    category: "nature",
    defaultW: 300,
    defaultH: 390,
    defaultPrimary: "#f9a8d4",
    defaultAccent: "#713f12",
    defaultDepth: "midground",
  },
  {
    id: "bush_shrub",
    name: "Hedge Bush",
    category: "nature",
    defaultW: 220,
    defaultH: 130,
    defaultPrimary: "#22c55e",
    defaultAccent: "#15803d",
    defaultDepth: "midground",
  },
  {
    id: "potted_plant",
    name: "Potted Monstera",
    category: "nature",
    defaultW: 115,
    defaultH: 175,
    defaultPrimary: "#16a34a",
    defaultAccent: "#b45309",
    defaultDepth: "foreground",
  },
  {
    id: "boulder",
    name: "Jagged Rock / Boulder",
    category: "nature",
    defaultW: 190,
    defaultH: 120,
    defaultPrimary: "#64748b",
    defaultAccent: "#334155",
    defaultDepth: "midground",
  },
  {
    id: "fluffy_cloud",
    name: "Anime Cumulus Cloud",
    category: "nature",
    defaultW: 320,
    defaultH: 145,
    defaultPrimary: "#ffffff",
    defaultAccent: "#cbd5e1",
    defaultDepth: "background",
  },
  {
    id: "crescent_moon",
    name: "Full / Crescent Moon",
    category: "nature",
    defaultW: 135,
    defaultH: 135,
    defaultPrimary: "#fef9c3",
    defaultAccent: "#94a3b8",
    defaultDepth: "background",
  },
  {
    id: "sakura_petals",
    name: "Drifting Petals",
    category: "nature",
    defaultW: 300,
    defaultH: 200,
    defaultPrimary: "#fbcfe8",
    defaultAccent: "#f472b6",
    defaultDepth: "foreground",
  },
  {
    id: "tall_grass",
    name: "Meadow Grass Clump",
    category: "nature",
    defaultW: 240,
    defaultH: 115,
    defaultPrimary: "#22c55e",
    defaultAccent: "#14532d",
    defaultDepth: "foreground",
  },

  // Tech & Home (9)
  {
    id: "monitor_pc",
    name: "Desktop Monitor",
    category: "tech",
    defaultW: 145,
    defaultH: 115,
    defaultPrimary: "#1e293b",
    defaultAccent: "#38bdf8",
    defaultDepth: "foreground",
  },
  {
    id: "laptop",
    name: "Open Laptop",
    category: "tech",
    defaultW: 110,
    defaultH: 85,
    defaultPrimary: "#cbd5e1",
    defaultAccent: "#38bdf8",
    defaultDepth: "foreground",
  },
  {
    id: "flatscreen_tv",
    name: "Widescreen TV + Stand",
    category: "tech",
    defaultW: 300,
    defaultH: 205,
    defaultPrimary: "#0f172a",
    defaultAccent: "#78350f",
    defaultDepth: "midground",
  },
  {
    id: "desk_lamp",
    name: "Study Desk Lamp",
    category: "tech",
    defaultW: 85,
    defaultH: 115,
    defaultPrimary: "#f59e0b",
    defaultAccent: "#fef08a",
    defaultDepth: "foreground",
  },
  {
    id: "wall_clock",
    name: "Round Wall Clock",
    category: "tech",
    defaultW: 90,
    defaultH: 90,
    defaultPrimary: "#ffffff",
    defaultAccent: "#1e293b",
    defaultDepth: "background",
  },
  {
    id: "fridge",
    name: "Kitchen Refrigerator",
    category: "tech",
    defaultW: 145,
    defaultH: 315,
    defaultPrimary: "#e2e8f0",
    defaultAccent: "#94a3b8",
    defaultDepth: "midground",
  },
  {
    id: "arcade_cab",
    name: "Arcade Cabinet",
    category: "tech",
    defaultW: 140,
    defaultH: 295,
    defaultPrimary: "#2563eb",
    defaultAccent: "#facc15",
    defaultDepth: "midground",
  },
  {
    id: "ac_unit",
    name: "Wall AC Unit",
    category: "tech",
    defaultW: 210,
    defaultH: 75,
    defaultPrimary: "#f8fafc",
    defaultAccent: "#94a3b8",
    defaultDepth: "background",
  },
  {
    id: "speaker_tower",
    name: "Studio Speaker",
    category: "tech",
    defaultW: 90,
    defaultH: 155,
    defaultPrimary: "#1e293b",
    defaultAccent: "#64748b",
    defaultDepth: "midground",
  },

  // Urban & School (10)
  {
    id: "chalkboard",
    name: "Classroom Chalkboard",
    category: "urban",
    defaultW: 480,
    defaultH: 205,
    defaultPrimary: "#1e4631",
    defaultAccent: "#b47846",
    defaultDepth: "background",
  },
  {
    id: "lockers",
    name: "School Lockers Row",
    category: "urban",
    defaultW: 260,
    defaultH: 300,
    defaultPrimary: "#94a3b8",
    defaultAccent: "#475569",
    defaultDepth: "background",
  },
  {
    id: "vending_machine",
    name: "Vending Machine",
    category: "urban",
    defaultW: 165,
    defaultH: 315,
    defaultPrimary: "#dc2626",
    defaultAccent: "#e0f2fe",
    defaultDepth: "midground",
  },
  {
    id: "street_lamp",
    name: "Streetlight Pole",
    category: "urban",
    defaultW: 110,
    defaultH: 430,
    defaultPrimary: "#334155",
    defaultAccent: "#fef08a",
    defaultDepth: "midground",
  },
  {
    id: "power_pole",
    name: "Utility Pole + Wires",
    category: "urban",
    defaultW: 220,
    defaultH: 520,
    defaultPrimary: "#475569",
    defaultAccent: "#1e293b",
    defaultDepth: "background",
  },
  {
    id: "park_bench",
    name: "Park Bench",
    category: "urban",
    defaultW: 260,
    defaultH: 135,
    defaultPrimary: "#92400e",
    defaultAccent: "#1e293b",
    defaultDepth: "midground",
  },
  {
    id: "trash_bin",
    name: "Street Bin / Dumpster",
    category: "urban",
    defaultW: 145,
    defaultH: 135,
    defaultPrimary: "#15803d",
    defaultAccent: "#1e293b",
    defaultDepth: "midground",
  },
  {
    id: "traffic_cone",
    name: "Road Cone",
    category: "urban",
    defaultW: 75,
    defaultH: 100,
    defaultPrimary: "#f97316",
    defaultAccent: "#ffffff",
    defaultDepth: "foreground",
  },
  {
    id: "neon_sign",
    name: "Shop Vertical Sign",
    category: "urban",
    defaultW: 115,
    defaultH: 250,
    defaultPrimary: "#ef4444",
    defaultAccent: "#fef08a",
    defaultDepth: "midground",
  },
  {
    id: "sedan_car",
    name: "Parked City Car",
    category: "urban",
    defaultW: 410,
    defaultH: 175,
    defaultPrimary: "#334155",
    defaultAccent: "#bae6fd",
    defaultDepth: "midground",
  },

  // Story Props (8)
  {
    id: "manga_poster",
    name: "Wall Poster Frame",
    category: "props",
    defaultW: 115,
    defaultH: 155,
    defaultPrimary: "#ef4444",
    defaultAccent: "#1e293b",
    defaultDepth: "background",
  },
  {
    id: "pinboard",
    name: "Cork Notice Board",
    category: "props",
    defaultW: 210,
    defaultH: 145,
    defaultPrimary: "#c2854c",
    defaultAccent: "#fef08a",
    defaultDepth: "background",
  },
  {
    id: "book_stack",
    name: "Stack of Books",
    category: "props",
    defaultW: 95,
    defaultH: 80,
    defaultPrimary: "#2563eb",
    defaultAccent: "#dc2626",
    defaultDepth: "foreground",
  },
  {
    id: "coffee_mug",
    name: "Steaming Mug",
    category: "props",
    defaultW: 65,
    defaultH: 70,
    defaultPrimary: "#ffffff",
    defaultAccent: "#92400e",
    defaultDepth: "foreground",
  },
  {
    id: "school_bag",
    name: "Student Backpack",
    category: "props",
    defaultW: 100,
    defaultH: 120,
    defaultPrimary: "#1e293b",
    defaultAccent: "#94a3b8",
    defaultDepth: "foreground",
  },
  {
    id: "cardboard_box",
    name: "Cardboard Crate",
    category: "props",
    defaultW: 130,
    defaultH: 115,
    defaultPrimary: "#d49b63",
    defaultAccent: "#78350f",
    defaultDepth: "foreground",
  },
  {
    id: "katana_rack",
    name: "Katana Display Stand",
    category: "props",
    defaultW: 185,
    defaultH: 115,
    defaultPrimary: "#1e293b",
    defaultAccent: "#cbd5e1",
    defaultDepth: "foreground",
  },
  {
    id: "ramen_bowl",
    name: "Hot Ramen Bowl",
    category: "props",
    defaultW: 100,
    defaultH: 75,
    defaultPrimary: "#dc2626",
    defaultAccent: "#fef08a",
    defaultDepth: "foreground",
  },

  // FX & Drama (6)
  {
    id: "ground_crater",
    name: "Impact Crater",
    category: "fx",
    defaultW: 360,
    defaultH: 130,
    defaultPrimary: "#475569",
    defaultAccent: "#0f172a",
    defaultDepth: "midground",
  },
  {
    id: "rubble_pile",
    name: "Broken Rubble Pile",
    category: "fx",
    defaultW: 230,
    defaultH: 120,
    defaultPrimary: "#64748b",
    defaultAccent: "#334155",
    defaultDepth: "foreground",
  },
  {
    id: "flame_burst",
    name: "Roaring Flames",
    category: "fx",
    defaultW: 210,
    defaultH: 220,
    defaultPrimary: "#f97316",
    defaultAccent: "#fef08a",
    defaultDepth: "foreground",
  },
  {
    id: "smoke_plume",
    name: "Dust / Smoke Cloud",
    category: "fx",
    defaultW: 260,
    defaultH: 150,
    defaultPrimary: "#cbd5e1",
    defaultAccent: "#64748b",
    defaultDepth: "foreground",
  },
  {
    id: "magic_circle",
    name: "Summoning Rune Circle",
    category: "fx",
    defaultW: 280,
    defaultH: 145,
    defaultPrimary: "#60a5fa",
    defaultAccent: "#e0f2fe",
    defaultDepth: "midground",
  },
  {
    id: "spotlight_beam",
    name: "Dramatic Light Shaft",
    category: "fx",
    defaultW: 320,
    defaultH: 520,
    defaultPrimary: "#fef08a",
    defaultAccent: "#ffffff",
    defaultDepth: "foreground",
  },
];

export interface SceneObjectAsset2D {
  id: string;
  name: string;
  category: SceneObjectCategory;
  kind: "single" | "sheet";
  src: string; // idb:// or dataUrl
  width: number;
  height: number;
  createdAt: number;
}

export interface SceneObjectInstance2D {
  id: string;
  kind: "builtin" | "custom";
  assetId: string;
  name: string;
  depth: SceneDepthLayer;
  x: number; // center x in 1280x800
  y: number; // center y in 1280x800
  width: number;
  height: number;
  rotation: number; // degrees
  skewX: number; // -45..45 degrees
  skewY: number; // -45..45 degrees
  flipX: boolean;
  flipY: boolean;
  opacity: number; // 0..1
  primaryColor: string;
  accentColor: string;
  tintEnabled: boolean;
  shadow: boolean;
  locked: boolean;
  visible: boolean;
}

export type SceneDrawTool =
  "select" | "ink" | "marker" | "tone" | "erase" | "line" | "rect" | "ellipse" | "text";

export type SceneTonePattern = "dots-light" | "dots-med" | "dots-dark" | "hatch";

export interface SceneStroke2D {
  id: string;
  layer: "behind" | "front";
  tool: Exclude<SceneDrawTool, "select">;
  color: string;
  size: number;
  opacity: number;
  tonePattern?: SceneTonePattern;
  filled?: boolean;
  points: { x: number; y: number }[];
  text?: string;
  fontSize?: number;
  rotation?: number;
}

export interface ScenePerspectiveGuide {
  mode: "off" | "1pt" | "2pt";
  horizonY: number; // 0..800
  vp1X: number; // 0..1280
  vp2X: number; // 0..1280
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  aimLinesToVp: boolean;
}

export interface Scene2D {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  renderMode: SceneRenderMode2D;
  lighting: SceneLighting2D;
  backdropId: SceneBackdropId;
  wallColor: string;
  floorColor: string;
  skyColor: string;
  accentColor: string;
  objects: SceneObjectInstance2D[];
  strokes: SceneStroke2D[];
  guides: ScenePerspectiveGuide;
}

export interface SourceScene2DMetadata {
  sceneId: string;
  sceneName: string;
  renderMode: SceneRenderMode2D;
  snapshot?: Scene2D;
}

function makeBuiltinInstance(
  defId: string,
  x: number,
  y: number,
  overrides: Partial<SceneObjectInstance2D> = {},
): SceneObjectInstance2D {
  const def = BUILTIN_SCENE_OBJECTS.find((o) => o.id === defId) ?? BUILTIN_SCENE_OBJECTS[0]!;
  return {
    id: `sobj-${defId}-${Math.random().toString(36).slice(2, 7)}`,
    kind: "builtin",
    assetId: def.id,
    name: def.name,
    depth: overrides.depth ?? def.defaultDepth,
    x,
    y,
    width: overrides.width ?? def.defaultW,
    height: overrides.height ?? def.defaultH,
    rotation: overrides.rotation ?? 0,
    skewX: overrides.skewX ?? 0,
    skewY: overrides.skewY ?? 0,
    flipX: overrides.flipX ?? false,
    flipY: overrides.flipY ?? false,
    opacity: overrides.opacity ?? 1,
    primaryColor: overrides.primaryColor ?? def.defaultPrimary,
    accentColor: overrides.accentColor ?? def.defaultAccent,
    tintEnabled: false,
    shadow: overrides.shadow ?? true,
    locked: false,
    visible: true,
  };
}

export interface StarterSceneTemplate {
  id: string;
  name: string;
  description: string;
  backdropId: SceneBackdropId;
  lighting: SceneLighting2D;
  buildObjects: () => SceneObjectInstance2D[];
}

export const STARTER_SCENE_TEMPLATES: StarterSceneTemplate[] = [
  {
    id: "cozy-bedroom",
    name: "Hero's Bedroom",
    description: "Warm manga bedroom with bed, study desk, PC, window & bookshelf",
    backdropId: "bedroom",
    lighting: "day",
    buildObjects: () => [
      makeBuiltinInstance("floor_rug", 640, 680, { width: 480, height: 110 }),
      makeBuiltinInstance("window_day", 620, 250, { width: 280, height: 240 }),
      makeBuiltinInstance("bookshelf", 185, 360, { width: 195, height: 350 }),
      makeBuiltinInstance("manga_poster", 930, 215, { width: 120, height: 155 }),
      makeBuiltinInstance("wall_clock", 360, 145, { width: 82, height: 82 }),
      makeBuiltinInstance("bed_single", 295, 585, {
        width: 390,
        height: 210,
        primaryColor: "#2563eb",
      }),
      makeBuiltinInstance("study_desk", 970, 520, { width: 300, height: 185 }),
      makeBuiltinInstance("monitor_pc", 965, 385, { width: 145, height: 115 }),
      makeBuiltinInstance("desk_lamp", 1080, 395, { width: 82, height: 108 }),
      makeBuiltinInstance("office_chair", 865, 595, {
        width: 118,
        height: 175,
        depth: "foreground",
      }),
      makeBuiltinInstance("school_bag", 715, 635, { width: 105, height: 125, depth: "foreground" }),
    ],
  },
  {
    id: "sunlit-classroom",
    name: "Anime Classroom",
    description: "Iconic high school classroom with chalkboard, lockers & sunny desks",
    backdropId: "classroom",
    lighting: "day",
    buildObjects: () => [
      makeBuiltinInstance("window_school", 240, 235, { width: 410, height: 215 }),
      makeBuiltinInstance("chalkboard", 815, 255, { width: 490, height: 210 }),
      makeBuiltinInstance("wall_clock", 815, 108, { width: 78, height: 78 }),
      makeBuiltinInstance("lockers", 1150, 380, { width: 190, height: 270 }),
      makeBuiltinInstance("school_desk", 345, 595, { width: 185, height: 185 }),
      makeBuiltinInstance("school_desk", 635, 595, { width: 185, height: 185 }),
      makeBuiltinInstance("school_desk", 925, 595, { width: 185, height: 185 }),
      makeBuiltinInstance("book_stack", 640, 505, { width: 90, height: 72, depth: "foreground" }),
      makeBuiltinInstance("school_bag", 250, 650, { width: 95, height: 110, depth: "foreground" }),
    ],
  },
  {
    id: "downtown-street",
    name: "Downtown Street",
    description: "City block with vending machine, utility pole, signage & parked car",
    backdropId: "city_street",
    lighting: "day",
    buildObjects: () => [
      makeBuiltinInstance("fluffy_cloud", 260, 125, { width: 290, height: 130 }),
      makeBuiltinInstance("fluffy_cloud", 960, 145, { width: 260, height: 115 }),
      makeBuiltinInstance("power_pole", 205, 345, { width: 205, height: 480 }),
      makeBuiltinInstance("vending_machine", 470, 460, { width: 175, height: 325 }),
      makeBuiltinInstance("neon_sign", 845, 290, { width: 115, height: 235 }),
      makeBuiltinInstance("street_lamp", 1090, 415, { width: 110, height: 420 }),
      makeBuiltinInstance("sedan_car", 920, 625, { width: 420, height: 180, depth: "midground" }),
      makeBuiltinInstance("trash_bin", 325, 565, { width: 120, height: 115 }),
      makeBuiltinInstance("traffic_cone", 685, 675, { width: 72, height: 95, depth: "foreground" }),
    ],
  },
  {
    id: "neighborhood-cafe",
    name: "Cozy Café",
    description: "Warm hangout café with pendant lamps, plants, tables & hot drinks",
    backdropId: "cafe",
    lighting: "day",
    buildObjects: () => [
      makeBuiltinInstance("window_day", 640, 235, { width: 320, height: 225 }),
      makeBuiltinInstance("pinboard", 215, 240, { width: 215, height: 145 }),
      makeBuiltinInstance("potted_plant", 130, 520, { width: 125, height: 195 }),
      makeBuiltinInstance("potted_plant", 1155, 520, { width: 125, height: 195 }),
      makeBuiltinInstance("ceiling_lamp", 370, 95, { width: 125, height: 125 }),
      makeBuiltinInstance("ceiling_lamp", 910, 95, { width: 125, height: 125 }),
      makeBuiltinInstance("cafe_chair", 265, 590, { width: 115, height: 170 }),
      makeBuiltinInstance("cafe_chair", 495, 590, { width: 115, height: 170, flipX: true }),
      makeBuiltinInstance("cafe_table", 380, 625, { width: 205, height: 185, depth: "foreground" }),
      makeBuiltinInstance("coffee_mug", 365, 520, { width: 58, height: 64, depth: "foreground" }),
      makeBuiltinInstance("cafe_chair", 785, 590, { width: 115, height: 170 }),
      makeBuiltinInstance("cafe_chair", 1015, 590, { width: 115, height: 170, flipX: true }),
      makeBuiltinInstance("cafe_table", 900, 625, { width: 205, height: 185, depth: "foreground" }),
      makeBuiltinInstance("laptop", 885, 515, { width: 96, height: 74, depth: "foreground" }),
    ],
  },
  {
    id: "school-rooftop",
    name: "Sunset Rooftop",
    description: "Dramatic anime confession & showdown rooftop with chain fence",
    backdropId: "rooftop",
    lighting: "sunset",
    buildObjects: () => [
      makeBuiltinInstance("fluffy_cloud", 290, 145, {
        width: 310,
        height: 135,
        primaryColor: "#fed7aa",
      }),
      makeBuiltinInstance("fluffy_cloud", 960, 120, {
        width: 280,
        height: 125,
        primaryColor: "#fed7aa",
      }),
      makeBuiltinInstance("railing", 210, 490, { width: 420, height: 165 }),
      makeBuiltinInstance("railing", 630, 490, { width: 420, height: 165 }),
      makeBuiltinInstance("railing", 1050, 490, { width: 420, height: 165 }),
      makeBuiltinInstance("park_bench", 240, 615, { width: 240, height: 130 }),
      makeBuiltinInstance("school_bag", 340, 645, { width: 98, height: 118, depth: "foreground" }),
      makeBuiltinInstance("sakura_petals", 830, 265, {
        width: 340,
        height: 220,
        depth: "foreground",
      }),
    ],
  },
  {
    id: "forest-clearing",
    name: "Forest & Shrine Gate",
    description: "Peaceful wooded clearing with cherry blossom tree, gate & rocks",
    backdropId: "forest_clearing",
    lighting: "day",
    buildObjects: () => [
      makeBuiltinInstance("fluffy_cloud", 820, 115, { width: 300, height: 130 }),
      makeBuiltinInstance("arch_gate", 640, 385, { width: 350, height: 320 }),
      makeBuiltinInstance("tree_oak", 160, 390, { width: 295, height: 420 }),
      makeBuiltinInstance("tree_sakura", 1110, 390, { width: 320, height: 420 }),
      makeBuiltinInstance("bush_shrub", 370, 560, { width: 220, height: 130 }),
      makeBuiltinInstance("boulder", 940, 635, { width: 195, height: 125 }),
      makeBuiltinInstance("tall_grass", 240, 710, { width: 260, height: 115, depth: "foreground" }),
      makeBuiltinInstance("sakura_petals", 760, 290, {
        width: 340,
        height: 220,
        depth: "foreground",
      }),
    ],
  },
  {
    id: "blank-studio",
    name: "Blank Canvas",
    description: "Clean perspective canvas ready to draw & layer from scratch",
    backdropId: "blank",
    lighting: "day",
    buildObjects: () => [],
  },
];

export function createScene2DFromTemplate(
  templateId = "cozy-bedroom",
  customName?: string,
): Scene2D {
  const tpl =
    STARTER_SCENE_TEMPLATES.find((t) => t.id === templateId) ?? STARTER_SCENE_TEMPLATES[0]!;
  const bd = SCENE_BACKDROPS.find((b) => b.id === tpl.backdropId) ?? SCENE_BACKDROPS[0]!;
  const now = Date.now();
  return {
    id: `scene2d-${now}-${Math.random().toString(36).slice(2, 6)}`,
    name: customName?.trim() || tpl.name,
    createdAt: now,
    updatedAt: now,
    renderMode: "color",
    lighting: tpl.lighting,
    backdropId: bd.id,
    wallColor: bd.defaultWallColor,
    floorColor: bd.defaultFloorColor,
    skyColor: bd.defaultSkyColor,
    accentColor: bd.defaultAccentColor,
    objects: tpl.buildObjects(),
    strokes: [],
    guides: {
      mode: "1pt",
      horizonY: 360,
      vp1X: 640,
      vp2X: 1120,
      showGrid: false,
      snapToGrid: false,
      gridSize: 32,
      aimLinesToVp: false,
    },
  };
}

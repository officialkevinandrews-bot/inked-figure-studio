export interface RosterCharacter {
  id: string;
  name: string;
  role: string;
  previewUrl: string;
  source3d?: {
    modelName: string;
    pose: Record<string, [number, number, number]>;
    hipsDrop?: number;
    fov?: number;
  };
}

/** Built-in Manga Character Archetypes ready to stamp */
export const PRESET_ROSTER: RosterCharacter[] = [
  {
    id: "roster-hero-action",
    name: "Shonen Hero (Combat Stance)",
    role: "Protagonist",
    previewUrl: "/models/hero_action.svg",
    source3d: {
      modelName: "X Bot",
      pose: {
        Spine1: [15, 0, 0],
        RightArm: [-30, 20, -50],
        RightForeArm: [0, 85, 0],
        LeftArm: [-20, -15, 40],
        LeftForeArm: [0, 90, 0],
        RightUpLeg: [-20, 10, 0],
        RightLeg: [40, 0, 0],
        LeftUpLeg: [25, -10, 0],
        LeftLeg: [15, 0, 0],
      },
      hipsDrop: 0.15,
      fov: 45,
    },
  },
  {
    id: "roster-hero-standing",
    name: "Hero (Casual Standing)",
    role: "Protagonist",
    previewUrl: "/models/hero_stand.svg",
    source3d: {
      modelName: "X Bot",
      pose: {
        RightArm: [0, 0, -10],
        LeftArm: [0, 0, 10],
      },
      hipsDrop: 0,
      fov: 35,
    },
  },
  {
    id: "roster-shock",
    name: "Comic Shock / Panic",
    role: "Reaction",
    previewUrl: "/models/hero_shock.svg",
    source3d: {
      modelName: "X Bot",
      pose: {
        Spine1: [-10, 0, 0],
        Head: [-20, 0, 0],
        RightArm: [-80, 0, -70],
        RightForeArm: [0, 110, 0],
        LeftArm: [-80, 0, 70],
        LeftForeArm: [0, 110, 0],
      },
      hipsDrop: -0.05,
      fov: 40,
    },
  },
  {
    id: "roster-villain-menacing",
    name: "Rival / Villain (Crossed Arms)",
    role: "Antagonist",
    previewUrl: "/models/villain_cross.svg",
    source3d: {
      modelName: "X Bot",
      pose: {
        Spine1: [-5, 0, 0],
        RightArm: [-45, 30, -35],
        RightForeArm: [0, 100, 20],
        LeftArm: [-45, -30, 35],
        LeftForeArm: [0, 100, -20],
      },
      hipsDrop: 0,
      fov: 35,
    },
  },
];

const ROSTER_STORAGE_KEY = "inked_manga_roster_v1";

export function loadSavedRoster(): RosterCharacter[] {
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveRosterItem(char: RosterCharacter): void {
  const current = loadSavedRoster().filter((c) => c.id !== char.id);
  const updated = [char, ...current].slice(0, 30); // keep recent 30
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(updated));
}

export function deleteRosterItem(id: string): void {
  const updated = loadSavedRoster().filter((c) => c.id !== id);
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(updated));
}

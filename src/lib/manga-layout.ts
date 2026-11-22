import { insetPanelPoints } from "./manga-grid";
import type { SpeechBalloon, ComicMark, SpeedLinesEffect, SFXStamp } from "./manga-effects";
import type { SerializedActorPose } from "./scene-cast";
import type { DrawnLine, LineCapStyle, LineStyleVariant } from "./drawn-lines";
import { userLsGet, userLsSet } from "./user-storage";

export type { DrawnLine, LineCapStyle, LineStyleVariant };

export interface Point {
  x: number;
  y: number;
}

export interface PanelPolygon {
  id: string;
  points: Point[]; // Normalized points [0..1] relative to the page's inner printable area
  borderWidth: number; // in px
  borderColor: string;
  borderStyle: "solid" | "dashed" | "dotted" | "none";
  cornerRadius?: number; // px rounding
  scalloped?: boolean; // Flashback / memory wavy scalloped border
  bleed?: boolean; // page-edge sides run off the trim
  floating?: boolean; // inset panel laid over others; no gutter inset
  tone?: import("./screentone").Screentone | null; // halftone screentone fill
  backgroundColor: string;
  opacity?: number;
}

export interface CameraSnapshotPose {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

export const PAGE_LAYER_ID = "__page__";

export type PageLayerPlacement =
  | { kind: "behind" }
  | { kind: "above" }
  | { kind: "below-panel"; panelId: string }
  | { kind: "above-panel"; panelId: string };

export interface PlacedElement {
  id: string;
  panelId: string;
  type: "character" | "prop" | "background";
  imageUrl: string;
  imageFileId?: string;
  fitMode?: "free" | "fill-panel";
  pageLayer?: PageLayerPlacement;
  // Position & transform relative to the panel's bounding box
  x: number; // in pixels relative to panel min bounds
  y: number;
  width: number;
  height: number;
  rotation: number; // in degrees
  flipX: boolean;
  flipY: boolean;
  opacity?: number; // 0 to 1
  zIndex: number;
  breakout: boolean; // if true, renders over borders and gutters!
  // Optional 3D metadata for non-destructive re-posing
  source3d?: {
    modelName: string;
    pose: Record<string, [number, number, number]>;
    hipsDrop: number;
    cameraPose?: CameraSnapshotPose | null;
    fov?: number;
    activeActorId?: string;
    cast?: SerializedActorPose[];
  };
  /** Optional 2D character creator recipe so stamped characters can spin/re-edit cleanly. */
  source2d?: import("./character2d-types").Source2DMetadata;
}

export interface PageFormat {
  id: string;
  name: string;
  width: number;
  height: number;
  gutter: number; // default gutter in px (space between columns)
  gutterY?: number; // space between tiers; defaults to gutter
  margin: number; // default outer page margin in px
}

export const PAGE_FORMATS: PageFormat[] = [
  { id: "tankobon", name: "Tankobon (Volume)", width: 800, height: 1200, gutter: 16, margin: 32 },
  { id: "b5", name: "B5 Magazine (Shonen)", width: 800, height: 1130, gutter: 18, margin: 36 },
  { id: "a4", name: "A4 Standard", width: 800, height: 1132, gutter: 16, margin: 32 },
  { id: "yonkoma", name: "4-Koma Strip", width: 500, height: 1400, gutter: 20, margin: 24 },
  { id: "webtoon", name: "Webtoon Vertical", width: 800, height: 2400, gutter: 30, margin: 20 },
];

export interface PageLayout {
  id: string;
  pageNumber: number;
  format: PageFormat;
  panels: PanelPolygon[];
  elements: PlacedElement[];
  balloons?: SpeechBalloon[];
  comicMarks?: ComicMark[];
  speedLines?: SpeedLinesEffect[];
  sfxStamps?: SFXStamp[];
  drawnLines?: DrawnLine[];
}

export type PanelOverlapPreference = "float" | "keep";
const PANEL_OVERLAP_PREF_KEY = "koma-panel-overlap-pref";

export function loadPanelOverlapPreference(): PanelOverlapPreference {
  try {
    const raw = userLsGet(PANEL_OVERLAP_PREF_KEY);
    return raw === "keep" ? "keep" : "float";
  } catch {
    return "float";
  }
}

export function savePanelOverlapPreference(pref: PanelOverlapPreference): void {
  userLsSet(PANEL_OVERLAP_PREF_KEY, pref, "workspace");
}

export interface PresetLayoutOption {
  id: string;
  label: string;
  category: "classic" | "action" | "cinematic" | "webtoon";
  description: string;
}

export const PRESET_LAYOUT_CATALOG: PresetLayoutOption[] = [
  { id: "1-splash", label: "1-Splash", category: "action", description: "Full page splash hero shot" },
  { id: "2-vert", label: "2-Panel", category: "classic", description: "Versus / two-character faceoff" },
  { id: "3-cinema", label: "3-Cinema", category: "cinematic", description: "Letterbox widescreen cinematic panels" },
  { id: "4-koma", label: "4-Koma", category: "classic", description: "Traditional 4-panel gag / yonkoma" },
  { id: "action-5", label: "Action 5", category: "action", description: "Dynamic diagonal slash cut battle" },
  { id: "classic-6", label: "Classic 6", category: "classic", description: "Standard Shonen manga chapter grid" },
  { id: "shojo-focus-5", label: "Shojo 5", category: "classic", description: "Left full-body portrait with reaction cuts" },
  { id: "shonen-slash-7", label: "Shonen 7", category: "action", description: "High-intensity battle slashing cuts" },
  { id: "webtoon-3", label: "Webtoon 3", category: "webtoon", description: "Mobile vertical scrolling panels" },
];

/** Built-in Manga Grid Layouts */
export function getPresetPanels(template: string): PanelPolygon[] {
  switch (template) {
    case "1-splash":
      return [
        {
          id: "p1",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
      ];

    case "2-vert":
      return [
        {
          id: "p1",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 0.5 },
            { x: 0, y: 0.5 },
          ],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p2",
          points: [
            { x: 0, y: 0.5 },
            { x: 1, y: 0.5 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
      ];

    case "3-cinema":
      return [
        {
          id: "p1",
          points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.33 }, { x: 0, y: 0.33 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p2",
          points: [{ x: 0, y: 0.33 }, { x: 1, y: 0.33 }, { x: 1, y: 0.66 }, { x: 0, y: 0.66 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p3",
          points: [{ x: 0, y: 0.66 }, { x: 1, y: 0.66 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
      ];

    case "4-koma":
      return [0, 1, 2, 3].map((i) => ({
        id: `p${i + 1}`,
        points: [
          { x: 0, y: i * 0.25 },
          { x: 1, y: i * 0.25 },
          { x: 1, y: (i + 1) * 0.25 },
          { x: 0, y: (i + 1) * 0.25 },
        ],
        borderWidth: 3,
        borderColor: "#000000",
        borderStyle: "solid",
        backgroundColor: "#ffffff",
      }));

    case "action-5":
      return [
        // Top full
        {
          id: "p1",
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 0.35 },
            { x: 0, y: 0.35 },
          ],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        // Mid left
        {
          id: "p2",
          points: [
            { x: 0, y: 0.35 },
            { x: 0.55, y: 0.35 },
            { x: 0.45, y: 0.7 },
            { x: 0, y: 0.7 },
          ],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        // Mid right diagonal action slash
        {
          id: "p3",
          points: [
            { x: 0.55, y: 0.35 },
            { x: 1, y: 0.35 },
            { x: 1, y: 0.7 },
            { x: 0.45, y: 0.7 },
          ],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        // Bottom left
        {
          id: "p4",
          points: [
            { x: 0, y: 0.7 },
            { x: 0.5, y: 0.7 },
            { x: 0.5, y: 1 },
            { x: 0, y: 1 },
          ],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        // Bottom right
        {
          id: "p5",
          points: [
            { x: 0.5, y: 0.7 },
            { x: 1, y: 0.7 },
            { x: 1, y: 1 },
            { x: 0.5, y: 1 },
          ],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
      ];

    case "shojo-focus-5":
      return [
        // Left tall panel (full body character portrait)
        {
          id: "p1",
          points: [{ x: 0, y: 0 }, { x: 0.42, y: 0 }, { x: 0.42, y: 1 }, { x: 0, y: 1 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        // 4 stacked right panels
        {
          id: "p2",
          points: [{ x: 0.42, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.25 }, { x: 0.42, y: 0.25 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p3",
          points: [{ x: 0.42, y: 0.25 }, { x: 1, y: 0.25 }, { x: 1, y: 0.5 }, { x: 0.42, y: 0.5 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p4",
          points: [{ x: 0.42, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 0.75 }, { x: 0.42, y: 0.75 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p5",
          points: [{ x: 0.42, y: 0.75 }, { x: 1, y: 0.75 }, { x: 1, y: 1 }, { x: 0.42, y: 1 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
      ];

    case "shonen-slash-7":
      return [
        {
          id: "p1",
          points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.28 }, { x: 0, y: 0.28 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p2",
          points: [{ x: 0, y: 0.28 }, { x: 0.48, y: 0.28 }, { x: 0.38, y: 0.56 }, { x: 0, y: 0.56 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p3",
          points: [{ x: 0.48, y: 0.28 }, { x: 1, y: 0.28 }, { x: 0.9, y: 0.56 }, { x: 0.38, y: 0.56 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p4",
          points: [{ x: 0.9, y: 0.28 }, { x: 1, y: 0.28 }, { x: 1, y: 0.56 }, { x: 0.9, y: 0.56 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p5",
          points: [{ x: 0, y: 0.56 }, { x: 0.33, y: 0.56 }, { x: 0.33, y: 1 }, { x: 0, y: 1 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p6",
          points: [{ x: 0.33, y: 0.56 }, { x: 0.66, y: 0.56 }, { x: 0.66, y: 1 }, { x: 0.33, y: 1 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p7",
          points: [{ x: 0.66, y: 0.56 }, { x: 1, y: 0.56 }, { x: 1, y: 1 }, { x: 0.66, y: 1 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
      ];

    case "webtoon-3":
      return [0, 1, 2].map((i) => ({
        id: `p${i + 1}`,
        points: [
          { x: 0, y: i * 0.333 },
          { x: 1, y: i * 0.333 },
          { x: 1, y: (i + 1) * 0.333 },
          { x: 0, y: (i + 1) * 0.333 },
        ],
        borderWidth: 3,
        borderColor: "#000000",
        borderStyle: "solid",
        backgroundColor: "#ffffff",
      }));

    case "classic-6":
    default:
      // Standard 2-column by 3-row layout
      return [
        {
          id: "p1",
          points: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.33 }, { x: 0, y: 0.33 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p2",
          points: [{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.33 }, { x: 0.5, y: 0.33 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p3",
          points: [{ x: 0, y: 0.33 }, { x: 0.5, y: 0.33 }, { x: 0.5, y: 0.66 }, { x: 0, y: 0.66 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p4",
          points: [{ x: 0.5, y: 0.33 }, { x: 1, y: 0.33 }, { x: 1, y: 0.66 }, { x: 0.5, y: 0.66 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p5",
          points: [{ x: 0, y: 0.66 }, { x: 0.5, y: 0.66 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p6",
          points: [{ x: 0.5, y: 0.66 }, { x: 1, y: 0.66 }, { x: 1, y: 1 }, { x: 0.5, y: 1 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
      ];
  }
}

/** Calculates actual pixel bounding box & polygon vertices for a panel */
export function getPanelPixelBounds(
  panel: PanelPolygon,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  gutter: number,
  gutterY: number = gutter
): { minX: number; minY: number; width: number; height: number; points: Point[] } {
  const points = insetPanelPoints(panel.points, pageWidth, pageHeight, margin, gutter, gutterY, {
    bleed: panel.bleed,
    floating: panel.floating,
  });
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY, points };
}

/** Pixel bounds using the page format's own gutters. */
export function panelBounds(panel: PanelPolygon, f: PageFormat) {
  return getPanelPixelBounds(panel, f.width, f.height, f.margin, f.gutter, f.gutterY ?? f.gutter);
}

/** Interactive Knife Split calculations */
export function splitPanel(
  panel: PanelPolygon,
  splitType: "horizontal" | "vertical" | "diagonal",
  splitRatio = 0.5
): [PanelPolygon, PanelPolygon] {
  const id1 =
    splitType === "horizontal"
      ? `${panel.id}_top`
      : splitType === "vertical"
      ? `${panel.id}_left`
      : `${panel.id}_diag1`;
  const id2 =
    splitType === "horizontal"
      ? `${panel.id}_bot`
      : splitType === "vertical"
      ? `${panel.id}_right`
      : `${panel.id}_diag2`;

  const xs = panel.points.map((p) => p.x);
  const ys = panel.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  if (splitType === "horizontal") {
    const splitY = minY + (maxY - minY) * splitRatio;
    const p1: PanelPolygon = {
      ...panel,
      id: id1,
      points: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: splitY },
        { x: minX, y: splitY },
      ],
    };
    const p2: PanelPolygon = {
      ...panel,
      id: id2,
      points: [
        { x: minX, y: splitY },
        { x: maxX, y: splitY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
    };
    return [p1, p2];
  } else if (splitType === "vertical") {
    const splitX = minX + (maxX - minX) * splitRatio;
    const p1: PanelPolygon = {
      ...panel,
      id: id1,
      points: [
        { x: minX, y: minY },
        { x: splitX, y: minY },
        { x: splitX, y: maxY },
        { x: minX, y: maxY },
      ],
    };
    const p2: PanelPolygon = {
      ...panel,
      id: id2,
      points: [
        { x: splitX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: splitX, y: maxY },
      ],
    };
    return [p1, p2];
  } else {
    // Dynamic Action Diagonal Cut
    const delta = (maxX - minX) * 0.12;
    const p1: PanelPolygon = {
      ...panel,
      id: id1,
      points: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX - delta, y: maxY },
        { x: minX, y: maxY },
      ],
    };
    const p2: PanelPolygon = {
      ...panel,
      id: id2,
      points: [
        { x: minX + delta, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
    };
    return [p1, p2];
  }
}

/** Swaps characters, backgrounds, balloons, SFX, marks, speed lines, and panel fills between two panels cleanly. */
export function swapPanelContents(layout: PageLayout, idA: string, idB: string): PageLayout {
  if (idA === idB) return layout;
  const panA = layout.panels.find((p) => p.id === idA);
  const panB = layout.panels.find((p) => p.id === idB);
  if (!panA || !panB) return layout;

  const bA = panelBounds(panA, layout.format);
  const bB = panelBounds(panB, layout.format);
  const dxAB = (bB.minX + bB.width / 2) - (bA.minX + bA.width / 2);
  const dyAB = (bB.minY + bB.height / 2) - (bA.minY + bA.height / 2);

  const shiftItem = <T extends { panelId: string; x: number; y: number }>(item: T): T => {
    if (item.panelId === idA) return { ...item, panelId: idB, x: item.x + dxAB, y: item.y + dyAB };
    if (item.panelId === idB) return { ...item, panelId: idA, x: item.x - dxAB, y: item.y - dyAB };
    return item;
  };

  return syncPanelBoundElements(
    {
      ...layout,
      panels: layout.panels.map((p) => {
        if (p.id === idA) return { ...p, backgroundColor: panB.backgroundColor, tone: panB.tone ?? null };
        if (p.id === idB) return { ...p, backgroundColor: panA.backgroundColor, tone: panA.tone ?? null };
        return p;
      }),
      elements: layout.elements.map(shiftItem),
      balloons: (layout.balloons ?? []).map(shiftItem),
      sfxStamps: (layout.sfxStamps ?? []).map(shiftItem),
      comicMarks: (layout.comicMarks ?? []).map(shiftItem),
      speedLines: (layout.speedLines ?? []).map((l) => {
        if (l.panelId === idA) return { ...l, panelId: idB, centerX: l.centerX + dxAB, centerY: l.centerY + dyAB };
        if (l.panelId === idB) return { ...l, panelId: idA, centerX: l.centerX - dxAB, centerY: l.centerY - dyAB };
        return l;
      }),
      drawnLines: (layout.drawnLines ?? []).map((d) => {
        if (d.panelId === idA) {
          return { ...d, panelId: idB, x1: d.x1 + dxAB, y1: d.y1 + dyAB, x2: d.x2 + dxAB, y2: d.y2 + dyAB };
        }
        if (d.panelId === idB) {
          return { ...d, panelId: idA, x1: d.x1 - dxAB, y1: d.y1 - dyAB, x2: d.x2 - dxAB, y2: d.y2 - dyAB };
        }
        return d;
      }),
    },
    [idA, idB],
  );
}

/** Merges a manual transform or breakout edit onto an element, releasing `fill-panel` lock unless `fitMode` is set explicitly. */
export function applyManualElementPatch(
  el: PlacedElement,
  patch: Partial<PlacedElement>,
): PlacedElement {
  const touchesTransform =
    patch.x !== undefined ||
    patch.y !== undefined ||
    patch.width !== undefined ||
    patch.height !== undefined ||
    patch.rotation !== undefined ||
    patch.breakout === true;
  const nextFitMode =
    patch.fitMode !== undefined
      ? patch.fitMode
      : touchesTransform && el.fitMode === "fill-panel"
      ? "free"
      : el.fitMode;
  return { ...el, ...patch, fitMode: nextFitMode };
}

/** Re-scales panel-bound `fill-panel` backgrounds cleanly whenever panel sizes, dividers, gutters, or formats change. */
export function syncPanelBoundElements(
  layout: PageLayout,
  onlyPanelIds?: Iterable<string>,
): PageLayout {
  const allowedPanels = onlyPanelIds ? new Set(onlyPanelIds) : null;
  const hasBound = layout.elements.some(
    (el) =>
      el.fitMode === "fill-panel" &&
      el.panelId !== PAGE_LAYER_ID &&
      !el.breakout &&
      (!allowedPanels || allowedPanels.has(el.panelId)),
  );
  if (!hasBound) return layout;

  const panelMap = new Map(layout.panels.map((p) => [p.id, p]));
  let changed = false;
  const elements = layout.elements.map((el) => {
    if (
      el.fitMode !== "fill-panel" ||
      el.panelId === PAGE_LAYER_ID ||
      el.breakout ||
      (allowedPanels && !allowedPanels.has(el.panelId))
    ) {
      return el;
    }
    const panel = panelMap.get(el.panelId);
    if (!panel) return el;
    const b = panelBounds(panel, layout.format);
    const nx = Math.round(b.minX);
    const ny = Math.round(b.minY);
    const nw = Math.max(1, Math.round(b.width));
    const nh = Math.max(1, Math.round(b.height));
    if (el.x === nx && el.y === ny && el.width === nw && el.height === nh) return el;
    changed = true;
    return { ...el, x: nx, y: ny, width: nw, height: nh };
  });

  return changed ? { ...layout, elements } : layout;
}

/** Converts a target pixel bounding box into normalized `[0..1]` panel vertices, preserving polygon shape and gutter accuracy. */
export function panelPointsForTargetRect(
  panel: PanelPolygon,
  targetRect: { x: number; y: number; width: number; height: number },
  format: PageFormat,
  floating: boolean,
): Point[] {
  const pw = Math.max(1, format.width - format.margin * 2);
  const ph = Math.max(1, format.height - format.margin * 2);
  const oldBox = panelBounds(panel, format);
  const oldW = Math.max(1, oldBox.width);
  const oldH = Math.max(1, oldBox.height);

  // Fractional vertex offsets relative to current panel pixel box
  const fracs = oldBox.points.map((p) => ({
    u: (p.x - oldBox.minX) / oldW,
    v: (p.y - oldBox.minY) / oldH,
  }));

  const toNormFromRect = (rect: { x: number; y: number; width: number; height: number }) =>
    fracs.map(({ u, v }) => ({
      x: (rect.x + u * rect.width - format.margin) / pw,
      y: (rect.y + v * rect.height - format.margin) / ph,
    }));

  const guess = toNormFromRect(targetRect);
  if (floating) return guess;

  // For non-floating panels, compensate once for gutter inset so pixel bounds land accurately
  const actual = panelBounds({ ...panel, floating: false, points: guess }, format);
  const adjustedRect = {
    x: targetRect.x + (targetRect.x - actual.minX),
    y: targetRect.y + (targetRect.y - actual.minY),
    width: Math.max(24, targetRect.width * (targetRect.width / Math.max(1, actual.width))),
    height: Math.max(24, targetRect.height * (targetRect.height / Math.max(1, actual.height))),
  };
  return toNormFromRect(adjustedRect);
}

/** Moves or resizes one selected panel and proportionally moves/scales every item contained inside it. */
export function transformPanelWithContents(
  layout: PageLayout,
  panelId: string,
  nextNormPoints: Point[],
  options?: { forceFloating?: boolean },
): PageLayout {
  const oldPanel = layout.panels.find((p) => p.id === panelId);
  if (!oldPanel) return layout;

  const oldBox = panelBounds(oldPanel, layout.format);
  const nextPanel: PanelPolygon = {
    ...oldPanel,
    points: nextNormPoints,
    ...(options?.forceFloating ? { floating: true } : {}),
  };
  const newBox = panelBounds(nextPanel, layout.format);

  const oldW = Math.max(1, oldBox.width);
  const oldH = Math.max(1, oldBox.height);
  const sx = newBox.width / oldW;
  const sy = newBox.height / oldH;
  const sUniform = (sx + sy) / 2;

  const mapX = (x: number) => newBox.minX + (x - oldBox.minX) * sx;
  const mapY = (y: number) => newBox.minY + (y - oldBox.minY) * sy;

  return {
    ...layout,
    panels: layout.panels.map((p) => (p.id === panelId ? nextPanel : p)),
    elements: layout.elements.map((el) => {
      if (el.panelId !== panelId) return el;
      if (el.fitMode === "fill-panel" && !el.breakout) {
        return {
          ...el,
          x: Math.round(newBox.minX),
          y: Math.round(newBox.minY),
          width: Math.max(1, Math.round(newBox.width)),
          height: Math.max(1, Math.round(newBox.height)),
        };
      }
      return {
        ...el,
        x: mapX(el.x),
        y: mapY(el.y),
        width: Math.max(4, el.width * sx),
        height: Math.max(4, el.height * sy),
      };
    }),
    balloons: (layout.balloons ?? []).map((b) => {
      if (b.panelId !== panelId) return b;
      return {
        ...b,
        x: mapX(b.x),
        y: mapY(b.y),
        width: Math.max(24, b.width * sx),
        height: Math.max(20, b.height * sy),
        fontSize: Math.max(8, b.fontSize * sUniform),
        tail: b.tail
          ? {
              ...b.tail,
              x: b.tail.x * sx,
              y: b.tail.y * sy,
              curveX: b.tail.curveX !== undefined ? b.tail.curveX * sx : undefined,
              curveY: b.tail.curveY !== undefined ? b.tail.curveY * sy : undefined,
            }
          : undefined,
        secondaryTail: b.secondaryTail
          ? {
              ...b.secondaryTail,
              x: b.secondaryTail.x * sx,
              y: b.secondaryTail.y * sy,
              curveX: b.secondaryTail.curveX !== undefined ? b.secondaryTail.curveX * sx : undefined,
              curveY: b.secondaryTail.curveY !== undefined ? b.secondaryTail.curveY * sy : undefined,
            }
          : undefined,
        tailX: b.tailX !== undefined ? b.tailX * sx : undefined,
        tailY: b.tailY !== undefined ? b.tailY * sy : undefined,
        tailCurveX: b.tailCurveX !== undefined ? b.tailCurveX * sx : undefined,
        tailCurveY: b.tailCurveY !== undefined ? b.tailCurveY * sy : undefined,
      };
    }),
    comicMarks: (layout.comicMarks ?? []).map((m) =>
      m.panelId === panelId
        ? {
            ...m,
            x: mapX(m.x),
            y: mapY(m.y),
            size: Math.max(8, m.size * sUniform),
          }
        : m,
    ),
    sfxStamps: (layout.sfxStamps ?? []).map((s) =>
      s.panelId === panelId
        ? {
            ...s,
            x: mapX(s.x),
            y: mapY(s.y),
            fontSize: Math.max(10, s.fontSize * sUniform),
          }
        : s,
    ),
    speedLines: (layout.speedLines ?? []).map((l) =>
      l.panelId === panelId
        ? {
            ...l,
            centerX: mapX(l.centerX),
            centerY: mapY(l.centerY),
            innerRadius: Math.max(2, l.innerRadius * sUniform),
            outerRadius: Math.max(12, l.outerRadius * sUniform),
          }
        : l,
    ),
    drawnLines: (layout.drawnLines ?? []).map((d) =>
      d.panelId === panelId
        ? {
            ...d,
            x1: mapX(d.x1),
            y1: mapY(d.y1),
            x2: mapX(d.x2),
            y2: mapY(d.y2),
          }
        : d,
    ),
  };
}

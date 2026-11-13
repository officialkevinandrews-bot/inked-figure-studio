import { insetPanelPoints } from "./manga-grid";
import type { SpeechBalloon, ComicMark, SpeedLinesEffect, SFXStamp } from "./manga-effects";

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

export interface PlacedElement {
  id: string;
  panelId: string;
  type: "character" | "prop" | "background";
  imageUrl: string;
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
    cameraPose?: any;
    fov?: number;
  };
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

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
  borderStyle: "solid" | "dashed" | "none";
  backgroundColor: string;
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
  gutter: number; // default gutter in px
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
  balloons: SpeechBalloon[];
  comicMarks: ComicMark[];
  speedLines: SpeedLinesEffect[];
  sfxStamps: SFXStamp[];
}

/** Pre-defined manga panel layouts (normalized 0..1 coordinates) */
export function getPresetPanels(template: string): PanelPolygon[] {
  switch (template) {
    case "1-splash":
      return [
        {
          id: "p1",
          points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
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
          points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.5 }, { x: 0, y: 0.5 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        {
          id: "p2",
          points: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
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
          points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.35 }, { x: 0, y: 0.35 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        // Mid left
        {
          id: "p2",
          points: [{ x: 0, y: 0.35 }, { x: 0.55, y: 0.35 }, { x: 0.45, y: 0.7 }, { x: 0, y: 0.7 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        // Mid right diagonal action slash
        {
          id: "p3",
          points: [{ x: 0.55, y: 0.35 }, { x: 1, y: 0.35 }, { x: 1, y: 0.7 }, { x: 0.45, y: 0.7 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        // Bottom left
        {
          id: "p4",
          points: [{ x: 0, y: 0.7 }, { x: 0.5, y: 0.7 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
        // Bottom right
        {
          id: "p5",
          points: [{ x: 0.5, y: 0.7 }, { x: 1, y: 0.7 }, { x: 1, y: 1 }, { x: 0.5, y: 1 }],
          borderWidth: 3,
          borderColor: "#000000",
          borderStyle: "solid",
          backgroundColor: "#ffffff",
        },
      ];

    case "classic-6":
    default:
      return [
        { id: "p1", points: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.33 }, { x: 0, y: 0.33 }], borderWidth: 3, borderColor: "#000000", borderStyle: "solid", backgroundColor: "#ffffff" },
        { id: "p2", points: [{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.33 }, { x: 0.5, y: 0.33 }], borderWidth: 3, borderColor: "#000000", borderStyle: "solid", backgroundColor: "#ffffff" },
        { id: "p3", points: [{ x: 0, y: 0.33 }, { x: 0.6, y: 0.33 }, { x: 0.6, y: 0.66 }, { x: 0, y: 0.66 }], borderWidth: 3, borderColor: "#000000", borderStyle: "solid", backgroundColor: "#ffffff" },
        { id: "p4", points: [{ x: 0.6, y: 0.33 }, { x: 1, y: 0.33 }, { x: 1, y: 0.66 }, { x: 0.6, y: 0.66 }], borderWidth: 3, borderColor: "#000000", borderStyle: "solid", backgroundColor: "#ffffff" },
        { id: "p5", points: [{ x: 0, y: 0.66 }, { x: 0.4, y: 0.66 }, { x: 0.4, y: 1 }, { x: 0, y: 1 }], borderWidth: 3, borderColor: "#000000", borderStyle: "solid", backgroundColor: "#ffffff" },
        { id: "p6", points: [{ x: 0.4, y: 0.66 }, { x: 1, y: 0.66 }, { x: 1, y: 1 }, { x: 0.4, y: 1 }], borderWidth: 3, borderColor: "#000000", borderStyle: "solid", backgroundColor: "#ffffff" },
      ];
  }
}

/** Computes the bounding box of a panel's polygon in pixel coordinates */
export function getPanelPixelBounds(
  panel: PanelPolygon,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  gutter: number
) {
  const innerW = pageWidth - margin * 2;
  const innerH = pageHeight - margin * 2;

  const pixelPoints = panel.points.map((p) => ({
    x: margin + p.x * innerW,
    y: margin + p.y * innerH,
  }));

  const xs = pixelPoints.map((p) => p.x);
  const ys = pixelPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX: minX + gutter / 2,
    maxX: maxX - gutter / 2,
    minY: minY + gutter / 2,
    maxY: maxY - gutter / 2,
    width: Math.max(10, maxX - minX - gutter),
    height: Math.max(10, maxY - minY - gutter),
    points: pixelPoints,
  };
}

/** Slices a panel polygon along a split line (horizontal, vertical, or diagonal knife cut) */
export function splitPanel(
  panel: PanelPolygon,
  splitType: "horizontal" | "vertical" | "diagonal",
  ratio = 0.5
): [PanelPolygon, PanelPolygon] {
  const xs = panel.points.map((p) => p.x);
  const ys = panel.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  if (splitType === "horizontal") {
    const splitY = minY + (maxY - minY) * ratio;
    const p1: PanelPolygon = {
      ...panel,
      id: `${panel.id}_top`,
      points: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: splitY },
        { x: minX, y: splitY },
      ],
    };
    const p2: PanelPolygon = {
      ...panel,
      id: `${panel.id}_bot`,
      points: [
        { x: minX, y: splitY },
        { x: maxX, y: splitY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ],
    };
    return [p1, p2];
  } else if (splitType === "vertical") {
    const splitX = minX + (maxX - minX) * ratio;
    const p1: PanelPolygon = {
      ...panel,
      id: `${panel.id}_left`,
      points: [
        { x: minX, y: minY },
        { x: splitX, y: minY },
        { x: splitX, y: maxY },
        { x: minX, y: maxY },
      ],
    };
    const p2: PanelPolygon = {
      ...panel,
      id: `${panel.id}_right`,
      points: [
        { x: splitX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: splitX, y: maxY },
      ],
    };
    return [p1, p2];
  } else {
    // Diagonal Action Cut
    const delta = (maxX - minX) * 0.15;
    const p1: PanelPolygon = {
      ...panel,
      id: `${panel.id}_diag1`,
      points: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX - delta, y: maxY },
        { x: minX, y: maxY },
      ],
    };
    const p2: PanelPolygon = {
      ...panel,
      id: `${panel.id}_diag2`,
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

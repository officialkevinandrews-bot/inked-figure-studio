import type { PanelPolygon, Point } from "./manga-layout";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface TemplateExtractOptions {
  /** Luminance threshold (0-255) below which pixels count as panel border ink. Default 170. */
  inkThreshold?: number;
  /** Snap near-horizontal/near-vertical edges within ±4° cleanly while preserving diagonal cuts. Default true. */
  snapAngles?: boolean;
  /** `"fit"` stretches the extracted layout to fill [0..1] printable bounds; `"exact"` keeps white sheet margins. Default "fit". */
  scaleMode?: "fit" | "exact";
  /** Panel numbering order: `"rtl"` (Manga right-to-left) or `"ltr"` (Comic left-to-right). Default "rtl". */
  readingDirection?: "rtl" | "ltr";
  /** Border thickness in px assigned to generated panels. Default 3.5. */
  borderWidth?: number;
}

export interface PaperBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ExtractedTemplateResult {
  width: number;
  height: number;
  paperBounds: PaperBounds;
  panels: PanelPolygon[];
  rawRegionCount: number;
  droppedOuterFrame: boolean;
}

interface OpenRegion {
  id: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  touchesEdge: boolean;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number(v.toFixed(4))));
}

/** Detects the bright white paper sheet inside screenshots that have dark outer padding. */
export function detectPaperBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): PaperBounds {
  const rowBright = new Uint32Array(height);
  const colBright = new Uint32Array(width);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = rgba[idx + 3];
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      const lum = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum >= 205 && chroma <= 45) {
        rowBright[y]++;
        colBright[x]++;
      }
    }
  }

  let minY = 0;
  while (minY < height - 1 && rowBright[minY] < width * 0.22) minY++;
  let maxY = height - 1;
  while (maxY > minY && rowBright[maxY] < width * 0.22) maxY--;

  let minX = 0;
  while (minX < width - 1 && colBright[minX] < height * 0.22) minX++;
  let maxX = width - 1;
  while (maxX > minX && colBright[maxX] < height * 0.22) maxX--;

  const pw = maxX - minX + 1;
  const ph = maxY - minY + 1;
  if (pw < width * 0.25 || ph < height * 0.25) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  }
  return { minX, minY, maxX, maxY };
}

/** Moore neighborhood clockwise boundary tracer around connected component `targetId`. */
function traceRegionBoundary(
  labels: Int32Array,
  pw: number,
  ph: number,
  region: OpenRegion,
): Point[] {
  let sx = -1;
  let sy = -1;
  outer: for (let y = region.minY; y <= region.maxY; y++) {
    for (let x = region.minX; x <= region.maxX; x++) {
      if (labels[y * pw + x] === region.id) {
        sx = x;
        sy = y;
        break outer;
      }
    }
  }
  if (sx < 0 || sy < 0) return [];

  // 8-neighbor offsets clockwise starting from West
  const dirs: Array<[number, number]> = [
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
  ];

  const isInside = (x: number, y: number): boolean =>
    x >= 0 && x < pw && y >= 0 && y < ph && labels[y * pw + x] === region.id;

  const contour: Point[] = [{ x: sx, y: sy }];
  let cx = sx;
  let cy = sy;
  let enterDir = 0; // entered from left (outside since (sx, sy) is top-leftmost)
  const maxSteps = pw * ph * 2 + 16;

  for (let step = 0; step < maxSteps; step++) {
    let found = false;
    for (let i = 0; i < 8; i++) {
      const dir = (enterDir + 1 + i) % 8;
      const nx = cx + dirs[dir][0];
      const ny = cy + dirs[dir][1];
      if (isInside(nx, ny)) {
        cx = nx;
        cy = ny;
        enterDir = (dir + 4) % 8;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy) break;
    contour.push({ x: cx, y: cy });
  }

  return contour;
}

function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdpOpen(pts: Point[], eps: number): Point[] {
  if (pts.length <= 2) return pts;
  let maxDist = -1;
  let splitIdx = 0;
  const first = pts[0];
  const last = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointToSegmentDist(pts[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      splitIdx = i;
    }
  }
  if (maxDist <= eps) return [first, last];
  const left = rdpOpen(pts.slice(0, splitIdx + 1), eps);
  const right = rdpOpen(pts.slice(splitIdx), eps);
  return [...left.slice(0, -1), ...right];
}

function simplifyClosedPolygon(contour: Point[], eps: number): Point[] {
  if (contour.length <= 4) return contour;
  let bestA = 0;
  let bestB = Math.floor(contour.length / 2);
  let maxD = -1;
  const sampleStep = Math.max(1, Math.floor(contour.length / 64));
  for (let i = 0; i < contour.length; i += sampleStep) {
    for (let j = i + sampleStep; j < contour.length; j += sampleStep) {
      const d = Math.hypot(contour[j].x - contour[i].x, contour[j].y - contour[i].y);
      if (d > maxD) {
        maxD = d;
        bestA = i;
        bestB = j;
      }
    }
  }

  const chain1 = contour.slice(bestA, bestB + 1);
  const chain2 = [...contour.slice(bestB), ...contour.slice(0, bestA + 1)];
  const simp1 = rdpOpen(chain1, eps);
  const simp2 = rdpOpen(chain2, eps);
  const merged = [...simp1.slice(0, -1), ...simp2.slice(0, -1)];
  return pruneNearCollinear(merged, eps * 0.9);
}

function pruneNearCollinear(pts: Point[], distTol: number): Point[] {
  const cur = [...pts];
  let changed = true;
  while (changed && cur.length > 3) {
    changed = false;
    for (let i = 0; i < cur.length; i++) {
      const prev = cur[(i - 1 + cur.length) % cur.length];
      const pt = cur[i];
      const next = cur[(i + 1) % cur.length];
      if (pointToSegmentDist(pt, prev, next) <= distTol) {
        cur.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return cur;
}

/** Snaps nearly horizontal/vertical segments (±4.5°) cleanly while keeping diagonal cuts crisp. */
function snapOrthogonalEdges(pts: Point[]): Point[] {
  if (pts.length < 3) return pts;
  const out = pts.map((p) => ({ ...p }));
  const sinThreshold = Math.sin((4.5 * Math.PI) / 180);

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      if (Math.abs(dy) / len <= sinThreshold) {
        const midY = (a.y + b.y) / 2;
        a.y = midY;
        b.y = midY;
      } else if (Math.abs(dx) / len <= sinThreshold) {
        const midX = (a.x + b.x) / 2;
        a.x = midX;
        b.x = midX;
      }
    }
  }
  return pruneNearCollinear(out, 2);
}

function polygonSignedArea(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

function ensureClockwise(pts: Point[]): Point[] {
  return polygonSignedArea(pts) >= 0 ? pts : [...pts].reverse();
}

function sortPanelsReadingOrder(panels: PanelPolygon[], rtl: boolean): PanelPolygon[] {
  const items = panels.map((p) => {
    const xs = p.points.map((pt) => pt.x);
    const ys = p.points.map((pt) => pt.y);
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
    return { panel: p, cx, cy, top: Math.min(...ys), bot: Math.max(...ys) };
  });
  items.sort((a, b) => a.cy - b.cy);

  const rows: (typeof items)[] = [];
  for (const it of items) {
    const row = rows[rows.length - 1];
    if (
      row &&
      it.top < Math.min(...row.map((r) => r.bot)) - 0.02 &&
      it.cy < Math.max(...row.map((r) => r.bot))
    ) {
      row.push(it);
    } else {
      rows.push([it]);
    }
  }
  return rows.flatMap((row) =>
    row.sort((a, b) => (rtl ? b.cx - a.cx : a.cx - b.cx)).map((r) => r.panel),
  );
}

/**
 * Extracts editable vector PanelPolygons from an RGBA pixel buffer of a grid layout image.
 */
export function extractPanelsFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  opts: TemplateExtractOptions = {},
): ExtractedTemplateResult {
  const inkThreshold = opts.inkThreshold ?? 170;
  const snapAngles = opts.snapAngles ?? true;
  const scaleMode = opts.scaleMode ?? "fit";
  const rtl = (opts.readingDirection ?? "rtl") === "rtl";
  const borderWidth = opts.borderWidth ?? 3.5;

  const paperBounds = detectPaperBounds(rgba, width, height);
  const pw = paperBounds.maxX - paperBounds.minX + 1;
  const ph = paperBounds.maxY - paperBounds.minY + 1;

  // Build binary ink mask inside paper sheet bounds
  const ink = new Uint8Array(pw * ph);
  for (let py = 0; py < ph; py++) {
    const srcY = paperBounds.minY + py;
    for (let px = 0; px < pw; px++) {
      const srcX = paperBounds.minX + px;
      const i = (srcY * width + srcX) * 4;
      const a = rgba[i + 3];
      const lum =
        a < 128 ? 255 : 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      ink[py * pw + px] = lum <= inkThreshold ? 1 : 0;
    }
  }

  // BFS flood-fill open regions
  const labels = new Int32Array(pw * ph);
  const queue = new Int32Array(pw * ph);
  const regions: OpenRegion[] = [];
  let nextLabel = 1;

  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const startIdx = y * pw + x;
      if (ink[startIdx] !== 0 || labels[startIdx] !== 0) continue;

      const labelId = nextLabel++;
      let head = 0;
      let tail = 0;
      queue[tail++] = startIdx;
      labels[startIdx] = labelId;

      let area = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let touchesEdge = false;

      while (head < tail) {
        const cur = queue[head++];
        const cx = cur % pw;
        const cy = (cur - cx) / pw;
        area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        if (cx === 0 || cy === 0 || cx === pw - 1 || cy === ph - 1) touchesEdge = true;

        if (cx > 0 && ink[cur - 1] === 0 && labels[cur - 1] === 0) {
          labels[cur - 1] = labelId;
          queue[tail++] = cur - 1;
        }
        if (cx + 1 < pw && ink[cur + 1] === 0 && labels[cur + 1] === 0) {
          labels[cur + 1] = labelId;
          queue[tail++] = cur + 1;
        }
        if (cy > 0 && ink[cur - pw] === 0 && labels[cur - pw] === 0) {
          labels[cur - pw] = labelId;
          queue[tail++] = cur - pw;
        }
        if (cy + 1 < ph && ink[cur + pw] === 0 && labels[cur + pw] === 0) {
          labels[cur + pw] = labelId;
          queue[tail++] = cur + pw;
        }
      }

      regions.push({ id: labelId, area, minX, minY, maxX, maxY, touchesEdge });
    }
  }

  const pageArea = pw * ph;
  const candidateRegions = regions.filter(
    (r) =>
      !r.touchesEdge &&
      r.area >= pageArea * 0.008 &&
      r.maxX - r.minX + 1 >= pw * 0.04 &&
      r.maxY - r.minY + 1 >= ph * 0.04,
  );

  // Drop outer border wrappers that enclose inner panel boxes (e.g., thin outer frame on Image 1)
  let droppedOuterFrame = false;
  const finalRegions = candidateRegions.filter((outer) => {
    let enclosedCount = 0;
    for (const inner of candidateRegions) {
      if (inner.id === outer.id) continue;
      if (
        inner.minX >= outer.minX - 2 &&
        inner.maxX <= outer.maxX + 2 &&
        inner.minY >= outer.minY - 2 &&
        inner.maxY <= outer.maxY + 2
      ) {
        enclosedCount++;
      }
    }
    const bboxArea = (outer.maxX - outer.minX + 1) * (outer.maxY - outer.minY + 1);
    const fillRatio = outer.area / Math.max(1, bboxArea);
    if (enclosedCount >= 2 || (enclosedCount === 1 && fillRatio < 0.72)) {
      droppedOuterFrame = true;
      return false;
    }
    return true;
  });

  // Trace & simplify each kept region boundary
  const simpEps = Math.max(2.2, Math.min(pw, ph) * 0.015);
  const pixelPolys: Point[][] = [];
  for (const reg of finalRegions) {
    const contour = traceRegionBoundary(labels, pw, ph, reg);
    if (contour.length < 3) continue;
    let simplified = simplifyClosedPolygon(contour, simpEps);
    if (snapAngles) {
      simplified = snapOrthogonalEdges(simplified);
    }
    if (simplified.length >= 3) {
      pixelPolys.push(ensureClockwise(simplified));
    }
  }

  if (pixelPolys.length === 0) {
    return {
      width: pw,
      height: ph,
      paperBounds,
      panels: [],
      rawRegionCount: candidateRegions.length,
      droppedOuterFrame,
    };
  }

  let allMinX = Infinity;
  let allMinY = Infinity;
  let allMaxX = -Infinity;
  let allMaxY = -Infinity;
  for (const poly of pixelPolys) {
    for (const pt of poly) {
      if (pt.x < allMinX) allMinX = pt.x;
      if (pt.y < allMinY) allMinY = pt.y;
      if (pt.x > allMaxX) allMaxX = pt.x;
      if (pt.y > allMaxY) allMaxY = pt.y;
    }
  }
  const allW = Math.max(1, allMaxX - allMinX);
  const allH = Math.max(1, allMaxY - allMinY);

  const rawPanels: PanelPolygon[] = pixelPolys.map((poly) => ({
    id: makeId("tplp"),
    points: poly.map((pt) => ({
      x: clamp01(scaleMode === "fit" ? (pt.x - allMinX) / allW : pt.x / Math.max(1, pw - 1)),
      y: clamp01(scaleMode === "fit" ? (pt.y - allMinY) / allH : pt.y / Math.max(1, ph - 1)),
    })),
    borderWidth,
    borderColor: "#000000",
    borderStyle: "solid",
    floating: true,
    backgroundColor: "#ffffff",
  }));

  const panels = sortPanelsReadingOrder(rawPanels, rtl);

  return {
    width: pw,
    height: ph,
    paperBounds,
    panels,
    rawRegionCount: candidateRegions.length,
    droppedOuterFrame,
  };
}

/** Loads an uploaded image Blob/File in the browser, downsamples safely for fast pixel processing, and extracts panels. */
export async function extractPanelsFromImageFile(
  file: Blob,
  opts: TemplateExtractOptions = {},
): Promise<{
  result: ExtractedTemplateResult;
  previewDataUrl: string;
}> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read template image."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Unsupported or unreadable image file."));
    el.src = dataUrl;
  });

  const maxDim = 680;
  const scale = Math.min(1, maxDim / Math.max(1, img.naturalWidth, img.naturalHeight));
  const w = Math.max(16, Math.round(img.naturalWidth * scale));
  const h = Math.max(16, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("2D canvas context unavailable.");
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const result = extractPanelsFromRgba(imageData.data, w, h, opts);
  return { result, previewDataUrl: dataUrl };
}

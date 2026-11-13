import { jsPDF } from "jspdf";
import type { PageLayout, PlacedElement } from "./manga-layout";
import { panelBounds } from "./manga-layout";
import { toneDataUrl, fadeGeometry, type Screentone } from "./screentone";
import { fontStack, ensureFontsLoaded } from "./manga-fonts";
import { COMIC_MARK_PRESETS } from "./manga-effects";

/** Fill a polygon with a screentone, honouring rotation and fade. */
async function drawTone(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  box: { minX: number; minY: number; width: number; height: number },
  tone: Screentone,
  W: number,
  H: number,
  scale: number
) {
  const tile = await loadImage(toneDataUrl(tone));
  const off = document.createElement("canvas");
  off.width = Math.round(W * scale);
  off.height = Math.round(H * scale);
  const o = off.getContext("2d")!;
  o.scale(scale, scale);
  const pat = o.createPattern(tile, "repeat");
  if (!pat) return;
  pat.setTransform(new DOMMatrix().rotateSelf(tone.angle));
  o.beginPath();
  pts.forEach((p, i) => (i ? o.lineTo(p.x, p.y) : o.moveTo(p.x, p.y)));
  o.closePath();
  o.fillStyle = pat;
  o.fill();
  const g = fadeGeometry(tone.fade, box);
  if (g) {
    o.globalCompositeOperation = "destination-in";
    let grad: CanvasGradient;
    if (g.type === "linear") {
      grad = o.createLinearGradient(g.x1, g.y1, g.x2, g.y2);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
    } else {
      grad = o.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.r);
      grad.addColorStop(0, g.invert ? "rgba(0,0,0,0)" : "rgba(0,0,0,1)");
      grad.addColorStop(g.invert ? 0.35 : 0.2, g.invert ? "rgba(0,0,0,0)" : "rgba(0,0,0,1)");
      grad.addColorStop(1, g.invert ? "rgba(0,0,0,1)" : "rgba(0,0,0,0)");
    }
    o.fillStyle = grad;
    o.fillRect(box.minX - 20, box.minY - 20, box.width + 40, box.height + 40);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}
import { generateBalloonPath } from "./manga-effects";
import { markPath } from "./manga-marks";

export interface ExportOptions {
  scale?: number; // 1 = 72 DPI, 2 = 150 DPI, 3 or 4 = 300 DPI high-res print
  format?: "png" | "jpeg";
  quality?: number; // 0.1 to 1.0
  filename?: string;
}

/**
 * Loads an image from URL/dataURL into an HTMLImageElement asynchronously.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load element image: ${url}`));
    img.src = url;
  });
}

/**
 * Renders a complete Manga PageLayout onto an HTML5 2D Canvas with sub-pixel crispness.
 */
export async function renderPageToCanvas(
  layout: PageLayout,
  scale = 2
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const { width, height } = layout.format;
  await ensureFontsLoaded();

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to acquire 2D canvas context.");

  // Scale everything so math coordinates match page layout points
  ctx.scale(scale, scale);

  // 1. Page Background (Pure White paper)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Pre-load all element images
  const loadedImages = new Map<string, HTMLImageElement>();
  await Promise.all(
    layout.elements.map(async (el) => {
      try {
        const img = await loadImage(el.imageUrl);
        loadedImages.set(el.id, img);
      } catch (err) {
        console.warn("Could not load image for element", el.id, err);
      }
    })
  );

  // 2. Draw Panel Backgrounds & Inside Elements
  const orderedPanels = [...layout.panels].sort((a, b) => Number(!!a.floating) - Number(!!b.floating));
  for (const panel of orderedPanels) {
    const bounds = panelBounds(panel, layout.format);
    const pts = bounds.points;
    if (pts.length < 3) continue;

    // Panel Fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = panel.backgroundColor || "#ffffff";
    ctx.fill();
    if (panel.tone) {
      ctx.restore();
      await drawTone(ctx, pts, bounds, panel.tone, width, height, scale);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    }

    // Clip to panel geometry
    ctx.clip();

    // Draw Speed Lines assigned to this panel
    const panelSpeedLines = (layout.speedLines ?? []).filter((l) => l.panelId === panel.id);
    for (const effect of panelSpeedLines) {
      ctx.save();
      ctx.strokeStyle = effect.color || "#000000";
      ctx.lineWidth = effect.strokeWidth;

      if (effect.type === "radial") {
        const count = effect.density;
        const cx = effect.centerX;
        const cy = effect.centerY;
        const r1 = effect.innerRadius;
        const r2 = effect.outerRadius;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.02;
          const x1 = cx + Math.cos(angle) * r1;
          const y1 = cy + Math.sin(angle) * r1;
          const x2 = cx + Math.cos(angle) * r2;
          const y2 = cy + Math.sin(angle) * r2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      } else {
        // Linear parallel motion lines
        const rad = (effect.angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        for (let i = 0; i < effect.density; i++) {
          const offset = (i - effect.density / 2) * 12;
          const x1 = effect.centerX + offset * -sin - cos * effect.outerRadius;
          const y1 = effect.centerY + offset * cos - sin * effect.outerRadius;
          const x2 = effect.centerX + offset * -sin + cos * effect.outerRadius;
          const y2 = effect.centerY + offset * cos + sin * effect.outerRadius;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Draw In-Panel (non-breakout) Elements sorted by z-index
    const inPanelElements = layout.elements
      .filter((el) => el.panelId === panel.id && !el.breakout)
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const el of inPanelElements) {
      const img = loadedImages.get(el.id);
      if (!img) continue;

      ctx.save();
      ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
      ctx.drawImage(img, -el.width / 2, -el.height / 2, el.width, el.height);
      ctx.restore();
    }

    ctx.restore(); // Restore clip

    // 3. Draw Panel Border Stroke
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.lineWidth = panel.borderWidth;
    ctx.strokeStyle = panel.borderColor;
    ctx.lineJoin = "miter";
    if (panel.borderStyle === "dashed") ctx.setLineDash([8, 6]);
    if (panel.borderStyle === "dotted") ctx.setLineDash([3, 4]);
    if (panel.borderStyle !== "none" && panel.borderWidth > 0) ctx.stroke();
    ctx.restore();
  }

  // 4. Breakout Character Elements (Pop out over borders and gutters)
  const breakoutElements = layout.elements
    .filter((el) => el.breakout)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const el of breakoutElements) {
    const img = loadedImages.get(el.id);
    if (!img) continue;

    ctx.save();
    ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
    ctx.drawImage(img, -el.width / 2, -el.height / 2, el.width, el.height);
    ctx.restore();
  }

  // 5. Speech Balloons
  for (const b of layout.balloons ?? []) {
    ctx.save();
    const pathD = generateBalloonPath(b.shape, b.width, b.height, b.tailX, b.tailY, b.hasTail);
    const p2d = new Path2D(pathD);

    ctx.translate(b.x, b.y);
    ctx.fillStyle = b.backgroundColor || "#ffffff";
    ctx.fill(p2d);

    ctx.lineWidth = b.borderWidth ?? b.strokeWidth ?? 2.5;
    ctx.strokeStyle = b.borderColor || b.strokeColor || "#000000";
    ctx.lineJoin = "round";
    if (b.shape === "whisper") {
      ctx.setLineDash([5, 4]);
    }
    ctx.stroke(p2d);

    // Render Text
    ctx.fillStyle = b.fontColor || "#000000";
    ctx.font = `${b.fontWeight === "normal" ? "" : "bold "}${b.fontSize}px ${fontStack(b.fontFamily)}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (b.writingMode === "vertical-rl" || b.isVertical) {
      // Vertical Japanese reading order
      const chars = b.text.split("");
      const startY = b.height / 2 - ((chars.length - 1) * b.fontSize * 1.1) / 2;
      chars.forEach((char, idx) => {
        ctx.fillText(char, b.width / 2, startY + idx * b.fontSize * 1.1);
      });
    } else {
      // Horizontal text with auto line wrap
      const words = b.text.split(" ");
      let line = "";
      const lines: string[] = [];
      const maxWidth = b.width * 0.8;

      for (const w of words) {
        const testLine = line ? `${line} ${w}` : w;
        if (ctx.measureText(testLine).width > maxWidth && line) {
          lines.push(line);
          line = w;
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line);

      const lineHeight = b.fontSize * 1.25;
      const startY = b.height / 2 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((l, idx) => {
        ctx.fillText(l, b.width / 2, startY + idx * lineHeight);
      });
    }
    ctx.restore();
  }

  // 6. Comic Marks (Emotions & Symbols)
  for (const m of layout.comicMarks ?? []) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate((m.rotation * Math.PI) / 180);
    ctx.globalAlpha = m.opacity ?? 1;
    const glyph = COMIC_MARK_PRESETS.find((p) => p.type === m.markType || p.mark === m.type)?.mark ?? m.type;
    const vec = markPath(m.markType ?? COMIC_MARK_PRESETS.find((p) => p.mark === m.type)?.type);
    if (vec) {
      const sc = m.size / 100;
      ctx.scale(sc, sc);
      ctx.translate(-50, -50);
      for (const part of vec) {
        const p2 = new Path2D(part.d);
        if (part.fill && part.fill !== "none") { ctx.fillStyle = part.fill; ctx.fill(p2); }
        if (part.stroke) { ctx.strokeStyle = part.stroke; ctx.lineWidth = part.width ?? 4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(p2); }
      }
    } else {
      ctx.font = `${m.size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(glyph, 0, 0);
    }
    ctx.restore();
  }

  // 7. SFX Stamps (Heavy Onomatopoeia)
  for (const sfx of layout.sfxStamps ?? []) {
    ctx.save();
    ctx.translate(sfx.x, sfx.y);
    ctx.rotate((sfx.rotation * Math.PI) / 180);
    // Skew transform
    const skewRad = ((sfx.skewX || 0) * Math.PI) / 180;
    ctx.transform(1, 0, Math.tan(skewRad), 1, 0, 0);

    ctx.globalAlpha = sfx.opacity ?? 1;
    ctx.font = `900 ${sfx.fontSize}px ${fontStack(sfx.fontFamily, "sfx")}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Stroke border
    ctx.lineWidth = sfx.strokeWidth;
    ctx.strokeStyle = sfx.strokeColor;
    ctx.lineJoin = "miter";
    ctx.miterLimit = 2;
    if (sfx.strokeWidth > 0) ctx.strokeText(sfx.text, 0, 0);

    // Fill
    ctx.fillStyle = sfx.fillColor;
    ctx.fillText(sfx.text, 0, 0);
    ctx.restore();
  }

  return canvas;
}

/**
 * Exports a single manga page as a high-resolution PNG or JPEG data URL.
 */
export async function exportPageAsImage(
  layout: PageLayout,
  options: ExportOptions = {}
): Promise<string> {
  const scale = options.scale ?? 2;
  const format = options.format ?? "png";
  const quality = options.quality ?? 0.95;

  const canvas = await renderPageToCanvas(layout, scale);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(mime, quality);
}

/**
 * Downloads a data URL as a file on the user's computer.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Compiles multiple manga pages into a printable, multi-page PDF book.
 */
export async function exportChapterAsPdf(
  pages: PageLayout[],
  options: { filename?: string; scale?: number } = {}
): Promise<void> {
  if (pages.length === 0) return;

  const scale = options.scale ?? 2;
  const firstFmt = pages[0].format;
  const orientation = firstFmt.height >= firstFmt.width ? "portrait" : "landscape";

  const pdf = new jsPDF({
    orientation,
    unit: "pt",
    format: [firstFmt.width, firstFmt.height],
  });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (i > 0) {
      pdf.addPage(
        [page.format.width, page.format.height],
        page.format.height >= page.format.width ? "portrait" : "landscape"
      );
    }

    const canvas = await renderPageToCanvas(page, scale);
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(imgData, "JPEG", 0, 0, page.format.width, page.format.height);
  }

  pdf.save(options.filename || `manga-chapter-${Date.now()}.pdf`);
}

/**
 * Calculates standard Webtoon vertical slice bounds (e.g. 800x1280 chunks).
 */
export function calculateWebtoonSlices(
  totalHeight: number,
  sliceHeight = 1280
): { startY: number; height: number }[] {
  const slices: { startY: number; height: number }[] = [];
  let y = 0;
  while (y < totalHeight) {
    const h = Math.min(sliceHeight, totalHeight - y);
    slices.push({ startY: y, height: h });
    y += sliceHeight;
  }
  return slices;
}

/**
 * Renders multiple pages or a vertical webtoon layout and slices it into standard
 * mobile webtoon strips (800px wide, max 1280px tall).
 */
export async function exportWebtoonSlices(
  pages: PageLayout[],
  sliceHeight = 1280
): Promise<string[]> {
  if (pages.length === 0) return [];

  // Render each page at 800px standard webtoon width
  const renderedCanvases: HTMLCanvasElement[] = [];
  for (const page of pages) {
    const targetScale = 800 / page.format.width;
    const c = await renderPageToCanvas(page, targetScale);
    renderedCanvases.push(c);
  }

  // Calculate total combined height
  const totalHeight = renderedCanvases.reduce((acc, c) => acc + c.height, 0);
  const combinedCanvas = document.createElement("canvas");
  combinedCanvas.width = 800;
  combinedCanvas.height = totalHeight;

  const combinedCtx = combinedCanvas.getContext("2d");
  if (!combinedCtx) throw new Error("Could not acquire combined canvas context");

  let currentY = 0;
  for (const c of renderedCanvases) {
    combinedCtx.drawImage(c, 0, currentY);
    currentY += c.height;
  }

  // Slice into segments
  const sliceMeta = calculateWebtoonSlices(totalHeight, sliceHeight);
  const results: string[] = [];

  for (const meta of sliceMeta) {
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = 800;
    sliceCanvas.height = meta.height;
    const sliceCtx = sliceCanvas.getContext("2d");
    if (!sliceCtx) continue;

    sliceCtx.drawImage(
      combinedCanvas,
      0,
      meta.startY,
      800,
      meta.height,
      0,
      0,
      800,
      meta.height
    );
    results.push(sliceCanvas.toDataURL("image/png"));
  }

  return results;
}


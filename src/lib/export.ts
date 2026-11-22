import { PAGE_LAYER_ID, panelBounds, type PageLayout, type PlacedElement } from "./manga-layout";
import {
  arrowHeadPolygon,
  lineDashArray,
  lineSegmentsForStyle,
  taperedNibPolygon,
  type DrawnLine,
} from "./drawn-lines";
import { toneDataUrl, fadeGeometry, type Screentone } from "./screentone";
import { fontStack, ensureFontsLoaded } from "./manga-fonts";
import {
  COMIC_MARK_PRESETS,
  buildBalloonRenderGeometry,
  generateSpeedWedges,
} from "./manga-effects";
import { tracePanelCanvasPath } from "./panel-geometry";
import { markPath } from "./manga-marks";

/** Fill a panel path with a screentone, honouring rotation, rounded/scalloped corners, and fade. */
async function drawTone(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  box: { minX: number; minY: number; width: number; height: number },
  tone: Screentone,
  W: number,
  H: number,
  scale: number,
  cornerRadius = 0,
  scalloped = false,
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
  tracePanelCanvasPath(o, pts, cornerRadius, scalloped);
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

const VERTICAL_ROTATE_CHARS = new Set(["ー", "—", "−", "…", "‥", "「", "」", "『", "』", "（", "）", "(", ")", "[", "]"]);

/**
 * Splits vertical Japanese (`vertical-rl`) balloon text into right-to-left columns,
 * respecting explicit newlines and wrapping when a column exceeds `maxHeight`.
 */
export function layoutVerticalColumns(
  text: string,
  fontSize: number,
  maxHeight: number,
): string[][] {
  const charStep = fontSize * 1.1;
  const maxChars = Math.max(1, Math.floor(Math.max(charStep, maxHeight) / charStep));
  const paragraphs = text.split(/\r?\n/);
  const cols: string[][] = [];

  for (const para of paragraphs) {
    const chars = Array.from(para);
    if (chars.length === 0) {
      cols.push([]);
      continue;
    }
    for (let i = 0; i < chars.length; i += maxChars) {
      cols.push(chars.slice(i, i + maxChars));
    }
  }
  return cols.length > 0 ? cols : [[]];
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

  const drawElementImage = (el: PlacedElement) => {
    const img = loadedImages.get(el.id);
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;
    ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
    ctx.drawImage(img, -el.width / 2, -el.height / 2, el.width, el.height);
    ctx.restore();
  };

  const panelIdSet = new Set(layout.panels.map((p) => p.id));
  const pageElements = layout.elements.filter((el) => el.panelId === PAGE_LAYER_ID);
  const pageKind = (el: PlacedElement) =>
    el.pageLayer?.kind ?? (el.type === "background" ? "behind" : "above");

  const drawStraightLine = (line: DrawnLine) => {
    ctx.save();
    ctx.globalAlpha = line.opacity ?? 1;
    ctx.strokeStyle = line.color || "#000000";
    ctx.fillStyle = line.color || "#000000";
    ctx.lineWidth = line.width;
    ctx.lineCap = line.style === "dotted" ? "round" : "butt";

    if (line.cap === "tapered" && line.style === "solid") {
      const nib = taperedNibPolygon(line);
      if (nib.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(nib[0].x, nib[0].y);
        for (let i = 1; i < nib.length; i++) ctx.lineTo(nib[i].x, nib[i].y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    const dash = lineDashArray(line.style, line.width);
    if (dash) ctx.setLineDash(dash);
    for (const seg of lineSegmentsForStyle(line)) {
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const fillArrow = (pts: { x: number; y: number }[]) => {
      if (pts.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
    };
    if (line.cap === "arrow" || line.cap === "both") {
      fillArrow(arrowHeadPolygon(line.x2, line.y2, line.x1, line.y1, line.width));
    }
    if (line.cap === "both") {
      fillArrow(arrowHeadPolygon(line.x1, line.y1, line.x2, line.y2, line.width));
    }
    ctx.restore();
  };

  // 1b. Page-level images & straight lines behind all panels
  pageElements
    .filter((el) => pageKind(el) === "behind")
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach(drawElementImage);

  (layout.drawnLines ?? [])
    .filter((l) => l.layer === "behind")
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach(drawStraightLine);

  // 2. Draw Panel Backgrounds & Inside Elements (plus panel-relative free page images)
  const orderedPanels = [...layout.panels].sort((a, b) => Number(!!a.floating) - Number(!!b.floating));
  for (const panel of orderedPanels) {
    const bounds = panelBounds(panel, layout.format);
    const pts = bounds.points;
    if (pts.length < 3) continue;

    pageElements
      .filter((el) => el.pageLayer?.kind === "below-panel" && el.pageLayer.panelId === panel.id)
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(drawElementImage);

    // Panel Fill (supports transparent fills so backdrop images show through)
    ctx.save();
    ctx.globalAlpha = panel.opacity ?? 1;
    tracePanelCanvasPath(ctx, pts, panel.cornerRadius ?? 0, Boolean(panel.scalloped));
    if (panel.backgroundColor !== "transparent") {
      ctx.fillStyle = panel.backgroundColor || "#ffffff";
      ctx.fill();
    }
    if (panel.tone) {
      ctx.restore();
      await drawTone(
        ctx,
        pts,
        bounds,
        panel.tone,
        width,
        height,
        scale,
        panel.cornerRadius ?? 0,
        Boolean(panel.scalloped),
      );
      ctx.save();
      tracePanelCanvasPath(ctx, pts, panel.cornerRadius ?? 0, Boolean(panel.scalloped));
    }

    // Clip to panel geometry
    ctx.clip();

    // Draw Tapered Ink Speed Lines assigned to this panel
    const panelSpeedLines = (layout.speedLines ?? []).filter((l) => l.panelId === panel.id);
    for (const effect of panelSpeedLines) {
      ctx.save();
      ctx.fillStyle = effect.color || "#000000";
      ctx.globalAlpha = effect.opacity ?? 1;
      for (const poly of generateSpeedWedges(effect)) {
        if (poly.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for (let k = 1; k < poly.length; k++) ctx.lineTo(poly[k].x, poly[k].y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw In-Panel (non-breakout) Elements sorted by z-index
    layout.elements
      .filter((el) => el.panelId === panel.id && !el.breakout)
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(drawElementImage);

    ctx.restore(); // Restore clip

    // 3. Draw Panel Border Stroke
    ctx.save();
    ctx.globalAlpha = panel.opacity ?? 1;
    tracePanelCanvasPath(ctx, pts, panel.cornerRadius ?? 0, Boolean(panel.scalloped));
    ctx.lineWidth = panel.borderWidth;
    ctx.strokeStyle = panel.borderColor;
    ctx.lineJoin = panel.cornerRadius || panel.scalloped ? "round" : "miter";
    if (panel.borderStyle === "dashed") ctx.setLineDash([8, 6]);
    if (panel.borderStyle === "dotted") ctx.setLineDash([3, 4]);
    if (panel.borderStyle !== "none" && panel.borderWidth > 0) ctx.stroke();
    ctx.restore();

    pageElements
      .filter((el) => el.pageLayer?.kind === "above-panel" && el.pageLayer.panelId === panel.id)
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach(drawElementImage);
  }

  // 4. Page-level above images & Breakout Character Elements
  pageElements
    .filter((el) => {
      const lyr = el.pageLayer;
      if (!lyr) return el.type !== "background";
      if (lyr.kind === "above") return true;
      if ((lyr.kind === "below-panel" || lyr.kind === "above-panel") && !panelIdSet.has(lyr.panelId)) return true;
      return false;
    })
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach(drawElementImage);

  layout.elements
    .filter((el) => el.panelId !== PAGE_LAYER_ID && el.breakout)
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach(drawElementImage);

  (layout.drawnLines ?? [])
    .filter((l) => l.layer !== "behind")
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach(drawStraightLine);

  // 5. Speech Balloons & Narration Caption Boxes
  for (const b of layout.balloons ?? []) {
    ctx.save();
    const geom = buildBalloonRenderGeometry(b);
    const bodyP2d = new Path2D(geom.bodyPath);
    const tailP2ds = geom.pointedTailPaths.map((d) => new Path2D(d));
    const strokeW = b.borderWidth ?? b.strokeWidth ?? 2.5;
    const strokeCol = b.borderColor || b.strokeColor || "#000000";
    const fillCol = b.backgroundColor || "#ffffff";

    ctx.translate(b.x, b.y);
    ctx.globalAlpha = b.opacity ?? 1;

    if (b.shadow ?? b.shape === "narration") {
      ctx.save();
      ctx.translate(3, 3);
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.fill(bodyP2d);
      for (const tp of tailP2ds) ctx.fill(tp);
      for (const circle of geom.thoughtCircles) {
        ctx.beginPath();
        ctx.arc(circle.cx, circle.cy, circle.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const useMergedStrokePass = tailP2ds.length > 0 && fillCol !== "transparent" && strokeW > 0;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.miterLimit = 3;
    if (b.shape === "whisper") {
      ctx.setLineDash([5, 4]);
    }

    if (useMergedStrokePass) {
      // Pass 1: Double-width outer stroke beneath unified fill so tail roots have no border seam
      ctx.lineWidth = strokeW * 2;
      ctx.strokeStyle = strokeCol;
      ctx.stroke(bodyP2d);
      for (const tp of tailP2ds) ctx.stroke(tp);

      // Pass 2: Solid interior fill mask
      ctx.fillStyle = fillCol;
      ctx.fill(bodyP2d);
      for (const tp of tailP2ds) ctx.fill(tp);
    } else {
      if (fillCol !== "transparent") {
        ctx.fillStyle = fillCol;
        ctx.fill(bodyP2d);
        for (const tp of tailP2ds) ctx.fill(tp);
      }
      if (strokeW > 0) {
        ctx.lineWidth = strokeW;
        ctx.strokeStyle = strokeCol;
        ctx.stroke(bodyP2d);
        for (const tp of tailP2ds) ctx.stroke(tp);
      }
    }
    ctx.restore();

    if (geom.thoughtCircles.length > 0) {
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = strokeCol;
      for (const circle of geom.thoughtCircles) {
        ctx.beginPath();
        ctx.arc(circle.cx, circle.cy, circle.r, 0, Math.PI * 2);
        if (fillCol !== "transparent") {
          ctx.fillStyle = fillCol;
          ctx.fill();
        }
        if (strokeW > 0) ctx.stroke();
      }
      ctx.restore();
    }

    if ((b.doubleBorder || b.shape === "narration") && b.width > 20 && b.height > 20) {
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(0.8, strokeW * 0.42);
      ctx.strokeRect(7.5, 7.5, Math.max(4, b.width - 15), Math.max(4, b.height - 15));
      ctx.restore();
    }

    // Render Text
    ctx.fillStyle = b.fontColor || "#000000";
    ctx.font = `${b.fontWeight === "normal" ? "" : "bold "}${b.fontSize}px ${fontStack(b.fontFamily)}`;
    ctx.textBaseline = "middle";

    if (b.writingMode === "vertical-rl" || b.isVertical) {
      ctx.textAlign = "center";
      // Vertical Japanese reading order (right-to-left columns, wrapping by height & newlines)
      const charStep = b.fontSize * 1.1;
      const colStep = b.fontSize * 1.25;
      const cols = layoutVerticalColumns(b.text, b.fontSize, b.height * 0.76);
      const startX = b.width / 2 + ((cols.length - 1) * colStep) / 2;
      cols.forEach((colChars, colIdx) => {
        const colX = startX - colIdx * colStep;
        const startY = b.height / 2 - ((Math.max(1, colChars.length) - 1) * charStep) / 2;
        colChars.forEach((char, rowIdx) => {
          const cy = startY + rowIdx * charStep;
          if (VERTICAL_ROTATE_CHARS.has(char)) {
            ctx.save();
            ctx.translate(colX, cy);
            ctx.rotate(Math.PI / 2);
            ctx.fillText(char, 0, 0);
            ctx.restore();
          } else {
            ctx.fillText(char, colX, cy);
          }
        });
      });
    } else {
      // Horizontal text preserving explicit line breaks & configurable left/center/right alignment
      const align = b.textAlign ?? (b.shape === "narration" ? "left" : "center");
      const maxWidth = b.shape === "narration" ? b.width - 26 : b.width * 0.78;
      const paragraphs = b.text.split(/\r?\n/);
      const lines: string[] = [];

      for (const para of paragraphs) {
        const words = para.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
          lines.push("");
          continue;
        }
        let line = "";
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
      }

      ctx.textAlign = align;
      const textX = align === "left" ? 13 : align === "right" ? b.width - 13 : b.width / 2;
      const lineHeight = b.fontSize * 1.25;
      const startY = b.height / 2 - ((Math.max(1, lines.length) - 1) * lineHeight) / 2;
      lines.forEach((l, idx) => {
        ctx.fillText(l, textX, startY + idx * lineHeight);
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
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = (part.width ?? 4) + 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke(p2);
      }
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

    // Outer white halo for contrast over dark screentones
    const haloW = sfx.haloWidth ?? 3;
    if (haloW > 0) {
      ctx.lineWidth = sfx.strokeWidth + haloW * 2;
      ctx.strokeStyle = sfx.haloColor || "#ffffff";
      ctx.lineJoin = "round";
      ctx.strokeText(sfx.text, 0, 0);
    }

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

  const { jsPDF } = await import("jspdf");
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


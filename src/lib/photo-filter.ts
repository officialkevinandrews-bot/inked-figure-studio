export type ScreentoneStyle = "dots" | "crosshatch" | "lines" | "posterize";

export interface PhotoFilterOptions {
  edgeStrength: number; // 0.5 to 3.0 (default 1.6)
  edgeThreshold: number; // 10 to 100 (default 34)
  contrast: number; // 0.5 to 2.0 (default 1.25)
  brightness: number; // -100 to 100 (default 0)
  toneStyle: ScreentoneStyle;
  toneFrequency: number; // 4 to 20 (default 8)
  invertLines: boolean; // default false
  preserveWhiteBg: boolean; // default true
}

export const DEFAULT_FILTER_OPTIONS: PhotoFilterOptions = {
  edgeStrength: 1.6,
  edgeThreshold: 34,
  contrast: 1.25,
  brightness: 0,
  toneStyle: "dots",
  toneFrequency: 8,
  invertLines: false,
  preserveWhiteBg: true,
};

/**
 * Pure image data processor for Sobel ink outlines + manga tone thresholding.
 * Works both in browser (Canvas ImageData) and test mock environments.
 */
export function processMangaFilterImageData(
  source: { data: Uint8ClampedArray | number[]; width: number; height: number },
  options: Partial<PhotoFilterOptions> = {}
): Uint8ClampedArray {
  const opt: PhotoFilterOptions = { ...DEFAULT_FILTER_OPTIONS, ...options };
  const { width, height } = source;
  const inData = source.data;
  const outData = new Uint8ClampedArray(width * height * 4);

  // 1. Precalculate grayscale luminance buffer: Y = 0.299R + 0.587G + 0.114B
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = inData[i * 4];
    const g = inData[i * 4 + 1];
    const b = inData[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const freq = Math.max(2, Math.round(opt.toneFrequency));
  const halfFreq = freq / 2;

  // 2. Sobel edge detection & Screentone synthesis
  for (let y = 0; y < height; y++) {
    const yOff = y * width;
    const yAbove = Math.max(0, y - 1) * width;
    const yBelow = Math.min(height - 1, y + 1) * width;

    for (let x = 0; x < width; x++) {
      const idx = yOff + x;
      const xLeft = Math.max(0, x - 1);
      const xRight = Math.min(width - 1, x + 1);

      // Sobel kernels
      // Gx = [-1, 0, 1; -2, 0, 2; -1, 0, 1]
      const gx =
        -1 * gray[yAbove + xLeft] +
        1 * gray[yAbove + xRight] +
        -2 * gray[idx - (x - xLeft)] +
        2 * gray[idx + (xRight - x)] +
        -1 * gray[yBelow + xLeft] +
        1 * gray[yBelow + xRight];

      // Gy = [-1, -2, -1; 0, 0, 0; 1, 2, 1]
      const gy =
        -1 * gray[yAbove + xLeft] +
        -2 * gray[yAbove + x] +
        -1 * gray[yAbove + xRight] +
        1 * gray[yBelow + xLeft] +
        2 * gray[yBelow + x] +
        1 * gray[yBelow + xRight];

      const edgeMag = Math.sqrt(gx * gx + gy * gy) * opt.edgeStrength;
      const isEdge = edgeMag >= opt.edgeThreshold;

      const outIdx = idx * 4;

      if (isEdge) {
        // Outline ink line
        const inkVal = opt.invertLines ? 255 : 0;
        outData[outIdx] = inkVal;
        outData[outIdx + 1] = inkVal;
        outData[outIdx + 2] = inkVal;
        outData[outIdx + 3] = 255;
      } else {
        // Non-edge: Apply adjusted luminance + Screentone
        let lum = gray[idx];
        // Apply contrast & brightness
        lum = (lum - 128) * opt.contrast + 128 + opt.brightness;
        lum = Math.max(0, Math.min(255, lum));

        let pixelVal = 255; // White paper default

        if (lum < 50) {
          // Solid Black ink shadow
          pixelVal = 0;
        } else if (lum >= 220) {
          // Pure White highlight
          pixelVal = 255;
        } else {
          // Mid-tones: Screentone pattern
          if (opt.toneStyle === "dots") {
            // 45-degree angle dot screen
            const u = (x + y) % freq;
            const v = (x - y + freq * 1000) % freq;
            const distFromCenter = Math.hypot(u - halfFreq, v - halfFreq);

            // Invert lum to get darkness radius (0 = darkest, 255 = lightest)
            const darkness = (220 - lum) / 170; // 0 to 1
            const maxRadius = halfFreq * 1.15;
            const dotRadius = darkness * maxRadius;

            pixelVal = distFromCenter <= dotRadius ? 0 : 255;
          } else if (opt.toneStyle === "crosshatch") {
            const hatch1 = (x + y) % freq === 0;
            const hatch2 = lum < 140 && (x - y + freq * 1000) % freq === 0;
            pixelVal = hatch1 || hatch2 ? 0 : 255;
          } else if (opt.toneStyle === "lines") {
            const line = (x + y * 2) % freq <= 1;
            pixelVal = line && lum < 180 ? 0 : 255;
          } else {
            // Posterize stepped gray
            if (lum < 110) pixelVal = 64;
            else if (lum < 170) pixelVal = 140;
            else pixelVal = 220;
          }
        }

        outData[outIdx] = pixelVal;
        outData[outIdx + 1] = pixelVal;
        outData[outIdx + 2] = pixelVal;
        outData[outIdx + 3] = 255;
      }
    }
  }

  return outData;
}

/**
 * High-level helper that takes an image element or blob/dataURL, draws to an offscreen
 * canvas, applies the manga inking and screentone filter, and returns the result as a PNG data URL.
 */
export async function applyPhotoToMangaFilter(
  imageSource: HTMLImageElement | string,
  options: Partial<PhotoFilterOptions> = {}
): Promise<string> {
  let img: HTMLImageElement;

  if (typeof imageSource === "string") {
    img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load source image for manga filter."));
      img.src = imageSource;
    });
  } else {
    img = imageSource;
  }

  // Create offscreen processing canvas
  const canvas = document.createElement("canvas");
  const maxDim = 1600; // Cap dimension for snappy processing
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context.");

  ctx.drawImage(img, 0, 0, w, h);
  const srcImageData = ctx.getImageData(0, 0, w, h);

  const filteredData = processMangaFilterImageData(srcImageData, options);
  const outImageData = new ImageData(filteredData, w, h);
  ctx.putImageData(outImageData, 0, 0);

  return canvas.toDataURL("image/png");
}


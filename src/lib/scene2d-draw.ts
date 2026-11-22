import { extractMangaLineartCanvas, tintCustomPartCanvas } from "./character2d-slicer";
import { loadSceneImageElement2D } from "./scene2d-store";
import {
  BUILTIN_SCENE_OBJECTS,
  SCENE2D_H,
  SCENE2D_W,
  type Scene2D,
  type SceneDepthLayer,
  type SceneLighting2D,
  type SceneObjectAsset2D,
  type ScenePerspectiveGuide,
  type SceneRenderMode2D,
  type SceneStroke2D,
  type SceneTonePattern,
} from "./scene2d-types";

type C = CanvasRenderingContext2D;

const INK = "#151822";
const PURE_INK = "#000000";

const DEPTH_ORDER: Record<SceneDepthLayer, number> = {
  background: 0,
  midground: 1,
  foreground: 2,
};

function inkOf(mode: SceneRenderMode2D): string {
  return mode === "manga" ? PURE_INK : INK;
}

function parseRgb(hex: string): [number, number, number] {
  const c = (hex || "#64748b").replace("#", "").trim();
  if (c.length === 3) {
    return [parseInt(c[0]! + c[0]!, 16), parseInt(c[1]! + c[1]!, 16), parseInt(c[2]! + c[2]!, 16)];
  }
  const n = parseInt(c.slice(0, 6), 16);
  if (Number.isNaN(n)) return [100, 116, 139];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(hex: string, amount: number): string {
  const [r, g, b] = parseRgb(hex);
  const fn = (v: number) =>
    amount >= 0 ? Math.round(v + (255 - v) * amount) : Math.round(v * (1 + amount));
  return `rgb(${Math.max(0, Math.min(255, fn(r)))},${Math.max(0, Math.min(255, fn(g)))},${Math.max(0, Math.min(255, fn(b)))})`;
}

const PATTERN_CACHE = new Map<string, CanvasPattern | null>();
function getScreentonePattern(
  ctx: C,
  kind: SceneTonePattern,
  color = "#000000",
): CanvasPattern | null {
  const key = `${kind}|${color}`;
  if (PATTERN_CACHE.has(key)) return PATTERN_CACHE.get(key) ?? null;

  const tile = document.createElement("canvas");
  const size = kind === "hatch" ? 10 : kind === "dots-dark" ? 8 : kind === "dots-med" ? 10 : 12;
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;

  tctx.fillStyle = color;
  tctx.strokeStyle = color;
  if (kind === "hatch") {
    tctx.lineWidth = 1.25;
    tctx.beginPath();
    tctx.moveTo(0, size);
    tctx.lineTo(size, 0);
    tctx.moveTo(-2, 2);
    tctx.lineTo(2, -2);
    tctx.moveTo(size - 2, size + 2);
    tctx.lineTo(size + 2, size - 2);
    tctx.stroke();
  } else {
    const r = kind === "dots-dark" ? 2.1 : kind === "dots-med" ? 1.6 : 1.1;
    tctx.beginPath();
    tctx.arc(size * 0.25, size * 0.25, r, 0, Math.PI * 2);
    tctx.arc(size * 0.75, size * 0.75, r, 0, Math.PI * 2);
    tctx.fill();
  }
  const pat = ctx.createPattern(tile, "repeat");
  PATTERN_CACHE.set(key, pat);
  return pat;
}

function drawSceneShape(
  ctx: C,
  trace: () => void,
  fillHex: string,
  mode: SceneRenderMode2D,
  opts: {
    lw?: number;
    shade?: "left" | "right" | "bottom" | "none";
    mangaFill?: "white" | "black" | "dots-light" | "dots-med" | "dots-dark" | "hatch";
    noStroke?: boolean;
    bounds?: { x: number; y: number; w: number; h: number };
  } = {},
) {
  ctx.save();
  ctx.beginPath();
  trace();
  if (mode === "manga") {
    if (opts.mangaFill === "black") {
      ctx.fillStyle = PURE_INK;
    } else if (
      opts.mangaFill === "dots-light" ||
      opts.mangaFill === "dots-med" ||
      opts.mangaFill === "dots-dark" ||
      opts.mangaFill === "hatch"
    ) {
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      const pat = getScreentonePattern(ctx, opts.mangaFill, PURE_INK);
      if (pat) ctx.fillStyle = pat;
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fill();
    if (!opts.noStroke) {
      ctx.strokeStyle = PURE_INK;
      ctx.lineWidth = opts.lw ?? 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = fillHex;
  ctx.fill();

  if (opts.shade && opts.shade !== "none" && opts.bounds) {
    const b = opts.bounds;
    ctx.save();
    ctx.clip();
    ctx.fillStyle = mixHex(fillHex, -0.2);
    if (opts.shade === "right") ctx.fillRect(b.x + b.w * 0.72, b.y - 2, b.w * 0.35, b.h + 4);
    else if (opts.shade === "bottom") ctx.fillRect(b.x - 2, b.y + b.h * 0.74, b.w + 4, b.h * 0.3);
    else ctx.fillRect(b.x - 2, b.y - 2, b.w * 0.24, b.h + 4);
    ctx.restore();
  }

  if (!opts.noStroke) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = opts.lw ?? 2.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.restore();
}

function strokeLine(ctx: C, pts: [number, number][], mode: SceneRenderMode2D, lw = 1.8) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = inkOf(mode);
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.stroke();
  ctx.restore();
}

function applyLightingTint(hex: string, lighting: SceneLighting2D): string {
  if (lighting === "day") return hex;
  if (lighting === "sunset") return mixHex(hex, -0.12);
  if (lighting === "night") return mixHex(hex, -0.45);
  return mixHex(hex, -0.25);
}

/**
 * Draws the 1-point perspective room shell or outdoor horizon backdrop behind all scene objects.
 */
export function drawBackdrop2D(ctx: C, scene: Scene2D) {
  const mode = scene.renderMode;
  const id = scene.backdropId;
  const hy = Math.max(180, Math.min(620, scene.guides.horizonY));
  const vpx = Math.max(160, Math.min(1120, scene.guides.vp1X));
  const wallCol = applyLightingTint(scene.wallColor, scene.lighting);
  const floorCol = applyLightingTint(scene.floorColor, scene.lighting);
  const skyCol =
    scene.lighting === "sunset"
      ? "#fb923c"
      : scene.lighting === "night"
        ? "#0f172a"
        : scene.lighting === "dramatic"
          ? "#334155"
          : scene.skyColor;
  const accCol = applyLightingTint(scene.accentColor, scene.lighting);

  if (id === "blank") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SCENE2D_W, SCENE2D_H);
    return;
  }

  const isIndoor =
    id === "bedroom" ||
    id === "classroom" ||
    id === "living_room" ||
    id === "hallway" ||
    id === "cafe";

  if (isIndoor) {
    // 1-point room geometry relative to vanishing point (vpx, hy)
    const backH = Math.round(SCENE2D_H * 0.56);
    const backTop = Math.max(40, Math.round(hy - backH * 0.52));
    const backBot = Math.min(SCENE2D_H - 120, Math.round(hy + backH * 0.34));
    const backL = Math.max(95, Math.round(vpx - 445));
    const backR = Math.min(SCENE2D_W - 95, Math.round(vpx + 445));

    // Back wall
    drawSceneShape(ctx, () => ctx.rect(0, 0, SCENE2D_W, backBot), wallCol, mode, {
      lw: 2,
      noStroke: true,
      mangaFill: "white",
    });

    // Side walls in 1-point perspective
    drawSceneShape(
      ctx,
      () => {
        ctx.moveTo(0, 0);
        ctx.lineTo(backL, backTop);
        ctx.lineTo(backL, backBot);
        ctx.lineTo(0, SCENE2D_H - 20);
        ctx.closePath();
      },
      mode === "manga" ? "#ffffff" : mixHex(wallCol, -0.1),
      mode,
      { lw: 2.2, mangaFill: scene.lighting === "night" ? "dots-light" : "white" },
    );
    drawSceneShape(
      ctx,
      () => {
        ctx.moveTo(SCENE2D_W, 0);
        ctx.lineTo(backR, backTop);
        ctx.lineTo(backR, backBot);
        ctx.lineTo(SCENE2D_W, SCENE2D_H - 20);
        ctx.closePath();
      },
      mode === "manga" ? "#ffffff" : mixHex(wallCol, -0.14),
      mode,
      { lw: 2.2, mangaFill: scene.lighting === "dramatic" ? "hatch" : "dots-light" },
    );

    // Ceiling plane
    drawSceneShape(
      ctx,
      () => {
        ctx.moveTo(0, 0);
        ctx.lineTo(SCENE2D_W, 0);
        ctx.lineTo(backR, backTop);
        ctx.lineTo(backL, backTop);
        ctx.closePath();
      },
      mode === "manga" ? "#ffffff" : mixHex(wallCol, 0.16),
      mode,
      { lw: 2, mangaFill: "white" },
    );

    // Perspective floor plane
    drawSceneShape(
      ctx,
      () => {
        ctx.moveTo(backL, backBot);
        ctx.lineTo(backR, backBot);
        ctx.lineTo(SCENE2D_W, SCENE2D_H);
        ctx.lineTo(0, SCENE2D_H);
        ctx.closePath();
      },
      floorCol,
      mode,
      { lw: 2.4, mangaFill: id === "hallway" ? "dots-light" : "white" },
    );

    // Perspective floorboard / tile lines radiating cleanly from VP
    ctx.save();
    ctx.strokeStyle = mode === "manga" ? "#00000055" : mixHex(floorCol, -0.32);
    ctx.lineWidth = 1.4;
    const rays = 14;
    for (let i = 1; i < rays; i++) {
      const fx = (SCENE2D_W * i) / rays;
      const t = (backBot - hy) / Math.max(20, SCENE2D_H - hy);
      const sx = vpx + (fx - vpx) * t;
      ctx.beginPath();
      ctx.moveTo(sx, backBot);
      ctx.lineTo(fx, SCENE2D_H);
      ctx.stroke();
    }
    ctx.restore();

    // Baseboard molding trim along back wall & sides
    drawSceneShape(ctx, () => ctx.rect(backL, backBot - 16, backR - backL, 16), accCol, mode, {
      lw: 1.8,
      mangaFill: "dots-med",
    });

    // Backdrop-specific subtle architectural details
    if (id === "cafe" || id === "living_room") {
      // Lower wainscot wall rail
      const wainY = Math.round(backBot - (backBot - backTop) * 0.3);
      strokeLine(
        ctx,
        [
          [backL, wainY],
          [backR, wainY],
        ],
        mode,
        1.8,
      );
      for (let x = backL + 55; x < backR - 20; x += 72) {
        strokeLine(
          ctx,
          [
            [x, wainY + 6],
            [x, backBot - 22],
          ],
          mode,
          1.1,
        );
      }
    } else if (id === "hallway") {
      // Perspective locker bays & ceiling fluorescent lights
      for (let k = 0.25; k <= 0.8; k += 0.28) {
        const ly = backTop * k;
        const lx1 = vpx - (vpx - backL) * (0.4 + k * 0.4);
        const lx2 = vpx + (backR - vpx) * (0.4 + k * 0.4);
        drawSceneShape(ctx, () => ctx.rect(lx1, ly, lx2 - lx1, 14), "#f8fafc", mode, {
          lw: 1.6,
          mangaFill: "white",
        });
      }
    }
  } else {
    // Outdoor backdrops
    const skyH = Math.max(160, hy + 18);
    drawSceneShape(ctx, () => ctx.rect(0, 0, SCENE2D_W, skyH), skyCol, mode, {
      noStroke: true,
      mangaFill:
        scene.lighting === "night"
          ? "dots-dark"
          : scene.lighting === "sunset" || scene.lighting === "dramatic"
            ? "dots-light"
            : "white",
    });

    if (scene.lighting === "night" && mode === "color") {
      ctx.fillStyle = "#fef9c3";
      for (let i = 0; i < 28; i++) {
        const sx = (i * 197 + 43) % SCENE2D_W;
        const sy = (i * 71 + 19) % Math.max(80, skyH - 60);
        ctx.fillRect(sx, sy, i % 3 === 0 ? 3 : 2, i % 3 === 0 ? 3 : 2);
      }
    }

    if (id === "city_street" || id === "rooftop" || id === "alleyway") {
      // Distant skyline silhouettes along horizon
      const buildings = [
        [20, 140, 175],
        [150, 125, 225],
        [270, 110, 140],
        [375, 160, 250],
        [530, 115, 185],
        [640, 150, 260],
        [785, 120, 165],
        [900, 165, 235],
        [1060, 120, 190],
        [1170, 110, 155],
      ] as const;
      for (const [bx, bw, bh] of buildings) {
        const top = hy - bh * (id === "rooftop" ? 0.55 : 0.85);
        drawSceneShape(
          ctx,
          () => ctx.rect(bx, top, bw, hy - top + 6),
          mode === "manga" ? "#ffffff" : mixHex(wallCol, -0.18),
          mode,
          { lw: 1.8, mangaFill: "dots-light" },
        );
        // Little facade window ticks
        if (bh > 155) {
          for (let wy = top + 16; wy < hy - 18; wy += 24) {
            for (let wx = bx + 14; wx < bx + bw - 18; wx += 24) {
              ctx.fillStyle =
                scene.lighting === "night"
                  ? "#fef08a"
                  : mode === "manga"
                    ? "#00000044"
                    : mixHex(skyCol, -0.35);
              ctx.fillRect(wx, wy, 10, 12);
            }
          }
        }
      }
    } else if (id === "park_path" || id === "forest_clearing") {
      // Layered distant rolling tree hills
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(0, hy + 8);
          for (let x = 0; x <= SCENE2D_W; x += 64) {
            ctx.quadraticCurveTo(x + 32, hy - 54 - ((x * 13) % 38), x + 64, hy + 4);
          }
          ctx.lineTo(SCENE2D_W, hy + 18);
          ctx.lineTo(0, hy + 18);
          ctx.closePath();
        },
        mode === "manga" ? "#ffffff" : mixHex(accCol, -0.1),
        mode,
        { lw: 2, mangaFill: "dots-light" },
      );
    } else if (id === "beach_cliff") {
      // Calm ocean water band below horizon + shimmering wave lines
      const sandY = Math.min(SCENE2D_H - 180, hy + 145);
      drawSceneShape(
        ctx,
        () => ctx.rect(0, hy, SCENE2D_W, sandY - hy),
        mode === "manga" ? "#ffffff" : applyLightingTint("#0284c7", scene.lighting),
        mode,
        { lw: 2, mangaFill: "dots-med" },
      );
      for (let wy = hy + 18; wy < sandY - 12; wy += 20) {
        strokeLine(
          ctx,
          [
            [(wy * 17) % 300, wy],
            [((wy * 17) % 300) + 180, wy],
          ],
          mode,
          1.5,
        );
        strokeLine(
          ctx,
          [
            [620 + ((wy * 13) % 240), wy + 6],
            [850 + ((wy * 13) % 240), wy + 6],
          ],
          mode,
          1.5,
        );
      }
    }

    // Ground plane
    const groundY = id === "beach_cliff" ? Math.min(SCENE2D_H - 180, hy + 145) : hy;
    drawSceneShape(
      ctx,
      () => ctx.rect(0, groundY, SCENE2D_W, SCENE2D_H - groundY),
      floorCol,
      mode,
      { lw: 2.3, mangaFill: id === "alleyway" ? "dots-med" : "white" },
    );

    if (id === "city_street") {
      // Sidewalk curbs + perspective road lane dashes toward VP
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(vpx - 120, hy);
          ctx.lineTo(vpx + 120, hy);
          ctx.lineTo(SCENE2D_W - 140, SCENE2D_H);
          ctx.lineTo(140, SCENE2D_H);
          ctx.closePath();
        },
        mode === "manga" ? "#ffffff" : mixHex(floorCol, -0.25),
        mode,
        { lw: 2.2, mangaFill: "dots-light" },
      );
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? PURE_INK : "#fef08a";
      ctx.lineWidth = 4;
      ctx.setLineDash([28, 22]);
      ctx.beginPath();
      ctx.moveTo(vpx, hy + 12);
      ctx.lineTo(vpx, SCENE2D_H);
      ctx.stroke();
      ctx.restore();
    } else if (id === "park_path") {
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(vpx - 55, hy);
          ctx.lineTo(vpx + 55, hy);
          ctx.lineTo(SCENE2D_W - 220, SCENE2D_H);
          ctx.lineTo(220, SCENE2D_H);
          ctx.closePath();
        },
        mode === "manga" ? "#ffffff" : mixHex(floorCol, 0.22),
        mode,
        { lw: 2.2, mangaFill: "white" },
      );
    } else if (id === "alleyway") {
      // Left and right tight brick alley walls
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(0, 0);
          ctx.lineTo(vpx - 190, hy - 145);
          ctx.lineTo(vpx - 190, hy + 25);
          ctx.lineTo(0, SCENE2D_H);
          ctx.closePath();
        },
        mode === "manga" ? "#ffffff" : mixHex(wallCol, -0.18),
        mode,
        { lw: 2.5, mangaFill: "hatch" },
      );
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(SCENE2D_W, 0);
          ctx.lineTo(vpx + 190, hy - 145);
          ctx.lineTo(vpx + 190, hy + 25);
          ctx.lineTo(SCENE2D_W, SCENE2D_H);
          ctx.closePath();
        },
        mode === "manga" ? "#ffffff" : mixHex(wallCol, -0.24),
        mode,
        { lw: 2.5, mangaFill: "dots-dark" },
      );
    }
  }

  // Manga ink dramatic vignette or night tone wash overlay (subtle in Color Mode)
  if (mode === "color" && scene.lighting === "sunset") {
    ctx.save();
    ctx.fillStyle = "rgba(251, 146, 60, 0.14)";
    ctx.fillRect(0, 0, SCENE2D_W, SCENE2D_H);
    ctx.restore();
  } else if (mode === "color" && scene.lighting === "night") {
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.24)";
    ctx.fillRect(0, 0, SCENE2D_W, SCENE2D_H);
    ctx.restore();
  }
}

/**
 * Draws any built-in categorized manga object inside local centered coordinates `[-w/2..w/2, -h/2..h/2]`.
 */
export function drawBuiltinObject2D(
  ctx: C,
  id: string,
  w: number,
  h: number,
  primary: string,
  accent: string,
  mode: SceneRenderMode2D,
) {
  const hw = w / 2;
  const hh = h / 2;

  switch (id) {
    case "bed_single":
    case "bed_bunk": {
      const wood = id === "bed_bunk" ? "#78350f" : "#92400e";
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 4, -hh + 8, w * 0.28, h * 0.58, 4), wood, mode);
      drawSceneShape(ctx, () => ctx.rect(-hw + 4, hh - 34, w - 8, 22), wood, mode, {
        mangaFill: "dots-med",
      });
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + 12, -hh + 36, w - 24, h - 66, 8),
        accent,
        mode,
        {
          shade: "bottom",
          bounds: { x: -hw, y: -hh, w, h },
        },
      );
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + w * 0.28, -hh + 34, w * 0.68, h - 62, 10),
        primary,
        mode,
        {
          shade: "bottom",
          bounds: { x: -hw, y: -hh, w, h },
        },
      );
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + 22, -hh + 44, w * 0.19, h * 0.34, 8),
        "#ffffff",
        mode,
      );
      if (id === "bed_bunk") {
        drawSceneShape(
          ctx,
          () => ctx.roundRect(-hw + 28, -hh + h * 0.44, w * 0.19, h * 0.3, 8),
          "#ffffff",
          mode,
        );
      }
      strokeLine(
        ctx,
        [
          [-hw + w * 0.32, -hh + 48],
          [-hw + w * 0.54, hh * 0.15],
        ],
        mode,
        1.6,
      );
      break;
    }

    case "study_desk": {
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 2, -hh + 8, w - 4, 24, 3), primary, mode, {
        shade: "bottom",
        bounds: { x: -hw, y: -hh, w, h: 28 },
      });
      drawSceneShape(
        ctx,
        () => ctx.rect(-hw + 12, -hh + 32, 22, h - 38),
        mixHex(primary, -0.15),
        mode,
      );
      drawSceneShape(ctx, () => ctx.rect(hw - w * 0.36, -hh + 32, w * 0.34, h - 38), accent, mode, {
        mangaFill: "dots-light",
      });
      for (let i = 0; i < 3; i++) {
        const dy = -hh + 38 + i * ((h - 52) / 3);
        const dh = (h - 58) / 3;
        drawSceneShape(
          ctx,
          () => ctx.rect(hw - w * 0.33, dy, w * 0.28, dh),
          mixHex(primary, 0.08),
          mode,
        );
        strokeLine(
          ctx,
          [
            [hw - w * 0.22, dy + dh / 2],
            [hw - w * 0.16, dy + dh / 2],
          ],
          mode,
          2.2,
        );
      }
      break;
    }

    case "school_desk": {
      strokeLine(
        ctx,
        [
          [-hw + 20, -hh + 28],
          [-hw + 20, hh - 8],
        ],
        mode,
        4,
      );
      strokeLine(
        ctx,
        [
          [hw - 20, -hh + 28],
          [hw - 20, hh - 8],
        ],
        mode,
        4,
      );
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 8, -hh + 10, w - 16, 22, 3), primary, mode);
      drawSceneShape(
        ctx,
        () => ctx.rect(-hw + 22, -hh + 32, w - 44, 22),
        mixHex(primary, -0.2),
        mode,
      );
      // Tucked chair behind/underneath
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw * 0.45, hh * 0.05, w * 0.45, h * 0.24, 4),
        primary,
        mode,
      );
      strokeLine(
        ctx,
        [
          [-hw * 0.42, hh * 0.29],
          [-hw * 0.42, hh - 6],
        ],
        mode,
        3.5,
      );
      strokeLine(
        ctx,
        [
          [hw * 0.42, hh * 0.29],
          [hw * 0.42, hh - 6],
        ],
        mode,
        3.5,
      );
      break;
    }

    case "office_chair": {
      strokeLine(
        ctx,
        [
          [0, hh * 0.25],
          [0, hh - 14],
        ],
        mode,
        6,
      );
      strokeLine(
        ctx,
        [
          [-hw * 0.72, hh - 6],
          [0, hh - 16],
          [hw * 0.72, hh - 6],
        ],
        mode,
        4,
      );
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw * 0.68, -hh + 6, w * 0.68, h * 0.5, 10),
        primary,
        mode,
        { shade: "right", bounds: { x: -hw, y: -hh, w, h } },
      );
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw * 0.78, hh * 0.06, w * 0.78, h * 0.22, 7),
        accent,
        mode,
      );
      break;
    }

    case "bookshelf": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 4, -hh + 4, w - 8, h - 8), primary, mode, {
        shade: "right",
        bounds: { x: -hw, y: -hh, w, h },
      });
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const sy = -hh + 16 + r * ((h - 32) / rows);
        const sh = (h - 36) / rows - 8;
        drawSceneShape(
          ctx,
          () => ctx.rect(-hw + 14, sy, w - 28, sh),
          mixHex(primary, -0.35),
          mode,
          { mangaFill: "dots-light" },
        );
        let bx = -hw + 18;
        let idx = 0;
        while (bx < hw - 32) {
          const bw = 12 + ((r * 7 + idx * 5) % 9);
          const bh = sh * (0.72 + ((idx * 3 + r) % 4) * 0.06);
          const bcol = idx % 3 === 0 ? accent : idx % 3 === 1 ? "#dc2626" : "#f59e0b";
          drawSceneShape(ctx, () => ctx.rect(bx, sy + sh - bh, bw, bh), bcol, mode, { lw: 1.5 });
          bx += bw + 2;
          idx++;
        }
      }
      break;
    }

    case "sofa": {
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + 18, -hh + 8, w - 36, h * 0.56, 14),
        primary,
        mode,
        { shade: "bottom", bounds: { x: -hw, y: -hh, w, h } },
      );
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + 6, -hh + h * 0.3, w * 0.16, h * 0.56, 10),
        mixHex(primary, -0.1),
        mode,
      );
      drawSceneShape(
        ctx,
        () => ctx.roundRect(hw - w * 0.16 - 6, -hh + h * 0.3, w * 0.16, h * 0.56, 10),
        mixHex(primary, -0.1),
        mode,
      );
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + w * 0.15, -hh + h * 0.45, w * 0.7, h * 0.36, 8),
        mixHex(primary, 0.14),
        mode,
      );
      strokeLine(
        ctx,
        [
          [0, -hh + h * 0.45],
          [0, -hh + h * 0.81],
        ],
        mode,
        1.8,
      );
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + w * 0.18, -hh + h * 0.24, w * 0.15, h * 0.28, 6),
        accent,
        mode,
      );
      drawSceneShape(
        ctx,
        () => ctx.roundRect(hw - w * 0.33, -hh + h * 0.24, w * 0.15, h * 0.28, 6),
        accent,
        mode,
      );
      break;
    }

    case "coffee_table": {
      strokeLine(
        ctx,
        [
          [-hw + 28, 0],
          [-hw + 20, hh - 4],
        ],
        mode,
        5,
      );
      strokeLine(
        ctx,
        [
          [hw - 28, 0],
          [hw - 20, hh - 4],
        ],
        mode,
        5,
      );
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-hw + 22, -hh + 10);
          ctx.lineTo(hw - 22, -hh + 10);
          ctx.lineTo(hw - 4, 8);
          ctx.lineTo(-hw + 4, 8);
          ctx.closePath();
        },
        primary,
        mode,
      );
      drawSceneShape(ctx, () => ctx.rect(-hw + 4, 8, w - 8, 12), mixHex(primary, -0.2), mode);
      break;
    }

    case "wardrobe": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 6, -hh + 6, w - 12, h - 12), primary, mode);
      strokeLine(
        ctx,
        [
          [0, -hh + 14],
          [0, hh - 14],
        ],
        mode,
        2.2,
      );
      drawSceneShape(ctx, () => ctx.rect(14, -hh + 28, w * 0.32, h * 0.56), accent, mode, {
        mangaFill: "dots-light",
      });
      drawSceneShape(ctx, () => ctx.arc(18, 0, 5, 0, Math.PI * 2), "#eab308", mode);
      drawSceneShape(ctx, () => ctx.arc(-18, 0, 5, 0, Math.PI * 2), "#eab308", mode);
      break;
    }

    case "cafe_table": {
      drawSceneShape(
        ctx,
        () => ctx.ellipse(0, hh - 12, w * 0.32, 12, 0, 0, Math.PI * 2),
        accent,
        mode,
      );
      drawSceneShape(ctx, () => ctx.rect(-9, -hh + 34, 18, h - 46), accent, mode);
      drawSceneShape(
        ctx,
        () => ctx.ellipse(0, -hh + 26, hw - 6, 22, 0, 0, Math.PI * 2),
        primary,
        mode,
      );
      break;
    }

    case "cafe_chair": {
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + 18, -hh + 8, w - 36, h * 0.42, 6),
        primary,
        mode,
      );
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 14, hh * 0.04, w - 28, 18, 4), accent, mode);
      strokeLine(
        ctx,
        [
          [-hw + 20, hh * 0.04 + 18],
          [-hw + 14, hh - 6],
        ],
        mode,
        4,
      );
      strokeLine(
        ctx,
        [
          [hw - 20, hh * 0.04 + 18],
          [hw - 14, hh - 6],
        ],
        mode,
        4,
      );
      break;
    }

    case "floor_rug": {
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-hw + 44, -hh + 8);
          ctx.lineTo(hw - 44, -hh + 8);
          ctx.lineTo(hw - 8, hh - 8);
          ctx.lineTo(-hw + 8, hh - 8);
          ctx.closePath();
        },
        primary,
        mode,
        { mangaFill: "dots-light" },
      );
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-hw + 62, -hh + 20);
          ctx.lineTo(hw - 62, -hh + 20);
          ctx.lineTo(hw - 36, hh - 20);
          ctx.lineTo(-hw + 36, hh - 20);
          ctx.closePath();
        },
        accent,
        mode,
        { lw: 1.6 },
      );
      break;
    }

    case "window_day":
    case "window_school": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 4, -hh + 4, w - 8, h - 8), "#e2e8f0", mode);
      drawSceneShape(ctx, () => ctx.rect(-hw + 16, -hh + 16, w - 32, h - 32), primary, mode, {
        mangaFill: "white",
      });
      // Window mullions + manga sun-glare diagonal strokes
      const cols = id === "window_school" ? 3 : 2;
      for (let i = 1; i < cols; i++) {
        const mx = -hw + 16 + ((w - 32) * i) / cols;
        strokeLine(
          ctx,
          [
            [mx, -hh + 16],
            [mx, hh - 16],
          ],
          mode,
          3,
        );
      }
      strokeLine(
        ctx,
        [
          [-hw + 16, 0],
          [hw - 16, 0],
        ],
        mode,
        3,
      );
      strokeLine(
        ctx,
        [
          [-hw + 35, -hh + 45],
          [-hw + 75, -hh + 22],
        ],
        mode,
        1.6,
      );
      strokeLine(
        ctx,
        [
          [12, 24],
          [64, -14],
        ],
        mode,
        1.6,
      );
      if (id === "window_day") {
        // Draped side curtains
        drawSceneShape(
          ctx,
          () => {
            ctx.moveTo(-hw + 4, -hh + 6);
            ctx.lineTo(-hw + w * 0.24, -hh + 6);
            ctx.quadraticCurveTo(-hw + w * 0.14, 0, -hw + w * 0.22, hh - 6);
            ctx.lineTo(-hw + 4, hh - 6);
            ctx.closePath();
          },
          accent,
          mode,
          { mangaFill: "dots-light" },
        );
        drawSceneShape(
          ctx,
          () => {
            ctx.moveTo(hw - 4, -hh + 6);
            ctx.lineTo(hw - w * 0.24, -hh + 6);
            ctx.quadraticCurveTo(hw - w * 0.14, 0, hw - w * 0.22, hh - 6);
            ctx.lineTo(hw - 4, hh - 6);
            ctx.closePath();
          },
          accent,
          mode,
          { mangaFill: "dots-light" },
        );
      }
      break;
    }

    case "wood_door": {
      drawSceneShape(
        ctx,
        () => ctx.rect(-hw + 4, -hh + 4, w - 8, h - 4),
        mixHex(primary, -0.25),
        mode,
      );
      drawSceneShape(ctx, () => ctx.rect(-hw + 12, -hh + 12, w - 24, h - 12), primary, mode);
      drawSceneShape(
        ctx,
        () => ctx.rect(-hw + 24, -hh + 30, w - 48, h * 0.34),
        mixHex(primary, 0.12),
        mode,
      );
      drawSceneShape(
        ctx,
        () => ctx.rect(-hw + 24, 16, w - 48, h * 0.36),
        mixHex(primary, 0.12),
        mode,
      );
      drawSceneShape(ctx, () => ctx.arc(hw - 26, 6, 8, 0, Math.PI * 2), accent, mode);
      break;
    }

    case "sliding_door": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 4, -hh + 4, w - 8, h - 8), accent, mode);
      drawSceneShape(ctx, () => ctx.rect(-hw + 12, -hh + 12, w / 2 - 14, h - 24), primary, mode);
      drawSceneShape(
        ctx,
        () => ctx.rect(2, -hh + 12, w / 2 - 14, h - 24),
        mixHex(primary, -0.06),
        mode,
      );
      for (const sx of [-hw + 12, 2]) {
        const pw = w / 2 - 14;
        for (let i = 1; i < 4; i++)
          strokeLine(
            ctx,
            [
              [sx + (pw * i) / 4, -hh + 12],
              [sx + (pw * i) / 4, hh - 12],
            ],
            mode,
            1.3,
          );
        for (let j = 1; j < 6; j++)
          strokeLine(
            ctx,
            [
              [sx, -hh + 12 + ((h - 24) * j) / 6],
              [sx + pw, -hh + 12 + ((h - 24) * j) / 6],
            ],
            mode,
            1.3,
          );
      }
      break;
    }

    case "railing": {
      // Rooftop chain-link mesh + steel top/bottom rails
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? "#00000088" : accent;
      ctx.lineWidth = 1.4;
      const step = 22;
      for (let x = -hw; x <= hw; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, -hh + 14);
        ctx.lineTo(x + h * 0.4, hh - 14);
        ctx.moveTo(x + h * 0.4, -hh + 14);
        ctx.lineTo(x, hh - 14);
        ctx.stroke();
      }
      ctx.restore();
      for (const px of [-hw + 8, 0, hw - 8]) {
        drawSceneShape(ctx, () => ctx.rect(px - 6, -hh + 4, 12, h - 8), primary, mode);
      }
      drawSceneShape(ctx, () => ctx.rect(-hw, -hh + 6, w, 14), primary, mode);
      drawSceneShape(ctx, () => ctx.rect(-hw, hh - 20, w, 14), primary, mode);
      break;
    }

    case "stairs_up": {
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const y = hh - t0 * h;
        const sw = w * (1 - t0 * 0.38);
        drawSceneShape(
          ctx,
          () => ctx.rect(-sw / 2, y - h / steps, sw, h / steps + 2),
          i % 2 === 0 ? primary : mixHex(primary, -0.1),
          mode,
          { lw: 1.8, mangaFill: i % 2 === 0 ? "white" : "dots-light" },
        );
      }
      strokeLine(
        ctx,
        [
          [-hw + 10, hh - 40],
          [-hw * 0.56, -hh + 10],
        ],
        mode,
        4.5,
      );
      strokeLine(
        ctx,
        [
          [hw - 10, hh - 40],
          [hw * 0.56, -hh + 10],
        ],
        mode,
        4.5,
      );
      break;
    }

    case "pillar": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 6, -hh + 20, w - 12, h - 40), primary, mode, {
        shade: "right",
        bounds: { x: -hw, y: -hh, w, h },
        mangaFill: "dots-light",
      });
      drawSceneShape(ctx, () => ctx.rect(-hw, -hh + 4, w, 22), accent, mode);
      drawSceneShape(ctx, () => ctx.rect(-hw, hh - 26, w, 22), accent, mode);
      break;
    }

    case "arch_gate": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 42, -hh + 34, 34, h - 38), primary, mode);
      drawSceneShape(ctx, () => ctx.rect(hw - 76, -hh + 34, 34, h - 38), primary, mode);
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 4, -hh + 8, w - 8, 28, 6), primary, mode);
      drawSceneShape(ctx, () => ctx.rect(-hw + 22, -hh + 58, w - 44, 22), accent, mode);
      break;
    }

    case "brick_wall": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 4, -hh + 18, w - 8, h - 22), primary, mode, {
        mangaFill: "dots-light",
      });
      drawSceneShape(ctx, () => ctx.rect(-hw, -hh + 4, w, 18), accent, mode);
      for (let y = -hh + 42; y < hh - 10; y += 26) {
        strokeLine(
          ctx,
          [
            [-hw + 4, y],
            [hw - 4, y],
          ],
          mode,
          1.5,
        );
      }
      break;
    }

    case "ceiling_lamp": {
      strokeLine(
        ctx,
        [
          [0, -hh],
          [0, -10],
        ],
        mode,
        3,
      );
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-20, -14);
          ctx.lineTo(20, -14);
          ctx.lineTo(hw - 12, hh * 0.55);
          ctx.lineTo(-hw + 12, hh * 0.55);
          ctx.closePath();
        },
        accent,
        mode,
        { mangaFill: "dots-dark" },
      );
      drawSceneShape(ctx, () => ctx.arc(0, hh * 0.58, 16, 0, Math.PI), primary, mode);
      break;
    }

    case "tree_oak":
    case "tree_sakura": {
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-22, hh - 8);
          ctx.quadraticCurveTo(-14, 15, -18, -hh * 0.15);
          ctx.lineTo(18, -hh * 0.15);
          ctx.quadraticCurveTo(14, 15, 24, hh - 8);
          ctx.closePath();
        },
        accent,
        mode,
        { shade: "right", bounds: { x: -30, y: -40, w: 60, h }, mangaFill: "hatch" },
      );
      const puffs: [number, number, number][] = [
        [0, -hh * 0.45, hw * 0.58],
        [-hw * 0.42, -hh * 0.22, hw * 0.44],
        [hw * 0.42, -hh * 0.22, hw * 0.44],
        [-hw * 0.25, -hh * 0.55, hw * 0.36],
        [hw * 0.28, -hh * 0.52, hw * 0.38],
      ];
      for (const [px, py, pr] of puffs) {
        drawSceneShape(ctx, () => ctx.arc(px, py, pr, 0, Math.PI * 2), primary, mode, {
          shade: "bottom",
          bounds: { x: px - pr, y: py - pr, w: pr * 2, h: pr * 2 },
          mangaFill: id === "tree_sakura" ? "dots-light" : "dots-med",
        });
      }
      break;
    }

    case "bush_shrub": {
      drawSceneShape(
        ctx,
        () => {
          ctx.arc(-hw * 0.45, hh * 0.12, hw * 0.45, Math.PI, Math.PI * 2);
          ctx.arc(0, -hh * 0.05, hw * 0.52, Math.PI, Math.PI * 2);
          ctx.arc(hw * 0.45, hh * 0.12, hw * 0.45, Math.PI, Math.PI * 2);
          ctx.lineTo(hw - 6, hh - 8);
          ctx.lineTo(-hw + 6, hh - 8);
          ctx.closePath();
        },
        primary,
        mode,
        { shade: "bottom", bounds: { x: -hw, y: -hh, w, h }, mangaFill: "dots-med" },
      );
      break;
    }

    case "potted_plant": {
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-26, 10);
          ctx.lineTo(26, 10);
          ctx.lineTo(18, hh - 6);
          ctx.lineTo(-18, hh - 6);
          ctx.closePath();
        },
        accent,
        mode,
        { mangaFill: "dots-med" },
      );
      for (const ang of [-0.7, -0.3, 0, 0.35, 0.72]) {
        ctx.save();
        ctx.rotate(ang);
        drawSceneShape(
          ctx,
          () => ctx.ellipse(0, -hh * 0.38, 16, hh * 0.42, 0, 0, Math.PI * 2),
          primary,
          mode,
        );
        ctx.restore();
      }
      break;
    }

    case "boulder": {
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-hw + 8, hh - 8);
          ctx.lineTo(-hw + 22, -hh * 0.15);
          ctx.lineTo(-12, -hh + 12);
          ctx.lineTo(hw * 0.48, -hh * 0.3);
          ctx.lineTo(hw - 8, hh - 8);
          ctx.closePath();
        },
        primary,
        mode,
        { shade: "right", bounds: { x: -hw, y: -hh, w, h }, mangaFill: "dots-med" },
      );
      strokeLine(
        ctx,
        [
          [-12, -hh + 12],
          [-4, 18],
          [26, hh - 10],
        ],
        mode,
        1.8,
      );
      break;
    }

    case "fluffy_cloud": {
      drawSceneShape(
        ctx,
        () => {
          ctx.arc(-hw * 0.45, 8, hw * 0.34, Math.PI * 0.85, Math.PI * 1.9);
          ctx.arc(-8, -14, hw * 0.4, Math.PI * 1.05, Math.PI * 1.95);
          ctx.arc(hw * 0.44, 6, hw * 0.32, Math.PI * 1.15, Math.PI * 0.15);
          ctx.lineTo(-hw + 20, hh * 0.48);
          ctx.closePath();
        },
        primary,
        mode,
        { shade: "bottom", bounds: { x: -hw, y: -hh, w, h }, mangaFill: "white" },
      );
      break;
    }

    case "crescent_moon": {
      drawSceneShape(ctx, () => ctx.arc(0, 0, Math.min(hw, hh) - 8, 0, Math.PI * 2), primary, mode);
      drawSceneShape(ctx, () => ctx.arc(-14, -12, 12, 0, Math.PI * 2), accent, mode, {
        lw: 1.2,
        mangaFill: "dots-light",
      });
      drawSceneShape(ctx, () => ctx.arc(18, 16, 16, 0, Math.PI * 2), accent, mode, {
        lw: 1.2,
        mangaFill: "dots-light",
      });
      break;
    }

    case "sakura_petals": {
      for (let i = 0; i < 16; i++) {
        const px = -hw + 20 + ((i * 73) % Math.max(40, w - 40));
        const py = -hh + 20 + ((i * 47) % Math.max(40, h - 40));
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((i * 37 * Math.PI) / 180);
        drawSceneShape(ctx, () => ctx.ellipse(0, 0, 10, 5.5, 0, 0, Math.PI * 2), primary, mode, {
          lw: 1.4,
          mangaFill: "white",
        });
        ctx.restore();
      }
      break;
    }

    case "tall_grass": {
      for (let x = -hw + 14; x < hw - 10; x += 18) {
        const tipX = x + ((x * 3) % 24) - 10;
        drawSceneShape(
          ctx,
          () => {
            ctx.moveTo(x - 7, hh - 6);
            ctx.quadraticCurveTo(x, -hh * 0.2, tipX, -hh + 10 + (Math.abs(x) % 22));
            ctx.quadraticCurveTo(x + 8, 0, x + 7, hh - 6);
            ctx.closePath();
          },
          primary,
          mode,
        );
      }
      break;
    }

    case "monitor_pc":
    case "laptop":
    case "flatscreen_tv": {
      if (id === "flatscreen_tv") {
        drawSceneShape(ctx, () => ctx.rect(-hw + 8, hh * 0.34, w - 16, hh * 0.6), accent, mode);
        drawSceneShape(
          ctx,
          () => ctx.roundRect(-hw + 20, -hh + 8, w - 40, h * 0.56, 6),
          primary,
          mode,
          { mangaFill: "black" },
        );
        drawSceneShape(ctx, () => ctx.rect(-hw + 32, -hh + 20, w - 64, h * 0.44), "#1e293b", mode, {
          mangaFill: "dots-dark",
        });
        strokeLine(
          ctx,
          [
            [-hw + 52, -hh + 38],
            [-hw + 95, -hh + 26],
          ],
          mode,
          2,
        );
      } else if (id === "monitor_pc") {
        drawSceneShape(ctx, () => ctx.rect(-14, hh * 0.25, 28, hh * 0.38), primary, mode);
        drawSceneShape(ctx, () => ctx.ellipse(0, hh - 12, 34, 8, 0, 0, Math.PI * 2), primary, mode);
        drawSceneShape(
          ctx,
          () => ctx.roundRect(-hw + 6, -hh + 6, w - 12, h * 0.68, 5),
          primary,
          mode,
        );
        drawSceneShape(ctx, () => ctx.rect(-hw + 14, -hh + 14, w - 28, h * 0.54), accent, mode, {
          mangaFill: "dots-light",
        });
      } else {
        drawSceneShape(
          ctx,
          () => ctx.roundRect(-hw + 12, -hh + 6, w - 24, h * 0.58, 4),
          primary,
          mode,
        );
        drawSceneShape(ctx, () => ctx.rect(-hw + 18, -hh + 12, w - 36, h * 0.46), accent, mode, {
          mangaFill: "dots-light",
        });
        drawSceneShape(
          ctx,
          () => {
            ctx.moveTo(-hw + 12, -hh + h * 0.64);
            ctx.lineTo(hw - 12, -hh + h * 0.64);
            ctx.lineTo(hw - 2, hh - 8);
            ctx.lineTo(-hw + 2, hh - 8);
            ctx.closePath();
          },
          mixHex(primary, -0.15),
          mode,
        );
      }
      break;
    }

    case "desk_lamp": {
      drawSceneShape(ctx, () => ctx.ellipse(0, hh - 10, 26, 8, 0, 0, Math.PI * 2), primary, mode);
      strokeLine(
        ctx,
        [
          [0, hh - 12],
          [-18, 0],
          [8, -hh + 26],
        ],
        mode,
        4,
      );
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-6, -hh + 16);
          ctx.lineTo(24, -hh + 24);
          ctx.lineTo(30, -hh + 48);
          ctx.lineTo(-14, -hh + 40);
          ctx.closePath();
        },
        primary,
        mode,
      );
      break;
    }

    case "wall_clock": {
      const r = Math.min(hw, hh) - 6;
      drawSceneShape(ctx, () => ctx.arc(0, 0, r, 0, Math.PI * 2), primary, mode);
      drawSceneShape(ctx, () => ctx.arc(0, 0, r - 6, 0, Math.PI * 2), "#ffffff", mode, { lw: 1.5 });
      strokeLine(
        ctx,
        [
          [0, 0],
          [0, -r * 0.55],
        ],
        mode,
        2.4,
      );
      strokeLine(
        ctx,
        [
          [0, 0],
          [r * 0.42, r * 0.14],
        ],
        mode,
        2.4,
      );
      break;
    }

    case "fridge": {
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 6, -hh + 6, w - 12, h - 12, 8), primary, mode, {
        shade: "right",
        bounds: { x: -hw, y: -hh, w, h },
      });
      strokeLine(
        ctx,
        [
          [-hw + 6, -hh + h * 0.34],
          [hw - 6, -hh + h * 0.34],
        ],
        mode,
        2.2,
      );
      strokeLine(
        ctx,
        [
          [hw - 22, -hh + h * 0.12],
          [hw - 22, -hh + h * 0.28],
        ],
        mode,
        3,
      );
      strokeLine(
        ctx,
        [
          [hw - 22, -hh + h * 0.42],
          [hw - 22, -hh + h * 0.62],
        ],
        mode,
        3,
      );
      break;
    }

    case "arcade_cab": {
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-hw + 14, -hh + 8);
          ctx.lineTo(hw - 14, -hh + 8);
          ctx.lineTo(hw - 6, -hh + h * 0.22);
          ctx.lineTo(hw - 6, hh - 8);
          ctx.lineTo(-hw + 6, hh - 8);
          ctx.lineTo(-hw + 6, -hh + h * 0.22);
          ctx.closePath();
        },
        primary,
        mode,
        { shade: "right", bounds: { x: -hw, y: -hh, w, h } },
      );
      drawSceneShape(ctx, () => ctx.rect(-hw + 18, -hh + 16, w - 36, 26), accent, mode);
      drawSceneShape(ctx, () => ctx.rect(-hw + 18, -hh + 52, w - 36, h * 0.3), "#0f172a", mode, {
        mangaFill: "dots-dark",
      });
      drawSceneShape(ctx, () => ctx.rect(-hw + 8, hh * 0.05, w - 16, 18), accent, mode);
      break;
    }

    case "ac_unit": {
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 6, -hh + 6, w - 12, h - 12, 8), primary, mode);
      drawSceneShape(ctx, () => ctx.rect(-hw + 18, 6, w - 36, 12), accent, mode, {
        mangaFill: "dots-dark",
      });
      break;
    }

    case "speaker_tower": {
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 6, -hh + 6, w - 12, h - 12, 6), primary, mode, {
        mangaFill: "dots-dark",
      });
      drawSceneShape(ctx, () => ctx.arc(0, -hh * 0.34, w * 0.2, 0, Math.PI * 2), accent, mode);
      drawSceneShape(ctx, () => ctx.arc(0, hh * 0.3, w * 0.32, 0, Math.PI * 2), accent, mode);
      break;
    }

    case "chalkboard": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 4, -hh + 4, w - 8, h - 16), accent, mode);
      drawSceneShape(ctx, () => ctx.rect(-hw + 14, -hh + 14, w - 28, h - 38), primary, mode, {
        mangaFill: "dots-dark",
      });
      drawSceneShape(ctx, () => ctx.rect(-hw + 6, hh - 16, w - 12, 12), accent, mode);
      break;
    }

    case "lockers": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 6, -hh + 6, w - 12, h - 12), primary, mode);
      const cols = 4;
      const cw = (w - 20) / cols;
      for (let i = 0; i < cols; i++) {
        const lx = -hw + 10 + i * cw;
        drawSceneShape(
          ctx,
          () => ctx.rect(lx + 2, -hh + 14, cw - 4, h - 28),
          mixHex(primary, 0.08),
          mode,
          { lw: 1.5 },
        );
        for (let v = 0; v < 3; v++)
          strokeLine(
            ctx,
            [
              [lx + 10, -hh + 28 + v * 7],
              [lx + cw - 10, -hh + 28 + v * 7],
            ],
            mode,
            1.5,
          );
        strokeLine(
          ctx,
          [
            [lx + cw - 10, 0],
            [lx + cw - 10, 22],
          ],
          mode,
          2.2,
        );
      }
      break;
    }

    case "vending_machine": {
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 6, -hh + 6, w - 12, h - 12, 6), primary, mode, {
        shade: "right",
        bounds: { x: -hw, y: -hh, w, h },
      });
      drawSceneShape(ctx, () => ctx.rect(-hw + 16, -hh + 18, w - 32, h * 0.48), accent, mode, {
        mangaFill: "white",
      });
      for (let r = 0; r < 3; r++) {
        const cy = -hh + 34 + r * (h * 0.14);
        strokeLine(
          ctx,
          [
            [-hw + 20, cy + 16],
            [hw - 20, cy + 16],
          ],
          mode,
          1.8,
        );
        for (let c = -hw + 28; c < hw - 32; c += 22) {
          drawSceneShape(
            ctx,
            () => ctx.rect(c, cy - 8, 12, 20),
            r % 2 === 0 ? "#ef4444" : "#2563eb",
            mode,
            { lw: 1.2 },
          );
        }
      }
      drawSceneShape(ctx, () => ctx.rect(-hw + 20, hh * 0.38, w - 44, h * 0.18), "#1e293b", mode, {
        mangaFill: "black",
      });
      break;
    }

    case "street_lamp": {
      drawSceneShape(ctx, () => ctx.rect(-9, -hh + 28, 18, h - 34), primary, mode);
      drawSceneShape(ctx, () => ctx.rect(-20, hh - 26, 40, 20), primary, mode);
      drawSceneShape(ctx, () => ctx.roundRect(-34, -hh + 6, 68, 28, 8), accent, mode);
      break;
    }

    case "power_pole": {
      drawSceneShape(ctx, () => ctx.rect(-13, -hh + 12, 26, h - 16), primary, mode, {
        shade: "right",
        bounds: { x: -16, y: -hh, w: 32, h },
        mangaFill: "dots-med",
      });
      drawSceneShape(ctx, () => ctx.rect(-hw * 0.55, -hh + 36, hw * 1.1, 10), accent, mode);
      drawSceneShape(ctx, () => ctx.rect(-hw * 0.45, -hh + 74, hw * 0.9, 10), accent, mode);
      drawSceneShape(ctx, () => ctx.roundRect(14, -hh + 96, 36, 56, 4), primary, mode);
      strokeLine(
        ctx,
        [
          [-hw, -hh + 10],
          [-hw * 0.5, -hh + 36],
          [hw * 0.5, -hh + 36],
          [hw, -hh + 18],
        ],
        mode,
        1.8,
      );
      break;
    }

    case "park_bench": {
      for (const y of [-hh + 14, -hh + 38, -hh + 62]) {
        drawSceneShape(ctx, () => ctx.rect(-hw + 16, y, w - 32, 16), primary, mode);
      }
      drawSceneShape(ctx, () => ctx.rect(-hw + 8, 6, w - 16, 22), primary, mode);
      strokeLine(
        ctx,
        [
          [-hw + 22, hh * 0.25],
          [-hw + 22, hh - 6],
        ],
        mode,
        5,
      );
      strokeLine(
        ctx,
        [
          [hw - 22, hh * 0.25],
          [hw - 22, hh - 6],
        ],
        mode,
        5,
      );
      break;
    }

    case "trash_bin": {
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + 12, -hh + 24, w - 24, h - 30, 6),
        primary,
        mode,
        { mangaFill: "dots-med" },
      );
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 6, -hh + 10, w - 12, 18, 4), accent, mode);
      strokeLine(
        ctx,
        [
          [-18, -hh + 34],
          [-18, hh - 16],
        ],
        mode,
        1.8,
      );
      strokeLine(
        ctx,
        [
          [0, -hh + 34],
          [0, hh - 16],
        ],
        mode,
        1.8,
      );
      strokeLine(
        ctx,
        [
          [18, -hh + 34],
          [18, hh - 16],
        ],
        mode,
        1.8,
      );
      break;
    }

    case "traffic_cone": {
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 6, hh - 20, w - 12, 14, 3), primary, mode);
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-10, -hh + 8);
          ctx.lineTo(10, -hh + 8);
          ctx.lineTo(hw - 14, hh - 20);
          ctx.lineTo(-hw + 14, hh - 20);
          ctx.closePath();
        },
        primary,
        mode,
      );
      drawSceneShape(ctx, () => ctx.rect(-18, -10, 36, 18), accent, mode);
      break;
    }

    case "neon_sign": {
      strokeLine(
        ctx,
        [
          [-hw + 4, -hh + 40],
          [-hw + 22, -hh + 40],
        ],
        mode,
        4,
      );
      strokeLine(
        ctx,
        [
          [-hw + 4, hh - 40],
          [-hw + 22, hh - 40],
        ],
        mode,
        4,
      );
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 20, -hh + 8, w - 28, h - 16, 8), accent, mode);
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + 28, -hh + 16, w - 44, h - 32, 6),
        primary,
        mode,
        {
          mangaFill: "white",
        },
      );
      ctx.save();
      ctx.fillStyle = mode === "manga" ? PURE_INK : "#ffffff";
      ctx.font = `900 ${Math.round(w * 0.22)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const letters = ["O", "P", "E", "N"];
      letters.forEach((ch, idx) => ctx.fillText(ch, 8, -hh + 50 + idx * ((h - 90) / 3)));
      ctx.restore();
      break;
    }

    case "sedan_car": {
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-hw + 18, 0);
          ctx.lineTo(-hw * 0.65, -hh + 42);
          ctx.lineTo(-hw * 0.32, -hh + 8);
          ctx.lineTo(hw * 0.36, -hh + 8);
          ctx.lineTo(hw * 0.72, -hh + 46);
          ctx.lineTo(hw - 12, 4);
          ctx.lineTo(hw - 12, hh - 28);
          ctx.lineTo(-hw + 16, hh - 28);
          ctx.closePath();
        },
        primary,
        mode,
        { shade: "bottom", bounds: { x: -hw, y: -hh, w, h } },
      );
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-hw * 0.56, -6);
          ctx.lineTo(-hw * 0.28, -hh + 20);
          ctx.lineTo(hw * 0.3, -hh + 20);
          ctx.lineTo(hw * 0.6, -6);
          ctx.closePath();
        },
        accent,
        mode,
        { mangaFill: "dots-light" },
      );
      drawSceneShape(ctx, () => ctx.arc(-hw * 0.54, hh - 26, 28, 0, Math.PI * 2), "#0f172a", mode, {
        mangaFill: "black",
      });
      drawSceneShape(ctx, () => ctx.arc(-hw * 0.54, hh - 26, 13, 0, Math.PI * 2), "#cbd5e1", mode);
      drawSceneShape(ctx, () => ctx.arc(hw * 0.54, hh - 26, 28, 0, Math.PI * 2), "#0f172a", mode, {
        mangaFill: "black",
      });
      drawSceneShape(ctx, () => ctx.arc(hw * 0.54, hh - 26, 13, 0, Math.PI * 2), "#cbd5e1", mode);
      break;
    }

    case "manga_poster": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 6, -hh + 6, w - 12, h - 12), accent, mode);
      drawSceneShape(ctx, () => ctx.rect(-hw + 14, -hh + 14, w - 28, h - 28), primary, mode, {
        mangaFill: "dots-light",
      });
      drawSceneShape(ctx, () => ctx.arc(0, -10, w * 0.22, 0, Math.PI * 2), "#ffffff", mode);
      break;
    }

    case "pinboard": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 4, -hh + 4, w - 8, h - 8), "#78350f", mode);
      drawSceneShape(ctx, () => ctx.rect(-hw + 12, -hh + 12, w - 24, h - 24), primary, mode, {
        mangaFill: "dots-light",
      });
      drawSceneShape(ctx, () => ctx.rect(-hw + 28, -hh + 26, 52, 46), accent, mode);
      drawSceneShape(ctx, () => ctx.rect(8, -10, 62, 48), "#ffffff", mode);
      break;
    }

    case "book_stack": {
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 8, 8, w - 16, 22, 3), primary, mode);
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 14, -14, w - 26, 22, 3), accent, mode);
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 18, -34, w - 34, 20, 3), "#f59e0b", mode);
      break;
    }

    case "coffee_mug": {
      strokeLine(
        ctx,
        [
          [-8, -hh + 22],
          [-14, -hh + 4],
          [10, -hh + 20],
          [14, -hh + 2],
        ],
        mode,
        1.8,
      );
      drawSceneShape(ctx, () => ctx.arc(hw - 16, 6, 12, -Math.PI / 2, Math.PI / 2), primary, mode);
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + 10, -hh + 26, w - 28, h - 32, 6),
        primary,
        mode,
      );
      drawSceneShape(
        ctx,
        () => ctx.ellipse(0, -hh + 28, (w - 28) / 2, 6, 0, 0, Math.PI * 2),
        accent,
        mode,
      );
      break;
    }

    case "school_bag": {
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + 10, -hh + 20, w - 20, h - 26, 14),
        primary,
        mode,
        { shade: "bottom", bounds: { x: -hw, y: -hh, w, h } },
      );
      drawSceneShape(
        ctx,
        () => ctx.roundRect(-hw + 10, -hh + 18, w - 20, h * 0.42, 12),
        mixHex(primary, 0.14),
        mode,
      );
      drawSceneShape(ctx, () => ctx.rect(-hw * 0.36, 0, w * 0.16, 18), accent, mode);
      drawSceneShape(ctx, () => ctx.rect(hw * 0.2, 0, w * 0.16, 18), accent, mode);
      break;
    }

    case "cardboard_box": {
      drawSceneShape(ctx, () => ctx.rect(-hw + 10, -hh + 20, w - 20, h - 26), primary, mode, {
        shade: "right",
        bounds: { x: -hw, y: -hh, w, h },
      });
      drawSceneShape(
        ctx,
        () => ctx.rect(-hw + 6, -hh + 12, w - 12, 18),
        mixHex(primary, 0.15),
        mode,
      );
      drawSceneShape(ctx, () => ctx.rect(-14, -hh + 12, 28, 34), accent, mode);
      break;
    }

    case "katana_rack": {
      strokeLine(
        ctx,
        [
          [-hw + 28, hh - 8],
          [-hw + 28, -hh + 14],
        ],
        mode,
        6,
      );
      strokeLine(
        ctx,
        [
          [hw - 28, hh - 8],
          [hw - 28, -hh + 14],
        ],
        mode,
        6,
      );
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 8, -hh + 18, w - 16, 12, 4), accent, mode);
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 14, 14, w - 28, 12, 4), accent, mode);
      break;
    }

    case "ramen_bowl": {
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-hw + 8, -4);
          ctx.lineTo(hw - 8, -4);
          ctx.quadraticCurveTo(hw * 0.65, hh - 6, 0, hh - 6);
          ctx.quadraticCurveTo(-hw * 0.65, hh - 6, -hw + 8, -4);
          ctx.closePath();
        },
        primary,
        mode,
      );
      drawSceneShape(ctx, () => ctx.ellipse(0, -6, hw - 8, 14, 0, 0, Math.PI * 2), accent, mode);
      strokeLine(
        ctx,
        [
          [-hw + 14, -18],
          [hw - 6, -8],
        ],
        mode,
        2.5,
      );
      strokeLine(
        ctx,
        [
          [-hw + 18, -26],
          [hw - 2, -14],
        ],
        mode,
        2.5,
      );
      break;
    }

    case "ground_crater": {
      drawSceneShape(
        ctx,
        () => ctx.ellipse(0, 8, hw - 14, hh - 18, 0, 0, Math.PI * 2),
        accent,
        mode,
        { mangaFill: "hatch" },
      );
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        strokeLine(
          ctx,
          [
            [Math.cos(a) * hw * 0.4, Math.sin(a) * hh * 0.35],
            [Math.cos(a) * hw * 0.95, Math.sin(a) * hh * 0.9],
          ],
          mode,
          2.2,
        );
      }
      break;
    }

    case "rubble_pile": {
      const blocks = [
        [-hw * 0.55, 8, 66, 44, -0.18],
        [hw * 0.25, 12, 72, 48, 0.22],
        [-20, -24, 68, 52, 0.08],
      ] as const;
      for (const [bx, by, bw, bh, rot] of blocks) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rot);
        drawSceneShape(ctx, () => ctx.rect(-bw / 2, -bh / 2, bw, bh), primary, mode, {
          shade: "right",
          bounds: { x: -bw / 2, y: -bh / 2, w: bw, h: bh },
          mangaFill: "dots-med",
        });
        ctx.restore();
      }
      break;
    }

    case "flame_burst": {
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(0, hh - 6);
          ctx.quadraticCurveTo(-hw, hh * 0.2, -hw * 0.55, -hh * 0.35);
          ctx.quadraticCurveTo(-24, -10, 0, -hh + 8);
          ctx.quadraticCurveTo(28, -20, hw * 0.65, -hh * 0.25);
          ctx.quadraticCurveTo(hw, hh * 0.35, 0, hh - 6);
          ctx.closePath();
        },
        primary,
        mode,
        { mangaFill: "dots-med" },
      );
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(0, hh - 18);
          ctx.quadraticCurveTo(-hw * 0.5, hh * 0.2, -16, -hh * 0.35);
          ctx.quadraticCurveTo(6, -15, hw * 0.35, 0);
          ctx.quadraticCurveTo(hw * 0.4, hh * 0.35, 0, hh - 18);
          ctx.closePath();
        },
        accent,
        mode,
        { mangaFill: "white" },
      );
      break;
    }

    case "smoke_plume": {
      const puffs: [number, number, number][] = [
        [-hw * 0.45, 16, hw * 0.32],
        [hw * 0.42, 12, hw * 0.34],
        [0, -14, hw * 0.44],
        [-hw * 0.2, -26, hw * 0.28],
      ];
      for (const [px, py, pr] of puffs) {
        drawSceneShape(ctx, () => ctx.arc(px, py, pr, 0, Math.PI * 2), primary, mode, {
          mangaFill: "dots-light",
        });
      }
      break;
    }

    case "magic_circle": {
      ctx.save();
      ctx.strokeStyle = mode === "manga" ? PURE_INK : primary;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, hw - 8, hh - 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, (hw - 8) * 0.78, (hh - 8) * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * (hw - 12);
        const y = Math.sin(a) * (hh - 12);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      break;
    }

    case "spotlight_beam": {
      drawSceneShape(
        ctx,
        () => {
          ctx.moveTo(-hw * 0.28, -hh + 8);
          ctx.lineTo(hw * 0.28, -hh + 8);
          ctx.lineTo(hw - 8, hh - 8);
          ctx.lineTo(-hw + 8, hh - 8);
          ctx.closePath();
        },
        mode === "manga" ? "#ffffff" : "rgba(254, 240, 138, 0.34)",
        mode,
        { noStroke: mode === "color", lw: 1.5, mangaFill: "dots-light" },
      );
      break;
    }

    default: {
      drawSceneShape(ctx, () => ctx.roundRect(-hw + 8, -hh + 8, w - 16, h - 16, 6), primary, mode);
    }
  }
}

export function renderSceneObjectThumbnailDataUrl(
  defId: string,
  mode: SceneRenderMode2D = "color",
): string {
  const def = BUILTIN_SCENE_OBJECTS.find((o) => o.id === defId);
  if (!def) return "";
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 72;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const scale = Math.min(82 / def.defaultW, 58 / def.defaultH);
  ctx.translate(48, 36);
  ctx.scale(scale, scale);
  drawBuiltinObject2D(
    ctx,
    def.id,
    def.defaultW,
    def.defaultH,
    def.defaultPrimary,
    def.defaultAccent,
    mode,
  );
  return c.toDataURL("image/png");
}

function drawManualStroke(ctx: C, stroke: SceneStroke2D, renderMode: SceneRenderMode2D) {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, stroke.opacity));

  if (stroke.tool === "erase") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
    for (let i = 1; i < stroke.points.length; i++)
      ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const strokeColor = renderMode === "manga" ? PURE_INK : stroke.color;

  if (stroke.tool === "tone") {
    const pat = getScreentonePattern(ctx, stroke.tonePattern ?? "dots-med", strokeColor);
    ctx.strokeStyle = pat ?? strokeColor;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
    for (let i = 1; i < stroke.points.length; i++)
      ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === "text" && stroke.text) {
    const pt = stroke.points[0]!;
    ctx.translate(pt.x, pt.y);
    if (stroke.rotation) ctx.rotate((stroke.rotation * Math.PI) / 180);
    const fs = stroke.fontSize ?? Math.max(24, stroke.size * 5);
    ctx.font = `900 ${fs}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(2, fs * 0.12);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(stroke.text, 0, 0);
    ctx.fillStyle = strokeColor;
    ctx.fillText(stroke.text, 0, 0);
    ctx.restore();
    return;
  }

  if (stroke.tool === "rect" && stroke.points.length >= 2) {
    const p0 = stroke.points[0]!;
    const p1 = stroke.points[stroke.points.length - 1]!;
    const rx = Math.min(p0.x, p1.x);
    const ry = Math.min(p0.y, p1.y);
    const rw = Math.abs(p1.x - p0.x);
    const rh = Math.abs(p1.y - p0.y);
    if (stroke.filled) {
      ctx.fillStyle = renderMode === "manga" ? "#ffffff" : stroke.color;
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = stroke.size;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
    return;
  }

  if (stroke.tool === "ellipse" && stroke.points.length >= 2) {
    const p0 = stroke.points[0]!;
    const p1 = stroke.points[stroke.points.length - 1]!;
    const cx = (p0.x + p1.x) / 2;
    const cy = (p0.y + p1.y) / 2;
    const rx = Math.max(1, Math.abs(p1.x - p0.x) / 2);
    const ry = Math.max(1, Math.abs(p1.y - p0.y) / 2);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (stroke.filled) {
      ctx.fillStyle = renderMode === "manga" ? "#ffffff" : stroke.color;
      ctx.fill();
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = stroke.size;
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
  for (let i = 1; i < stroke.points.length; i++)
    ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y);
  ctx.stroke();
  ctx.restore();
}

function drawManualLayerBuffer(
  targetCtx: C,
  strokes: SceneStroke2D[],
  layer: "behind" | "front",
  renderMode: SceneRenderMode2D,
) {
  const list = strokes.filter((s) => s.layer === layer);
  if (list.length === 0) return;

  const buf = document.createElement("canvas");
  buf.width = SCENE2D_W;
  buf.height = SCENE2D_H;
  const bctx = buf.getContext("2d");
  if (!bctx) return;
  for (const s of list) drawManualStroke(bctx, s, renderMode);
  targetCtx.drawImage(buf, 0, 0);
}

const CUSTOM_SPRITE_CACHE = new Map<string, HTMLCanvasElement>();
function getProcessedCustomSceneSprite(
  img: HTMLImageElement,
  srcKey: string,
  mode: SceneRenderMode2D,
  tintHex: string | null,
): HTMLCanvasElement {
  const key = `scene|${srcKey}|${mode}|${tintHex ?? "orig"}`;
  const hit = CUSTOM_SPRITE_CACHE.get(key);
  if (hit) return hit;
  if (CUSTOM_SPRITE_CACHE.size > 48) {
    const firstKey = CUSTOM_SPRITE_CACHE.keys().next().value;
    if (firstKey) CUSTOM_SPRITE_CACHE.delete(firstKey);
  }
  const canvas =
    mode === "manga"
      ? extractMangaLineartCanvas(
          img,
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
        )
      : tintCustomPartCanvas(img, tintHex, mode);
  CUSTOM_SPRITE_CACHE.set(key, canvas);
  return canvas;
}

export function drawPerspectiveGuideOverlay(ctx: C, guides: ScenePerspectiveGuide) {
  ctx.save();
  if (guides.showGrid) {
    const gs = Math.max(16, guides.gridSize || 32);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.22)";
    ctx.lineWidth = 1;
    for (let x = gs; x < SCENE2D_W; x += gs) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SCENE2D_H);
      ctx.stroke();
    }
    for (let y = gs; y < SCENE2D_H; y += gs) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SCENE2D_W, y);
      ctx.stroke();
    }
  }

  if (guides.mode !== "off") {
    ctx.strokeStyle = "rgba(239, 68, 68, 0.72)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, guides.horizonY);
    ctx.lineTo(SCENE2D_W, guides.horizonY);
    ctx.stroke();
    ctx.setLineDash([]);

    const drawRays = (vx: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(vx, guides.horizonY);
        ctx.lineTo(vx + Math.cos(ang) * 1600, guides.horizonY + Math.sin(ang) * 1600);
        ctx.stroke();
      }
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(vx, guides.horizonY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    drawRays(guides.vp1X, "rgba(239, 68, 68, 0.32)");
    if (guides.mode === "2pt") {
      drawRays(guides.vp2X, "rgba(37, 99, 235, 0.3)");
    }
  }
  ctx.restore();
}

export async function preloadScene2DImages(
  scene: Scene2D,
  customAssets: SceneObjectAsset2D[],
): Promise<Map<string, HTMLImageElement>> {
  const assetMap = new Map(customAssets.map((a) => [a.id, a]));
  const urls = new Set<string>();
  for (const obj of scene.objects) {
    if (obj.kind === "custom") {
      const a = assetMap.get(obj.assetId);
      if (a?.src) urls.add(a.src);
    }
  }
  const out = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...urls].map(async (src) => {
      const img = await loadSceneImageElement2D(src);
      if (img) out.set(src, img);
    }),
  );
  return out;
}

export function renderScene2DSync(
  ctx: C,
  scene: Scene2D,
  customAssets: SceneObjectAsset2D[],
  imageMap: Map<string, HTMLImageElement>,
  opts: {
    showGuides?: boolean;
    selectedObjectId?: string | null;
    activeStroke?: SceneStroke2D | null;
  } = {},
) {
  ctx.save();
  ctx.clearRect(0, 0, SCENE2D_W, SCENE2D_H);

  // 1. Perspective Room / Outdoor Backdrop
  drawBackdrop2D(ctx, scene);

  // 2. Behind-objects manual ink / screentone buffer
  const allStrokes = opts.activeStroke ? [...scene.strokes, opts.activeStroke] : scene.strokes;
  drawManualLayerBuffer(ctx, allStrokes, "behind", scene.renderMode);

  // 3. Sorted Scene Objects (background -> midground -> foreground)
  const assetMap = new Map(customAssets.map((a) => [a.id, a]));
  const ordered = [...scene.objects].sort((a, b) => DEPTH_ORDER[a.depth] - DEPTH_ORDER[b.depth]);

  for (const obj of ordered) {
    if (!obj.visible) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, Math.min(1, obj.opacity));
    ctx.translate(obj.x, obj.y);
    if (obj.rotation) ctx.rotate((obj.rotation * Math.PI) / 180);
    if (obj.skewX || obj.skewY) {
      ctx.transform(
        1,
        Math.tan((obj.skewY * Math.PI) / 180),
        Math.tan((obj.skewX * Math.PI) / 180),
        1,
        0,
        0,
      );
    }
    ctx.scale(obj.flipX ? -1 : 1, obj.flipY ? -1 : 1);

    // Subtle ground contact shadow
    if (
      obj.shadow &&
      obj.assetId !== "spotlight_beam" &&
      obj.assetId !== "fluffy_cloud" &&
      obj.assetId !== "sakura_petals"
    ) {
      ctx.save();
      ctx.fillStyle = scene.renderMode === "manga" ? "rgba(0,0,0,0.12)" : "rgba(15,23,42,0.18)";
      ctx.beginPath();
      ctx.ellipse(
        0,
        obj.height * 0.48,
        obj.width * 0.44,
        Math.max(6, obj.height * 0.08),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    if (obj.kind === "builtin") {
      drawBuiltinObject2D(
        ctx,
        obj.assetId,
        obj.width,
        obj.height,
        obj.primaryColor,
        obj.accentColor,
        scene.renderMode,
      );
    } else {
      const asset = assetMap.get(obj.assetId);
      const img = asset?.src ? imageMap.get(asset.src) : undefined;
      if (img && asset) {
        const sprite = getProcessedCustomSceneSprite(
          img,
          asset.src,
          scene.renderMode,
          obj.tintEnabled ? obj.primaryColor : null,
        );
        ctx.drawImage(sprite, -obj.width / 2, -obj.height / 2, obj.width, obj.height);
      }
    }

    if (opts.selectedObjectId === obj.id) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-obj.width / 2 - 4, -obj.height / 2 - 4, obj.width + 8, obj.height + 8);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // 4. Front manual ink / marker / screentone / signage buffer
  drawManualLayerBuffer(ctx, allStrokes, "front", scene.renderMode);

  // 5. Optional non-exporting Perspective Vanishing Point & Snap Grid guides
  if (opts.showGuides) {
    drawPerspectiveGuideOverlay(ctx, scene.guides);
  }
  ctx.restore();
}

export async function exportScene2DPng(
  scene: Scene2D,
  customAssets: SceneObjectAsset2D[],
  scale = 1.5,
): Promise<string> {
  const imageMap = await preloadScene2DImages(scene, customAssets);
  const c = document.createElement("canvas");
  c.width = Math.round(SCENE2D_W * scale);
  c.height = Math.round(SCENE2D_H * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.scale(scale, scale);
  renderScene2DSync(ctx, scene, customAssets, imageMap, {
    showGuides: false,
    selectedObjectId: null,
  });
  return c.toDataURL("image/png");
}

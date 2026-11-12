import type { BrowState, BrowStyle, EyeState, EyeStyle, FaceCalibration, MouthState, MouthStyle, ResolvedFace } from "./face-library";

type C = CanvasRenderingContext2D;
const INK = "#141414";

const EYE: Record<EyeStyle, { w: number; h: number; slant: number; iris: number; lash: number }> = {
  sharp: { w: 70, h: 34, slant: 10, iris: 0.5, lash: 6 },
  round: { w: 62, h: 52, slant: 0, iris: 0.62, lash: 4 },
  almond: { w: 74, h: 30, slant: 6, iris: 0.48, lash: 5 },
  shonen: { w: 66, h: 40, slant: 14, iris: 0.42, lash: 7 },
};
// upper lid: inner y, control y, outer extra y (× h); lower lid control (× h); iris scale
const LID: Record<EyeState, { yi: number; yc: number; yo: number; lo: number; iris: number }> = {
  open: { yi: 0, yc: -1.1, yo: 0, lo: 0.55, iris: 1 },
  half: { yi: -0.05, yc: -0.45, yo: -0.1, lo: 0.5, iris: 1 },
  glare: { yi: 0.05, yc: -0.45, yo: -0.55, lo: 0.4, iris: 0.85 },
  intense: { yi: -0.1, yc: -0.8, yo: -0.35, lo: 0.5, iris: 0.7 },
  shock: { yi: -0.15, yc: -1.4, yo: 0.1, lo: 0.8, iris: 1 },
  teary: { yi: 0, yc: -1.1, yo: 0, lo: 0.6, iris: 1.05 },
  blank: { yi: 0, yc: -1.0, yo: 0, lo: 0.6, iris: 0 },
  happy: { yi: 0, yc: 0, yo: 0, lo: 0, iris: 0 },
  closed: { yi: 0, yc: 0, yo: 0, lo: 0, iris: 0 },
};

/** Eye drawn around its centre; local +x points away from the nose. */
export function drawEye(c: C, style: EyeStyle, state: EyeState) {
  const s = EYE[style], L = LID[state];
  const hw = s.w / 2, h = s.h;
  c.strokeStyle = INK; c.fillStyle = INK; c.lineCap = "round"; c.lineJoin = "round";
  if (state === "happy") {
    c.lineWidth = s.lash; c.beginPath(); c.moveTo(-hw, 8); c.quadraticCurveTo(0, -h * 0.9, hw, 8 - s.slant * 0.4); c.stroke(); return;
  }
  if (state === "closed") {
    c.lineWidth = s.lash; c.beginPath(); c.moveTo(-hw, -2); c.quadraticCurveTo(0, h * 0.45, hw, -2 - s.slant * 0.5); c.stroke();
    c.lineWidth = 2; for (let i = 0; i < 3; i++) { const x = -hw * 0.4 + i * hw * 0.5; c.beginPath(); c.moveTo(x, h * 0.25); c.lineTo(x + 3, h * 0.42); c.stroke(); }
    return;
  }
  const yi = L.yi * h, yc = L.yc * h, yo = -s.slant + L.yo * h;
  const lower = () => { c.moveTo(hw - 4, yo + 6); c.quadraticCurveTo(0, h * L.lo, -hw + 6, yi + 4); };
  const shape = new Path2D();
  shape.moveTo(-hw, yi); shape.quadraticCurveTo(0, yc, hw, yo);
  shape.lineTo(hw - 4, yo + 6); shape.quadraticCurveTo(0, h * L.lo, -hw + 6, yi + 4); shape.closePath();
  c.save(); c.fillStyle = "#ffffff"; c.fill(shape); c.clip(shape);
  if (L.iris > 0) {
    const shock = state === "shock";
    const rx = (s.w * s.iris * L.iris) / 2 * (shock ? 0.35 : 1), ry = rx * (style === "round" ? 1.25 : 1.15);
    const cy = (yc * 0.25 + h * L.lo * 0.25);
    if (shock) { c.lineWidth = 3; c.beginPath(); c.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(0, cy, rx * 0.4, 0, Math.PI * 2); c.fill(); }
    else {
      const g = c.createLinearGradient(0, cy - ry, 0, cy + ry); g.addColorStop(0, "#0c0c0c"); g.addColorStop(1, "#5a5a5a");
      c.fillStyle = g; c.beginPath(); c.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = INK; c.beginPath(); c.ellipse(0, cy, rx * 0.45, ry * 0.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(-rx * 0.35, cy - ry * 0.4, rx * 0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(rx * 0.35, cy + ry * 0.35, rx * 0.13, 0, Math.PI * 2); c.fill();
      if (state === "teary") { c.beginPath(); c.arc(rx * 0.1, cy - ry * 0.05, rx * 0.18, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(-rx * 0.5, cy + ry * 0.4, rx * 0.12, 0, Math.PI * 2); c.fill(); }
    }
  }
  c.restore();
  c.lineWidth = s.lash; c.beginPath(); c.moveTo(-hw, yi); c.quadraticCurveTo(0, yc, hw, yo); c.stroke();
  c.lineWidth = s.lash * 0.6; c.beginPath(); c.moveTo(hw, yo); c.lineTo(hw + 7, yo - 5); c.stroke();
  c.lineWidth = 2; c.beginPath(); lower(); c.stroke();
  if (state === "teary") { c.strokeStyle = "#6aa9d8"; c.lineWidth = 3; c.beginPath(); c.moveTo(-hw + 6, h * L.lo * 0.7); for (let x = -hw + 6; x <= hw - 4; x += 8) c.lineTo(x, h * L.lo * 0.7 + (x / 8 % 2 ? 2 : -2)); c.stroke(); }
}

const BROW: Record<BrowStyle, { len: number; w: number; arch: number }> = {
  thin: { len: 70, w: 4, arch: 6 }, soft: { len: 64, w: 6, arch: 4 }, bold: { len: 74, w: 11, arch: 5 }, arched: { len: 70, w: 6, arch: 14 },
};
/** side: +1 for the canvas-right brow, -1 for the left one (used for asymmetric "smug"). */
export function drawBrow(c: C, style: BrowStyle, state: BrowState, side: 1 | -1) {
  const s = BROW[style]; const hl = s.len / 2;
  let yi = 0, yo = -4, arch = s.arch;
  if (state === "raised") { yi = -14; yo = -18; arch += 4; }
  else if (state === "angry") { yi = 12; yo = -14; arch = 0; }
  else if (state === "sad") { yi = -14; yo = 8; arch = 2; }
  else if (state === "flat") { yi = 0; yo = 0; arch = 0; }
  else if (state === "smug") { if (side === 1) { yi = -16; yo = -20; arch += 8; } else { yi = 4; yo = -2; arch = 0; } }
  c.strokeStyle = INK; c.lineCap = "round"; c.lineWidth = s.w;
  c.beginPath(); c.moveTo(-hl, yi); c.quadraticCurveTo(0, Math.min(yi, yo) - arch, hl, yo); c.stroke();
}

const MW: Record<MouthStyle, number> = { line: 44, soft: 42, fang: 50, wide: 62 };
export function drawMouth(c: C, style: MouthStyle, state: MouthState) {
  const w = MW[style], hw = w / 2;
  c.strokeStyle = INK; c.fillStyle = INK; c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = 4;
  const fang = (x: number, y: number) => { if (style !== "fang") return; c.fillStyle = "#fff"; c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x + 5, y); c.lineTo(x, y + 10); c.closePath(); c.fill(); c.lineWidth = 2; c.stroke(); c.fillStyle = INK; };
  const openFill = (top: number, bot: number, wid: number) => {
    c.beginPath(); c.moveTo(-wid, top); c.quadraticCurveTo(0, top - 4, wid, top); c.quadraticCurveTo(wid * 0.9, bot, 0, bot); c.quadraticCurveTo(-wid * 0.9, bot, -wid, top); c.closePath();
    c.fill(); c.save(); c.clip(); c.fillStyle = "#c9636b"; c.beginPath(); c.ellipse(0, bot, wid * 0.6, (bot - top) * 0.45, 0, 0, Math.PI * 2); c.fill(); c.restore();
  };
  switch (state) {
    case "neutral": c.beginPath(); c.moveTo(-hw * 0.6, 0); c.quadraticCurveTo(0, 3, hw * 0.6, 0); c.stroke(); break;
    case "flat": c.beginPath(); c.moveTo(-hw * 0.5, 0); c.lineTo(hw * 0.5, 0); c.stroke(); break;
    case "smile": c.beginPath(); c.moveTo(-hw, -6); c.quadraticCurveTo(0, 14, hw, -6); c.stroke(); fang(hw * 0.4, 2); break;
    case "smirk": c.beginPath(); c.moveTo(-hw * 0.7, 2); c.quadraticCurveTo(hw * 0.3, 8, hw, -10); c.stroke(); fang(hw * 0.35, 4); break;
    case "grin": openFill(-6, 30, hw); c.fillStyle = "#fff"; c.fillRect(-hw * 0.8, -5, hw * 1.6, 7); fang(hw * 0.5, 2); break;
    case "shout": openFill(-14, 40, hw * 0.85); fang(hw * 0.45, -10); break;
    case "gasp": c.beginPath(); c.ellipse(0, 6, 10, 15, 0, 0, Math.PI * 2); c.fill(); break;
    case "gritted": {
      c.fillStyle = "#fff"; c.beginPath(); c.roundRect(-hw, -10, w, 22, 8); c.fill(); c.stroke();
      c.lineWidth = 2; c.beginPath(); c.moveTo(-hw, 1); c.lineTo(hw, 1); for (let x = -hw + w / 6; x < hw; x += w / 6) { c.moveTo(x, -10); c.lineTo(x, 12); } c.stroke(); break;
    }
    case "wavy": c.beginPath(); c.moveTo(-hw * 0.8, 0); for (let i = 1; i <= 8; i++) c.lineTo(-hw * 0.8 + (i * hw * 1.6) / 8, i % 2 ? -4 : 4); c.stroke(); break;
  }
  if (style === "soft" && (state === "neutral" || state === "smile" || state === "flat")) { c.lineWidth = 2; c.beginPath(); c.moveTo(-8, 16); c.quadraticCurveTo(0, 20, 8, 16); c.stroke(); }
}

function drawFx(c: C, fx: string, k: FaceCalibration, mono: boolean) {
  const ex = k.eyeSpacing, ey = k.eyeY;
  c.lineCap = "round"; c.strokeStyle = INK;
  if (fx === "blush") {
    for (const sx of [-1, 1]) {
      const x = 256 + sx * (ex + 18), y = ey + 50;
      const g = c.createRadialGradient(x, y, 2, x, y, 38); g.addColorStop(0, mono ? "rgba(60,60,60,0.35)" : "rgba(240,110,130,0.6)"); g.addColorStop(1, "rgba(240,110,130,0)");
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 40, 20, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = mono ? INK : "#c0394f"; c.lineWidth = 2.5; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + i * 12 - 4, y + 8); c.lineTo(x + i * 12 + 6, y - 8); c.stroke(); }
    }
  } else if (fx === "sweat") {
    const x = 380, y = 150; c.fillStyle = mono ? "#fff" : "#cfe8fb"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x, y - 34); c.quadraticCurveTo(x + 22, y, x, y + 14); c.quadraticCurveTo(x - 22, y, x, y - 34); c.fill(); c.stroke();
    c.fillStyle = "#fff"; c.beginPath(); c.ellipse(x - 5, y + 2, 3, 6, 0, 0, Math.PI * 2); c.fill();
  } else if (fx === "anger") {
    const x = 140, y = 140; c.strokeStyle = mono ? INK : "#d0202a"; c.lineWidth = 6;
    for (let i = 0; i < 4; i++) { c.save(); c.translate(x, y); c.rotate((i * Math.PI) / 2); c.beginPath(); c.moveTo(6, -22); c.quadraticCurveTo(8, -8, 22, -6); c.stroke(); c.restore(); }
  } else if (fx === "tears") {
    for (const sx of [-1, 1]) {
      const x = 256 + sx * (ex + 4); c.fillStyle = mono ? "rgba(255,255,255,0.9)" : "rgba(150,200,240,0.85)"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - 9, ey + 10); c.quadraticCurveTo(x - 14, ey + 120, x - 6, 470); c.lineTo(x + 8, 470); c.quadraticCurveTo(x + 14, ey + 120, x + 9, ey + 10); c.closePath(); c.fill(); c.stroke();
    }
  } else if (fx === "gloom") {
    c.strokeStyle = mono ? INK : "#3b3157"; c.lineWidth = 2;
    for (let x = 150; x <= 362; x += 9) { c.globalAlpha = 0.7; c.beginPath(); c.moveTo(x, 70); c.lineTo(x, ey - k.browGap - 20 - ((x * 7) % 25)); c.stroke(); }
    c.globalAlpha = 1;
  } else if (fx === "sparkle") {
    const x = 256 + ex + 70, y = ey - 60; c.fillStyle = mono ? INK : "#e8b400";
    c.beginPath(); c.moveTo(x, y - 24); c.quadraticCurveTo(x + 3, y - 3, x + 24, y); c.quadraticCurveTo(x + 3, y + 3, x, y + 24); c.quadraticCurveTo(x - 3, y + 3, x - 24, y); c.quadraticCurveTo(x - 3, y - 3, x, y - 24); c.fill();
  }
}

/** Composes the full face onto a 512×512 transparent canvas. */
export function drawFace(c: C, f: ResolvedFace, k: FaceCalibration, opts: { mono: boolean; guide: boolean }) {
  c.clearRect(0, 0, 512, 512);
  if (opts.guide) {
    c.save(); c.strokeStyle = "rgba(230,60,40,0.9)"; c.lineWidth = 2; c.setLineDash([8, 6]);
    c.beginPath(); c.ellipse(256, 280, 190, 230, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(256, 20); c.lineTo(256, 500); c.moveTo(40, k.eyeY); c.lineTo(472, k.eyeY); c.moveTo(150, k.mouthY); c.lineTo(362, k.mouthY); c.stroke(); c.restore();
  }
  if (f.fx.includes("gloom")) drawFx(c, "gloom", k, opts.mono);
  if (f.fx.includes("blush")) drawFx(c, "blush", k, opts.mono);
  for (const side of [1, -1] as const) {
    c.save(); c.translate(256 + side * k.eyeSpacing, k.eyeY); c.scale(side * k.partScale, k.partScale); drawEye(c, f.eyeStyle, f.eye); c.restore();
    c.save(); c.translate(256 + side * (k.eyeSpacing + 4), k.eyeY - k.browGap); c.scale(side * k.partScale, k.partScale); drawBrow(c, f.browStyle, f.brow, side); c.restore();
  }
  c.save(); c.translate(256, k.mouthY); c.scale(k.partScale, k.partScale); drawMouth(c, f.mouthStyle, f.mouth); c.restore();
  for (const fx of ["tears", "sweat", "anger", "sparkle"]) if (f.fx.includes(fx as never)) drawFx(c, fx, k, opts.mono);
}

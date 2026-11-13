export interface SphericalLight {
  azimuth: number; // -180 to 180 deg (0 = +Z front, +90 = +X right)
  elevation: number; // -60 to 85 deg
  radius?: number;
}

export interface LightPreset {
  id: string;
  label: string;
  azimuth: number;
  elevation: number;
  lightIntensity: number;
  rimIntensity: number;
  fillIntensity: number;
}

export const LIGHT_PRESETS: LightPreset[] = [
  {
    id: "studio",
    label: "Studio 3/4",
    azimuth: 40,
    elevation: 46,
    lightIntensity: 2.2,
    rimIntensity: 0.5,
    fillIntensity: 0.6,
  },
  {
    id: "dramatic",
    label: "Dramatic Side",
    azimuth: -80,
    elevation: 22,
    lightIntensity: 2.9,
    rimIntensity: 1.2,
    fillIntensity: 0.25,
  },
  {
    id: "rim",
    label: "Rim Backlight",
    azimuth: 162,
    elevation: 28,
    lightIntensity: 3.1,
    rimIntensity: 0.35,
    fillIntensity: 0.35,
  },
  {
    id: "under",
    label: "Under-Lit",
    azimuth: 12,
    elevation: -35,
    lightIntensity: 2.6,
    rimIntensity: 0.65,
    fillIntensity: 0.2,
  },
  {
    id: "top",
    label: "Top Spot",
    azimuth: 0,
    elevation: 80,
    lightIntensity: 2.7,
    rimIntensity: 0.4,
    fillIntensity: 0.3,
  },
];

export const OUTLINE_SWATCHES: { hex: string; label: string }[] = [
  { hex: "#0d0d0d", label: "Sumi Ink" },
  { hex: "#1e1b4b", label: "Deep Indigo" },
  { hex: "#3b2314", label: "Warm Sepia" },
  { hex: "#7f1d1d", label: "Crimson Ink" },
];

export function clampAzimuth(deg: number): number {
  let a = deg;
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return Math.round(a);
}

export function clampElevation(deg: number): number {
  return Math.max(-60, Math.min(85, Math.round(deg)));
}

/** Converts spherical azimuth/elevation angles (in degrees) to 3D Cartesian coordinates. */
export function lightSphericalToCartesian(
  azimuthDeg: number,
  elevationDeg: number,
  radius = 5.5,
): [number, number, number] {
  const az = (clampAzimuth(azimuthDeg) * Math.PI) / 180;
  const el = (clampElevation(elevationDeg) * Math.PI) / 180;
  const cosEl = Math.cos(el);
  const x = +(radius * cosEl * Math.sin(az)).toFixed(3);
  const y = +(radius * Math.sin(el)).toFixed(3);
  const z = +(radius * cosEl * Math.cos(az)).toFixed(3);
  return [x, y, z];
}

/** Inverse conversion from Cartesian [x, y, z] light position to spherical degrees. */
export function lightCartesianToSpherical(pos: [number, number, number]): SphericalLight {
  const [x, y, z] = pos;
  const r = Math.hypot(x, y, z) || 1;
  const el = (Math.asin(Math.max(-1, Math.min(1, y / r))) * 180) / Math.PI;
  const az = (Math.atan2(x, z) * 180) / Math.PI;
  return {
    azimuth: clampAzimuth(az),
    elevation: clampElevation(el),
    radius: +r.toFixed(3),
  };
}

/** Converts a CSS hex colour (#rgb or #rrggbb) to normalized 0..1 RGB tuple for OutlineEffect. */
export function hexToOutlineRgb(hex?: string): [number, number, number] {
  if (!hex) return [0.05, 0.05, 0.05];
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0.05, 0.05, 0.05];
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [+r.toFixed(3), +g.toFixed(3), +b.toFixed(3)];
}


export interface MangaBackground {
  id: string;
  name: string;
  category: "scenery" | "action" | "mood" | "screentone";
  thumbnail: string;
  generateSvg: (width: number, height: number) => string;
}

/**
 * Procedural vector manga background plates inspired by Manga Maker ComiPo and classic manga.
 * Renders as crisp SVG data URLs with zero asset loading latency.
 */
export const MANGA_BACKGROUNDS: MangaBackground[] = [
  // --- SCENERY & ENVIRONMENTS ---
  {
    id: "classroom_day",
    name: "Classroom (Windows & Desks)",
    category: "scenery",
    thumbnail: "🏫",
    generateSvg: (w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="#ffffff"/>
        <!-- Window Frames on Left -->
        <line x1="0" y1="${h * 0.1}" x2="${w * 0.45}" y2="${h * 0.05}" stroke="#111" stroke-width="3"/>
        <line x1="0" y1="${h * 0.7}" x2="${w * 0.45}" y2="${h * 0.6}" stroke="#111" stroke-width="3"/>
        <line x1="${w * 0.15}" y1="${h * 0.08}" x2="${w * 0.15}" y2="${h * 0.67}" stroke="#111" stroke-width="2"/>
        <line x1="${w * 0.3}" y1="${h * 0.06}" x2="${w * 0.3}" y2="${h * 0.63}" stroke="#111" stroke-width="2"/>
        <!-- Window Sunlight Rays -->
        <polygon points="0,${h * 0.1} ${w * 0.4},${h * 0.05} ${w * 0.8},${h} ${w * 0.2},${h}" fill="#f4f4f5" opacity="0.4"/>
        <!-- Classroom Floor Horizon -->
        <line x1="0" y1="${h * 0.68}" x2="${w}" y2="${h * 0.68}" stroke="#222" stroke-width="2"/>
        <!-- Blackboard Frame on Right -->
        <rect x="${w * 0.55}" y="${h * 0.15}" width="${w * 0.42}" height="${h * 0.42}" fill="#f9fafb" stroke="#111" stroke-width="3"/>
        <line x1="${w * 0.53}" y1="${h * 0.58}" x2="${w * 0.98}" y2="${h * 0.58}" stroke="#111" stroke-width="3"/>
        <!-- Student Desk Silhouette in Foreground -->
        <rect x="${w * 0.25}" y="${h * 0.75}" width="${w * 0.45}" height="${h * 0.04}" fill="#222"/>
        <line x1="${w * 0.3}" y1="${h * 0.79}" x2="${w * 0.3}" y2="${h}" stroke="#222" stroke-width="4"/>
        <line x1="${w * 0.65}" y1="${h * 0.79}" x2="${w * 0.65}" y2="${h}" stroke="#222" stroke-width="4"/>
        <rect x="${w * 0.32}" y="${h * 0.82}" width="${w * 0.32}" height="${h * 0.02}" fill="#444"/>
      </svg>
    `,
  },
  {
    id: "school_rooftop",
    name: "School Rooftop & Wire Fence",
    category: "scenery",
    thumbnail: "🏢",
    generateSvg: (w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="#ffffff"/>
        <!-- Sky Halftone Gradient -->
        <defs>
          <pattern id="sky-dots" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="1.2" fill="#888"/>
          </pattern>
        </defs>
        <rect width="${w}" height="${h * 0.55}" fill="url(#sky-dots)" opacity="0.3"/>
        <!-- Distant City Horizon Silhouettes -->
        <polygon points="0,${h * 0.55} ${w * 0.1},${h * 0.45} ${w * 0.2},${h * 0.48} ${w * 0.35},${h * 0.4} ${w * 0.5},${h * 0.47} ${w * 0.65},${h * 0.42} ${w * 0.8},${h * 0.5} ${w},${h * 0.46} ${w},${h * 0.55} 0,${h * 0.55}" fill="#e4e4e7" stroke="#222" stroke-width="1.5"/>
        <!-- Rooftop Concrete Ledge -->
        <rect x="0" y="${h * 0.65}" width="${w}" height="${h * 0.35}" fill="#fafafa" stroke="#111" stroke-width="3"/>
        <line x1="0" y1="${h * 0.72}" x2="${w}" y2="${h * 0.72}" stroke="#777" stroke-width="1.5"/>
        <!-- Chain-Link Wire Fence -->
        <g stroke="#333" stroke-width="1.2" opacity="0.85">
          ${Array.from({ length: 16 })
            .map((_, i) => `<line x1="${(w / 15) * i}" y1="${h * 0.2}" x2="${(w / 15) * i}" y2="${h * 0.65}"/>`)
            .join("")}
          <line x1="0" y1="${h * 0.2}" x2="${w}" y2="${h * 0.2}" stroke-width="3.5" stroke="#111"/>
          <line x1="0" y1="${h * 0.42}" x2="${w}" y2="${h * 0.42}" stroke-width="2.5" stroke="#111"/>
          <line x1="0" y1="${h * 0.65}" x2="${w}" y2="${h * 0.65}" stroke-width="3.5" stroke="#111"/>
        </g>
      </svg>
    `,
  },
  {
    id: "city_street_crosswalk",
    name: "Urban City & Crosswalk",
    category: "scenery",
    thumbnail: "🏙️",
    generateSvg: (w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="#ffffff"/>
        <!-- Skyscrapers in 2-point perspective -->
        <polygon points="${w * 0.1},0 ${w * 0.4},${h * 0.15} ${w * 0.4},${h * 0.65} ${w * 0.1},${h * 0.75}" fill="#ffffff" stroke="#111" stroke-width="2.5"/>
        <polygon points="${w * 0.4},${h * 0.15} ${w * 0.48},${h * 0.2} ${w * 0.48},${h * 0.62} ${w * 0.4},${h * 0.65}" fill="#e4e4e7" stroke="#111" stroke-width="2"/>
        <polygon points="${w * 0.9},0 ${w * 0.6},${h * 0.18} ${w * 0.6},${h * 0.65} ${w * 0.9},${h * 0.72}" fill="#ffffff" stroke="#111" stroke-width="2.5"/>
        <!-- Vanishing Road Surface -->
        <polygon points="0,${h} ${w},${h} ${w * 0.55},${h * 0.62} ${w * 0.45},${h * 0.62}" fill="#f4f4f5" stroke="#111" stroke-width="2"/>
        <!-- Zebra Crosswalk Stripes -->
        ${Array.from({ length: 6 })
          .map((_, i) => {
            const y1 = h * 0.72 + i * (h * 0.045);
            return `<polygon points="${w * 0.2},${y1} ${w * 0.8},${y1} ${w * 0.83},${y1 + h * 0.03} ${w * 0.17},${y1 + h * 0.03}" fill="#ffffff" stroke="#222" stroke-width="1.5"/>`;
          })
          .join("")}
      </svg>
    `,
  },
  {
    id: "japanese_room_shoji",
    name: "Traditional Tatami & Shoji Screen",
    category: "scenery",
    thumbnail: "🍵",
    generateSvg: (w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="#ffffff"/>
        <!-- Wall -->
        <rect width="${w}" height="${h * 0.7}" fill="#fdfbf7"/>
        <!-- Shoji Sliding Paper Doors -->
        <g stroke="#18181b" stroke-width="2">
          <rect x="${w * 0.1}" y="${h * 0.08}" width="${w * 0.8}" height="${h * 0.58}" fill="#ffffff" stroke-width="4"/>
          <line x1="${w * 0.5}" y1="${h * 0.08}" x2="${w * 0.5}" y2="${h * 0.66}" stroke-width="3"/>
          <!-- Grid lattices -->
          ${Array.from({ length: 7 })
            .map((_, i) => `<line x1="${w * 0.1}" y1="${h * 0.15 + i * (h * 0.07)}" x2="${w * 0.9}" y2="${h * 0.15 + i * (h * 0.07)}"/>`)
            .join("")}
          ${Array.from({ length: 9 })
            .map((_, i) => `<line x1="${w * 0.18 + i * (w * 0.08)}" y1="${h * 0.08}" x2="${w * 0.18 + i * (w * 0.08)}" y2="${h * 0.66}"/>`)
            .join("")}
        </g>
        <!-- Tatami Floor with Green Border Strips -->
        <rect x="0" y="${h * 0.66}" width="${w}" height="${h * 0.34}" fill="#fefce8" stroke="#18181b" stroke-width="3"/>
        <line x1="0" y1="${h * 0.82}" x2="${w}" y2="${h * 0.82}" stroke="#15803d" stroke-width="6"/>
      </svg>
    `,
  },

  // --- ACTION & SPEED FX ---
  {
    id: "speed_focus_burst",
    name: "Focus Shock Burst (Dramatic Tension)",
    category: "action",
    thumbnail: "💥",
    generateSvg: (w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const rays = Array.from({ length: 64 })
        .map((_, i) => {
          const a = (i / 64) * Math.PI * 2;
          const r1 = Math.min(w, h) * (0.28 + (i % 4) * 0.05);
          const r2 = Math.max(w, h) * 0.95;
          const x1 = cx + Math.cos(a) * r1;
          const y1 = cy + Math.sin(a) * r1;
          const x2 = cx + Math.cos(a) * r2;
          const y2 = cy + Math.sin(a) * r2;
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#000" stroke-width="${1.5 + (i % 3) * 1.5}"/>`;
        })
        .join("");
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
          <rect width="${w}" height="${h}" fill="#ffffff"/>
          <g>${rays}</g>
        </svg>
      `;
    },
  },
  {
    id: "horizontal_dash_lines",
    name: "High-Speed Horizontal Dash",
    category: "action",
    thumbnail: "💨",
    generateSvg: (w, h) => {
      const lines = Array.from({ length: 50 })
        .map((_, i) => {
          const y = (i / 50) * h;
          const len = w * (0.35 + Math.sin(i * 3.7) * 0.25);
          const x = (i % 2 === 0 ? 0 : w - len) + Math.cos(i) * 20;
          return `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + len).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#111" stroke-width="${1.2 + (i % 3)}"/>`;
        })
        .join("");
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
          <rect width="${w}" height="${h}" fill="#ffffff"/>
          <g>${lines}</g>
        </svg>
      `;
    },
  },
  {
    id: "impact_concentric_shock",
    name: "Concentric Explosion Shockwaves",
    category: "action",
    thumbnail: "⭕",
    generateSvg: (w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const rings = [0.15, 0.25, 0.38, 0.52, 0.68, 0.85]
        .map(
          (scale, i) =>
            `<circle cx="${cx}" cy="${cy}" r="${Math.min(w, h) * scale}" fill="none" stroke="#000" stroke-width="${4 - (i % 2) * 1.5}" stroke-dasharray="${12 + i * 4},${8 + i * 2}"/>`
        )
        .join("");
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
          <rect width="${w}" height="${h}" fill="#ffffff"/>
          ${rings}
        </svg>
      `;
    },
  },

  // --- MOOD & EMOTIONAL ATMOSPHERES ---
  {
    id: "cherry_blossom_shojo",
    name: "Shojo Romance (Cherry Petals & Sparkles)",
    category: "mood",
    thumbnail: "🌸",
    generateSvg: (w, h) => {
      const petals = Array.from({ length: 28 })
        .map((_, i) => {
          const x = ((i * 73) % w) + 15;
          const y = ((i * 97) % h) + 15;
          const s = 14 + (i % 5) * 6;
          const rot = (i * 35) % 360;
          return `
            <g transform="translate(${x},${y}) rotate(${rot})">
              <path d="M 0 0 C -${s * 0.4} -${s * 0.6}, -${s * 0.4} -${s}, 0 -${s * 1.2} C ${s * 0.4} -${s}, ${s * 0.4} -${s * 0.6}, 0 0 Z" fill="#ffe4e6" stroke="#f43f5e" stroke-width="1.2"/>
            </g>
          `;
        })
        .join("");
      const sparkles = Array.from({ length: 18 })
        .map((_, i) => {
          const x = ((i * 127) % w) + 20;
          const y = ((i * 149) % h) + 20;
          return `
            <g transform="translate(${x},${y})">
              <path d="M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill="#facc15" stroke="#ca8a04" stroke-width="0.8"/>
            </g>
          `;
        })
        .join("");
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
          <rect width="${w}" height="${h}" fill="#fffdfa"/>
          ${petals}
          ${sparkles}
        </svg>
      `;
    },
  },
  {
    id: "gloomy_depression_lines",
    name: "Gloomy Despair / Shock (Vertical Blue/Black)",
    category: "mood",
    thumbnail: "⚡",
    generateSvg: (w, h) => {
      const lines = Array.from({ length: 45 })
        .map((_, i) => {
          const x = (i / 45) * w;
          const len = h * (0.35 + Math.sin(i * 1.5) * 0.2);
          return `<line x1="${x}" y1="0" x2="${x}" y2="${len}" stroke="#1e293b" stroke-width="${1.5 + (i % 2) * 1.5}"/>`;
        })
        .join("");
      return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
          <rect width="${w}" height="${h}" fill="#ffffff"/>
          <g>${lines}</g>
        </svg>
      `;
    },
  },
  {
    id: "night_pitch_black",
    name: "Dramatic Blackout (Night / Silhouette)",
    category: "mood",
    thumbnail: "🌑",
    generateSvg: (w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="#09090b"/>
      </svg>
    `,
  },

  // --- SCREENTONES & GRADIENTS ---
  {
    id: "halftone_dots_dense",
    name: "Classic Halftone Dots (60 LPI)",
    category: "screentone",
    thumbnail: "🏁",
    generateSvg: (w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <defs>
          <pattern id="ht-dense" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.4" fill="#000000"/>
          </pattern>
        </defs>
        <rect width="${w}" height="${h}" fill="#ffffff"/>
        <rect width="${w}" height="${h}" fill="url(#ht-dense)"/>
      </svg>
    `,
  },
  {
    id: "halftone_dots_sparse",
    name: "Soft Screentone Dots (30 LPI Light)",
    category: "screentone",
    thumbnail: "░",
    generateSvg: (w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <defs>
          <pattern id="ht-sparse" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="1.5" fill="#52525b"/>
          </pattern>
        </defs>
        <rect width="${w}" height="${h}" fill="#ffffff"/>
        <rect width="${w}" height="${h}" fill="url(#ht-sparse)"/>
      </svg>
    `,
  },
  {
    id: "manga_gradation_top_down",
    name: "Manga Gradation (Sky / Emotion Tone)",
    category: "screentone",
    thumbnail: "📶",
    generateSvg: (w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <defs>
          <linearGradient id="manga-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#27272a"/>
            <stop offset="60%" stop-color="#d4d4d8"/>
            <stop offset="100%" stop-color="#ffffff"/>
          </linearGradient>
        </defs>
        <rect width="${w}" height="${h}" fill="url(#manga-grad)"/>
      </svg>
    `,
  },
  {
    id: "crosshatch_dark_shading",
    name: "Heavy Crosshatching (Horror / Drama)",
    category: "screentone",
    thumbnail: "▦",
    generateSvg: (w, h) => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <defs>
          <pattern id="crosshatch-pattern" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="8" y2="8" stroke="#18181b" stroke-width="1.2"/>
            <line x1="8" y1="0" x2="0" y2="8" stroke="#18181b" stroke-width="1.2"/>
          </pattern>
        </defs>
        <rect width="${w}" height="${h}" fill="#ffffff"/>
        <rect width="${w}" height="${h}" fill="url(#crosshatch-pattern)"/>
      </svg>
    `,
  },
];

export function getMangaBackgroundDataUrl(bg: MangaBackground, width = 800, height = 1130): string {
  const svg = bg.generateSvg(width, height);
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}


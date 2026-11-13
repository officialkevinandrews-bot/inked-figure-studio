import { useEffect, useState } from "react";
import { HEX_RE } from "@/lib/wardrobe";

function hexToRgb(hex: string): [number, number, number] {
  const clean = HEX_RE.test(hex) ? hex.slice(1) : "ffffff";
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n || 0)));
  return `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Full RGB picker (native wheel, hex box, and expandable R/G/B channels) with a row of quick-pick swatches. */
export function ColorPicker({
  label,
  value,
  onChange,
  swatches,
  onReset,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  swatches: string[];
  onReset?: () => void;
}) {
  const [text, setText] = useState(value);
  const [showRgb, setShowRgb] = useState(false);
  useEffect(() => setText(value), [value]);

  const [r, g, b] = hexToRgb(value);
  const setChannel = (idx: 0 | 1 | 2, val: number) => {
    const next: [number, number, number] = [r, g, b];
    next[idx] = val;
    onChange(rgbToHex(next[0], next[1], next[2]));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="w-20 shrink-0 text-xs font-semibold">{label}</span>
        <input
          type="color"
          value={HEX_RE.test(value) ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} colour`}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border-2 border-foreground bg-background p-0"
        />
        <input
          value={text}
          maxLength={7}
          aria-label={`${label} hex`}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setText(v);
            if (HEX_RE.test(v)) onChange(v.toLowerCase());
          }}
          className="w-16 rounded border border-input bg-background px-1.5 py-1 font-mono text-[11px] uppercase"
        />
        <button
          type="button"
          onClick={() => setShowRgb((s) => !s)}
          aria-expanded={showRgb}
          aria-label={`${label} RGB sliders`}
          className={`rounded border px-1.5 py-1 text-[10px] font-semibold ${
            showRgb ? "border-foreground bg-accent text-foreground" : "border-border text-muted-foreground hover:border-foreground"
          }`}
        >
          RGB
        </button>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            aria-label={`Reset ${label.toLowerCase()}`}
            className="text-[10px] font-semibold text-muted-foreground underline hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>

      {showRgb && (
        <div className="space-y-1 rounded-sm border border-border bg-muted/40 p-1.5 text-[10px]">
          {(
            [
              ["R", r, 0],
              ["G", g, 1],
              ["B", b, 2],
            ] as const
          ).map(([ch, val, idx]) => (
            <div key={ch} className="flex items-center gap-1.5">
              <span className="w-3 font-mono font-bold">{ch}</span>
              <input
                type="range"
                min={0}
                max={255}
                value={val}
                aria-label={`${label} ${ch}`}
                onChange={(e) => setChannel(idx, +e.target.value)}
                className="flex-1 accent-primary"
              />
              <input
                type="number"
                min={0}
                max={255}
                value={val}
                aria-label={`${label} ${ch} value`}
                onChange={(e) => setChannel(idx, +e.target.value)}
                className="w-11 rounded border border-input bg-background px-1 py-0.5 font-mono text-[10px]"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
            className={`h-5 w-5 rounded-sm border-2 ${
              c.toLowerCase() === value.toLowerCase() ? "border-primary ring-1 ring-primary" : "border-border"
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

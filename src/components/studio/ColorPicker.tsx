import { useEffect, useState } from "react";
import { HEX_RE } from "@/lib/wardrobe";

/** Full RGB picker (native wheel + hex box) with a row of quick-pick swatches. */
export function ColorPicker({ label, value, onChange, swatches }: { label: string; value: string; onChange: (hex: string) => void; swatches: string[] }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs font-semibold">{label}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} colour`}
          className="h-7 w-9 cursor-pointer rounded border-2 border-foreground bg-background p-0" />
        <input value={text} maxLength={7} aria-label={`${label} hex`}
          onChange={(e) => { const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`; setText(v); if (HEX_RE.test(v)) onChange(v.toLowerCase()); }}
          className="w-20 rounded border border-input bg-background px-1.5 py-1 font-mono text-[11px] uppercase" />
      </div>
      <div className="flex flex-wrap gap-1">
        {swatches.map((c) => (
          <button key={c} title={c} aria-label={`${label} ${c}`} onClick={() => onChange(c)}
            className={`h-5 w-5 rounded-sm border-2 ${c.toLowerCase() === value.toLowerCase() ? "border-primary ring-1 ring-primary" : "border-border"}`}
            style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

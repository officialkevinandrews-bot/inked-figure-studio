import { useEffect, useRef, useState } from "react";
import {
  BROW_STATES, BROW_STYLES, CHARACTER_LOOKS, DEFAULT_CALIBRATION, EXPRESSIONS, EYE_STATES, EYE_STYLES, FACE_FX, MOUTH_STATES, MOUTH_STYLES,
  applyExpression, resolveFace, setPartOverride, toggleFx,
  type FaceCalibration, type FaceConfig, type FaceFx, type ResolvedFace,
} from "@/lib/face-library";
import { drawFace } from "@/lib/face-draw";
import { DEFAULT_FACE_COLORS, FACE_COLOR_LABELS, type FaceColors } from "@/lib/face-library";
import { SWATCHES } from "@/lib/wardrobe";
import { ColorPicker } from "./ColorPicker";

function FaceThumb({ face, calib, size = 64 }: { face: ResolvedFace; calib: FaceCalibration; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify([face, calib]);
  useEffect(() => {
    const c = ref.current?.getContext("2d"); if (!c) return;
    c.save(); c.clearRect(0, 0, 512, 512); drawFace(c, face, calib, { mono: false, guide: false }); c.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <canvas ref={ref} width={512} height={512} style={{ width: size, height: size }} className="mx-auto" />;
}

const Btn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title?: string }) => (
  <button title={title} onClick={onClick} className={`rounded-sm border-2 px-1.5 py-1 text-[11px] font-semibold transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground hover:bg-accent"}`}>{children}</button>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2 border-b border-border p-3"><h3 className="font-display text-sm uppercase tracking-wide">{title}</h3>{children}</div>
);

const SLIDERS: [keyof FaceCalibration, string, number, number, number][] = [
  ["offsetY", "Face height", -0.1, 0.25, 0.002], ["offsetZ", "Forward / back", 0, 0.25, 0.002], ["offsetX", "Left / right", -0.05, 0.05, 0.001],
  ["size", "Face size", 0.08, 0.4, 0.002], ["tilt", "Tilt", -40, 40, 1], ["curve", "Wrap around face", 0, 1, 0.01],
  ["eyeSpacing", "Eye spacing", 40, 140, 1], ["eyeY", "Eye height", 150, 340, 1], ["browGap", "Brow gap", 30, 100, 1],
  ["mouthY", "Mouth height", 300, 470, 1], ["partScale", "Feature size", 0.5, 1.8, 0.01],
];

export function FacePanel({ face, onChange, hasHead, onAutoFit }: { face: FaceConfig; onChange: (f: FaceConfig) => void; hasHead: boolean; onAutoFit: () => void }) {
  const [part, setPart] = useState<"eye" | "brow" | "mouth">("eye");
  const r = resolveFace(face);
  const set = (p: Partial<FaceConfig>) => onChange({ ...face, ...p });
  const setK = (k: keyof FaceCalibration, v: number) => onChange({ ...face, calib: { ...face.calib, [k]: v } });
  const states = part === "eye" ? EYE_STATES : part === "brow" ? BROW_STATES : MOUTH_STATES;

  if (!hasHead) return <p className="p-4 text-sm text-muted-foreground">Load a rigged model with a Head bone to add a face.</p>;

  return (
    <div className="flex-1 overflow-y-auto text-sm" data-testid="face-panel">
      <div className="flex items-center gap-3 border-b border-border p-3">
        <FaceThumb face={r} calib={face.calib} size={72} />
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={face.visible} onChange={(e) => set({ visible: e.target.checked })} /> Show face</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={face.guide} onChange={(e) => set({ guide: e.target.checked })} /> Alignment guide</label>
          <p className="text-[11px] text-muted-foreground">{face.expression ?? "Custom"}{Object.keys(face.overrides).length ? " (mixed)" : ""}</p>
        </div>
      </div>

      <Section title="Expressions">
        <div className="grid grid-cols-3 gap-1.5">
          {Object.keys(EXPRESSIONS).map((name) => (
            <button key={name} onClick={() => onChange(applyExpression(face, name))}
              className={`rounded-sm border-2 p-1 text-[10px] font-semibold ${face.expression === name && !Object.keys(face.overrides).length ? "border-foreground bg-accent" : "border-border hover:border-foreground"}`}>
              <FaceThumb face={resolveFace(applyExpression(face, name))} calib={face.calib} size={52} />
              {name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Mix & Match">
        <div className="flex gap-1">
          {(["eye", "brow", "mouth"] as const).map((p) => <Btn key={p} active={part === p} onClick={() => setPart(p)}>{p === "eye" ? "Eyes" : p === "brow" ? "Brows" : "Mouth"}</Btn>)}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(states).map(([id, label]) => {
            const preview = resolveFace(setPartOverride(face, part, id));
            return (
              <button key={id} onClick={() => onChange(setPartOverride(face, part, id))} aria-label={`${part} ${label}`}
                className={`rounded-sm border-2 p-1 text-[10px] ${r[part] === id ? "border-foreground bg-accent font-semibold" : "border-border hover:border-foreground"}`}>
                <FaceThumb face={preview} calib={face.calib} size={52} />{label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Manga FX">
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(FACE_FX) as [FaceFx, string][]).map(([id, label]) => <Btn key={id} active={face.fx.includes(id)} onClick={() => onChange(toggleFx(face, id))}>{label}</Btn>)}
        </div>
      </Section>

      <Section title="Face Colours">
        {(Object.keys(FACE_COLOR_LABELS) as (keyof FaceColors)[]).map((k) => (
          <ColorPicker key={k} label={FACE_COLOR_LABELS[k]} value={r.colors[k]} swatches={SWATCHES.face}
            onChange={(c) => onChange({ ...face, colors: { ...r.colors, [k]: c } })} />
        ))}
        <button onClick={() => onChange({ ...face, colors: { ...DEFAULT_FACE_COLORS } })} className="text-[11px] underline">Reset face colours</button>
      </Section>

      <Section title="Character Creator">
        <div className="flex flex-wrap gap-1.5">
          {CHARACTER_LOOKS.map((l) => <Btn key={l.name} active={face.eyeStyle === l.eyeStyle && face.browStyle === l.browStyle && face.mouthStyle === l.mouthStyle} onClick={() => set({ eyeStyle: l.eyeStyle, browStyle: l.browStyle, mouthStyle: l.mouthStyle })}>{l.name}</Btn>)}
        </div>
        {([["Eye shape", EYE_STYLES, "eyeStyle"], ["Brow shape", BROW_STYLES, "browStyle"], ["Mouth shape", MOUTH_STYLES, "mouthStyle"]] as const).map(([label, opts, key]) => (
          <label key={key} className="block text-xs font-semibold">{label}
            <select value={face[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<FaceConfig>)} className="mt-1 w-full rounded border border-input bg-background p-1.5 text-xs">
              {Object.entries(opts).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          </label>
        ))}
      </Section>

      <Section title="Fit to Model">
        <p className="text-[11px] text-muted-foreground">Line the face up once per model; it's saved and follows every pose.</p>
        <div className="flex gap-1.5">
          <Btn onClick={onAutoFit}>Auto-fit to face</Btn>
          <Btn onClick={() => onChange({ ...face, fitted: false, calib: { ...DEFAULT_CALIBRATION } })}>Reset fit</Btn>
        </div>
        {SLIDERS.map(([k, label, min, max, step]) => (
          <label key={k} className="block text-xs">
            <span className="flex justify-between"><span>{label}</span><span className="tabular-nums text-muted-foreground">{Number(face.calib[k]).toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0)}</span></span>
            <input type="range" min={min} max={max} step={step} value={face.calib[k]} onChange={(e) => setK(k, parseFloat(e.target.value))} className="w-full" aria-label={label} />
          </label>
        ))}
      </Section>
    </div>
  );
}

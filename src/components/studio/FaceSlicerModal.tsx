import { useEffect, useRef, useState } from "react";
import { EXPRESSIONS, applyExpression, resolveFace, DEFAULT_FACE, type FaceCalibration } from "@/lib/face-library";
import { PART_IDS, PART_LABELS, TEMPLATE_BOXES, TEMPLATE_SIZE, clampBox, type Box, type FacePack, type PartId } from "@/lib/face-parts";
import { SAMPLE_FACES, drawTemplateGuide, makeSampleSheet, slicePack, toTemplateCanvas } from "@/lib/face-pack-draw";
import { FaceThumb } from "./FacePanel";

const VIEW = 440; // on-screen sheet size
const K = VIEW / TEMPLATE_SIZE;

export function FaceSlicerModal({ calib, onClose, onSave }: { calib: FaceCalibration; onClose: () => void; onSave: (p: FacePack) => void }) {
  const [sheet, setSheet] = useState<HTMLCanvasElement | null>(null);
  const [boxes, setBoxes] = useState<Record<PartId, Box>>({ ...TEMPLATE_BOXES });
  const [name, setName] = useState("");
  const [pack, setPack] = useState<FacePack | null>(null);
  const [guide, setGuide] = useState(true);
  const [err, setErr] = useState("");
  const view = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: PartId; mode: "move" | "size"; x: number; y: number; b: Box } | null>(null);

  // redraw preview
  useEffect(() => {
    const c = view.current?.getContext("2d"); if (!c) return;
    c.clearRect(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE);
    c.fillStyle = "#f4e8dc"; c.beginPath(); c.ellipse(512, 560, 380, 460, 0, 0, Math.PI * 2); c.fill();
    if (guide) drawTemplateGuide(c);
    if (sheet) c.drawImage(sheet, 0, 0);
  }, [sheet, guide]);

  const reslice = (b = boxes, s = sheet, n = name) => {
    if (!s) return;
    const p = slicePack(s, b, n || "My face");
    setPack((old) => ({ ...p, id: old?.id ?? p.id }));
  };
  useEffect(() => { reslice(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sheet]);

  const loadFile = (f: File) => {
    setErr("");
    if (!f.type.startsWith("image/")) { setErr("Please choose a PNG or JPG image."); return; }
    const img = new Image();
    img.onload = () => { setSheet(toTemplateCanvas(img)); setName((n) => n || f.name.replace(/\.[^.]+$/, "")); URL.revokeObjectURL(img.src); };
    img.onerror = () => setErr("Couldn't read that image.");
    img.src = URL.createObjectURL(f);
  };

  const onDown = (e: React.PointerEvent, id: PartId, mode: "move" | "size") => {
    e.stopPropagation(); (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { id, mode, x: e.clientX, y: e.clientY, b: boxes[id] };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = (e.clientX - d.x) / K, dy = (e.clientY - d.y) / K;
    const nb = d.mode === "move" ? { ...d.b, x: d.b.x + dx, y: d.b.y + dy } : { ...d.b, w: d.b.w + dx, h: d.b.h + dy };
    setBoxes((b) => ({ ...b, [d.id]: clampBox(nb) }));
  };
  const onUp = () => { if (drag.current) { drag.current = null; reslice(); } };

  const downloadTemplate = () => {
    const c = document.createElement("canvas"); c.width = c.height = TEMPLATE_SIZE;
    drawTemplateGuide(c.getContext("2d")!);
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "face_template_1024.png"; a.click();
  };

  const found = pack ? PART_IDS.filter((id) => pack.parts[id]) : [];
  const neutral = { ...DEFAULT_FACE, calib };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-label="Face slicer">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-sm border-2 border-foreground bg-card shadow-xl">
        <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
          <h2 className="font-display text-lg uppercase tracking-wide">Face Slicer — neutral face to parts</h2>
          <button onClick={onClose} aria-label="Close face slicer" className="text-xl">×</button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:flex-row">
          <div className="space-y-2">
            <div className="relative select-none border border-border" style={{ width: VIEW, height: VIEW }} onPointerMove={onMove} onPointerUp={onUp}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}>
              <canvas ref={view} width={TEMPLATE_SIZE} height={TEMPLATE_SIZE} style={{ width: VIEW, height: VIEW }} />
              {!sheet && <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-muted-foreground">Drop your neutral face PNG here, or pick a sample below</div>}
              {sheet && PART_IDS.map((id) => {
                const b = boxes[id]; const ok = pack?.parts[id];
                return (
                  <div key={id} data-testid={`box-${id}`} onPointerDown={(e) => onDown(e, id, "move")}
                    className={`absolute cursor-move border-2 ${ok ? "border-primary" : "border-destructive"} bg-primary/5`}
                    style={{ left: b.x * K, top: b.y * K, width: b.w * K, height: b.h * K }}>
                    <span className="absolute -top-4 left-0 whitespace-nowrap bg-card px-0.5 text-[9px] font-bold">{PART_LABELS[id]}</span>
                    <span onPointerDown={(e) => onDown(e, id, "size")} className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize border-2 border-foreground bg-card" />
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => fileRef.current?.click()} className="rounded-sm border-2 border-foreground bg-foreground px-2 py-1 text-xs font-semibold text-background">Upload face image</button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
              {SAMPLE_FACES.map((s) => (
                <button key={s.name} onClick={() => { setSheet(makeSampleSheet(s)); setName(s.name.replace("Sample: ", "")); }} className="rounded-sm border-2 border-border px-2 py-1 text-xs font-semibold hover:border-foreground">{s.name}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} /> Show template</label>
              <button className="underline" onClick={() => { setBoxes({ ...TEMPLATE_BOXES }); reslice({ ...TEMPLATE_BOXES }); }}>Reset boxes</button>
              <button className="underline" onClick={downloadTemplate}>Download blank template</button>
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <p className="max-w-[440px] text-[11px] text-muted-foreground">Drag a box to move it, or its corner to resize. Each part is trimmed to its ink automatically. White paper backgrounds are removed for you.</p>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <label className="block text-xs font-semibold">Face name
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => reslice()} className="mt-1 w-full rounded border border-input bg-background p-1.5 text-sm" placeholder="e.g. Hero A" />
            </label>
            <div>
              <h3 className="font-display text-sm uppercase">Parts found ({found.length}/6)</h3>
              <div className="mt-1 flex flex-wrap gap-2" data-testid="parts-found">
                {PART_IDS.map((id) => (
                  <div key={id} className={`flex h-16 w-20 flex-col items-center justify-center rounded-sm border ${pack?.parts[id] ? "border-border" : "border-dashed border-destructive/60"}`}>
                    {pack?.parts[id] ? <img src={pack.parts[id]!.src} alt={PART_LABELS[id]} className="max-h-10 max-w-[72px] object-contain" /> : <span className="text-[9px] text-destructive">missing</span>}
                    <span className="text-[9px]">{PART_LABELS[id]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-display text-sm uppercase">Every expression, made from your neutral face</h3>
              <div className="mt-1 grid grid-cols-4 gap-1.5" data-testid="expression-preview">
                {Object.keys(EXPRESSIONS).map((ex) => (
                  <div key={ex} className="rounded-sm border border-border p-1 text-center text-[10px] font-semibold">
                    {pack ? <FaceThumb face={resolveFace(applyExpression(neutral, ex))} calib={calib} size={76} pack={pack} /> : <div style={{ height: 76 }} />}
                    {ex}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t-2 border-foreground px-4 py-2">
          <button onClick={onClose} className="rounded-sm border-2 border-border px-3 py-1 text-sm">Cancel</button>
          <button disabled={!pack || found.length < 3} onClick={() => pack && onSave({ ...pack, name: name.trim() || "My face" })}
            className="rounded-sm border-2 border-foreground bg-foreground px-3 py-1 text-sm font-semibold text-background disabled:opacity-40">Save to my face library</button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import type { ComicMark, SpeedLinesEffect, SFXStamp } from "@/lib/manga-effects";
import { generateSpeedWedges } from "@/lib/manga-effects";
import { Trash2, RotateCw } from "lucide-react";
import { usePageZoom } from "./zoom-context";
import { markPath } from "@/lib/manga-marks";
import { fontStack } from "@/lib/manga-fonts";
import { COMIC_MARK_PRESETS } from "@/lib/manga-effects";

// ── 1. Comic Marks Renderer
export function ComicMarkRenderer({
  mark,
  isSelected,
  onSelect,
  onChange,
  onDelete,
}: {
  mark: ComicMark;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<ComicMark>) => void;
  onDelete: () => void;
}) {
  const zoom = usePageZoom();
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

  const symbolMap: Record<string, string> = {
    sweat: "💧",
    anger: "💢",
    sparkles: "✨",
    shock: "///",
    question: "❓",
    exclamation: "❗",
    heart: "❤️",
    spiral: "🌀",
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos({ x: mark.x, y: mark.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    onChange({
      x: initialPos.x + ((e.clientX - dragStart.x) / zoom),
      y: initialPos.y + ((e.clientY - dragStart.y) / zoom),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer capture already released */
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${mark.x}px`,
        top: `${mark.y}px`,
        fontSize: `${mark.size}px`,
        lineHeight: 1,
        opacity: mark.opacity ?? 1,
        transform: `translate(-50%, -50%) rotate(${mark.rotation}deg)`,
        zIndex: mark.zIndex,
      }}
      className={`group select-none cursor-move p-1 ${isSelected ? "ring-2 ring-primary rounded-xs" : ""}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {(() => {
        const vec = markPath(mark.markType ?? COMIC_MARK_PRESETS.find((p) => p.mark === mark.type)?.type);
        if (vec)
          return (
            <svg width={mark.size} height={mark.size} viewBox="0 0 100 100" style={{ display: "block", overflow: "visible" }}>
              {/* White contrast halo so emotion marks pop over black screentones */}
              {vec.map((part, i) => (
                <path key={`halo-${i}`} d={part.d} fill="none" stroke="#ffffff" strokeWidth={(part.width ?? 4) + 6} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {vec.map((part, i) => (
                <path key={i} d={part.d} fill={part.fill ?? "none"} stroke={part.stroke} strokeWidth={part.width ?? 4} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
          );
        return <span className="drop-shadow-md select-none">{symbolMap[mark.type] || mark.type || "✨"}</span>;
      })()}

      {isSelected && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-foreground text-background px-1.5 py-0.5 rounded-sm shadow-ink text-[10px] z-50 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onChange({ rotation: (mark.rotation + 15) % 360 })}
            className="p-0.5 hover:bg-muted/30"
            title="Rotate"
          >
            <RotateCw className="h-2.5 w-2.5" />
          </button>
          <button onClick={onDelete} className="p-0.5 hover:text-destructive" title="Delete">
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── 2. Speed Lines Renderer
export function SpeedLinesRenderer({
  effect,
  width,
  height,
  isSelected,
  onSelect,
  onChange,
  onDelete,
}: {
  effect: SpeedLinesEffect;
  width: number;
  height: number;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<SpeedLinesEffect>) => void;
  onDelete: () => void;
}) {
  const wedges = React.useMemo(() => generateSpeedWedges(effect), [effect]);
  const zoom = usePageZoom();

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: "none",
        zIndex: effect.zIndex,
      }}
    >
      <svg style={{ width: "100%", height: "100%", pointerEvents: "none" }}>
        {wedges.map((poly, i) => (
          <polygon
            key={i}
            points={poly.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ")}
            fill={effect.color || "#000000"}
            opacity={effect.opacity ?? 1}
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          />
        ))}

        {/* Focal Center Handle when selected */}
        {isSelected && (
          <circle
            cx={effect.centerX}
            cy={effect.centerY}
            r={10}
            fill="#e11d2e"
            stroke="#ffffff"
            strokeWidth={2}
            style={{ pointerEvents: "auto" }}
            className="cursor-move"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
              const handleMove = (ev: PointerEvent) => {
                if (rect) {
                  onChange({
                    centerX: (ev.clientX - rect.left) / zoom,
                    centerY: (ev.clientY - rect.top) / zoom,
                  });
                }
              };
              const handleUp = () => {
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
              };
              window.addEventListener("pointermove", handleMove);
              window.addEventListener("pointerup", handleUp);
            }}
          />
        )}
      </svg>
    </div>
  );
}

// ── 3. Stylized Sound Effects (SFX Stamps)
export function SFXStampRenderer({
  stamp,
  isSelected,
  onSelect,
  onChange,
  onDelete,
}: {
  stamp: SFXStamp;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<SFXStamp>) => void;
  onDelete: () => void;
}) {
  const zoom = usePageZoom();
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos({ x: stamp.x, y: stamp.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    onChange({
      x: initialPos.x + ((e.clientX - dragStart.x) / zoom),
      y: initialPos.y + ((e.clientY - dragStart.y) / zoom),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer capture already released */
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${stamp.x}px`,
        top: `${stamp.y}px`,
        fontSize: `${stamp.fontSize}px`,
        opacity: stamp.opacity ?? 1,
        whiteSpace: "nowrap",
        lineHeight: 1,
        transform: `translate(-50%, -50%) rotate(${stamp.rotation}deg) skewX(${stamp.skewX}deg)`,
        zIndex: stamp.zIndex,
      }}
      className={`group select-none cursor-move p-2 ${isSelected ? "ring-2 ring-primary rounded-xs" : ""}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <span className="relative inline-block select-none">
        {(stamp.haloWidth ?? 3) > 0 && (
          <span
            aria-hidden="true"
            style={{
              fontFamily: fontStack(stamp.fontFamily, "sfx"),
              color: "transparent",
              WebkitTextStroke: `${(stamp.strokeWidth ?? 3) + (stamp.haloWidth ?? 3) * 2}px ${stamp.haloColor || "#ffffff"}`,
              paintOrder: "stroke fill",
            }}
            className="pointer-events-none absolute inset-0 font-black tracking-widest select-none"
          >
            {stamp.text}
          </span>
        )}
        <span
          style={{
            fontFamily: fontStack(stamp.fontFamily, "sfx"),
            color: stamp.fillColor || "#ffffff",
            WebkitTextStroke: `${stamp.strokeWidth ?? 3}px ${stamp.strokeColor || "#000000"}`,
            paintOrder: "stroke fill",
          }}
          className="relative font-black tracking-widest drop-shadow-xl select-none"
        >
          {stamp.text}
        </span>
      </span>

      {isSelected && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-foreground text-background px-1.5 py-0.5 rounded-sm shadow-ink text-[10px] z-50 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onChange({ rotation: (stamp.rotation + 15) % 360 })}
            className="p-0.5 hover:bg-muted/30"
            title="Rotate"
          >
            <RotateCw className="h-2.5 w-2.5" />
          </button>
          <button onClick={onDelete} className="p-0.5 hover:text-destructive" title="Delete">
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </div>
  );
}


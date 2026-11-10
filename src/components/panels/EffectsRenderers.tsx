import React, { useState } from "react";
import type { ComicMark, SpeedLinesEffect, SFXStamp } from "@/lib/manga-effects";
import { generateRadialSpeedLines } from "@/lib/manga-effects";
import { Trash2, RotateCw } from "lucide-react";

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
      x: initialPos.x + (e.clientX - dragStart.x),
      y: initialPos.y + (e.clientY - dragStart.y),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${mark.x}px`,
        top: `${mark.y}px`,
        fontSize: `${mark.size}px`,
        transform: `rotate(${mark.rotation}deg)`,
        zIndex: mark.zIndex,
      }}
      className={`group select-none cursor-move p-1 ${isSelected ? "ring-2 ring-primary rounded-xs" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <span className="drop-shadow-md select-none">{symbolMap[mark.type] || "✨"}</span>

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
  const lines = generateRadialSpeedLines(
    effect.centerX,
    effect.centerY,
    effect.innerRadius,
    effect.outerRadius,
    effect.density,
    effect.strokeWidth,
    effect.color
  );

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
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <svg style={{ width: "100%", height: "100%", pointerEvents: "auto" }}>
        {lines.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke={effect.color || "#000000"}
            strokeWidth={effect.strokeWidth || 1.5}
            strokeLinecap="round"
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
            className="cursor-move"
            onPointerDown={(e) => {
              e.stopPropagation();
              const handleMove = (ev: PointerEvent) => {
                const rect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
                if (rect) {
                  onChange({
                    centerX: ev.clientX - rect.left,
                    centerY: ev.clientY - rect.top,
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
      x: initialPos.x + (e.clientX - dragStart.x),
      y: initialPos.y + (e.clientY - dragStart.y),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${stamp.x}px`,
        top: `${stamp.y}px`,
        fontSize: `${stamp.fontSize}px`,
        transform: `rotate(${stamp.rotation}deg) skewX(${stamp.skewX}deg)`,
        zIndex: stamp.zIndex,
      }}
      className={`group select-none cursor-move p-2 ${isSelected ? "ring-2 ring-primary rounded-xs" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <span
        style={{
          fontFamily: "'Dela Gothic One', sans-serif",
          color: stamp.fillColor || "#ffffff",
          WebkitTextStroke: `${stamp.strokeWidth || 3}px ${stamp.strokeColor || "#000000"}`,
          paintOrder: "stroke fill",
        }}
        className="font-black tracking-widest drop-shadow-xl select-none"
      >
        {stamp.text}
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


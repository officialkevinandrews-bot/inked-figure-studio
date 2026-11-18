import React, { useState } from "react";
import type { SpeechBalloon } from "@/lib/manga-effects";
import { balloonPathFromSpec } from "@/lib/manga-effects";
import { computeResizedBox } from "@/lib/transform-box";
import { Trash2, Type, AlignVerticalJustifyCenter, MessageCircle } from "lucide-react";
import { usePageZoom } from "./zoom-context";
import { fontStack } from "@/lib/manga-fonts";

interface SpeechBalloonRendererProps {
  balloon: SpeechBalloon;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<SpeechBalloon>) => void;
  onDelete: () => void;
}

const BALLOON_HANDLES: { id: string; label: string; cls: string }[] = [
  { id: "nw", label: "Resize balloon top-left", cls: "-top-1.5 -left-1.5 cursor-nwse-resize" },
  { id: "ne", label: "Resize balloon top-right", cls: "-top-1.5 -right-1.5 cursor-nesw-resize" },
  { id: "se", label: "Resize balloon bottom-right", cls: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
  { id: "sw", label: "Resize balloon bottom-left", cls: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
  { id: "e", label: "Resize balloon width", cls: "top-1/2 -translate-y-1/2 -right-1.5 cursor-ew-resize" },
  { id: "s", label: "Resize balloon height", cls: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize" },
];

export function SpeechBalloonRenderer({
  balloon,
  isSelected,
  onSelect,
  onChange,
  onDelete,
}: SpeechBalloonRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const zoom = usePageZoom();
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, bx: 0, by: 0, w: 0, h: 0 });

  const [draggingTail, setDraggingTail] = useState(false);
  const [draggingCurve, setDraggingCurve] = useState(false);
  const [draggingTail2, setDraggingTail2] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos({ x: balloon.x, y: balloon.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      onChange({
        x: initialPos.x + dx,
        y: initialPos.y + dy,
      });
    } else if (resizing) {
      const dx = (e.clientX - resizeStart.x) / zoom;
      const dy = (e.clientY - resizeStart.y) / zoom;
      const next = computeResizedBox(
        { x: resizeStart.bx, y: resizeStart.by, width: resizeStart.w, height: resizeStart.h },
        resizing,
        dx,
        dy,
        e.shiftKey,
      );
      onChange({
        x: next.x,
        y: next.y,
        width: Math.max(56, next.width),
        height: Math.max(36, next.height),
      });
    } else if (draggingTail) {
      onChange({
        tailX: initialPos.x + (e.clientX - dragStart.x) / zoom,
        tailY: initialPos.y + (e.clientY - dragStart.y) / zoom,
      });
    } else if (draggingCurve) {
      onChange({
        tailCurveX: initialPos.x + (e.clientX - dragStart.x) / zoom,
        tailCurveY: initialPos.y + (e.clientY - dragStart.y) / zoom,
      });
    } else if (draggingTail2) {
      onChange({
        secondaryTail: {
          ...(balloon.secondaryTail ?? { x: -40, y: balloon.height * 0.8 }),
          x: initialPos.x + (e.clientX - dragStart.x) / zoom,
          y: initialPos.y + (e.clientY - dragStart.y) / zoom,
        },
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    setResizing(null);
    setDraggingTail(false);
    setDraggingCurve(false);
    setDraggingTail2(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer capture already released */
    }
  };

  const handleTailPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggingTail(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos({ x: balloon.tailX ?? 0, y: balloon.tailY ?? balloon.height * 0.8 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const defaultCurveX = balloon.tailCurveX ?? (balloon.tailX ?? 0) * 0.55 + 24;
  const defaultCurveY = balloon.tailCurveY ?? (balloon.tailY ?? balloon.height * 0.8) * 0.55;

  const handleCurvePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggingCurve(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos({ x: defaultCurveX, y: defaultCurveY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const secTailX = balloon.secondaryTail?.x ?? -48;
  const secTailY = balloon.secondaryTail?.y ?? balloon.height * 0.8;

  const handleTail2PointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggingTail2(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos({ x: secTailX, y: secTailY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const svgPath = balloonPathFromSpec(balloon);
  const showDoubleBorder = Boolean(balloon.doubleBorder || balloon.shape === "narration");
  const showShadow = Boolean(balloon.shadow ?? balloon.shape === "narration");
  const outerStrokeW = balloon.borderWidth ?? 2.5;
  const align = balloon.textAlign ?? (balloon.shape === "narration" ? "left" : "center");
  const justifyMap = { left: "flex-start", center: "center", right: "flex-end" } as const;

  return (
    <div
      style={{
        position: "absolute",
        left: `${balloon.x}px`,
        top: `${balloon.y}px`,
        width: `${balloon.width}px`,
        height: `${balloon.height}px`,
        zIndex: balloon.zIndex,
        opacity: balloon.opacity ?? 1,
      }}
      className={`group select-none cursor-move ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Balloon Vector Body */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${balloon.width}px`,
          height: `${balloon.height}px`,
          overflow: "visible",
          pointerEvents: "none",
          filter: showShadow ? "drop-shadow(3px 3px 0px rgba(0, 0, 0, 0.22))" : undefined,
        }}
      >
        <path
          d={svgPath}
          fill={balloon.backgroundColor || "#ffffff"}
          stroke={balloon.borderColor || balloon.strokeColor || "#000000"}
          strokeWidth={outerStrokeW}
          strokeDasharray={balloon.shape === "whisper" ? "5,3" : undefined}
          strokeLinejoin="round"
        />
        {showDoubleBorder && balloon.width > 20 && balloon.height > 20 && (
          <rect
            x={7.5}
            y={7.5}
            width={Math.max(4, balloon.width - 15)}
            height={Math.max(4, balloon.height - 15)}
            fill="none"
            stroke={balloon.borderColor || balloon.strokeColor || "#000000"}
            strokeWidth={Math.max(0.8, outerStrokeW * 0.42)}
          />
        )}
      </svg>

      {/* Balloon Text Content */}
      <div
        style={{
          position: "absolute",
          inset: balloon.shape === "narration" ? "11px 13px" : "12%",
          display: "flex",
          alignItems: "center",
          justifyContent: justifyMap[align],
          textAlign: align,
          fontSize: `${balloon.fontSize}px`,
          fontFamily: fontStack(balloon.fontFamily),
          fontWeight: balloon.fontWeight === "normal" ? 400 : 700,
          writingMode: balloon.isVertical || balloon.writingMode === "vertical-rl" ? "vertical-rl" : "horizontal-tb",
          lineHeight: 1.25,
          color: balloon.fontColor || "#000000",
        }}
        className="overflow-hidden select-text"
      >
        {isEditing ? (
          <textarea
            autoFocus
            value={balloon.text}
            onChange={(e) => onChange({ text: e.target.value })}
            onBlur={() => setIsEditing(false)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ textAlign: align, fontWeight: balloon.fontWeight === "normal" ? 400 : 700 }}
            className="w-full h-full p-0.5 bg-transparent border-none outline-none resize-none"
          />
        ) : (
          <span className="whitespace-pre-wrap w-full">{balloon.text || "Double click to write dialogue"}</span>
        )}
      </div>

      {/* On-canvas resize handles for balloons & narration boxes */}
      {isSelected && !isEditing &&
        BALLOON_HANDLES.map((h) => (
          <div
            key={h.id}
            role="button"
            tabIndex={0}
            data-touch-handle="true"
            aria-label={h.label}
            style={{ touchAction: "none" }}
            className={`pointer-events-auto absolute h-2.5 w-2.5 rounded-xs border border-foreground bg-primary shadow-xs ${h.cls}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect();
              setResizing(h.id);
              setResizeStart({
                x: e.clientX,
                y: e.clientY,
                bx: balloon.x,
                by: balloon.y,
                w: balloon.width,
                h: balloon.height,
              });
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        ))}

      {/* Draggable Tail Handles */}
      {isSelected && balloon.hasTail && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag primary speech tail"
          style={{
            position: "absolute",
            left: `${balloon.width / 2 + (balloon.tailX ?? 0) - 6}px`,
            top: `${balloon.height / 2 + (balloon.tailY ?? balloon.height * 0.8) - 6}px`,
            cursor: "crosshair",
            pointerEvents: "auto",
            touchAction: "none",
          }}
          data-touch-handle="true"
          className="w-3.5 h-3.5 bg-primary border-2 border-foreground rounded-full shadow-ink z-50 transition-transform hover:scale-125"
          title="Drag to aim speech tail"
          onPointerDown={handleTailPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {isSelected && balloon.hasTail && balloon.tailCurved && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag curved tail bend"
          style={{
            position: "absolute",
            left: `${balloon.width / 2 + defaultCurveX - 5}px`,
            top: `${balloon.height / 2 + defaultCurveY - 5}px`,
            cursor: "grab",
            pointerEvents: "auto",
          }}
          className="w-3 h-3 bg-amber-400 border-2 border-foreground rotate-45 shadow-xs z-50 transition-transform hover:scale-125"
          title="Drag to bend curved tail"
          onPointerDown={handleCurvePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {isSelected && balloon.hasSecondaryTail && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drag secondary speech tail"
          style={{
            position: "absolute",
            left: `${balloon.width / 2 + secTailX - 6}px`,
            top: `${balloon.height / 2 + secTailY - 6}px`,
            cursor: "crosshair",
            pointerEvents: "auto",
          }}
          className="w-3.5 h-3.5 bg-sky-400 border-2 border-foreground rounded-full shadow-ink z-50 transition-transform hover:scale-125"
          title="Drag to aim 2nd group dialogue tail"
          onPointerDown={handleTail2PointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Selected Action Toolbar */}
      {isSelected && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-foreground text-background px-2 py-0.5 rounded-sm shadow-ink text-[11px] z-50 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onChange({ isVertical: !balloon.isVertical })}
            title="Toggle Vertical / Horizontal Text Flow"
            className={`p-1 rounded-xs ${balloon.isVertical ? "bg-primary text-primary-foreground" : "hover:bg-muted/30"}`}
          >
            <AlignVerticalJustifyCenter className="h-3 w-3" />
          </button>
          <button
            onClick={() => onChange({ hasTail: !balloon.hasTail })}
            title="Toggle Tail"
            className="p-1 hover:bg-muted/30 rounded-xs"
          >
            <MessageCircle className="h-3 w-3" />
          </button>
          <button
            onClick={() => setIsEditing(true)}
            title="Edit Text"
            className="p-1 hover:bg-muted/30 rounded-xs"
          >
            <Type className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            title="Delete Balloon"
            className="p-1 hover:text-destructive rounded-xs"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import type { SpeechBalloon } from "@/lib/manga-effects";
import { generateBalloonPath } from "@/lib/manga-effects";
import { Trash2, Type, AlignVerticalJustifyCenter, MessageCircle } from "lucide-react";

interface SpeechBalloonRendererProps {
  balloon: SpeechBalloon;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<SpeechBalloon>) => void;
  onDelete: () => void;
}

export function SpeechBalloonRenderer({
  balloon,
  isSelected,
  onSelect,
  onChange,
  onDelete,
}: SpeechBalloonRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

  const [draggingTail, setDraggingTail] = useState(false);

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
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      onChange({
        x: initialPos.x + dx,
        y: initialPos.y + dy,
      });
    } else if (draggingTail) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const localX = e.clientX - (balloon.x + balloon.width / 2);
      const localY = e.clientY - (balloon.y + balloon.height / 2);
      onChange({
        tailX: localX,
        tailY: localY,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    setDraggingTail(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleTailPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggingTail(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const svgPath = generateBalloonPath(
    balloon.shape,
    balloon.width,
    balloon.height,
    balloon.tailX,
    balloon.tailY,
    balloon.hasTail
  );

  return (
    <div
      style={{
        position: "absolute",
        left: `${balloon.x}px`,
        top: `${balloon.y}px`,
        width: `${balloon.width}px`,
        height: `${balloon.height}px`,
        zIndex: balloon.zIndex,
      }}
      className={`group select-none cursor-move ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
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
        }}
      >
        <path
          d={svgPath}
          fill={balloon.backgroundColor || "#ffffff"}
          stroke={balloon.borderColor || "#000000"}
          strokeWidth={balloon.borderWidth || 2.5}
          strokeDasharray={balloon.shape === "whisper" ? "5,3" : undefined}
          strokeLinejoin="round"
        />
      </svg>

      {/* Balloon Text Content */}
      <div
        style={{
          position: "absolute",
          inset: "12%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: `${balloon.fontSize}px`,
          fontFamily: balloon.fontFamily || "inherit",
          writingMode: balloon.isVertical ? "vertical-rl" : "horizontal-tb",
          lineHeight: 1.25,
          color: "#000000",
        }}
        className="text-center font-bold overflow-hidden select-text"
      >
        {isEditing ? (
          <textarea
            autoFocus
            value={balloon.text}
            onChange={(e) => onChange({ text: e.target.value })}
            onBlur={() => setIsEditing(false)}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full h-full p-1 bg-transparent border-none outline-none resize-none text-center font-bold"
          />
        ) : (
          <span className="whitespace-pre-wrap">{balloon.text || "Double click to write dialogue"}</span>
        )}
      </div>

      {/* Draggable Tail Tip Handle (when selected) */}
      {isSelected && balloon.hasTail && (
        <div
          style={{
            position: "absolute",
            left: `${balloon.width / 2 + balloon.tailX - 6}px`,
            top: `${balloon.height / 2 + balloon.tailY - 6}px`,
            cursor: "crosshair",
            pointerEvents: "auto",
          }}
          className="w-3.5 h-3.5 bg-primary border-2 border-foreground rounded-full shadow-ink z-50 transition-transform hover:scale-125"
          title="Drag to aim speech tail"
          onPointerDown={handleTailPointerDown}
          onPointerUp={handlePointerUp}
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

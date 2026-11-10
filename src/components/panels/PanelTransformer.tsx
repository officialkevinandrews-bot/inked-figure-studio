import React, { useRef, useState, useEffect } from "react";
import type { PlacedElement } from "@/lib/manga-layout";
import { FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, Trash2, Maximize2, ShieldAlert } from "lucide-react";

interface PanelTransformerProps {
  element: PlacedElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: Partial<PlacedElement>) => void;
  onDelete: () => void;
}

export function PanelTransformer({
  element,
  isSelected,
  onSelect,
  onChange,
  onDelete,
}: PanelTransformerProps) {
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

  const [resizing, setResizing] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos({ x: element.x, y: element.y });
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
    } else if (resizing) {
      const dx = e.clientX - resizeStart.x;
      const dy = e.clientY - resizeStart.y;
      let newW = resizeStart.w;
      let newH = resizeStart.h;

      if (resizing.includes("e")) newW = Math.max(20, resizeStart.w + dx);
      if (resizing.includes("s")) newH = Math.max(20, resizeStart.h + dy);
      if (resizing.includes("w")) {
        newW = Math.max(20, resizeStart.w - dx);
      }
      if (resizing.includes("n")) {
        newH = Math.max(20, resizeStart.h - dy);
      }

      // Preserve aspect ratio if holding shift
      if (e.shiftKey) {
        const aspect = resizeStart.w / resizeStart.h;
        newH = newW / aspect;
      }

      onChange({ width: newW, height: newH });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    setResizing(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleResizePointerDown = (handle: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setResizing(handle);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w: element.width,
      h: element.height,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        transform: `rotate(${element.rotation}deg) scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})`,
        transformOrigin: "center center",
        zIndex: element.zIndex,
      }}
      className={`group select-none cursor-move ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <img
        src={element.imageUrl}
        alt="Placed Character"
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
      />

      {/* Breakout badge indicator */}
      {element.breakout && (
        <span
          title="Breakout layer: overlaps panel borders & gutters"
          className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-ink pointer-events-none flex items-center gap-0.5"
        >
          <Maximize2 className="h-2.5 w-2.5" /> Breakout
        </span>
      )}

      {/* Selected handles & Quick Controls toolbar */}
      {isSelected && (
        <>
          {/* Quick Transform Toolbar */}
          <div
            style={{
              transform: `scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})`,
            }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-foreground text-background px-2 py-1 rounded-sm shadow-ink text-xs z-50 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onChange({ breakout: !element.breakout })}
              title={element.breakout ? "Clip inside panel" : "Break out past borders (Pop-out)"}
              className={`px-1.5 py-0.5 rounded-xs text-[10px] font-bold ${
                element.breakout ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              {element.breakout ? "★ Pop-out ON" : "Pop-out OFF"}
            </button>

            <button
              onClick={() => onChange({ flipX: !element.flipX })}
              title="Flip Horizontal"
              className="p-1 hover:bg-muted/30 rounded-xs"
            >
              <FlipHorizontal className="h-3 w-3" />
            </button>
            <button
              onClick={() => onChange({ flipY: !element.flipY })}
              title="Flip Vertical"
              className="p-1 hover:bg-muted/30 rounded-xs"
            >
              <FlipVertical className="h-3 w-3" />
            </button>
            <button
              onClick={() => onChange({ zIndex: element.zIndex + 1 })}
              title="Bring Forward"
              className="p-1 hover:bg-muted/30 rounded-xs"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => onChange({ zIndex: Math.max(1, element.zIndex - 1) })}
              title="Send Backward"
              className="p-1 hover:bg-muted/30 rounded-xs"
            >
              <ArrowDown className="h-3 w-3" />
            </button>
            <button
              onClick={onDelete}
              title="Delete Element"
              className="p-1 hover:text-destructive rounded-xs"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          {/* 8-point resize handles */}
          {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => {
            const posClass: Record<string, string> = {
              nw: "-top-1.5 -left-1.5 cursor-nwse-resize",
              n: "-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
              ne: "-top-1.5 -right-1.5 cursor-nesw-resize",
              e: "top-1/2 -translate-y-1/2 -right-1.5 cursor-ew-resize",
              se: "-bottom-1.5 -right-1.5 cursor-nwse-resize",
              s: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
              sw: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
              w: "top-1/2 -translate-y-1/2 -left-1.5 cursor-ew-resize",
            };

            return (
              <div
                key={handle}
                className={`absolute w-3 h-3 bg-primary border-2 border-foreground rounded-xs shadow-xs ${posClass[handle]}`}
                onPointerDown={(e) => handleResizePointerDown(handle, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            );
          })}
        </>
      )}
    </div>
  );
}


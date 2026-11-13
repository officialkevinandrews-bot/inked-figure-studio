import React, { useState } from "react";
import type { PlacedElement } from "@/lib/manga-layout";
import { computeResizedBox } from "@/lib/transform-box";
import { FlipHorizontal, FlipVertical, ArrowUp, ArrowDown, Trash2, Maximize2, RotateCw } from "lucide-react";
import { usePageZoom } from "./zoom-context";

interface PanelTransformerProps {
  element: PlacedElement;
  isSelected: boolean;
  mode?: "full" | "art-only" | "handles-only";
  onSelect: () => void;
  onChange: (updated: Partial<PlacedElement>) => void;
  onDelete: () => void;
}

const HANDLE_LABELS: Record<string, string> = {
  nw: "Resize top-left corner",
  n: "Resize top edge",
  ne: "Resize top-right corner",
  e: "Resize right edge",
  se: "Resize bottom-right corner",
  s: "Resize bottom edge",
  sw: "Resize bottom-left corner",
  w: "Resize left edge",
};

export function PanelTransformer({
  element,
  isSelected,
  mode = "full",
  onSelect,
  onChange,
  onDelete,
}: PanelTransformerProps) {
  const zoom = usePageZoom();
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

  const [resizing, setResizing] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, elX: 0, elY: 0, w: 0, h: 0 });
  const [rotating, setRotating] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos({ x: element.x, y: element.y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
      onChange(
        computeResizedBox(
          { x: resizeStart.elX, y: resizeStart.elY, width: resizeStart.w, height: resizeStart.h },
          resizing,
          dx,
          dy,
          e.shiftKey,
        ),
      );
    } else if (rotating && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const deg = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI - 90;
      onChange({ rotation: Math.round(e.shiftKey ? Math.round(deg / 15) * 15 : deg) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    setResizing(null);
    setRotating(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer capture already released */
    }
  };

  const handleResizePointerDown = (handle: string, e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    setResizing(handle);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      elX: element.x,
      elY: element.y,
      w: element.width,
      h: element.height,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const showArt = mode !== "handles-only";
  const showHandles = mode !== "art-only" && isSelected;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        transform: `rotate(${element.rotation}deg) scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})`,
        transformOrigin: "center center",
        zIndex: mode === "handles-only" ? 90 : element.zIndex,
        pointerEvents: mode === "handles-only" ? "none" : "auto",
      }}
      className={`group select-none ${showArt ? "cursor-move" : ""} ${showHandles ? "ring-2 ring-primary ring-offset-1" : ""}`}
      onClick={showArt ? (e) => e.stopPropagation() : undefined}
      onPointerDown={showArt ? handlePointerDown : undefined}
      onPointerMove={showArt ? handlePointerMove : undefined}
      onPointerUp={showArt ? handlePointerUp : undefined}
    >
      {showArt && (
        <>
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
        </>
      )}

      {/* Selected handles & Quick Controls toolbar */}
      {showHandles && (
        <>
          {/* Quick Transform Toolbar */}
          <div
            style={{
              transform: `scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})`,
            }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-foreground text-background px-2 py-1 rounded-sm shadow-ink text-xs z-50 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
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
                role="button"
                tabIndex={0}
                aria-label={HANDLE_LABELS[handle]}
                className={`pointer-events-auto absolute w-3 h-3 bg-primary border-2 border-foreground rounded-xs shadow-xs ${posClass[handle]}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => handleResizePointerDown(handle, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            );
          })}

          {/* On-canvas bottom rotation handle */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Rotate element"
            title="Drag to rotate (Shift snaps 15°)"
            className="pointer-events-auto absolute -bottom-7 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-foreground bg-card text-foreground shadow-ink cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect();
              setRotating(true);
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <RotateCw className="h-3 w-3" />
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState } from "react";
import {
  DEFAULT_TAIL_WIDTH,
  MAX_BALLOON_TAILS,
  addBalloonTail,
  balloonPatchWithTails,
  buildBalloonRenderGeometry,
  defaultCurveControlForTail,
  getBalloonTails,
  supportsBalloonTails,
  type SpeechBalloon,
} from "@/lib/manga-effects";
import { computeResizedBox } from "@/lib/transform-box";
import {
  AlignVerticalJustifyCenter,
  Minus,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { usePageZoom } from "./zoom-context";
import { fontStack } from "@/lib/manga-fonts";

export const BALLOON_TAIL_BADGE_CLASSES = [
  "bg-primary text-primary-foreground",
  "bg-sky-500 text-white",
  "bg-emerald-500 text-white",
  "bg-violet-500 text-white",
  "bg-orange-500 text-white",
  "bg-rose-500 text-white",
] as const;

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
  const [dragTailState, setDragTailState] = useState<{
    kind: "tip" | "curve";
    index: number;
  } | null>(null);

  const canHaveTails = supportsBalloonTails(balloon.shape);
  const tails = canHaveTails ? getBalloonTails(balloon) : [];

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
    } else if (dragTailState) {
      const currentTails = getBalloonTails(balloon);
      if (!currentTails[dragTailState.index]) return;
      const nextX = initialPos.x + (e.clientX - dragStart.x) / zoom;
      const nextY = initialPos.y + (e.clientY - dragStart.y) / zoom;
      const nextTails = currentTails.map((tail, i) => {
        if (i !== dragTailState.index) return tail;
        if (dragTailState.kind === "tip") {
          return { ...tail, x: nextX, y: nextY };
        }
        return { ...tail, curved: true, curveX: nextX, curveY: nextY };
      });
      onChange(balloonPatchWithTails(balloon, nextTails));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    setResizing(null);
    setDragTailState(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer capture already released */
    }
  };

  const handleTailTipPointerDown = (e: React.PointerEvent, index: number) => {
    const tail = tails[index];
    if (!tail) return;
    e.stopPropagation();
    onSelect();
    setDragTailState({ kind: "tip", index });
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos({ x: tail.x, y: tail.y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTailCurvePointerDown = (e: React.PointerEvent, index: number) => {
    const tail = tails[index];
    if (!tail) return;
    e.stopPropagation();
    onSelect();
    const ctrl = defaultCurveControlForTail(tail);
    setDragTailState({ kind: "curve", index });
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialPos(ctrl);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const geom = buildBalloonRenderGeometry(balloon);
  const showDoubleBorder = Boolean(balloon.doubleBorder || balloon.shape === "narration");
  const showShadow = Boolean(balloon.shadow ?? balloon.shape === "narration");
  const outerStrokeW = balloon.borderWidth ?? 2.5;
  const fillCol = balloon.backgroundColor || "#ffffff";
  const strokeCol = balloon.borderColor || balloon.strokeColor || "#000000";
  const strokeDash = balloon.shape === "whisper" ? "5,3" : undefined;
  const useMergedStrokePass =
    geom.pointedTailPaths.length > 0 && fillCol !== "transparent" && outerStrokeW > 0;
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
      {/* Balloon Vector Body + Merged Multi-Tail Outlines */}
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
        {useMergedStrokePass ? (
          <>
            {/* Pass 1: Continuous silhouette outer stroke under fill */}
            <path
              d={geom.bodyPath}
              fill="none"
              stroke={strokeCol}
              strokeWidth={outerStrokeW * 2}
              strokeDasharray={strokeDash}
              strokeLinejoin="round"
              strokeMiterlimit={3}
            />
            {geom.pointedTailPaths.map((tailD, idx) => (
              <path
                key={`tail-stroke-${tails[idx]?.id ?? idx}`}
                d={tailD}
                fill="none"
                stroke={strokeCol}
                strokeWidth={outerStrokeW * 2}
                strokeDasharray={strokeDash}
                strokeLinejoin="round"
                strokeMiterlimit={3}
              />
            ))}
            {/* Pass 2: Solid unified interior fill hides interior tail-base seams */}
            <path d={geom.bodyPath} fill={fillCol} stroke="none" />
            {geom.pointedTailPaths.map((tailD, idx) => (
              <path
                key={`tail-fill-${tails[idx]?.id ?? idx}`}
                d={tailD}
                fill={fillCol}
                stroke="none"
              />
            ))}
          </>
        ) : (
          <>
            <path
              d={geom.bodyPath}
              fill={fillCol}
              stroke={strokeCol}
              strokeWidth={outerStrokeW}
              strokeDasharray={strokeDash}
              strokeLinejoin="round"
            />
            {geom.pointedTailPaths.map((tailD, idx) => (
              <path
                key={`tail-single-${tails[idx]?.id ?? idx}`}
                d={tailD}
                fill={fillCol}
                stroke={strokeCol}
                strokeWidth={outerStrokeW}
                strokeDasharray={strokeDash}
                strokeLinejoin="round"
              />
            ))}
          </>
        )}

        {/* Thought-cloud trailing circles (`O o .`) */}
        {geom.thoughtCircles.map((circle, idx) => (
          <circle
            key={`thought-dot-${idx}`}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            fill={fillCol === "transparent" ? "#ffffff" : fillCol}
            stroke={strokeCol}
            strokeWidth={outerStrokeW}
          />
        ))}

        {showDoubleBorder && balloon.width > 20 && balloon.height > 20 && (
          <rect
            x={7.5}
            y={7.5}
            width={Math.max(4, balloon.width - 15)}
            height={Math.max(4, balloon.height - 15)}
            fill="none"
            stroke={strokeCol}
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
      {isSelected &&
        !isEditing &&
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

      {/* Numbered, Touch-Safe Draggable Tail Tip & Curve Handles */}
      {isSelected &&
        !isEditing &&
        tails.map((tail, idx) => {
          const badgeCls = BALLOON_TAIL_BADGE_CLASSES[idx % BALLOON_TAIL_BADGE_CLASSES.length];
          const ctrl = tail.curved ? defaultCurveControlForTail(tail) : null;
          return (
            <React.Fragment key={tail.id ?? idx}>
              <div
                role="button"
                tabIndex={0}
                data-touch-handle="true"
                data-testid={`balloon-tail-handle-${idx}`}
                aria-label={`Drag speech tail ${idx + 1}`}
                title={`Drag tail ${idx + 1} (width ${Math.round(tail.width ?? DEFAULT_TAIL_WIDTH)}px)`}
                style={{
                  position: "absolute",
                  left: `${balloon.width / 2 + tail.x - 9}px`,
                  top: `${balloon.height / 2 + tail.y - 9}px`,
                  cursor: "crosshair",
                  pointerEvents: "auto",
                  touchAction: "none",
                }}
                className={`z-50 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-foreground text-[9px] font-bold leading-none shadow-ink transition-transform hover:scale-125 ${badgeCls}`}
                onPointerDown={(e) => handleTailTipPointerDown(e, idx)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onClick={(e) => e.stopPropagation()}
              >
                {idx + 1}
              </div>

              {ctrl && (
                <div
                  role="button"
                  tabIndex={0}
                  data-touch-handle="true"
                  data-testid={`balloon-curve-handle-${idx}`}
                  aria-label={`Drag curved tail ${idx + 1} bend`}
                  title={`Drag curve bend for tail ${idx + 1}`}
                  style={{
                    position: "absolute",
                    left: `${balloon.width / 2 + ctrl.x - 6}px`,
                    top: `${balloon.height / 2 + ctrl.y - 6}px`,
                    cursor: "grab",
                    pointerEvents: "auto",
                    touchAction: "none",
                  }}
                  className="z-50 h-3 w-3 rotate-45 border-2 border-foreground bg-amber-400 shadow-xs transition-transform hover:scale-125"
                  onPointerDown={(e) => handleTailCurvePointerDown(e, idx)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </React.Fragment>
          );
        })}

      {/* Selected Action Toolbar */}
      {isSelected && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1 whitespace-nowrap bg-foreground text-background px-2 py-0.5 rounded-sm shadow-ink text-[11px] z-50 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onChange({ isVertical: !balloon.isVertical })}
            title="Toggle Vertical / Horizontal Text Flow"
            className={`p-1 rounded-xs ${balloon.isVertical ? "bg-primary text-primary-foreground" : "hover:bg-muted/30"}`}
          >
            <AlignVerticalJustifyCenter className="h-3 w-3" />
          </button>

          {canHaveTails && (
            <>
              <button
                type="button"
                data-testid="balloon-add-tail-btn"
                disabled={tails.length >= MAX_BALLOON_TAILS}
                onClick={() => {
                  const patch = addBalloonTail(balloon);
                  if (patch) onChange(patch);
                }}
                title={
                  tails.length >= MAX_BALLOON_TAILS
                    ? `Max ${MAX_BALLOON_TAILS} tails reached`
                    : balloon.shape === "cloud"
                      ? "Add thought bubble dot trail"
                      : "Add another speaker tail"
                }
                className="inline-flex items-center gap-0.5 rounded-xs px-1.5 py-0.5 text-[10px] font-bold hover:bg-muted/30 disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
                <span>Tail</span>
                {tails.length > 0 && (
                  <span className="ml-0.5 font-mono text-[9px] opacity-80">{tails.length}</span>
                )}
              </button>

              {tails.length > 0 && (
                <button
                  type="button"
                  data-testid="balloon-remove-last-tail-btn"
                  onClick={() => onChange(balloonPatchWithTails(balloon, tails.slice(0, -1)))}
                  title="Remove last tail"
                  aria-label="Remove last tail"
                  className="p-1 rounded-xs hover:bg-muted/30"
                >
                  <Minus className="h-3 w-3" />
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setIsEditing(true)}
            title="Edit Text"
            className="p-1 hover:bg-muted/30 rounded-xs"
          >
            <Type className="h-3 w-3" />
          </button>
          <button
            type="button"
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

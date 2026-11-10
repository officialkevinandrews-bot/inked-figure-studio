import React from "react";
import type { PageLayout, PlacedElement } from "@/lib/manga-layout";
import { getPanelPixelBounds } from "@/lib/manga-layout";
import { PanelTransformer } from "./PanelTransformer";
import { SpeechBalloonRenderer } from "./SpeechBalloonRenderer";
import {
  ComicMarkRenderer,
  SpeedLinesRenderer,
  SFXStampRenderer,
} from "./EffectsRenderers";
import type { SpeechBalloon, ComicMark, SpeedLinesEffect, SFXStamp } from "@/lib/manga-effects";

interface PageCanvasProps {
  layout: PageLayout;
  selectedPanelId: string | null;
  selectedItemId: string | null;
  onSelectPanel: (panelId: string) => void;
  onSelectItem: (itemId: string | null) => void;
  onUpdateElement: (id: string, updated: Partial<PlacedElement>) => void;
  onDeleteElement: (id: string) => void;
  onUpdateBalloon: (id: string, updated: Partial<SpeechBalloon>) => void;
  onDeleteBalloon: (id: string) => void;
  onUpdateComicMark: (id: string, updated: Partial<ComicMark>) => void;
  onDeleteComicMark: (id: string) => void;
  onUpdateSpeedLines: (id: string, updated: Partial<SpeedLinesEffect>) => void;
  onDeleteSpeedLines: (id: string) => void;
  onUpdateSFXStamp: (id: string, updated: Partial<SFXStamp>) => void;
  onDeleteSFXStamp: (id: string) => void;
  zoom?: number;
}

export function PageCanvas({
  layout,
  selectedPanelId,
  selectedItemId,
  onSelectPanel,
  onSelectItem,
  onUpdateElement,
  onDeleteElement,
  onUpdateBalloon,
  onDeleteBalloon,
  onUpdateComicMark,
  onDeleteComicMark,
  onUpdateSpeedLines,
  onDeleteSpeedLines,
  onUpdateSFXStamp,
  onDeleteSFXStamp,
  zoom = 1,
}: PageCanvasProps) {
  const { width, height, margin, gutter } = layout.format;

  const clippedElements = layout.elements.filter((el) => !el.breakout);
  const breakoutElements = layout.elements.filter((el) => el.breakout);

  const balloons = layout.balloons ?? [];
  const comicMarks = layout.comicMarks ?? [];
  const speedLines = layout.speedLines ?? [];
  const sfxStamps = layout.sfxStamps ?? [];

  return (
    <div
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: "top center",
      }}
      className="relative transition-transform duration-100 ease-out select-none shadow-2xl"
    >
      {/* Physical Manga Page */}
      <div
        id="manga-page-container"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: "#ffffff",
        }}
        className="relative overflow-hidden border-2 border-foreground bg-white text-black"
        onClick={() => {
          onSelectItem(null);
        }}
      >
        {/* SVG Defs for Panel Clipping Masks */}
        <svg
          style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <defs>
            {layout.panels.map((p) => {
              const bounds = getPanelPixelBounds(p, width, height, margin, gutter);
              const pathD =
                bounds.points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ") +
                " Z";
              return (
                <clipPath key={`clip-${p.id}`} id={`clip-${p.id}`} clipPathUnits="userSpaceOnUse">
                  <path d={pathD} />
                </clipPath>
              );
            })}
          </defs>
        </svg>

        {/* 1. Panel Backgrounds Layer */}
        {layout.panels.map((p) => {
          const bounds = getPanelPixelBounds(p, width, height, margin, gutter);
          const isSelected = selectedPanelId === p.id;
          const svgPoints = bounds.points.map((pt) => `${pt.x},${pt.y}`).join(" ");

          return (
            <svg
              key={`bg-${p.id}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: `${width}px`,
                height: `${height}px`,
                pointerEvents: "auto",
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPanel(p.id);
                onSelectItem(null);
              }}
            >
              <polygon
                points={svgPoints}
                fill={p.backgroundColor || "#ffffff"}
                stroke={isSelected ? "#e11d2e" : p.borderColor}
                strokeWidth={isSelected ? Math.max(3, p.borderWidth + 1) : p.borderWidth}
                strokeDasharray={p.borderStyle === "dashed" ? "6,4" : undefined}
                className="cursor-pointer transition-all hover:fill-muted/20"
              />
            </svg>
          );
        })}

        {/* 2. Speed Lines Layer */}
        {speedLines.map((line) => (
          <SpeedLinesRenderer
            key={line.id}
            effect={line}
            width={width}
            height={height}
            isSelected={selectedItemId === line.id}
            onSelect={() => onSelectItem(line.id)}
            onChange={(u) => onUpdateSpeedLines(line.id, u)}
            onDelete={() => onDeleteSpeedLines(line.id)}
          />
        ))}

        {/* 3. Clipped Elements Layer (Masked cleanly inside panel frames) */}
        {layout.panels.map((p) => {
          const panelElements = clippedElements.filter((el) => el.panelId === p.id);
          if (panelElements.length === 0) return null;

          return (
            <div
              key={`clip-group-${p.id}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: `${width}px`,
                height: `${height}px`,
                clipPath: `url(#clip-${p.id})`,
                pointerEvents: "none",
              }}
            >
              {panelElements.map((el) => (
                <div key={el.id} style={{ pointerEvents: "auto" }}>
                  <PanelTransformer
                    element={el}
                    isSelected={selectedItemId === el.id}
                    onSelect={() => {
                      onSelectPanel(el.panelId);
                      onSelectItem(el.id);
                    }}
                    onChange={(updated) => onUpdateElement(el.id, updated)}
                    onDelete={() => onDeleteElement(el.id)}
                  />
                </div>
              ))}
            </div>
          );
        })}

        {/* 4. Panel Borders Outline Re-draw */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${height}px`,
            pointerEvents: "none",
          }}
        >
          {layout.panels.map((p) => {
            const bounds = getPanelPixelBounds(p, width, height, margin, gutter);
            const isSelected = selectedPanelId === p.id;
            const svgPoints = bounds.points.map((pt) => `${pt.x},${pt.y}`).join(" ");

            return (
              <polygon
                key={`border-${p.id}`}
                points={svgPoints}
                fill="none"
                stroke={isSelected ? "#e11d2e" : p.borderColor}
                strokeWidth={isSelected ? Math.max(3, p.borderWidth + 1) : p.borderWidth}
                strokeDasharray={p.borderStyle === "dashed" ? "6,4" : undefined}
              />
            );
          })}
        </svg>

        {/* 5. Breakout Characters (Overlaps Borders and Gutters!) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${height}px`,
            pointerEvents: "none",
          }}
        >
          {breakoutElements.map((el) => (
            <div key={el.id} style={{ pointerEvents: "auto" }}>
              <PanelTransformer
                element={el}
                isSelected={selectedItemId === el.id}
                onSelect={() => {
                  onSelectPanel(el.panelId);
                  onSelectItem(el.id);
                }}
                onChange={(updated) => onUpdateElement(el.id, updated)}
                onDelete={() => onDeleteElement(el.id)}
              />
            </div>
          ))}
        </div>

        {/* 6. Comic Marks Layer */}
        {comicMarks.map((mark) => (
          <ComicMarkRenderer
            key={mark.id}
            mark={mark}
            isSelected={selectedItemId === mark.id}
            onSelect={() => onSelectItem(mark.id)}
            onChange={(u) => onUpdateComicMark(mark.id, u)}
            onDelete={() => onDeleteComicMark(mark.id)}
          />
        ))}

        {/* 7. SFX Stamps (Sound Effects Onomatopoeia) */}
        {sfxStamps.map((stamp) => (
          <SFXStampRenderer
            key={stamp.id}
            stamp={stamp}
            isSelected={selectedItemId === stamp.id}
            onSelect={() => onSelectItem(stamp.id)}
            onChange={(u) => onUpdateSFXStamp(stamp.id, u)}
            onDelete={() => onDeleteSFXStamp(stamp.id)}
          />
        ))}

        {/* 8. Speech Balloons Layer (Topmost Layer for Readability) */}
        {balloons.map((b) => (
          <SpeechBalloonRenderer
            key={b.id}
            balloon={b}
            isSelected={selectedItemId === b.id}
            onSelect={() => onSelectItem(b.id)}
            onChange={(u) => onUpdateBalloon(b.id, u)}
            onDelete={() => onDeleteBalloon(b.id)}
          />
        ))}
      </div>
    </div>
  );
}

import React from "react";
import type { PageLayout, PanelPolygon, PlacedElement } from "@/lib/manga-layout";
import { getPanelPixelBounds } from "@/lib/manga-layout";
import { PanelTransformer } from "./PanelTransformer";

interface PageCanvasProps {
  layout: PageLayout;
  selectedPanelId: string | null;
  selectedElementId: string | null;
  onSelectPanel: (panelId: string) => void;
  onSelectElement: (elementId: string | null) => void;
  onUpdateElement: (id: string, updated: Partial<PlacedElement>) => void;
  onDeleteElement: (id: string) => void;
  zoom?: number;
}

export function PageCanvas({
  layout,
  selectedPanelId,
  selectedElementId,
  onSelectPanel,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  zoom = 1,
}: PageCanvasProps) {
  const { width, height, margin, gutter } = layout.format;

  // Group elements into clipped panel elements vs breakout elements
  const clippedElements = layout.elements.filter((el) => !el.breakout);
  const breakoutElements = layout.elements.filter((el) => el.breakout);

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
          onSelectElement(null);
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
              const pathD = bounds.points
                .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
                .join(" ") + " Z";
              return (
                <clipPath key={`clip-${p.id}`} id={`clip-${p.id}`} clipPathUnits="userSpaceOnUse">
                  <path d={pathD} />
                </clipPath>
              );
            })}
          </defs>
        </svg>

        {/* 1. Panel Backgrounds & Borders Layer */}
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
                onSelectElement(null);
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

        {/* 2. Clipped Elements Layer (strictly masked within panel boundaries) */}
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
                    isSelected={selectedElementId === el.id}
                    onSelect={() => {
                      onSelectPanel(el.panelId);
                      onSelectElement(el.id);
                    }}
                    onChange={(updated) => onUpdateElement(el.id, updated)}
                    onDelete={() => onDeleteElement(el.id)}
                  />
                </div>
              ))}
            </div>
          );
        })}

        {/* 3. Panel Borders Re-draw (so borders sit crisply above clipped artwork) */}
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

        {/* 4. Breakout Layer (Renders characters that pop-out past borders over gutters) */}
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
                isSelected={selectedElementId === el.id}
                onSelect={() => {
                  onSelectPanel(el.panelId);
                  onSelectElement(el.id);
                }}
                onChange={(updated) => onUpdateElement(el.id, updated)}
                onDelete={() => onDeleteElement(el.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

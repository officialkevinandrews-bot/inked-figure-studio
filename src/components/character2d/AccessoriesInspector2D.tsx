import React, { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import {
  ACCESSORY_SLOTS_2D,
  countEquippedAccessories2D,
  getAccessoriesForSlot2D,
  getAccessoryItem2D,
  type AccessoryItemId2D,
  type AccessorySlot2D,
  type AccessorySlotSelection2D,
  type CharacterAccessories2D,
} from "@/lib/character2d-accessories";
import { RGB_SWATCHES_2D } from "@/lib/character2d-types";

interface AccessoriesInspector2DProps {
  accessories: CharacterAccessories2D | undefined;
  onChange: (next: CharacterAccessories2D) => void;
  onSuggestZoom?: (zoom: "face" | "full") => void;
}

function AccessoryColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-foreground/85">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase text-muted-foreground">{value}</span>
          <input
            type="color"
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded-sm border border-border bg-transparent p-0.5"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {RGB_SWATCHES_2D.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            onClick={() => onChange(hex)}
            className={`h-4 w-4 rounded-sm border transition-transform ${
              value.toLowerCase() === hex.toLowerCase()
                ? "scale-110 border-primary ring-1 ring-primary"
                : "border-foreground/30 hover:scale-105"
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  );
}

export const AccessoriesInspector2D: React.FC<AccessoriesInspector2DProps> = ({
  accessories,
  onChange,
  onSuggestZoom,
}) => {
  const [activeSlot, setActiveSlot] = useState<AccessorySlot2D>("eyewear");
  const accMap: CharacterAccessories2D = accessories ?? {};
  const equippedCount = countEquippedAccessories2D(accMap);
  const slotMeta = ACCESSORY_SLOTS_2D.find((s) => s.id === activeSlot) ?? ACCESSORY_SLOTS_2D[0]!;
  const items = getAccessoriesForSlot2D(activeSlot);
  const currentSel = accMap[activeSlot];
  const currentId: AccessoryItemId2D = currentSel?.id ?? "none";
  const currentMeta = getAccessoryItem2D(currentId);

  const selectSlot = (slotId: AccessorySlot2D) => {
    setActiveSlot(slotId);
    const meta = ACCESSORY_SLOTS_2D.find((s) => s.id === slotId);
    if (meta && onSuggestZoom) onSuggestZoom(meta.defaultZoom);
  };

  const setSlotItem = (itemId: AccessoryItemId2D) => {
    if (itemId === "none") {
      const next = { ...accMap };
      delete next[activeSlot];
      onChange(next);
      return;
    }
    const meta = getAccessoryItem2D(itemId);
    if (!meta) return;
    const prev = accMap[activeSlot];
    const nextSel: AccessorySlotSelection2D = {
      id: itemId,
      color: prev?.id === itemId ? prev.color : meta.defaultColor,
      accentColor: prev?.id === itemId ? prev.accentColor : meta.defaultAccentColor,
      scale: prev?.id === itemId ? prev.scale : 1,
      offsetY: prev?.id === itemId ? prev.offsetY : 0,
    };
    onChange({ ...accMap, [activeSlot]: nextSel });
  };

  const updateCurrentSel = (patch: Partial<AccessorySlotSelection2D>) => {
    if (!currentSel || currentSel.id === "none") return;
    onChange({
      ...accMap,
      [activeSlot]: { ...currentSel, ...patch },
    });
  };

  return (
    <div className="space-y-3" data-testid="char2d-accessories-inspector">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-bold block">Manga Accessories (6 Modular Slots)</span>
          <span className="text-[10px] text-muted-foreground">
            Layer multiple slots at once · 8-angle &amp; Manga Ink ready
          </span>
        </div>
        {equippedCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground hover:border-destructive/60 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
            Clear ({equippedCount})
          </button>
        )}
      </div>

      {/* 6 Modular Slot Sub-Tabs */}
      <div className="grid grid-cols-3 gap-1">
        {ACCESSORY_SLOTS_2D.map((s) => {
          const isEquipped = Boolean(accMap[s.id] && accMap[s.id]?.id !== "none");
          const isActive = activeSlot === s.id;
          return (
            <button
              key={s.id}
              type="button"
              data-testid={`acc-slot-${s.id}`}
              onClick={() => selectSlot(s.id)}
              className={`relative flex items-center justify-center gap-1 rounded-sm border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                isActive
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background hover:border-foreground/40"
              }`}
            >
              <span>{s.label}</span>
              {isEquipped && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                  title="Equipped in this slot"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Item Picker for Active Slot */}
      <div className="space-y-1.5 rounded-sm border border-border bg-muted/20 p-2.5">
        <span className="text-[11px] font-bold block">{slotMeta.label} Style</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setSlotItem("none")}
            className={`rounded-sm border px-2 py-1.5 text-left transition-colors ${
              currentId === "none"
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-background hover:border-foreground/40"
            }`}
          >
            <div className="text-[11px] font-bold">None</div>
            <div className="text-[9px] text-muted-foreground">Empty slot</div>
          </button>
          {items.map((item) => {
            const active = currentId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`acc-item-${item.id}`}
                onClick={() => setSlotItem(item.id)}
                className={`rounded-sm border px-2 py-1.5 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background hover:border-foreground/40"
                }`}
              >
                <div className="text-[11px] font-bold leading-tight">{item.name}</div>
                <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                  {item.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Slot Colors & Fine Fit Controls */}
      {currentSel && currentMeta && (
        <div className="space-y-2.5 rounded-sm border border-border bg-card p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold">{currentMeta.name} — Customize</span>
            <button
              type="button"
              onClick={() =>
                updateCurrentSel({
                  color: currentMeta.defaultColor,
                  accentColor: currentMeta.defaultAccentColor,
                  scale: 1,
                  offsetY: 0,
                })
              }
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>

          <AccessoryColorPicker
            label={currentMeta.primaryLabel}
            value={currentSel.color}
            onChange={(hex) => updateCurrentSel({ color: hex })}
          />

          {currentMeta.accentLabel && (
            <AccessoryColorPicker
              label={currentMeta.accentLabel}
              value={currentSel.accentColor ?? currentMeta.defaultAccentColor ?? "#f8fafc"}
              onChange={(hex) => updateCurrentSel({ accentColor: hex })}
            />
          )}

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
            <label className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Size</span>
                <span className="font-mono">{Math.round((currentSel.scale ?? 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.8}
                max={1.25}
                step={0.02}
                value={currentSel.scale ?? 1}
                onChange={(e) => updateCurrentSel({ scale: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </label>
            <label className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Vertical Nudge</span>
                <span className="font-mono">
                  {(currentSel.offsetY ?? 0) >= 0
                    ? `+${currentSel.offsetY ?? 0}`
                    : currentSel.offsetY}
                  px
                </span>
              </div>
              <input
                type="range"
                min={-14}
                max={14}
                step={1}
                value={currentSel.offsetY ?? 0}
                onChange={(e) => updateCurrentSel({ offsetY: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

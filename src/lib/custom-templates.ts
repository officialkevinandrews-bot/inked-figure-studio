import type { PanelPolygon } from "./manga-layout";
import type { GridTemplate } from "./manga-grid";

export interface SavedCustomTemplate {
  id: string;
  label: string;
  description: string;
  panels: PanelPolygon[];
  createdAt: number;
}

const KEY = "koma-custom-templates";

export function loadCustomTemplates(): SavedCustomTemplate[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedCustomTemplate[];
    return Array.isArray(parsed) ? parsed.filter((t) => t && t.id && Array.isArray(t.panels) && t.panels.length > 0) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplates(list: SavedCustomTemplate[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function addCustomTemplate(
  list: SavedCustomTemplate[],
  label: string,
  panels: PanelPolygon[],
): SavedCustomTemplate[] {
  const clean = label.trim() || `Custom ${list.length + 1}`;
  const clone: PanelPolygon[] = JSON.parse(JSON.stringify(panels));
  const entry: SavedCustomTemplate = {
    id: `custom-tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    label: clean,
    description: `${clone.length}-panel custom layout`,
    panels: clone,
    createdAt: Date.now(),
  };
  return [entry, ...list];
}

export function removeCustomTemplate(list: SavedCustomTemplate[], id: string): SavedCustomTemplate[] {
  return list.filter((t) => t.id !== id);
}

export function toGridTemplates(saved: SavedCustomTemplate[]): (GridTemplate & { isCustom: true })[] {
  return saved.map((s) => ({
    id: s.id,
    label: s.label,
    category: "classic",
    description: s.description,
    isCustom: true,
    build: () => JSON.parse(JSON.stringify(s.panels)) as PanelPolygon[],
  }));
}

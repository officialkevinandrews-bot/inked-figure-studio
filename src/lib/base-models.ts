import shonen from "@/assets/models/shonen_base.fbx.asset.json";

/** Bodies that ship with the studio. Uploaded bodies use "file:<id>" keys stored in the browser file store. */
export interface BuiltinModel { key: string; name: string; url: string; ext: string }
export const BUILTIN_MODELS: BuiltinModel[] = [
  { key: "builtin:xbot", name: "X Bot (demo)", url: "/models/xbot.glb", ext: "glb" },
  { key: "builtin:shonen-base", name: "Shonen Hero Base", url: shonen.url, ext: "fbx" },
];
export const builtinModel = (key: string) => BUILTIN_MODELS.find((m) => m.key === key);

/** Every distinct uploaded body already used by a character, so it can be reused without re-uploading. */
export function uploadedBodies(chars: { model: string; modelName: string }[]) {
  const seen = new Map<string, string>();
  for (const c of chars) if (c.model.startsWith("file:") && !seen.has(c.model)) seen.set(c.model, c.modelName);
  return [...seen].map(([key, name]) => ({ key, name }));
}

export const SKIN_SWATCHES = ["#ffe4cf", "#f7d2b6", "#eebf9c", "#d9a07a", "#b97c55", "#8d5a3b", "#5e3a25", "#ffffff"];

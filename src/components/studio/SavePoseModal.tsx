import React, { useState } from "react";
import { X, BookmarkPlus } from "lucide-react";
import { CATEGORIES } from "@/lib/poses";

interface SavePoseModalProps {
  isOpen: boolean;
  onClose: () => void;
  thumbnail?: string;
  onSave: (name: string, category: string) => void;
}

export function SavePoseModal({
  isOpen,
  onClose,
  thumbnail,
  onSave,
}: SavePoseModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Custom");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), category);
    setName("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-sm border-2 border-foreground bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b-2 border-foreground px-4 py-3">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg">Save Pose to Library</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {thumbnail && (
            <div className="flex justify-center bg-muted/30 p-2 rounded-sm border border-border">
              <img
                src={thumbnail}
                alt="Pose Thumbnail"
                className="h-28 object-contain"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1">Pose Name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hero Landing, Punch High, Coffee Sip"
              className="w-full rounded-sm border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-sm border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-foreground"
            >
              <option value="Custom">Custom</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold hover:border-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-sm border-2 border-foreground bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              Save Pose
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

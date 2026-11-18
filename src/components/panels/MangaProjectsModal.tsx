import React, { useMemo, useRef, useState } from "react";
import { insetPanelPoints } from "@/lib/manga-grid";
import type { MangaLibraryState, MangaProject } from "@/lib/manga-projects";
import {
  BookOpen,
  Check,
  Copy,
  Download,
  Edit3,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

interface MangaProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  library: MangaLibraryState;
  saveStatus: "saved" | "saving";
  onSaveNow: () => void | Promise<void>;
  onSelectChapter: (projectId: string, chapterId: string) => void | Promise<void>;
  onCreateProject: (title: string) => void | Promise<void>;
  onAddChapter: (projectId: string, chapterTitle?: string) => void | Promise<void>;
  onRenameProject: (projectId: string, title: string) => void;
  onRenameChapter: (projectId: string, chapterId: string, title: string) => void;
  onDuplicateProject: (projectId: string) => void | Promise<void>;
  onDuplicateChapter: (projectId: string, chapterId: string) => void | Promise<void>;
  onDeleteProject: (projectId: string) => void | Promise<void>;
  onDeleteChapter: (projectId: string, chapterId: string) => void | Promise<void>;
  onExportProject: (projectId: string) => void | Promise<void>;
  onImportProject: (file: File) => void | Promise<void>;
}

function formatUpdated(ts: number): string {
  try {
    return new Date(ts).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Mini wireframe SVG thumbnail of a project's first page. */
function ProjectPreviewThumb({ project }: { project: MangaProject }) {
  const firstPage = project.chapters[0]?.pages[0];
  const W = 54;
  const H = 78;
  if (!firstPage) {
    return <div className="h-[78px] w-[54px] shrink-0 rounded-sm border border-border bg-white" />;
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[78px] w-[54px] shrink-0 rounded-sm border border-foreground bg-white shadow-xs"
      aria-hidden="true"
    >
      {firstPage.panels.map((p) => (
        <polygon
          key={p.id}
          points={insetPanelPoints(p.points, W, H, 4, 2, 2, {
            bleed: p.bleed,
            floating: p.floating,
          })
            .map((pt) => `${pt.x},${pt.y}`)
            .join(" ")}
          fill={p.backgroundColor === "transparent" || !p.backgroundColor ? "#fff" : p.backgroundColor}
          stroke="#111"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

export function MangaProjectsModal({
  isOpen,
  onClose,
  library,
  saveStatus,
  onSaveNow,
  onSelectChapter,
  onCreateProject,
  onAddChapter,
  onRenameProject,
  onRenameChapter,
  onDuplicateProject,
  onDuplicateChapter,
  onDeleteProject,
  onDeleteChapter,
  onExportProject,
  onImportProject,
}: MangaProjectsModalProps) {
  const [search, setSearch] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingProjId, setEditingProjId] = useState<string | null>(null);
  const [editingProjTitle, setEditingProjTitle] = useState("");
  const [editingChapterKey, setEditingChapterKey] = useState<string | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState("");
  const [confirmDeleteProjId, setConfirmDeleteProjId] = useState<string | null>(null);
  const [confirmDeleteChapterKey, setConfirmDeleteChapterKey] = useState<string | null>(null);
  const [newChapterTargetProjId, setNewChapterTargetProjId] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...library.projects].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.chapters.some((c) => c.title.toLowerCase().includes(q)),
    );
  }, [library.projects, search]);

  if (!isOpen) return null;

  const submitNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim() || `Manga Series ${library.projects.length + 1}`;
    setNewTitle("");
    setCreatingNew(false);
    await onCreateProject(title);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manga Series and Chapters Library"
        data-testid="manga-projects-modal"
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded border-2 border-foreground bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-foreground bg-accent/40 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg">Manga Series &amp; Chapters</h2>
              <span
                data-testid="library-save-badge"
                className="rounded border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
              >
                {saveStatus === "saving" ? "Saving..." : "All changes saved"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Save separate manga series with independent chapters &amp; pages. 3D characters, outfits &amp; base models stay shared across all projects.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void onSaveNow()}
              className="rounded border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:border-foreground"
            >
              Save Now
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Manga Projects"
              className="rounded p-1 hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <button
            type="button"
            data-testid="new-manga-series-btn"
            onClick={() => {
              setCreatingNew((v) => !v);
              setNewTitle(`Manga Series ${library.projects.length + 1}`);
            }}
            className="flex items-center gap-1.5 rounded border-2 border-foreground bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-ink hover:-translate-y-0.5 transition-transform"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            + New Manga Series
          </button>

          <button
            type="button"
            data-testid="import-manga-project-btn"
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-foreground"
          >
            <Upload className="h-3.5 w-3.5" />
            Import Project (.json)
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            aria-label="Import Manga Project File"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportProject(f);
              e.target.value = "";
            }}
          />

          <div className="relative ml-auto min-w-[180px] flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search series or chapters..."
              aria-label="Search manga series"
              className="w-full rounded border border-border bg-background py-1 pl-7 pr-2 text-xs"
            />
          </div>
        </div>

        {/* Inline New Series Form */}
        {creatingNew && (
          <form
            onSubmit={submitNewProject}
            className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-4 py-2.5 text-xs"
          >
            <span className="font-bold text-primary">New Series:</span>
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Series title (e.g. Tokyo Blades)"
              aria-label="New series title"
              className="min-w-[200px] flex-1 rounded border border-foreground bg-background px-2 py-1 text-xs font-medium"
            />
            <button
              type="submit"
              className="rounded border-2 border-foreground bg-primary px-3 py-1 font-bold text-primary-foreground shadow-ink"
            >
              Create &amp; Open
            </button>
            <button
              type="button"
              onClick={() => setCreatingNew(false)}
              className="rounded border border-border bg-background px-2.5 py-1 hover:border-foreground"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Series Cards List */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {filteredProjects.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No saved manga series match &ldquo;{search}&rdquo;.
            </div>
          ) : (
            filteredProjects.map((proj) => {
              const isActiveProj = proj.id === library.activeProjectId;
              const totalPages = proj.chapters.reduce((sum, ch) => sum + ch.pages.length, 0);
              const isEditingProj = editingProjId === proj.id;
              const isConfirmingProjDel = confirmDeleteProjId === proj.id;
              const isAddingChapterHere = newChapterTargetProjId === proj.id;

              return (
                <div
                  key={proj.id}
                  data-testid={`project-card-${proj.id}`}
                  className={`rounded border-2 p-3 transition-colors ${
                    isActiveProj
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <ProjectPreviewThumb project={proj} />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Title + Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {isEditingProj ? (
                          <form
                            className="flex flex-1 items-center gap-1.5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              onRenameProject(proj.id, editingProjTitle);
                              setEditingProjId(null);
                            }}
                          >
                            <input
                              type="text"
                              autoFocus
                              value={editingProjTitle}
                              onChange={(e) => setEditingProjTitle(e.target.value)}
                              aria-label="Edit series title"
                              className="flex-1 rounded border border-primary bg-card px-2 py-0.5 text-sm font-bold"
                            />
                            <button
                              type="submit"
                              className="rounded border border-primary bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProjId(null)}
                              className="rounded border border-border px-2 py-0.5 text-[11px]"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate font-display text-base">{proj.title}</h3>
                            {isActiveProj && (
                              <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                                Active
                              </span>
                            )}
                          </div>
                        )}

                        {/* Project Action Buttons */}
                        <div className="flex flex-wrap items-center gap-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setNewChapterTargetProjId(isAddingChapterHere ? null : proj.id);
                              setNewChapterTitle(`Chapter ${proj.chapters.length + 1}`);
                            }}
                            className="flex items-center gap-1 rounded border border-primary bg-primary/10 px-2 py-1 font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                            Add Chapter
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProjId(proj.id);
                              setEditingProjTitle(proj.title);
                            }}
                            title="Rename series"
                            aria-label={`Rename ${proj.title}`}
                            className="rounded border border-border p-1 hover:border-foreground"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDuplicateProject(proj.id)}
                            title="Duplicate entire series"
                            aria-label={`Duplicate ${proj.title}`}
                            className="flex items-center gap-1 rounded border border-border px-2 py-1 hover:border-foreground"
                          >
                            <Copy className="h-3 w-3" />
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => void onExportProject(proj.id)}
                            title="Export this series & all its chapters as .json"
                            aria-label={`Export ${proj.title}`}
                            className="flex items-center gap-1 rounded border border-border px-2 py-1 hover:border-foreground"
                          >
                            <Download className="h-3 w-3" />
                            Export
                          </button>
                          {isConfirmingProjDel ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteProjId(null);
                                  void onDeleteProject(proj.id);
                                }}
                                className="rounded bg-destructive px-2 py-1 font-bold text-destructive-foreground"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteProjId(null)}
                                className="rounded border border-border px-1.5 py-1"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProjId(proj.id)}
                              title="Delete series"
                              aria-label={`Delete ${proj.title}`}
                              className="rounded border border-border p-1 text-destructive hover:border-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        {proj.chapters.length} {proj.chapters.length === 1 ? "chapter" : "chapters"} · {totalPages}{" "}
                        {totalPages === 1 ? "page" : "pages"} · Updated {formatUpdated(proj.updatedAt)}
                      </div>

                      {/* Inline Add Chapter Input */}
                      {isAddingChapterHere && (
                        <form
                          className="flex flex-wrap items-center gap-1.5 rounded border border-primary/60 bg-card p-2 text-xs"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const t = newChapterTitle.trim() || `Chapter ${proj.chapters.length + 1}`;
                            setNewChapterTargetProjId(null);
                            await onAddChapter(proj.id, t);
                          }}
                        >
                          <input
                            type="text"
                            autoFocus
                            value={newChapterTitle}
                            onChange={(e) => setNewChapterTitle(e.target.value)}
                            aria-label="New chapter title"
                            className="min-w-[160px] flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                          />
                          <button
                            type="submit"
                            className="rounded bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground"
                          >
                            Create Chapter
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewChapterTargetProjId(null)}
                            className="rounded border border-border px-2 py-1 text-[11px]"
                          >
                            Cancel
                          </button>
                        </form>
                      )}

                      {/* Chapters List inside this Series */}
                      <div className="mt-2 space-y-1">
                        {proj.chapters.map((ch) => {
                          const isCurrent = isActiveProj && proj.activeChapterId === ch.id;
                          const chKey = `${proj.id}:${ch.id}`;
                          const isEditingCh = editingChapterKey === chKey;
                          const isConfirmingChDel = confirmDeleteChapterKey === chKey;

                          return (
                            <div
                              key={ch.id}
                              data-testid={`chapter-row-${ch.id}`}
                              className={`flex flex-wrap items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs ${
                                isCurrent
                                  ? "border-primary/70 bg-card font-semibold"
                                  : "border-border/80 bg-muted/30"
                              }`}
                            >
                              {isEditingCh ? (
                                <form
                                  className="flex flex-1 items-center gap-1.5"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    onRenameChapter(proj.id, ch.id, editingChapterTitle);
                                    setEditingChapterKey(null);
                                  }}
                                >
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editingChapterTitle}
                                    onChange={(e) => setEditingChapterTitle(e.target.value)}
                                    aria-label="Edit chapter title"
                                    className="flex-1 rounded border border-primary bg-background px-2 py-0.5 text-xs"
                                  />
                                  <button
                                    type="submit"
                                    className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingChapterKey(null)}
                                    className="rounded border border-border px-1.5 py-0.5 text-[10px]"
                                  >
                                    Cancel
                                  </button>
                                </form>
                              ) : (
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="truncate">{ch.title}</span>
                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                    ({ch.pages.length} {ch.pages.length === 1 ? "page" : "pages"})
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center gap-1 text-[11px]">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onSelectChapter(proj.id, ch.id);
                                    onClose();
                                  }}
                                  className={`flex items-center gap-1 rounded border px-2 py-0.5 font-semibold transition-colors ${
                                    isCurrent
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-foreground bg-background hover:bg-accent"
                                  }`}
                                >
                                  {isCurrent && <Check className="h-3 w-3" />}
                                  {isCurrent ? "Editing" : "Open & Review"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingChapterKey(chKey);
                                    setEditingChapterTitle(ch.title);
                                  }}
                                  title="Rename chapter"
                                  aria-label={`Rename ${ch.title}`}
                                  className="rounded border border-border p-1 hover:border-foreground"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onDuplicateChapter(proj.id, ch.id)}
                                  title="Duplicate chapter"
                                  aria-label={`Duplicate ${ch.title}`}
                                  className="rounded border border-border p-1 hover:border-foreground"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                {proj.chapters.length > 1 && (
                                  isConfirmingChDel ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmDeleteChapterKey(null);
                                        void onDeleteChapter(proj.id, ch.id);
                                      }}
                                      className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground"
                                    >
                                      Confirm
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteChapterKey(chKey)}
                                      title="Delete chapter"
                                      aria-label={`Delete ${ch.title}`}
                                      className="rounded border border-border p-1 text-destructive hover:border-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

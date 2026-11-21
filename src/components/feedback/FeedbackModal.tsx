import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bug,
  Camera,
  CheckCircle2,
  Clock,
  Lightbulb,
  MessageCircle,
  Paperclip,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useOptionalAuth } from "@/components/auth/AuthProvider";
import { normalizeEmail } from "@/lib/allowlist";
import {
  canDeleteFeedbackItem,
  compressImageToFeedbackDataUrl,
  FEEDBACK_AREAS,
  type FeedbackItem,
  type FeedbackPriority,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/feedback";
import { useOptionalFeedback } from "./FeedbackProvider";

function friendlyMemberLabel(email: string, displayName?: string | null): string {
  const norm = normalizeEmail(email);
  if (norm === "officialkevinandrews@gmail.com") return "Kevin (Main)";
  if (norm === "careerdrivenkevin@gmail.com") return "Kevin (Alt)";
  if (norm === "craigrees@hotmail.com") return "Craig";
  if (displayName?.trim()) return displayName.trim();
  return email || "Member";
}

function formatShortTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const TYPE_META: Record<FeedbackType, { label: string; badgeClass: string; Icon: React.ComponentType<{ className?: string }> }> = {
  bug: { label: "Bug", badgeClass: "bg-red-100 text-red-900 border-red-400", Icon: Bug },
  feature: { label: "Feature", badgeClass: "bg-amber-100 text-amber-900 border-amber-400", Icon: Lightbulb },
  feedback: { label: "Feedback", badgeClass: "bg-sky-100 text-sky-900 border-sky-400", Icon: MessageCircle },
};

const PRIORITY_CLASS: Record<FeedbackPriority, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-amber-500 text-black",
  low: "bg-muted text-muted-foreground",
};

export function FeedbackModal() {
  const auth = useOptionalAuth();
  const fb = useOptionalFeedback();

  const [type, setType] = useState<FeedbackType>("bug");
  const [priority, setPriority] = useState<FeedbackPriority>("medium");
  const [area, setArea] = useState<string>("Manga Panels");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeDeviceInfo, setIncludeDeviceInfo] = useState(true);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [capturingShot, setCapturingShot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [mobileComposeOpen, setMobileComposeOpen] = useState(false);

  const [filterStatus, setFilterStatus] = useState<"active" | "all" | FeedbackStatus>("active");
  const [filterType, setFilterType] = useState<"all" | FeedbackType>("all");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fb?.isOpen) {
      setArea(fb.activeArea || "Manga Panels");
      setFormError(null);
      setFormSuccess(null);
    }
  }, [fb?.isOpen, fb?.activeArea]);

  const filteredItems = useMemo(() => {
    if (!fb) return [];
    return fb.items.filter((item) => {
      if (filterType !== "all" && item.type !== filterType) return false;
      if (filterStatus === "active") return item.status !== "done";
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      return true;
    });
  }, [fb, filterStatus, filterType]);

  if (!fb || !fb.isOpen || !auth?.user) return null;

  const currentUser = auth.user;

  const handleCaptureView = async () => {
    setFormError(null);
    setCapturingShot(true);
    try {
      const captured = await fb.captureCurrentView();
      if (!captured) {
        setFormError("Could not auto-capture this view — please use Attach Image instead.");
      } else {
        setScreenshotDataUrl(captured);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to capture view.");
    } finally {
      setCapturingShot(false);
    }
  };

  const handleAttachFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setFormError(null);
    setCapturingShot(true);
    try {
      const compressed = await compressImageToFeedbackDataUrl(file);
      setScreenshotDataUrl(compressed);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not attach image.");
    } finally {
      setCapturingShot(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await fb.submitFeedback({
        type,
        priority,
        area,
        title,
        description,
        deviceInfo: includeDeviceInfo ? fb.buildDefaultDeviceInfo(area) : null,
        screenshotDataUrl,
      });
      setTitle("");
      setDescription("");
      setScreenshotDataUrl(null);
      setFormSuccess("Posted to shared team board.");
      setMobileComposeOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not post feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (item: FeedbackItem, nextStatus: FeedbackStatus) => {
    setBusyItemId(item.id);
    try {
      await fb.changeStatus(item, nextStatus);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleSendReply = async (item: FeedbackItem) => {
    const text = (replyDrafts[item.id] ?? "").trim();
    if (!text) return;
    setBusyItemId(item.id);
    try {
      await fb.postReply(item, text);
      setReplyDrafts((prev) => ({ ...prev, [item.id]: "" }));
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDelete = async (item: FeedbackItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    setBusyItemId(item.id);
    try {
      await fb.removeItem(item.id);
    } finally {
      setBusyItemId(null);
    }
  };

  const devicePreview = fb.buildDefaultDeviceInfo(area);

  return (
    <div
      data-testid="feedback-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) fb.closeFeedback();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Team Feedback & Bug Board"
        data-testid="feedback-modal"
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded border-2 border-foreground bg-card text-foreground shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-foreground bg-muted/50 px-3 sm:px-5 py-2.5">
          <div>
            <h2 className="font-display text-base sm:text-lg tracking-wide flex items-center gap-2">
              TEAM FEEDBACK & BUG BOARD
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Shared live across Kevin & Craig&apos;s profiles ({fb.summary.openCount} open · {fb.summary.inProgressCount} in progress · {fb.summary.doneCount} done)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileComposeOpen((v) => !v)}
              className="md:hidden flex items-center gap-1 rounded-sm border-2 border-foreground bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-ink"
            >
              <Plus className="h-3.5 w-3.5" />
              {mobileComposeOpen ? "View List" : "New Post"}
            </button>
            <button
              type="button"
              onClick={fb.closeFeedback}
              aria-label="Close Feedback Board"
              className="rounded-sm border border-border p-1 hover:border-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body: Composer + Shared Board */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_1fr] overflow-hidden">
          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            className={`${
              mobileComposeOpen ? "flex" : "hidden md:flex"
            } flex-col gap-2.5 overflow-y-auto border-b-2 md:border-b-0 md:border-r-2 border-foreground bg-background/60 p-3 sm:p-4 text-xs`}
          >
            <div className="font-bold text-sm">Post Feedback, Bug, or Request</div>

            <div>
              <span className="block font-semibold text-muted-foreground mb-1">Type</span>
              <div className="grid grid-cols-3 gap-1">
                {(["bug", "feature", "feedback"] as const).map((t) => {
                  const active = type === t;
                  const MetaIcon = TYPE_META[t].Icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex items-center justify-center gap-1 rounded-sm border py-1.5 font-semibold transition-colors ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card hover:border-foreground"
                      }`}
                    >
                      <MetaIcon className="h-3.5 w-3.5" />
                      {TYPE_META[t].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block font-semibold text-muted-foreground mb-1">Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as FeedbackPriority)}
                  className="w-full rounded-sm border border-input bg-background px-2 py-1.5 font-medium"
                >
                  <option value="high">High (Blocker)</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low (Polish)</option>
                </select>
              </label>

              <label className="block">
                <span className="block font-semibold text-muted-foreground mb-1">App Area</span>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full rounded-sm border border-input bg-background px-2 py-1.5 font-medium"
                >
                  {FEEDBACK_AREAS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  {!FEEDBACK_AREAS.includes(area as (typeof FEEDBACK_AREAS)[number]) && (
                    <option value={area}>{area}</option>
                  )}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="block font-semibold text-muted-foreground mb-1">Title</span>
              <input
                type="text"
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of bug, idea, or note..."
                className="w-full rounded-sm border border-input bg-background px-2.5 py-1.5 text-xs"
              />
            </label>

            <label className="block">
              <span className="block font-semibold text-muted-foreground mb-1">Details / Steps</span>
              <textarea
                rows={4}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened, or what should be changed/added before launch?"
                className="w-full rounded-sm border border-input bg-background px-2.5 py-1.5 text-xs resize-y"
              />
            </label>

            <label className="flex items-start gap-2 rounded-sm border border-border bg-card p-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDeviceInfo}
                onChange={(e) => setIncludeDeviceInfo(e.target.checked)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block font-semibold">Include device/view info</span>
                <span className="block text-[10px] text-muted-foreground truncate">{devicePreview}</span>
              </span>
            </label>

            {/* Screenshot Attach / Auto-Capture */}
            <div className="space-y-1.5">
              <span className="block font-semibold text-muted-foreground">Screenshot (optional)</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={capturingShot}
                  onClick={handleCaptureView}
                  className="flex items-center gap-1 rounded-sm border border-foreground bg-accent px-2 py-1 font-semibold hover:bg-accent/80 disabled:opacity-50"
                >
                  <Camera className="h-3.5 w-3.5 text-primary" />
                  {capturingShot ? "Working..." : "Capture View"}
                </button>
                <button
                  type="button"
                  disabled={capturingShot}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 font-semibold hover:border-foreground disabled:opacity-50"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Attach Image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void handleAttachFile(e.target.files)}
                />
              </div>
              {screenshotDataUrl && (
                <div className="relative rounded border border-foreground bg-card p-1">
                  <img
                    src={screenshotDataUrl}
                    alt="Attached preview"
                    className="max-h-32 w-full object-contain rounded-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setScreenshotDataUrl(null)}
                    aria-label="Remove screenshot"
                    className="absolute right-1.5 top-1.5 rounded-full border border-foreground bg-background p-0.5 hover:bg-destructive hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {formError && (
              <div className="rounded border border-destructive bg-destructive/10 px-2.5 py-1.5 text-[11px] font-medium text-destructive">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="rounded border border-emerald-600 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-900">
                {formSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !title.trim()}
              data-testid="feedback-submit-btn"
              className="mt-auto flex items-center justify-center gap-1.5 rounded-sm border-2 border-foreground bg-primary px-3 py-2 font-bold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Posting..." : "Post to Board"}
            </button>
          </form>

          {/* Feed */}
          <div
            className={`${
              mobileComposeOpen ? "hidden md:flex" : "flex"
            } min-h-0 flex-col overflow-hidden`}
          >
            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-3 sm:px-4 py-2 text-xs">
              <div className="flex items-center gap-1">
                {([
                  ["active", `Open & WIP (${fb.summary.openCount + fb.summary.inProgressCount})`],
                  ["open", `Open (${fb.summary.openCount})`],
                  ["in-progress", `In Progress (${fb.summary.inProgressCount})`],
                  ["done", `Done (${fb.summary.doneCount})`],
                  ["all", `All (${fb.summary.totalCount})`],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterStatus(key)}
                    className={`rounded-sm px-2 py-1 font-semibold transition-colors ${
                      filterStatus === key
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                aria-label="Filter by type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "all" | FeedbackType)}
                className="ml-auto rounded-sm border border-input bg-background px-2 py-1 text-xs font-medium"
              >
                <option value="all">All Types</option>
                <option value="bug">Bugs Only</option>
                <option value="feature">Features Only</option>
                <option value="feedback">Feedback Only</option>
              </select>
            </div>

            {/* List */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {fb.error && (
                <div className="rounded border border-destructive bg-destructive/10 p-2.5 text-xs text-destructive">
                  Could not sync feedback board: {fb.error}
                </div>
              )}

              {fb.loading ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Loading shared team board...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="rounded border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                  No items match this filter yet. Use the form on the left to log a bug, request a feature, or leave notes for Kevin & Craig.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const meta = TYPE_META[item.type];
                  const Icon = meta.Icon;
                  const canDelete = canDeleteFeedbackItem(item, currentUser.email, currentUser.uid);
                  const isBusy = busyItemId === item.id;
                  const replyText = replyDrafts[item.id] ?? "";

                  return (
                    <article
                      key={item.id}
                      data-testid={`feedback-card-${item.id}`}
                      className="rounded border-2 border-foreground bg-background p-3 shadow-ink space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                            >
                              <Icon className="h-3 w-3" />
                              {meta.label}
                            </span>
                            <span
                              className={`rounded-xs px-1.5 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_CLASS[item.priority]}`}
                            >
                              {item.priority}
                            </span>
                            <span className="rounded-xs border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                              {item.area}
                            </span>
                            <span className="text-[11px] font-semibold text-foreground">
                              {friendlyMemberLabel(item.authorEmail, item.authorName)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatShortTime(item.createdAt)}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold leading-snug">{item.title}</h3>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <select
                            aria-label={`Status for ${item.title}`}
                            disabled={isBusy}
                            value={item.status}
                            onChange={(e) => void handleStatusChange(item, e.target.value as FeedbackStatus)}
                            className={`rounded-sm border px-2 py-1 text-[11px] font-bold ${
                              item.status === "done"
                                ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                                : item.status === "in-progress"
                                ? "border-amber-500 bg-amber-50 text-amber-900"
                                : "border-foreground bg-card text-foreground"
                            }`}
                          >
                            <option value="open">Open</option>
                            <option value="in-progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                          {canDelete && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleDelete(item)}
                              title="Delete item"
                              aria-label={`Delete ${item.title}`}
                              className="rounded-sm border border-border p-1 text-muted-foreground hover:border-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {item.description && (
                        <p className="whitespace-pre-wrap text-xs text-foreground/90 leading-relaxed">
                          {item.description}
                        </p>
                      )}

                      {item.deviceInfo && (
                        <div className="inline-flex items-center gap-1 rounded-xs bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          {item.deviceInfo}
                        </div>
                      )}

                      {item.screenshotDataUrl && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setLightboxSrc(item.screenshotDataUrl)}
                            className="group relative inline-block overflow-hidden rounded border border-foreground bg-muted"
                            title="Click to enlarge screenshot"
                          >
                            <img
                              src={item.screenshotDataUrl}
                              alt={`Screenshot for ${item.title}`}
                              className="max-h-36 w-auto object-contain transition-transform group-hover:scale-[1.02]"
                            />
                          </button>
                        </div>
                      )}

                      {/* Replies Thread */}
                      <div className="border-t border-border pt-2 space-y-1.5">
                        {item.replies.map((rep) => (
                          <div
                            key={rep.id}
                            className="rounded-xs border border-border bg-muted/40 px-2.5 py-1.5 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground mb-0.5">
                              <span className="font-bold text-foreground">
                                {friendlyMemberLabel(rep.authorEmail, rep.authorName)}
                              </span>
                              <span>{formatShortTime(rep.createdAt)}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-foreground/95">{rep.text}</p>
                          </div>
                        ))}

                        <div className="flex gap-1.5 pt-0.5">
                          <input
                            type="text"
                            maxLength={1500}
                            value={replyText}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void handleSendReply(item);
                              }
                            }}
                            placeholder="Write a reply to Craig / Kevin..."
                            className="min-w-0 flex-1 rounded-sm border border-input bg-card px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            disabled={isBusy || !replyText.trim()}
                            onClick={() => void handleSendReply(item)}
                            className="flex items-center gap-1 rounded-sm border border-foreground bg-accent px-2.5 py-1 font-semibold hover:bg-accent/80 disabled:opacity-40"
                          >
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            Reply
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Screenshot Full-View Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative max-h-[92dvh] max-w-[92vw]">
            <img
              src={lightboxSrc}
              alt="Full-size attachment"
              className="max-h-[88dvh] max-w-[90vw] rounded border-2 border-white object-contain"
            />
            <button
              type="button"
              onClick={() => setLightboxSrc(null)}
              aria-label="Close image preview"
              className="absolute -right-2 -top-2 rounded-full border-2 border-foreground bg-background p-1.5 shadow-lg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

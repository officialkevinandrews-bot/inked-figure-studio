import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Monitor,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import {
  APP_DOWNLOADS,
  APP_RELEASE_PAGE_URL,
  APP_RELEASE_VERSION,
  getDesktopBridge,
  type AppDownloadEntry,
} from "@/lib/app-downloads";

interface DownloadAppsModalProps {
  open: boolean;
  onClose: () => void;
}

export function DownloadAppsModal({ open, onClose }: DownloadAppsModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const desktopBridge = open ? getDesktopBridge() : null;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!copiedId) return;
    const timer = window.setTimeout(() => setCopiedId(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  if (!open || typeof document === "undefined") return null;

  const handleCopySha = async (entry: AppDownloadEntry) => {
    try {
      await navigator.clipboard?.writeText(entry.sha256);
      setCopiedId(entry.id);
    } catch {
      setCopiedId(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-xs sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-apps-title"
        data-testid="download-apps-modal"
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-sm border-2 border-foreground bg-card text-foreground shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="download-apps-title"
                className="text-base font-bold tracking-tight sm:text-lg"
              >
                Download MangakaDesk Apps
              </h2>
              <span className="rounded-sm border border-foreground/30 bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                v{APP_RELEASE_VERSION}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Direct member builds for Android phones/tablets and Windows PCs. Both sync to the same cloud account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close download apps modal"
            data-testid="download-apps-close-btn"
            className="rounded-sm border border-border p-1.5 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-4 sm:p-6">
          {desktopBridge?.platform === "windows" && (
            <div className="flex items-center gap-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                Currently running inside MangakaDesk Windows Desktop{" "}
                {desktopBridge.version ? `v${desktopBridge.version}` : ""}.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {APP_DOWNLOADS.map((entry) => {
              const Icon = entry.id === "android" ? Smartphone : Monitor;
              const isCopied = copiedId === entry.id;

              return (
                <section
                  key={entry.id}
                  data-testid={`download-card-${entry.id}`}
                  className="flex flex-col justify-between rounded-sm border-2 border-foreground/80 bg-background p-4 shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-foreground/30 bg-accent text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold leading-tight">{entry.name}</h3>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            v{entry.version} · {entry.fileSizeLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="mt-2.5 text-xs text-muted-foreground">{entry.subtitle}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-foreground/80">
                      Requires: {entry.requirements}
                    </p>

                    <ol className="mt-3 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
                      {entry.installSteps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>

                    {entry.notes && (
                      <p className="mt-2.5 rounded-sm border border-border bg-accent/50 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        {entry.notes}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 border-t border-border pt-3">
                    <a
                      href={entry.downloadUrl}
                      download={entry.fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`download-app-${entry.id}`}
                      className="flex w-full items-center justify-center gap-2 rounded-sm border-2 border-foreground bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Download {entry.fileName}</span>
                    </a>

                    <div className="flex items-center justify-between gap-2 rounded-sm border border-border bg-card px-2 py-1 text-[10px]">
                      <span className="truncate font-mono text-muted-foreground" title={entry.sha256}>
                        SHA-256: {entry.sha256.slice(0, 12)}…{entry.sha256.slice(-8)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopySha(entry)}
                        data-testid={`copy-sha-${entry.id}`}
                        className="inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 font-semibold text-foreground hover:bg-accent"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-accent/30 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-6">
          <span>Available inside the studio only (private pre-release for invited members).</span>
          <a
            href={APP_RELEASE_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-foreground underline-offset-2 hover:underline"
          >
            <span>Release v{APP_RELEASE_VERSION}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Download,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { CORE_ALLOWED_EMAILS } from "@/lib/allowlist";
import { downloadFullAccountBackup } from "@/lib/cloud-sync";
import { useOptionalAuth } from "./AuthProvider";

interface AccountMenuProps {
  compact?: boolean;
}

export function AccountMenu({ compact = false }: AccountMenuProps) {
  const auth = useOptionalAuth();
  const [open, setOpen] = useState(false);
  const [allowlistOpen, setAllowlistOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [allowlistMsg, setAllowlistMsg] = useState<string | null>(null);
  const [allowlistBusy, setAllowlistBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  if (!auth?.user) return null;
  const {
    user,
    syncStatus,
    allowedEmails,
    syncNow,
    signOutSafely,
    addAllowedEmail,
    removeAllowedEmail,
  } = auth;

  const initials = (user.displayName || user.email || "U").slice(0, 2).toUpperCase();

  const renderBadgeIcon = () => {
    if (syncStatus.phase === "syncing") {
      return <RefreshCw className="h-3 w-3 animate-spin text-amber-500" />;
    }
    if (syncStatus.phase === "offline") {
      return <CloudOff className="h-3 w-3 text-slate-500" />;
    }
    if (syncStatus.phase === "error" || syncStatus.phase === "conflict") {
      return <AlertTriangle className="h-3 w-3 text-destructive" />;
    }
    return <CheckCircle2 className="h-3 w-3 text-emerald-600" />;
  };

  const statusLabel = (() => {
    switch (syncStatus.phase) {
      case "syncing":
        return syncStatus.detail || "Saving to your cloud account…";
      case "offline":
        return `Offline — saved locally (${syncStatus.pendingCount} queued)`;
      case "conflict":
        return "Sync conflict needs your choice";
      case "error":
        return syncStatus.errorMessage || "Sync paused — saved locally";
      default:
        return syncStatus.pendingCount > 0
          ? `${syncStatus.pendingCount} change(s) queued`
          : "All data synced to your account";
    }
  })();

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAllowlistMsg(null);
    setAllowlistBusy(true);
    const res = await addAllowedEmail(newEmail);
    setAllowlistBusy(false);
    if (res.ok) {
      setNewEmail("");
      setAllowlistMsg("Added email to allowlist.");
    } else {
      setAllowlistMsg(res.error ?? "Could not add email.");
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        data-testid="account-menu-btn"
        onClick={() => setOpen((v) => !v)}
        title={`${user.email ?? "Signed-in Account"} — ${statusLabel}`}
        className="flex items-center gap-1.5 rounded-sm border border-border bg-card px-1.5 py-1 text-xs font-semibold hover:border-foreground transition-colors"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName ?? "Account avatar"}
            referrerPolicy="no-referrer"
            className="h-5 w-5 rounded-full object-cover border border-border"
          />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {initials}
          </span>
        )}
        {renderBadgeIcon()}
        {!compact && (
          <span className="hidden xl:inline max-w-[110px] truncate text-[11px]">
            {user.displayName?.split(" ")[0] || user.email}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            data-testid="account-menu-popover"
            className="absolute right-0 top-full z-50 mt-1.5 w-76 max-w-[92vw] max-h-[78dvh] overflow-y-auto rounded-sm border-2 border-foreground bg-card p-3 text-xs shadow-ink"
          >
            <div className="border-b border-border pb-2">
              <div className="font-bold truncate">{user.displayName || "Signed In"}</div>
              {user.email && (
                <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
              )}
            </div>

            <div className="mt-2.5 flex items-start gap-2 rounded-sm bg-muted/60 p-2 text-[11px]">
              <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{statusLabel}</div>
                {syncStatus.lastSyncedAt && (
                  <div className="text-[10px] text-muted-foreground">
                    Last cloud save: {new Date(syncStatus.lastSyncedAt).toLocaleTimeString()}
                  </div>
                )}
                {syncStatus.legacyImportedCount > 0 && (
                  <div className="mt-0.5 text-[10px] text-emerald-700 font-medium">
                    Imported {syncStatus.legacyImportedCount} browser item(s) to this account.
                  </div>
                )}
              </div>
            </div>

            {/* Shared Allowlist Manager (accessible by Kevin & Craig) */}
            <div className="mt-2.5 border-t border-border pt-2">
              <button
                type="button"
                data-testid="account-allowlist-toggle"
                onClick={() => setAllowlistOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-sm px-1 py-1 text-[11px] font-bold hover:bg-muted"
              >
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Allowed Users ({allowedEmails.length})</span>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {allowlistOpen ? "Hide" : "Manage"}
                </span>
              </button>

              {allowlistOpen && (
                <div className="mt-1.5 space-y-2 rounded-sm border border-border bg-muted/30 p-2">
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px]">
                    {allowedEmails.map((em) => {
                      const isCore = (CORE_ALLOWED_EMAILS as readonly string[]).includes(em);
                      return (
                        <li key={em} className="flex items-center justify-between gap-1">
                          <span className="truncate font-mono text-[10px]">{em}</span>
                          {isCore ? (
                            <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground">
                              Core
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={allowlistBusy}
                              onClick={() => void removeAllowedEmail(em)}
                              title={`Remove ${em}`}
                              className="shrink-0 rounded p-0.5 text-destructive hover:bg-destructive/15"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <form onSubmit={(e) => void handleAddEmail(e)} className="flex gap-1">
                    <input
                      type="email"
                      required
                      placeholder="friend@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="min-w-0 flex-1 rounded-xs border border-input bg-background px-1.5 py-1 text-[11px]"
                    />
                    <button
                      type="submit"
                      disabled={allowlistBusy}
                      title="Invite email to allowlist"
                      className="flex items-center gap-0.5 rounded-xs border border-foreground bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add</span>
                    </button>
                  </form>

                  {allowlistMsg && (
                    <div className="text-[10px] text-muted-foreground">{allowlistMsg}</div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2.5 space-y-1.5">
              <button
                type="button"
                data-testid="account-download-backup-btn"
                disabled={backupBusy}
                onClick={async () => {
                  setBackupBusy(true);
                  try {
                    await downloadFullAccountBackup(user.uid, user.email);
                  } finally {
                    setBackupBusy(false);
                  }
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-border bg-accent/60 px-2.5 py-1.5 font-semibold hover:border-foreground disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                <span>{backupBusy ? "Preparing Full Backup…" : "Download Full Account Backup (.json)"}</span>
              </button>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  data-testid="account-sync-now-btn"
                  onClick={() => {
                    void syncNow();
                  }}
                  disabled={syncStatus.phase === "syncing"}
                  className="flex flex-1 items-center justify-center gap-1 rounded-sm border border-border bg-background px-2 py-1.5 font-semibold hover:border-foreground disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${syncStatus.phase === "syncing" ? "animate-spin" : ""}`}
                  />
                  <span>Sync Now</span>
                </button>
                <button
                  type="button"
                  data-testid="account-signout-btn"
                  onClick={() => {
                    setOpen(false);
                    void signOutSafely();
                  }}
                  className="flex items-center justify-center gap-1 rounded-sm border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 font-semibold text-destructive hover:bg-destructive hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useAuth } from "./AuthProvider";

function formatTimestamp(ms: number): string {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const {
    phase,
    user,
    deniedEmail,
    firebaseConfigured,
    authError,
    authInfo,
    authBusy,
    syncStatus,
    legacyPrompt,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    resendVerification,
    checkVerification,
    clearAuthMessages,
    dismissAccessDenied,
    signOutSafely,
    resolveConflict,
    confirmImportLegacyData,
    skipLegacyData,
    continueWhileSyncing,
  } = useAuth();

  const [emailMode, setEmailMode] = useState<"signin" | "signup">("signin");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [importingLegacy, setImportingLegacy] = useState(false);

  if (phase === "loading" || phase === "syncing_initial") {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-sm rounded-sm border-2 border-foreground bg-card p-6 text-center shadow-ink">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <h2 className="font-display text-lg tracking-wide">
            {phase === "syncing_initial" ? "SYNCING YOUR WORKSPACE" : "INKED FIGURE STUDIO"}
          </h2>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {phase === "syncing_initial"
              ? `Loading projects, 3D characters, and models for ${user?.email ?? "your account"}…`
              : "Checking your account session…"}
          </p>
          {phase === "syncing_initial" && (
            <button
              type="button"
              data-testid="skip-sync-wait-btn"
              onClick={continueWhileSyncing}
              className="mt-4 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-foreground"
            >
              Open Studio Now (Sync in Background)
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "access_denied") {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-8 text-foreground safe-pt safe-pb">
        <div className="w-full max-w-md rounded-sm border-2 border-foreground bg-card p-6 text-center shadow-ink">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-foreground bg-destructive/15 text-destructive">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="font-display text-xl tracking-wide">PRIVATE STUDIO</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Access is locked to invited accounts only.{" "}
            <span className="font-semibold text-foreground">{deniedEmail}</span> is not on the allowlist.
          </p>
          <button
            type="button"
            data-testid="access-denied-back-btn"
            onClick={dismissAccessDenied}
            className="mt-5 w-full rounded-sm border-2 border-foreground bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-ink"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (phase === "needs_verification" && user) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-8 text-foreground safe-pt safe-pb">
        <div className="w-full max-w-md rounded-sm border-2 border-foreground bg-card p-6 shadow-ink">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border-2 border-foreground bg-primary/15 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="font-display text-xl tracking-wide text-center">VERIFY YOUR EMAIL</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground text-center">
            We sent a verification link to{" "}
            <span className="font-semibold text-foreground">{user.email}</span>. Click that link first so nobody else can claim your email, then tap continue below.
          </p>

          {authInfo && (
            <div className="mt-3 rounded-sm border border-emerald-600/50 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
              {authInfo}
            </div>
          )}
          {authError && (
            <div
              role="alert"
              className="mt-3 rounded-sm border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {authError}
            </div>
          )}

          <div className="mt-5 space-y-2">
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void checkVerification()}
              className="flex w-full items-center justify-center gap-2 rounded-sm border-2 border-foreground bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-ink disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>I&apos;ve Verified — Enter Studio</span>
            </button>
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void resendVerification()}
              className="w-full rounded-sm border border-border bg-background px-4 py-2 text-xs font-semibold hover:border-foreground disabled:opacity-60"
            >
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={() => void signOutSafely()}
              className="w-full rounded-sm px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Use a Different Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user || phase !== "authenticated") {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-8 text-foreground safe-pt safe-pb">
        <div className="w-full max-w-md rounded-sm border-2 border-foreground bg-card p-6 sm:p-7 shadow-ink">
          <div className="mb-4 text-center">
            <h1 className="font-display text-2xl sm:text-3xl tracking-wide">
              INKED<span className="text-primary">FIGURE</span> STUDIO
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Private 3D Manga Posing &amp; Comic Panel Studio
            </p>
          </div>

          <div className="mb-5 space-y-2 rounded-sm border border-border bg-muted/40 p-3 text-xs">
            <div className="flex items-start gap-2">
              <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Every series, chapter, character &amp; 3D model saves privately to your account.</span>
            </div>
            <div className="flex items-start gap-2">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Pick up seamlessly across PC, tablet, and phone in any orientation.</span>
            </div>
            <div className="flex items-start gap-2">
              <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Offline-safe editing queues changes automatically until you&apos;re back online.</span>
            </div>
          </div>

          {!firebaseConfigured ? (
            <div
              data-testid="firebase-unconfigured-notice"
              className="rounded-sm border-2 border-amber-600/70 bg-amber-50 p-3.5 text-xs text-amber-950"
            >
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
                <span>Account login pending Firebase project config</span>
              </div>
              <p className="mt-1 leading-relaxed text-amber-900/90">
                Link a Firebase project (`VITE_FIREBASE_*`) with Google Sign-In, Email/Password auth, Firestore, and Security Rules to enable private account access.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                data-testid="google-signin-btn"
                disabled={authBusy}
                onClick={() => void signInWithGoogle()}
                className="flex w-full items-center justify-center gap-2.5 rounded-sm border-2 border-foreground bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-ink transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {authBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                <span>{authBusy ? "Connecting…" : "Continue with Google"}</span>
              </button>

              <div className="my-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>or sign in with email &amp; password</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="mb-3 grid grid-cols-2 rounded-sm border border-border bg-muted/40 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode("signin");
                    clearAuthMessages();
                  }}
                  className={`rounded-xs py-1.5 transition-colors ${
                    emailMode === "signin"
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode("signup");
                    clearAuthMessages();
                  }}
                  className={`rounded-xs py-1.5 transition-colors ${
                    emailMode === "signup"
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground"
                  }`}
                >
                  Create Password
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (emailMode === "signin") {
                    void signInWithEmail(emailInput, passwordInput);
                  } else {
                    void registerWithEmail(emailInput, passwordInput);
                  }
                }}
                className="space-y-2.5 text-xs"
              >
                <label className="block">
                  <span className="mb-1 block font-semibold">Email Address</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full rounded-sm border border-input bg-background px-2.5 py-2 text-xs"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block font-semibold">Password</span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={emailMode === "signin" ? "current-password" : "new-password"}
                    placeholder="At least 6 characters"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full rounded-sm border border-input bg-background px-2.5 py-2 text-xs"
                  />
                </label>

                <button
                  type="submit"
                  data-testid="email-auth-submit-btn"
                  disabled={authBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-sm border-2 border-foreground bg-card px-4 py-2 font-bold hover:bg-accent disabled:opacity-60"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>
                    {emailMode === "signin" ? "Sign In with Email" : "Create Account with Email"}
                  </span>
                </button>

                {emailMode === "signin" && (
                  <div className="text-right">
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => void sendPasswordReset(emailInput)}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </form>
            </>
          )}

          {authInfo && (
            <div className="mt-3 rounded-sm border border-emerald-600/50 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
              {authInfo}
            </div>
          )}

          {authError && (
            <div
              role="alert"
              className="mt-3 rounded-sm border border-destructive/60 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {authError}
            </div>
          )}

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Only invited allowlisted email addresses can unlock this studio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}

      {legacyPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label="Import Existing Browser Work"
            data-testid="legacy-import-dialog"
            className="w-full max-w-md rounded-sm border-2 border-foreground bg-card p-5 shadow-ink"
          >
            <div className="flex items-center gap-2 text-primary">
              <HardDrive className="h-5 w-5 shrink-0" />
              <h2 className="font-display text-base">IMPORT EXISTING BROWSER WORK?</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              We found existing studio work saved on this browser (
              <span className="font-semibold text-foreground">
                {legacyPrompt.projectCount} manga series, {legacyPrompt.characterCount} characters,{" "}
                {legacyPrompt.poseCount} custom poses, {legacyPrompt.fileCount} uploaded files/images
              </span>
              ). Would you like to import it into{" "}
              <span className="font-semibold text-foreground">{user.email}</span>?
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Choosing &ldquo;Start Fresh&rdquo; leaves those local files untouched so you can still import them into another account later.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                data-testid="legacy-import-confirm-btn"
                disabled={importingLegacy}
                onClick={async () => {
                  setImportingLegacy(true);
                  try {
                    await confirmImportLegacyData();
                  } finally {
                    setImportingLegacy(false);
                  }
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-sm border-2 border-foreground bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-ink disabled:opacity-60"
              >
                {importingLegacy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Import Into This Account</span>
              </button>
              <button
                type="button"
                data-testid="legacy-import-skip-btn"
                disabled={importingLegacy}
                onClick={skipLegacyData}
                className="flex-1 rounded-sm border-2 border-foreground bg-card px-3 py-2 text-xs font-bold hover:bg-accent disabled:opacity-60"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {syncStatus.conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label="Resolve Cloud Sync Conflict"
            className="w-full max-w-md rounded-sm border-2 border-foreground bg-card p-5 shadow-ink"
          >
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h2 className="font-display text-base">NEW SAVE ON ANOTHER DEVICE</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Your account has a newer cloud save ({syncStatus.conflict.remoteProjectCount} series updated{" "}
              {formatTimestamp(syncStatus.conflict.remoteUpdatedAt)}), while this device also has{" "}
              {syncStatus.conflict.localPendingCount} un-uploaded change(s). Choose which version to keep so nothing is overwritten by accident.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void resolveConflict("cloud")}
                className="flex-1 rounded-sm border-2 border-foreground bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-ink"
              >
                Load Latest from Cloud
              </button>
              <button
                type="button"
                onClick={() => void resolveConflict("local")}
                className="flex-1 rounded-sm border-2 border-foreground bg-card px-3 py-2 text-xs font-bold hover:bg-accent"
              >
                Keep This Device &amp; Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

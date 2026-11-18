import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  CORE_ALLOWED_EMAILS,
  isValidEmailAddress,
  normalizeEmail,
  saveSharedAllowlist,
  verifyUserAllowlistAccess,
} from "@/lib/allowlist";
import {
  declineLegacyBrowserData,
  flushCloudSync,
  getCloudSyncStatus,
  importLegacyBrowserData,
  initializeUserCloudSession,
  registerOnCloudPullApplied,
  resolveCloudConflict,
  subscribeCloudSyncStatus,
  teardownUserCloudSession,
  type CloudSyncStatus,
  type LegacyBrowserSummary,
} from "@/lib/cloud-sync";
import {
  completeGoogleRedirectSignIn,
  createAccountWithEmailPassword,
  friendlyAuthError,
  getFirebaseAuth,
  reloadSignedInUser,
  resendVerificationEmail,
  sendResetPassword,
  signInWithEmailPassword,
  signInWithGoogle as firebaseGoogleSignIn,
  signOutFirebase,
} from "@/lib/firebase";
import { isFirebaseConfigured } from "@/lib/firebase-config";
import { setActiveStorageUser } from "@/lib/user-storage";

export type AuthPhase =
  | "loading"
  | "signed_out"
  | "needs_verification"
  | "access_denied"
  | "syncing_initial"
  | "authenticated";

interface AuthContextValue {
  phase: AuthPhase;
  user: User | null;
  deniedEmail: string | null;
  firebaseConfigured: boolean;
  authError: string | null;
  authInfo: string | null;
  authBusy: boolean;
  hydrationVersion: number;
  syncStatus: CloudSyncStatus;
  allowedEmails: string[];
  legacyPrompt: LegacyBrowserSummary | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  checkVerification: () => Promise<void>;
  clearAuthMessages: () => void;
  dismissAccessDenied: () => void;
  signOutSafely: () => Promise<boolean>;
  syncNow: () => Promise<boolean>;
  resolveConflict: (choice: "cloud" | "local") => Promise<void>;
  confirmImportLegacyData: () => Promise<void>;
  skipLegacyData: () => void;
  addAllowedEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  removeAllowedEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const firebaseConfigured = isFirebaseConfigured();
  const [phase, setPhase] = useState<AuthPhase>(firebaseConfigured ? "loading" : "signed_out");
  const [user, setUser] = useState<User | null>(null);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [hydrationVersion, setHydrationVersion] = useState(0);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() => getCloudSyncStatus());
  const [allowedEmails, setAllowedEmails] = useState<string[]>([...CORE_ALLOWED_EMAILS]);
  const [legacyPrompt, setLegacyPrompt] = useState<LegacyBrowserSummary | null>(null);

  useEffect(() => {
    return subscribeCloudSyncStatus(setSyncStatus);
  }, []);

  useEffect(() => {
    registerOnCloudPullApplied(() => {
      setHydrationVersion((v) => v + 1);
    });
    return () => registerOnCloudPullApplied(null);
  }, []);

  const activateAuthenticatedUser = useCallback(async (verifiedUser: User) => {
    const access = await verifyUserAllowlistAccess(verifiedUser.email);
    setAllowedEmails(access.emails);

    if (!access.allowed) {
      teardownUserCloudSession();
      setActiveStorageUser(null);
      setLegacyPrompt(null);
      setDeniedEmail(verifiedUser.email ?? "this email address");
      setUser(null);
      await signOutFirebase().catch(() => {});
      setPhase("access_denied");
      return;
    }

    setDeniedEmail(null);
    setAuthError(null);
    setUser(verifiedUser);
    setActiveStorageUser(verifiedUser.uid);
    setPhase("syncing_initial");

    const { legacyPrompt: summary } = await initializeUserCloudSession(verifiedUser);
    setLegacyPrompt(summary);
    setHydrationVersion((v) => v + 1);
    setPhase("authenticated");
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      setActiveStorageUser(null);
      setPhase("signed_out");
      return;
    }

    let cancelled = false;
    const auth = getFirebaseAuth();

    void completeGoogleRedirectSignIn().catch((err) => {
      if (!cancelled) {
        setAuthError(friendlyAuthError(err));
      }
    });

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (cancelled) return;
      if (!nextUser) {
        teardownUserCloudSession();
        setActiveStorageUser(null);
        setLegacyPrompt(null);
        setUser(null);
        setPhase((cur) => (cur === "access_denied" ? "access_denied" : "signed_out"));
        return;
      }

      if (!nextUser.emailVerified) {
        teardownUserCloudSession();
        setActiveStorageUser(null);
        setLegacyPrompt(null);
        setUser(nextUser);
        setPhase("needs_verification");
        return;
      }

      await activateAuthenticatedUser(nextUser);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [firebaseConfigured, activateAuthenticatedUser]);

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseConfigured) {
      setAuthError("Firebase authentication is not configured for this build yet.");
      return;
    }
    setDeniedEmail(null);
    setAuthError(null);
    setAuthInfo(null);
    setAuthBusy(true);
    try {
      await firebaseGoogleSignIn();
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  }, [firebaseConfigured]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!firebaseConfigured) {
        setAuthError("Firebase authentication is not configured yet.");
        return;
      }
      setDeniedEmail(null);
      setAuthError(null);
      setAuthInfo(null);
      setAuthBusy(true);
      try {
        await signInWithEmailPassword(email, password);
      } catch (err) {
        setAuthError(friendlyAuthError(err));
      } finally {
        setAuthBusy(false);
      }
    },
    [firebaseConfigured],
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!firebaseConfigured) {
        setAuthError("Firebase authentication is not configured yet.");
        return;
      }
      setDeniedEmail(null);
      setAuthError(null);
      setAuthInfo(null);
      setAuthBusy(true);
      try {
        await createAccountWithEmailPassword(email, password);
        setAuthInfo("Account created! Check your email inbox for the verification link to continue.");
      } catch (err) {
        setAuthError(friendlyAuthError(err));
      } finally {
        setAuthBusy(false);
      }
    },
    [firebaseConfigured],
  );

  const sendPasswordReset = useCallback(
    async (email: string) => {
      if (!firebaseConfigured) return;
      if (!isValidEmailAddress(email)) {
        setAuthError("Enter your email address first so we know where to send the reset link.");
        return;
      }
      setAuthError(null);
      setAuthInfo(null);
      setAuthBusy(true);
      try {
        await sendResetPassword(email);
        setAuthInfo(`Password reset email sent to ${normalizeEmail(email)} (if an account exists).`);
      } catch (err) {
        setAuthError(friendlyAuthError(err));
      } finally {
        setAuthBusy(false);
      }
    },
    [firebaseConfigured],
  );

  const resendVerification = useCallback(async () => {
    if (!user) return;
    setAuthError(null);
    setAuthInfo(null);
    setAuthBusy(true);
    try {
      await resendVerificationEmail(user);
      setAuthInfo(`Verification email re-sent to ${user.email}.`);
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  }, [user]);

  const checkVerification = useCallback(async () => {
    if (!user) return;
    setAuthError(null);
    setAuthBusy(true);
    try {
      const refreshed = await reloadSignedInUser(user);
      if (refreshed?.emailVerified) {
        await activateAuthenticatedUser(refreshed);
      } else {
        setAuthError("Email is not verified yet — click the link in your inbox (or check Spam/Junk), then try again.");
      }
    } catch (err) {
      setAuthError(friendlyAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  }, [user, activateAuthenticatedUser]);

  const clearAuthMessages = useCallback(() => {
    setAuthError(null);
    setAuthInfo(null);
  }, []);

  const dismissAccessDenied = useCallback(() => {
    setDeniedEmail(null);
    setPhase("signed_out");
  }, []);

  const syncNow = useCallback(async () => {
    if (!user) return false;
    return flushCloudSync(user.uid);
  }, [user]);

  const signOutSafely = useCallback(async () => {
    if (!user) {
      await signOutFirebase().catch(() => {});
      setPhase("signed_out");
      return true;
    }
    const latest = getCloudSyncStatus();
    if (latest.pendingCount > 0 && phase === "authenticated") {
      const ok = await flushCloudSync(user.uid);
      if (!ok) {
        const proceed =
          typeof window === "undefined"
            ? false
            : window.confirm(
                "Some recent edits haven't uploaded to cloud yet (they remain saved locally on this device). Sign out anyway?",
              );
        if (!proceed) return false;
      }
    }
    teardownUserCloudSession();
    setActiveStorageUser(null);
    setLegacyPrompt(null);
    setDeniedEmail(null);
    await signOutFirebase();
    return true;
  }, [user, phase]);

  const handleResolveConflict = useCallback(async (choice: "cloud" | "local") => {
    await resolveCloudConflict(choice);
  }, []);

  const confirmImportLegacyData = useCallback(async () => {
    if (!user) return;
    setLegacyPrompt(null);
    await importLegacyBrowserData(user.uid);
    setHydrationVersion((v) => v + 1);
  }, [user]);

  const skipLegacyData = useCallback(() => {
    if (!user) return;
    declineLegacyBrowserData(user.uid);
    setLegacyPrompt(null);
  }, [user]);

  const addAllowedEmail = useCallback(
    async (rawEmail: string) => {
      const clean = normalizeEmail(rawEmail);
      if (!isValidEmailAddress(clean)) {
        return { ok: false, error: "Enter a valid email address." };
      }
      if (allowedEmails.includes(clean)) {
        return { ok: false, error: "That email is already on the allowlist." };
      }
      try {
        const updated = await saveSharedAllowlist([...allowedEmails, clean], user?.email ?? null);
        setAllowedEmails(updated);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Could not update allowlist.",
        };
      }
    },
    [allowedEmails, user?.email],
  );

  const removeAllowedEmail = useCallback(
    async (rawEmail: string) => {
      const clean = normalizeEmail(rawEmail);
      if ((CORE_ALLOWED_EMAILS as readonly string[]).includes(clean)) {
        return { ok: false, error: "Core owner emails cannot be removed." };
      }
      try {
        const updated = await saveSharedAllowlist(
          allowedEmails.filter((e) => e !== clean),
          user?.email ?? null,
        );
        setAllowedEmails(updated);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Could not update allowlist.",
        };
      }
    },
    [allowedEmails, user?.email],
  );

  return (
    <AuthContext.Provider
      value={{
        phase,
        user,
        deniedEmail,
        firebaseConfigured,
        authError,
        authInfo,
        authBusy,
        hydrationVersion,
        syncStatus,
        allowedEmails,
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
        syncNow,
        resolveConflict: handleResolveConflict,
        confirmImportLegacyData,
        skipLegacyData,
        addAllowedEmail,
        removeAllowedEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}

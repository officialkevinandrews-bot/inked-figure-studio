import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { FIREBASE_CONFIG, isFirebaseConfigured } from "./firebase-config";

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedStorage: FirebaseStorage | null = null;
let emulatorsConnected = false;

function ensureServices(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage | null;
} {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase project configuration is missing. Link a Firebase project first.");
  }

  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG);
  }

  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
    if (typeof window !== "undefined") {
      void setPersistence(cachedAuth, browserLocalPersistence).catch(() => {});
    }
  }

  if (!cachedDb) {
    try {
      // App already maintains account-scoped IndexedDB/localStorage offline storage;
      // avoiding Firestore multi-tab IndexedDB locks prevents Chrome tab-lock hangs on startup.
      cachedDb = initializeFirestore(cachedApp, {
        localCache: memoryLocalCache(),
        experimentalAutoDetectLongPolling: true,
      });
    } catch {
      cachedDb = getFirestore(cachedApp);
    }
  }

  const storageEnabled =
    typeof window !== "undefined" && import.meta.env.VITE_FIREBASE_ENABLE_STORAGE === "true";
  if (!cachedStorage && storageEnabled && FIREBASE_CONFIG.storageBucket) {
    try {
      cachedStorage = getStorage(cachedApp);
    } catch {
      cachedStorage = null;
    }
  }

  const useEmulator =
    typeof window !== "undefined" && import.meta.env.VITE_FIREBASE_USE_EMULATOR === "true";
  if (useEmulator && !emulatorsConnected && cachedAuth && cachedDb) {
    emulatorsConnected = true;
    try {
      connectAuthEmulator(cachedAuth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(cachedDb, "127.0.0.1", 8080);
      if (cachedStorage) connectStorageEmulator(cachedStorage, "127.0.0.1", 9199);
    } catch {
      /* ignore if already connected during HMR */
    }
  }

  return {
    app: cachedApp,
    auth: cachedAuth,
    db: cachedDb,
    storage: cachedStorage,
  };
}

export function getFirebaseAuth(): Auth {
  return ensureServices().auth;
}

export function getFirebaseDb(): Firestore {
  return ensureServices().db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  return ensureServices().storage;
}

function buildGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/**
 * Signs in using Google OAuth popup, automatically falling back to redirect
 * on mobile browsers or environments that block popups.
 */
export async function signInWithGoogle(): Promise<User | null> {
  const auth = getFirebaseAuth();
  const provider = buildGoogleProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment" ||
      code === "auth/cancelled-popup-request"
    ) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const res = await signInWithEmailAndPassword(auth, email.trim(), password);
  return res.user;
}

export async function createAccountWithEmailPassword(
  email: string,
  password: string,
): Promise<User> {
  const auth = getFirebaseAuth();
  const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (!res.user.emailVerified) {
    await sendEmailVerification(res.user).catch(() => {});
  }
  return res.user;
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function reloadSignedInUser(user: User): Promise<User | null> {
  await reload(user);
  return getFirebaseAuth().currentUser;
}

export async function sendResetPassword(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  await sendPasswordResetEmail(auth, email.trim());
}

export async function completeGoogleRedirectSignIn(): Promise<User | null> {
  if (!isFirebaseConfigured()) return null;
  const auth = getFirebaseAuth();
  const result = await getRedirectResult(auth).catch(() => null);
  return result?.user ?? null;
}

export async function signOutFirebase(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const auth = getFirebaseAuth();
  await signOut(auth);
}

export function friendlyAuthError(err: unknown): string {
  const code = String((err as { code?: string })?.code ?? "");
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password did not match an existing account.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Switch to Sign In instead.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 6 characters).";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts right now — please wait a moment and try again.";
    case "auth/popup-closed-by-user":
      return "Sign-in window was closed before finishing.";
    case "auth/unauthorized-domain":
      return "This website domain is not authorized in Firebase Auth settings yet.";
    default:
      return err instanceof Error ? err.message : "Authentication failed.";
  }
}

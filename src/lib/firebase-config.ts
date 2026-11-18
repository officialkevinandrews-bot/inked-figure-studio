export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const DEFAULT_FIREBASE_CONFIG: FirebaseWebConfig = {
  apiKey: "AIzaSyByG7qzLYOLAobEqWHMhYPQQvuDQyLqqtk",
  authDomain: "inked-figure-studio-app.firebaseapp.com",
  projectId: "inked-figure-studio-app",
  storageBucket: "inked-figure-studio-app.firebasestorage.app",
  messagingSenderId: "899470972007",
  appId: "1:899470972007:web:90177d018b8717d033f0c2",
};

function envOrDefault(val: unknown, fallback: string): string {
  const s = String(val ?? "").trim();
  return s.length > 0 ? s : fallback;
}

/**
 * Public Firebase Web App config.
 * Uses VITE_FIREBASE_* overrides when present, falling back to the linked Inked Figure Studio project.
 */
export const FIREBASE_CONFIG: FirebaseWebConfig = {
  apiKey: envOrDefault(import.meta.env.VITE_FIREBASE_API_KEY, DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: envOrDefault(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    DEFAULT_FIREBASE_CONFIG.authDomain,
  ),
  projectId: envOrDefault(
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    DEFAULT_FIREBASE_CONFIG.projectId,
  ),
  storageBucket: envOrDefault(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    DEFAULT_FIREBASE_CONFIG.storageBucket,
  ),
  messagingSenderId: envOrDefault(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  ),
  appId: envOrDefault(import.meta.env.VITE_FIREBASE_APP_ID, DEFAULT_FIREBASE_CONFIG.appId),
};

export function isFirebaseConfigured(cfg: FirebaseWebConfig = FIREBASE_CONFIG): boolean {
  return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
}

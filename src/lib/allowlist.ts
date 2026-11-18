import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { isFirebaseConfigured } from "./firebase-config";

export const CORE_ALLOWED_EMAILS = [
  "officialkevinandrews@gmail.com",
  "careerdrivenkevin@gmail.com",
  "craigrees@hotmail.com",
] as const;

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function normalizeEmail(email?: string | null): string {
  return String(email ?? "").trim().toLowerCase();
}

export function isValidEmailAddress(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && normalized.length <= 320 && EMAIL_RE.test(normalized);
}

export function isCoreAllowedEmail(email?: string | null): boolean {
  const norm = normalizeEmail(email);
  return (CORE_ALLOWED_EMAILS as readonly string[]).includes(norm);
}

/** Ensures the 3 core owner emails are always retained, normalized, unique, and capped at 50 entries. */
export function normalizeAllowlistEmails(emails: string[]): string[] {
  const set = new Set<string>(CORE_ALLOWED_EMAILS);
  for (const raw of emails) {
    const clean = normalizeEmail(raw);
    if (isValidEmailAddress(clean)) {
      set.add(clean);
    }
  }
  return [...set].slice(0, 50);
}

/** Verifies whether the signed-in user's verified email is allowed to access the studio. */
export async function verifyUserAllowlistAccess(email?: string | null): Promise<{
  allowed: boolean;
  emails: string[];
}> {
  const norm = normalizeEmail(email);
  if (!norm) return { allowed: false, emails: [...CORE_ALLOWED_EMAILS] };
  if (isCoreAllowedEmail(norm)) {
    // Core owner emails are always authorized immediately without blocking on a network read.
    return { allowed: true, emails: [...CORE_ALLOWED_EMAILS] };
  }
  if (!isFirebaseConfigured()) {
    return { allowed: false, emails: [...CORE_ALLOWED_EMAILS] };
  }
  try {
    const db = getFirebaseDb();
    const snap = await Promise.race([
      getDoc(doc(db, "config", "allowlist")),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Allowlist lookup timeout")), 5000)),
    ]);
    if (!snap || !snap.exists()) return { allowed: false, emails: [...CORE_ALLOWED_EMAILS] };
    const list = normalizeAllowlistEmails(
      Array.isArray(snap.data()?.emails) ? (snap.data()?.emails as string[]) : [],
    );
    return { allowed: list.includes(norm), emails: list };
  } catch {
    return { allowed: false, emails: [...CORE_ALLOWED_EMAILS] };
  }
}

export async function loadSharedAllowlist(): Promise<string[]> {
  if (!isFirebaseConfigured()) return [...CORE_ALLOWED_EMAILS];
  const db = getFirebaseDb();
  const ref = doc(db, "config", "allowlist");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return [...CORE_ALLOWED_EMAILS];
  }
  const raw = Array.isArray(snap.data()?.emails) ? (snap.data()?.emails as string[]) : [];
  return normalizeAllowlistEmails(raw);
}

export async function saveSharedAllowlist(
  emails: string[],
  updatedBy: string | null,
): Promise<string[]> {
  const normalized = normalizeAllowlistEmails(emails);
  if (!isFirebaseConfigured()) return normalized;
  const db = getFirebaseDb();
  await setDoc(doc(db, "config", "allowlist"), {
    emails: normalized,
    updatedAt: Date.now(),
    updatedBy: updatedBy ? normalizeEmail(updatedBy).slice(0, 320) : null,
  });
  return normalized;
}

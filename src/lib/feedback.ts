import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { isCoreAllowedEmail, normalizeEmail } from "./allowlist";
import { getFirebaseDb } from "./firebase";
import { isFirebaseConfigured } from "./firebase-config";

export const FEEDBACK_COLLECTION = "feedback";
export const MAX_SCREENSHOT_DATA_URL_LENGTH = 650_000;
const TARGET_SCREENSHOT_DATA_URL_LENGTH = 580_000;
const FEEDBACK_SEEN_STORAGE_PREFIX = "inked_feedback_seen_v1:";

export type FeedbackType = "bug" | "feature" | "feedback";
export type FeedbackStatus = "open" | "in-progress" | "done";
export type FeedbackPriority = "low" | "medium" | "high";

export const FEEDBACK_AREAS = [
  "Manga Panels",
  "Create Character",
  "3D Pose Studio",
  "Grid Importer",
  "Account & Sync",
  "Mobile / Tablet",
  "Other",
] as const;

export interface FeedbackAuthor {
  uid: string;
  email: string | null | undefined;
  displayName?: string | null | undefined;
}

export interface FeedbackReply {
  id: string;
  text: string;
  authorUid: string;
  authorEmail: string;
  authorName: string | null;
  createdAt: number;
}

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  area: string;
  title: string;
  description: string;
  authorUid: string;
  authorEmail: string;
  authorName: string | null;
  deviceInfo: string | null;
  screenshotDataUrl: string | null;
  replies: FeedbackReply[];
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackDraft {
  type: FeedbackType;
  priority: FeedbackPriority;
  area: string;
  title: string;
  description: string;
  deviceInfo?: string | null;
  screenshotDataUrl?: string | null;
}

export interface FeedbackSummaryCounts {
  totalCount: number;
  openCount: number;
  inProgressCount: number;
  doneCount: number;
  unreadCount: number;
}

export function makeFeedbackId(prefix = "fb"): string {
  const rand =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${rand}`.slice(0, 128);
}

function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function formatDeviceContext(opts: {
  area: string;
  width?: number;
  height?: number;
  tier?: string;
  isTouch?: boolean;
}): string {
  const parts = [clampString(opts.area || "Manga Panels", 40)];
  if (typeof opts.width === "number" && typeof opts.height === "number" && opts.width > 0 && opts.height > 0) {
    parts.push(`${Math.round(opts.width)}x${Math.round(opts.height)}`);
  }
  if (opts.tier) parts.push(opts.tier);
  if (typeof opts.isTouch === "boolean") parts.push(opts.isTouch ? "touch" : "mouse");
  return parts.join(" · ").slice(0, 256);
}

export function isValidScreenshotDataUrl(url: string | null | undefined): boolean {
  if (url == null) return true;
  if (typeof url !== "string" || url.length > MAX_SCREENSHOT_DATA_URL_LENGTH) return false;
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(url);
}

export function buildFeedbackItem(
  draft: FeedbackDraft,
  author: FeedbackAuthor,
  now = Date.now(),
): FeedbackItem {
  const uid = clampString(author.uid, 128);
  if (!uid) {
    throw new Error("You must be signed in to post feedback.");
  }
  const title = clampString(draft.title, 160);
  if (!title) {
    throw new Error("Please enter a short title.");
  }
  const area = clampString(draft.area || "Manga Panels", 64) || "Manga Panels";
  const description = clampString(draft.description ?? "", 4000);
  const authorEmail = clampString(normalizeEmail(author.email), 320);
  const authorNameRaw = author.displayName ? clampString(author.displayName, 120) : "";
  const deviceInfoRaw = draft.deviceInfo ? clampString(draft.deviceInfo, 256) : "";
  const screenshot = draft.screenshotDataUrl ?? null;

  if (!isValidScreenshotDataUrl(screenshot)) {
    throw new Error("Screenshot is too large or not a PNG/JPEG/WebP image (max ~480 KB compressed).");
  }

  return {
    id: makeFeedbackId(draft.type === "bug" ? "bug" : draft.type === "feature" ? "feat" : "fb"),
    type: draft.type,
    status: "open",
    priority: draft.priority,
    area,
    title,
    description,
    authorUid: uid,
    authorEmail,
    authorName: authorNameRaw || null,
    deviceInfo: deviceInfoRaw || null,
    screenshotDataUrl: screenshot,
    replies: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function buildUpdatedFeedbackStatus(
  item: FeedbackItem,
  status: FeedbackStatus,
  now = Date.now(),
): FeedbackItem {
  return {
    ...item,
    status,
    updatedAt: Math.max(now, item.updatedAt),
  };
}

export function buildUpdatedFeedbackWithReply(
  item: FeedbackItem,
  text: string,
  author: FeedbackAuthor,
  now = Date.now(),
): FeedbackItem {
  const cleanText = clampString(text, 1500);
  if (!cleanText) {
    throw new Error("Reply cannot be empty.");
  }
  if (item.replies.length >= 100) {
    throw new Error("This thread has reached the 100-reply limit.");
  }
  const uid = clampString(author.uid, 128);
  if (!uid) {
    throw new Error("You must be signed in to reply.");
  }
  const authorNameRaw = author.displayName ? clampString(author.displayName, 120) : "";
  const reply: FeedbackReply = {
    id: makeFeedbackId("rep"),
    text: cleanText,
    authorUid: uid,
    authorEmail: clampString(normalizeEmail(author.email), 320),
    authorName: authorNameRaw || null,
    createdAt: now,
  };
  return {
    ...item,
    replies: [...item.replies, reply],
    updatedAt: Math.max(now, item.updatedAt),
  };
}

export function canDeleteFeedbackItem(
  item: Pick<FeedbackItem, "authorUid">,
  userEmail?: string | null,
  userUid?: string | null,
): boolean {
  if (userUid && item.authorUid === userUid) return true;
  return isCoreAllowedEmail(userEmail);
}

export function normalizeFeedbackItem(raw: unknown): FeedbackItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  if (r.type !== "bug" && r.type !== "feature" && r.type !== "feedback") return null;
  if (r.status !== "open" && r.status !== "in-progress" && r.status !== "done") return null;
  if (r.priority !== "low" && r.priority !== "medium" && r.priority !== "high") return null;
  if (typeof r.title !== "string" || typeof r.area !== "string") return null;
  if (typeof r.authorUid !== "string" || typeof r.authorEmail !== "string") return null;
  if (typeof r.createdAt !== "number" || typeof r.updatedAt !== "number") return null;

  const replies: FeedbackReply[] = Array.isArray(r.replies)
    ? r.replies
        .filter((rep): rep is FeedbackReply => {
          if (!rep || typeof rep !== "object") return false;
          const x = rep as Record<string, unknown>;
          return (
            typeof x.id === "string" &&
            typeof x.text === "string" &&
            typeof x.authorUid === "string" &&
            typeof x.authorEmail === "string" &&
            typeof x.createdAt === "number"
          );
        })
        .map((rep) => ({
          id: rep.id,
          text: rep.text,
          authorUid: rep.authorUid,
          authorEmail: rep.authorEmail,
          authorName: typeof rep.authorName === "string" ? rep.authorName : null,
          createdAt: rep.createdAt,
        }))
    : [];

  return {
    id: r.id,
    type: r.type,
    status: r.status,
    priority: r.priority,
    area: r.area,
    title: r.title,
    description: typeof r.description === "string" ? r.description : "",
    authorUid: r.authorUid,
    authorEmail: r.authorEmail,
    authorName: typeof r.authorName === "string" ? r.authorName : null,
    deviceInfo: typeof r.deviceInfo === "string" ? r.deviceInfo : null,
    screenshotDataUrl:
      typeof r.screenshotDataUrl === "string" && isValidScreenshotDataUrl(r.screenshotDataUrl)
        ? r.screenshotDataUrl
        : null,
    replies,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function countFeedbackSummary(
  items: FeedbackItem[],
  lastSeenAt: number,
  currentUserEmail?: string | null,
): FeedbackSummaryCounts {
  const viewerEmail = normalizeEmail(currentUserEmail);
  let openCount = 0;
  let inProgressCount = 0;
  let doneCount = 0;
  let unreadCount = 0;

  for (const item of items) {
    if (item.status === "open") openCount += 1;
    else if (item.status === "in-progress") inProgressCount += 1;
    else doneCount += 1;

    const latestReply = item.replies[item.replies.length - 1];
    const latestActorEmail = normalizeEmail(latestReply ? latestReply.authorEmail : item.authorEmail);
    const authoredByOther = !viewerEmail || latestActorEmail !== viewerEmail;

    if (item.updatedAt > lastSeenAt && authoredByOther) {
      unreadCount += 1;
    }
  }

  return {
    totalCount: items.length,
    openCount,
    inProgressCount,
    doneCount,
    unreadCount,
  };
}

export function getFeedbackLastSeen(uid?: string | null): number {
  if (typeof window === "undefined" || !uid) return 0;
  try {
    const raw = window.localStorage.getItem(`${FEEDBACK_SEEN_STORAGE_PREFIX}${uid}`);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function markFeedbackSeenNow(uid?: string | null, ts = Date.now()): number {
  if (typeof window === "undefined" || !uid) return ts;
  try {
    window.localStorage.setItem(`${FEEDBACK_SEEN_STORAGE_PREFIX}${uid}`, String(ts));
  } catch {
    // Ignore storage quota errors cleanly.
  }
  return ts;
}

function toFirestorePayload(item: FeedbackItem): FeedbackItem {
  return {
    id: item.id,
    type: item.type,
    status: item.status,
    priority: item.priority,
    area: item.area,
    title: item.title,
    description: item.description,
    authorUid: item.authorUid,
    authorEmail: item.authorEmail,
    authorName: item.authorName ?? null,
    deviceInfo: item.deviceInfo ?? null,
    screenshotDataUrl: item.screenshotDataUrl ?? null,
    replies: item.replies.map((rep) => ({
      id: rep.id,
      text: rep.text,
      authorUid: rep.authorUid,
      authorEmail: rep.authorEmail,
      authorName: rep.authorName ?? null,
      createdAt: rep.createdAt,
    })),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function subscribeFeedbackItems(
  onData: (items: FeedbackItem[]) => void,
  onError?: (err: Error) => void,
): () => void {
  if (!isFirebaseConfigured()) {
    onData([]);
    return () => {};
  }
  const db = getFirebaseDb();
  const q = query(collection(db, FEEDBACK_COLLECTION), orderBy("updatedAt", "desc"), limit(150));
  return onSnapshot(
    q,
    (snap) => {
      const items: FeedbackItem[] = [];
      snap.forEach((docSnap) => {
        const normalized = normalizeFeedbackItem(docSnap.data());
        if (normalized) items.push(normalized);
      });
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      onData(items);
    },
    (err) => {
      onError?.(err instanceof Error ? err : new Error("Failed to load feedback board."));
    },
  );
}

export async function createFeedbackItem(item: FeedbackItem): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured in this build.");
  }
  const db = getFirebaseDb();
  await setDoc(doc(db, FEEDBACK_COLLECTION, item.id), toFirestorePayload(item));
}

export async function updateFeedbackItem(item: FeedbackItem): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured in this build.");
  }
  const db = getFirebaseDb();
  await setDoc(doc(db, FEEDBACK_COLLECTION, item.id), toFirestorePayload(item));
}

export async function deleteFeedbackItem(itemId: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured in this build.");
  }
  const db = getFirebaseDb();
  await deleteDoc(doc(db, FEEDBACK_COLLECTION, itemId));
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image for compression."));
    img.src = src;
  });
}

/** Scales and JPEG-compresses any image blob or data URL to fit cleanly under Firestore's 650 KB field cap. */
export async function compressImageToFeedbackDataUrl(input: Blob | string): Promise<string> {
  if (typeof document === "undefined") {
    throw new Error("Image compression requires a browser environment.");
  }

  let objectUrl: string | null = null;
  try {
    const src =
      typeof input === "string"
        ? input
        : ((objectUrl = URL.createObjectURL(input)), objectUrl);
    const img = await loadImageElement(src);
    const srcW = Math.max(1, img.naturalWidth || img.width);
    const srcH = Math.max(1, img.naturalHeight || img.height);

    const maxEdges = [1280, 960, 720, 520];
    const qualities = [0.82, 0.68, 0.52, 0.36];

    for (const maxEdge of maxEdges) {
      const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D canvas unavailable.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length <= TARGET_SCREENSHOT_DATA_URL_LENGTH && isValidScreenshotDataUrl(dataUrl)) {
          return dataUrl;
        }
      }
    }

    throw new Error("Screenshot is still too large after compression. Try cropping or attaching a smaller image.");
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MessageSquarePlus } from "lucide-react";
import { useOptionalAuth } from "@/components/auth/AuthProvider";
import {
  buildFeedbackItem,
  buildUpdatedFeedbackStatus,
  buildUpdatedFeedbackWithReply,
  compressImageToFeedbackDataUrl,
  countFeedbackSummary,
  createFeedbackItem,
  deleteFeedbackItem,
  formatDeviceContext,
  getFeedbackLastSeen,
  markFeedbackSeenNow,
  subscribeFeedbackItems,
  updateFeedbackItem,
  type FeedbackDraft,
  type FeedbackItem,
  type FeedbackStatus,
  type FeedbackSummaryCounts,
} from "@/lib/feedback";
import { useDeviceLayout } from "@/lib/use-device-layout";

export type FeedbackCaptureHandler = () => Promise<string | null>;

interface FeedbackContextValue {
  items: FeedbackItem[];
  loading: boolean;
  error: string | null;
  isOpen: boolean;
  activeArea: string;
  summary: FeedbackSummaryCounts;
  lastSeenAt: number;
  openFeedback: (preferredArea?: string) => void;
  closeFeedback: () => void;
  setActiveArea: (area: string) => void;
  registerCaptureHandler: (handler: FeedbackCaptureHandler | null) => void;
  captureCurrentView: () => Promise<string | null>;
  submitFeedback: (draft: FeedbackDraft) => Promise<FeedbackItem>;
  changeStatus: (item: FeedbackItem, status: FeedbackStatus) => Promise<void>;
  postReply: (item: FeedbackItem, text: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  buildDefaultDeviceInfo: (area: string) => string;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const auth = useOptionalAuth();
  const device = useDeviceLayout();
  const user = auth?.user ?? null;
  const phase = auth?.phase ?? "signed_out";

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeArea, setActiveArea] = useState<string>("Manga Panels");
  const [lastSeenAt, setLastSeenAt] = useState<number>(0);

  const captureHandlerRef = useRef<FeedbackCaptureHandler | null>(null);

  useEffect(() => {
    if (!user || phase !== "authenticated") {
      setItems([]);
      setLoading(false);
      setError(null);
      setIsOpen(false);
      return;
    }

    setLastSeenAt(getFeedbackLastSeen(user.uid));
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeFeedbackItems(
      (nextItems) => {
        setItems(nextItems);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        setError(err.message);
      },
    );
    return unsubscribe;
  }, [user, phase]);

  const markSeen = useCallback(() => {
    if (!user?.uid) return;
    const now = markFeedbackSeenNow(user.uid, Date.now());
    setLastSeenAt(now);
  }, [user?.uid]);

  const openFeedback = useCallback(
    (preferredArea?: string) => {
      if (preferredArea) setActiveArea(preferredArea);
      setIsOpen(true);
      markSeen();
    },
    [markSeen],
  );

  const closeFeedback = useCallback(() => {
    setIsOpen(false);
    markSeen();
  }, [markSeen]);

  const registerCaptureHandler = useCallback((handler: FeedbackCaptureHandler | null) => {
    captureHandlerRef.current = handler;
  }, []);

  const captureCurrentView = useCallback(async (): Promise<string | null> => {
    if (!captureHandlerRef.current) return null;
    const raw = await captureHandlerRef.current();
    if (!raw) return null;
    return compressImageToFeedbackDataUrl(raw);
  }, []);

  const buildDefaultDeviceInfo = useCallback(
    (area: string) =>
      formatDeviceContext({
        area,
        width: device.width,
        height: device.height,
        tier: device.tier,
        isTouch: device.isTouch,
      }),
    [device.height, device.isTouch, device.tier, device.width],
  );

  const submitFeedback = useCallback(
    async (draft: FeedbackDraft) => {
      if (!user) throw new Error("Sign in to post feedback.");
      const item = buildFeedbackItem(draft, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
      await createFeedbackItem(item);
      markSeen();
      return item;
    },
    [markSeen, user],
  );

  const changeStatus = useCallback(async (item: FeedbackItem, status: FeedbackStatus) => {
    const updated = buildUpdatedFeedbackStatus(item, status);
    await updateFeedbackItem(updated);
  }, []);

  const postReply = useCallback(
    async (item: FeedbackItem, text: string) => {
      if (!user) throw new Error("Sign in to reply.");
      const updated = buildUpdatedFeedbackWithReply(item, text, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
      await updateFeedbackItem(updated);
      markSeen();
    },
    [markSeen, user],
  );

  const removeItem = useCallback(async (itemId: string) => {
    await deleteFeedbackItem(itemId);
  }, []);

  const summary = useMemo(
    () => countFeedbackSummary(items, lastSeenAt, user?.email),
    [items, lastSeenAt, user?.email],
  );

  const value = useMemo<FeedbackContextValue>(
    () => ({
      items,
      loading,
      error,
      isOpen,
      activeArea,
      summary,
      lastSeenAt,
      openFeedback,
      closeFeedback,
      setActiveArea,
      registerCaptureHandler,
      captureCurrentView,
      submitFeedback,
      changeStatus,
      postReply,
      removeItem,
      buildDefaultDeviceInfo,
    }),
    [
      items,
      loading,
      error,
      isOpen,
      activeArea,
      summary,
      lastSeenAt,
      openFeedback,
      closeFeedback,
      registerCaptureHandler,
      captureCurrentView,
      submitFeedback,
      changeStatus,
      postReply,
      removeItem,
      buildDefaultDeviceInfo,
    ],
  );

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useOptionalFeedback(): FeedbackContextValue | null {
  return useContext(FeedbackContext);
}

interface FeedbackButtonProps {
  compact?: boolean;
  area?: string;
}

export function FeedbackButton({ compact = false, area }: FeedbackButtonProps) {
  const feedback = useOptionalFeedback();
  const auth = useOptionalAuth();
  if (!feedback || !auth?.user) return null;

  const { summary, openFeedback } = feedback;
  const badgeCount = summary.unreadCount > 0 ? summary.unreadCount : summary.openCount;
  const hasUnread = summary.unreadCount > 0;

  return (
    <button
      type="button"
      data-testid="feedback-board-btn"
      onClick={() => openFeedback(area)}
      title={`Team Feedback & Bug Board (${summary.openCount} open, ${summary.unreadCount} new)`}
      aria-label={`Feedback and bugs (${summary.openCount} open, ${summary.unreadCount} unread)`}
      className={`relative flex items-center gap-1 rounded-sm border-2 border-foreground bg-accent font-semibold text-foreground shadow-ink transition-transform hover:-translate-y-0.5 shrink-0 ${
        compact ? "px-1.5 sm:px-2.5 py-1 text-xs" : "px-2 sm:px-2.5 py-1 text-xs"
      }`}
    >
      <MessageSquarePlus className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="hidden md:inline">Feedback</span>
      {badgeCount > 0 && (
        <span
          data-testid="feedback-badge-count"
          className={`inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px] text-[10px] font-bold leading-none ${
            hasUnread
              ? "bg-primary text-primary-foreground"
              : "bg-foreground text-background"
          }`}
        >
          {badgeCount}
        </span>
      )}
    </button>
  );
}

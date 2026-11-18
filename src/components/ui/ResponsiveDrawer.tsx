import React from "react";
import { X } from "lucide-react";

export type DrawerDisplayMode =
  | "pinned-left"
  | "pinned-right"
  | "drawer-left"
  | "drawer-right"
  | "sheet-bottom";

interface ResponsiveDrawerProps {
  mode: DrawerDisplayMode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pinnedClassName?: string;
  testId?: string;
  children: React.ReactNode;
}

/**
 * Renders toolbars/inspectors either as a pinned desktop column, a slide-over side drawer
 * (tablet / landscape phone), or a bottom sheet (portrait phone).
 */
export function ResponsiveDrawer({
  mode,
  isOpen,
  onClose,
  title,
  pinnedClassName = "w-76",
  testId,
  children,
}: ResponsiveDrawerProps) {
  if (mode === "pinned-left" || mode === "pinned-right") {
    if (!isOpen) return null;
    const borderCls =
      mode === "pinned-left" ? "border-r-2 border-foreground" : "border-l-2 border-foreground";
    return (
      <aside
        data-testid={testId}
        className={`flex ${pinnedClassName} flex-col ${borderCls} bg-card overflow-hidden shrink-0`}
      >
        {children}
      </aside>
    );
  }

  if (!isOpen) return null;

  const isSheet = mode === "sheet-bottom";
  const panelCls = isSheet
    ? "fixed inset-x-0 bottom-0 z-40 flex h-[56dvh] max-h-[82dvh] flex-col rounded-t-lg border-t-2 border-foreground bg-card shadow-2xl safe-pb"
    : mode === "drawer-left"
    ? "fixed inset-y-0 left-0 z-40 flex w-[86vw] max-w-[330px] flex-col border-r-2 border-foreground bg-card shadow-2xl safe-pb"
    : "fixed inset-y-0 right-0 z-40 flex w-[86vw] max-w-[330px] flex-col border-l-2 border-foreground bg-card shadow-2xl safe-pb";

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label={title}
        data-testid={testId}
        className={panelCls}
      >
        <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-2 shrink-0">
          {isSheet && (
            <span className="h-1 w-8 rounded-full bg-foreground/25 mr-2" aria-hidden="true" />
          )}
          <span className="font-display text-xs tracking-wide truncate">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="ml-auto rounded border border-border bg-background p-1 hover:border-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">{children}</div>
      </aside>
    </>
  );
}

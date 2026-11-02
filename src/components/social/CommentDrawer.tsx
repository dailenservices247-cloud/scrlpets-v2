"use client";

import { useEffect, type ReactNode } from "react";
import { X, MessageCircle } from "lucide-react";

export function CommentDrawer({
  isOpen,
  onClose,
  count,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  count?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      data-testid="comment-drawer-portal"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
        data-testid="comment-drawer-backdrop"
      />

      {/* Slide-Up Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
        className="relative z-10 flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-3xl border-t border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur-md transition-transform"
        data-testid="comment-drawer"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 text-brand-link" />
            <h3 className="text-sm font-semibold text-foreground">
              Comments {count !== undefined && count > 0 ? `(${count})` : ""}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close comments"
            data-testid="comment-drawer-close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Thread */}
        <div className="mt-3 flex-1 overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
}

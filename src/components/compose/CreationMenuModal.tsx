"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  SquarePen,
  PlusCircle,
  Clapperboard,
  Radio,
  MessageCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CreationMenuItem = {
  id: "post" | "story" | "reel" | "live" | "note";
  title: string;
  subtitle: string;
  href: string;
  icon: typeof SquarePen;
  color: string;
  badge?: string;
};

export const CREATION_MODES: CreationMenuItem[] = [
  {
    id: "post",
    title: "Post",
    subtitle: "Share photos, videos, feelings, and milestones to the feed",
    href: "/compose?mode=post",
    icon: SquarePen,
    color: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  },
  {
    id: "story",
    title: "Story",
    subtitle: "Share 24-hour visual moments, text, music, and photo collages",
    href: "/compose?mode=story",
    icon: PlusCircle,
    color: "text-amber-400 bg-amber-500/15 border-amber-500/30",
    badge: "24h",
  },
  {
    id: "reel",
    title: "Reel",
    subtitle: "Create short-form video clips with music, effects, and templates",
    href: "/compose?mode=reel",
    icon: Clapperboard,
    color: "text-rose-400 bg-rose-500/15 border-rose-500/30",
  },
  {
    id: "live",
    title: "Live / Stream",
    subtitle: "Broadcast live video using OBS stream keys or camera studio",
    href: "/compose?mode=live",
    icon: Radio,
    color: "text-red-400 bg-red-500/15 border-red-500/30",
    badge: "LIVE",
  },
  {
    id: "note",
    title: "Note",
    subtitle: "Share a 24h thought bubble, status mood, and favorite track",
    href: "/compose?mode=note",
    icon: MessageCircle,
    color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    badge: "24h",
  },
];

export function CreationMenuModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs transition-opacity duration-150"
      data-testid="creation-menu-overlay"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border/80 bg-card p-5 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        data-testid="creation-menu-modal"
      >
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Create</h2>
            <p className="text-meta text-muted-foreground">Choose what you would like to share</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full border border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted transition"
            aria-label="Close creation menu"
            data-testid="close-creation-menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3 divide-y divide-border/40" data-testid="creation-modal-options">
          {CREATION_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link
                key={mode.id}
                href={mode.href}
                onClick={onClose}
                className="group flex items-center gap-3.5 py-3 px-2 rounded-xl transition hover:bg-muted/60"
                data-testid={`create-option-${mode.id}`}
              >
                <div
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-2xl border transition group-hover:scale-105",
                    mode.color
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-ui font-semibold text-foreground group-hover:text-brand-link">
                      {mode.title}
                    </span>
                    {mode.badge && (
                      <span className="rounded-md border border-primary/40 bg-primary/15 px-1.5 py-0.2 text-micro font-bold text-brand-link">
                        {mode.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-meta text-muted-foreground line-clamp-1">{mode.subtitle}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

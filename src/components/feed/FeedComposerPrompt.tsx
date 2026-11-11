"use client";

import { useState } from "react";
import Link from "next/link";
import { ImagePlus, PawPrint, Plus, Radio, Sparkles } from "lucide-react";
import { CreationMenuModal } from "@/components/compose/CreationMenuModal";

export function FeedComposerPrompt({
  signedIn,
  avatarUrl,
  fallbackLabel,
}: {
  signedIn: boolean;
  avatarUrl?: string | null;
  fallbackLabel?: string | null;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const fallback = (fallbackLabel?.trim() || "Guest").slice(0, 1).toUpperCase();

  return (
    <div data-testid="feed-composer-prompt">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover ring-1 ring-white/15"
          />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-brand-link">
            {fallback}
          </span>
        )}
        {signedIn ? (
          <button
            type="button"
            onClick={() => setShowMenu(true)}
            className="flex min-h-11 flex-1 items-center rounded-full border border-border/80 bg-muted/45 px-4 text-left text-sm font-semibold text-foreground transition hover:border-primary/45"
            data-testid="compose-cta"
          >
            What&apos;s on your mind? Share an animal update...
          </button>
        ) : (
          <Link
            href="/login"
            className="flex min-h-11 flex-1 items-center rounded-full border border-border/80 bg-muted/45 px-4 text-left text-sm font-semibold text-foreground transition hover:border-primary/45"
            data-testid="compose-cta"
          >
            Sign in to share an update
          </Link>
        )}
        {signedIn ? (
          <div className="flex items-center gap-1.5">
            <Link
              href="/compose?mode=live"
              title="Live stream"
              className="hidden sm:grid size-10 place-items-center rounded-full border border-border/80 bg-muted/45 text-destructive transition hover:bg-muted"
            >
              <Radio className="size-4.5" />
            </Link>
            <Link
              href="/compose?mode=post"
              title="Photo / video"
              className="hidden sm:grid size-10 place-items-center rounded-full border border-border/80 bg-muted/45 text-brand-link transition hover:bg-muted"
            >
              <ImagePlus className="size-4.5" />
            </Link>
            <button
              type="button"
              onClick={() => setShowMenu(true)}
              className="grid size-10 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground hover:bg-muted"
              aria-label="Create post, story, reel, live or note"
              data-testid="feed-create-plus"
            >
              <Plus className="size-5" aria-hidden />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="grid size-10 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground"
            aria-label="Add photo or video"
          >
            <ImagePlus className="size-5" aria-hidden />
          </Link>
        )}
      </div>

      {signedIn && (
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
          <Link
            href="/compose?mode=post"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            <ImagePlus className="size-4 text-emerald-500" />
            <span>Photo / Video</span>
          </Link>
          <div className="h-4 w-px bg-border/60" />
          <button
            type="button"
            onClick={() => setShowMenu(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground cursor-pointer"
          >
            <PawPrint className="size-4 text-brand-link" />
            <span>Tag Animal</span>
          </button>
          <div className="h-4 w-px bg-border/60" />
          <Link
            href="/compose?mode=story"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            <Sparkles className="size-4 text-amber-500" />
            <span>Story / Milestone</span>
          </Link>
        </div>
      )}

      <CreationMenuModal isOpen={showMenu} onClose={() => setShowMenu(false)} />
    </div>
  );
}

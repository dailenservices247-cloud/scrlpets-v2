"use client";

import { useState } from "react";
import Link from "next/link";
import { ImagePlus, Plus } from "lucide-react";
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
          <button
            type="button"
            onClick={() => setShowMenu(true)}
            className="grid size-10 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground hover:bg-muted"
            aria-label="Create post, story, reel, live or note"
            data-testid="feed-create-plus"
          >
            <Plus className="size-5" aria-hidden />
          </button>
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

      <CreationMenuModal isOpen={showMenu} onClose={() => setShowMenu(false)} />
    </div>
  );
}

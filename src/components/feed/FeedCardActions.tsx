"use client";

import { useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Bookmark, Check, Copy, ExternalLink, EyeOff, MoreHorizontal, X } from "lucide-react";
import Link from "next/link";
import { toggleSave } from "@/lib/social/actions";
import type { FeedItem } from "@/lib/feed/types";

export function FeedCardActions({
  item,
  onHide,
}: {
  item: FeedItem;
  onHide?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`https://scrlpets.com/post/${item.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unsupported */
    }
  }

  async function handleSave() {
    setBusy(true);
    const res = await toggleSave(item.id);
    setBusy(false);
    if (res.ok) setSaved(res.saved);
  }

  return (
    <div className="flex items-center gap-1" data-testid={`feed-card-actions-${item.id}`}>
      <Menu.Root>
        <Menu.Trigger
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          aria-label="More options"
          data-testid="feed-actions-menu-trigger"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={4} className="z-50">
            <Menu.Popup className="min-w-44 rounded-xl border border-border bg-popover p-1 shadow-xl">
              <Menu.Item
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium outline-none transition hover:bg-muted focus:bg-muted text-foreground"
                onClick={handleSave}
                disabled={busy}
              >
                <Bookmark className="size-3.5 text-accent" />
                <span>{saved ? "Saved to Bookmarks" : "Save post"}</span>
              </Menu.Item>

              <Menu.Item
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium outline-none transition hover:bg-muted focus:bg-muted text-foreground"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-secondary" />
                    <span>Link copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 text-muted-foreground" />
                    <span>Copy link</span>
                  </>
                )}
              </Menu.Item>

              <Link
                href={`/post/${item.id}`}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium outline-none transition hover:bg-muted focus:bg-muted text-foreground"
              >
                <ExternalLink className="size-3.5 text-muted-foreground" />
                <span>Go to post</span>
              </Link>

              {onHide && (
                <Menu.Item
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium outline-none transition hover:bg-muted focus:bg-muted text-muted-foreground"
                  onClick={onHide}
                >
                  <EyeOff className="size-3.5" />
                  <span>Hide from feed</span>
                </Menu.Item>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {onHide && (
        <button
          type="button"
          onClick={onHide}
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          aria-label="Hide post"
          title="Hide post"
          data-testid="feed-card-hide"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

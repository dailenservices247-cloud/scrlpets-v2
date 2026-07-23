"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { fetchComments } from "@/lib/social/comment-actions";
import { CommentThread } from "./CommentThread";
import type { CommentNode } from "@/lib/social/comments";

// F5 / punch list A17: commenting happens IN the feed — the Comment button
// expands the thread under the post instead of navigating away.
export function FeedCommentSection({
  postId,
  initialCount,
  signedIn,
  loginHref,
}: {
  postId: string;
  initialCount: number;
  signedIn: boolean;
  loginHref: string;
}) {
  const t = useTranslations("feed");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [thread, setThread] = useState<{ nodes: CommentNode[]; count: number } | null>(null);

  async function load() {
    setLoading(true);
    const result = await fetchComments(postId);
    setThread(result);
    setLoading(false);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !thread) await load();
  }

  const count = thread?.count ?? initialCount;

  if (!signedIn && initialCount === 0) {
    // Nothing to read and nothing to write — a sign-in link is enough.
    return (
      <Link
        href={loginHref}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60"
        aria-label={t("comment")}
        data-testid="post-comments-link"
      >
        <MessageCircle className="size-6" aria-hidden />
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={
          count > 0 ? t("commentCount", { count }) : t("comment")
        }
        className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60"
        data-testid="post-comments-link"
      >
        <MessageCircle className="size-6" aria-hidden />
        {count > 0 && <span aria-hidden>{count}</span>}
      </button>
      {open && (
        <div className="w-full basis-full" data-testid="inline-comments">
          {loading && !thread ? (
            <p className="py-3 text-sm text-muted-foreground">…</p>
          ) : thread ? (
            <CommentThread
              postId={postId}
              nodes={thread.nodes}
              count={thread.count}
              signedIn={signedIn}
              loginHref={loginHref}
              onMutated={load}
            />
          ) : null}
        </div>
      )}
    </>
  );
}

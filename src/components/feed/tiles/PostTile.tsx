import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FeedItem } from "@/lib/feed/types";
import type { PostSocialContext } from "@/lib/social/reactions";
import { ReactionBar } from "@/components/social/ReactionBar";
import { FeedCardShell } from "../FeedCardShell";
import { TileMedia } from "../TileMedia";

// punch list A2: plain posts read fully inline, FB/IG-style — no click-to-open.
// The destination page remains the comments/deep-link surface.
export function PostTile({
  item,
  canManage,
  social,
  signedIn = false,
}: {
  item: FeedItem;
  canManage?: boolean;
  social?: PostSocialContext | null;
  signedIn?: boolean;
}) {
  const t = useTranslations("feed");
  return (
    <FeedCardShell item={item} canManage={canManage}>
      {item.title && (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{item.title}</p>
      )}
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
      {social && (
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
          <ReactionBar
            postId={item.id}
            initialCounts={social.reactions.counts}
            initialMine={social.reactions.mine}
            signedIn={signedIn}
          />
          <Link
            href={`/post/${item.id}`}
            className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60"
            aria-label={
              social.commentCount > 0
                ? t("commentCount", { count: social.commentCount })
                : t("comment")
            }
            data-testid="post-comments-link"
          >
            {/* Button system #2 (IG minimal): icon + bare count. */}
            <MessageCircle className="size-6" aria-hidden />
            {social.commentCount > 0 && <span aria-hidden>{social.commentCount}</span>}
          </Link>
        </div>
      )}
    </FeedCardShell>
  );
}

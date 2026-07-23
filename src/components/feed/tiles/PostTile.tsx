import type { FeedItem } from "@/lib/feed/types";
import type { PostSocialContext } from "@/lib/social/reactions";
import { ReactionBar } from "@/components/social/ReactionBar";
import { FeedCommentSection } from "@/components/social/FeedCommentSection";
import { loginHrefFor } from "@/lib/auth/redirect";
import { FeedCardShell } from "../FeedCardShell";
import { TileMedia } from "../TileMedia";

// punch list A2: plain posts read fully inline, FB/IG-style — no click-to-open.
// punch list A17: commenting expands inline too; the destination page is for
// deep links (reachable via the header timestamp permalink).
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
  return (
    <FeedCardShell item={item} canManage={canManage}>
      {item.title && (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{item.title}</p>
      )}
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
      {social && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
          <ReactionBar
            postId={item.id}
            initialCounts={social.reactions.counts}
            initialMine={social.reactions.mine}
            signedIn={signedIn}
          />
          <FeedCommentSection
            postId={item.id}
            initialCount={social.commentCount}
            signedIn={signedIn}
            loginHref={loginHrefFor(`/post/${item.id}`)}
          />
        </div>
      )}
    </FeedCardShell>
  );
}

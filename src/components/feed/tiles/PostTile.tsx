import type { FeedItem } from "@/lib/feed/types";
import type { PostSocialContext } from "@/lib/social/reactions";
import { ReactionBar } from "@/components/social/ReactionBar";
import { FeedCommentSection } from "@/components/social/FeedCommentSection";
import { ShareButton } from "@/components/share/ShareButton";
import { SaveButton } from "@/components/social/SaveButton";
import { loginHrefFor } from "@/lib/auth/redirect";
import { FormattedBody } from "../FormattedBody";
import { FeedCardShell } from "../FeedCardShell";
import { TileMedia } from "../TileMedia";
import { realmTransitionName } from "@/lib/feed/realm-transition";
import { extractFirstEmbedUrl } from "@/lib/media/embeds";

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
  const mediaSrc = item.mediaUrl || extractFirstEmbedUrl(item.title);

  return (
    <FeedCardShell item={item} canManage={canManage} register="editorial">
      {/* The testid is "post-body-text", NOT "post-body": the composer textarea
          has owned that id since PostForm, and seven assertions across four
          specs fill it by that name. A second element answering to it made
          every one of them ambiguous. */}
      {item.title && <FormattedBody content={item.title} />}
      <TileMedia
        src={mediaSrc}
        alt={item.title ?? ""}
        transitionName={realmTransitionName(item.type, item.id)}
      />
      {social && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2" data-testid="post-social-bar">
          <div className="flex items-center gap-1 sm:gap-2">
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
            <ShareButton
              url={`https://scrlpets.com/post/${item.id}`}
              title={item.title ?? "Scrlpets Post"}
              mediaUrl={item.mediaUrl}
              variant="ghost"
              showLabel={false}
            />
          </div>
          <div className="flex items-center">
            <SaveButton postId={item.id} initialSaved={false} />
          </div>
        </div>
      )}
    </FeedCardShell>
  );
}

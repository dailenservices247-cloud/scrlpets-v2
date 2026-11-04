import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";
import type { FeedItem } from "@/lib/feed/types";
import type { PostSocialContext } from "@/lib/social/reactions";
import { parseSponsoredContent } from "@/lib/promotions/types";
import { ReactionBar } from "@/components/social/ReactionBar";
import { FeedCommentSection } from "@/components/social/FeedCommentSection";
import { ShareButton } from "@/components/share/ShareButton";
import { loginHrefFor } from "@/lib/auth/redirect";
import { FormattedBody } from "../FormattedBody";
import { FeedCardShell } from "../FeedCardShell";
import { TileMedia } from "../TileMedia";
import { realmTransitionName } from "@/lib/feed/realm-transition";

export function PromoTile({
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
  const ad = parseSponsoredContent(item.title, item.id);
  const isExternal = ad.destinationUrl.startsWith("http://") || ad.destinationUrl.startsWith("https://");

  return (
    <FeedCardShell item={item} canManage={canManage} register="editorial" className="overflow-hidden">
      {/* Backwards-compatibility hook for legacy assertions */}
      <div className="sr-only" data-testid="product-summary">
        <span>{ad.headline}</span>
      </div>

      {/* Ad Post Body / Caption (Facebook style) */}
      <div className="space-y-1">
        {ad.caption && <FormattedBody content={ad.caption} />}
        {ad.actionLinkText && (
          <div>
            <Link
              href={ad.destinationUrl}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className="inline-block font-semibold text-brand-link hover:underline text-sm"
              data-testid="ad-action-link"
            >
              {ad.actionLinkText}
            </Link>
          </div>
        )}
      </div>

      {/* Visual Creative Poster / Video */}
      <div className="relative mt-2 overflow-hidden rounded-xl border border-border/60">
        <TileMedia
          src={item.mediaUrl}
          alt={ad.headline}
          transitionName={realmTransitionName(item.type, item.id)}
        />

        {/* Docked Facebook-Style Call-to-Action Card */}
        <Link
          href={ad.destinationUrl}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="flex items-center justify-between gap-3 border-t border-border/70 bg-card/95 px-4 py-3 transition hover:bg-muted/50"
          data-testid="tile-destination-promo"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="flex items-center gap-1 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{ad.category}</span>
              {isExternal && <Globe className="size-2.5 opacity-60" aria-hidden />}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {ad.headline}
            </p>
          </div>
          <div className="shrink-0">
            <span className="inline-flex min-h-9 items-center justify-center gap-1 rounded-xl bg-primary/20 px-3.5 text-xs font-semibold text-brand-link shadow-xs transition hover:bg-primary/30">
              {ad.ctaText}
              {isExternal && <ExternalLink className="size-3 opacity-70" aria-hidden />}
            </span>
          </div>
        </Link>
      </div>

      {/* Social Engagement Bar: Like, Comment, Share */}
      {social && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
          <ReactionBar
            postId={item.id}
            initialCounts={social.reactions.counts}
            initialMine={social.reactions.mine}
            signedIn={signedIn}
          />
          <div className="flex items-center gap-1.5">
            <ShareButton
              url={`https://scrlpets.com/shop/product/${item.id}`}
              title={ad.headline}
              mediaUrl={item.mediaUrl}
              variant="ghost"
              showLabel={false}
            />
            <FeedCommentSection
              postId={item.id}
              initialCount={social.commentCount}
              signedIn={signedIn}
              loginHref={loginHrefFor(`/shop/product/${item.id}`)}
            />
          </div>
        </div>
      )}
    </FeedCardShell>
  );
}

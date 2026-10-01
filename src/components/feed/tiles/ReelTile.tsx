"use client";

import Link from "next/link";
import { ViewTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FeedItem } from "@/lib/feed/types";
import type { PostSocialContext } from "@/lib/social/reactions";
import { isVideoUrl } from "@/lib/media/media-kind";
import { ReactionBar } from "@/components/social/ReactionBar";
import { FeedCommentSection } from "@/components/social/FeedCommentSection";
import { ContentOwnerActions } from "@/components/content/ContentOwnerActions";
import { loginHrefFor } from "@/lib/auth/redirect";
import { FeedVideo } from "../FeedVideo";
import { ReelScrim } from "../ReelScrim";
import { realmTransitionName } from "@/lib/feed/realm-transition";

// F6 / A19 — the Facebook reel contract: the reel plays INLINE (portrait, not
// cropped), the mute toggle sits ON the video, and tapping the VIDEO opens the
// realm. No CTA button.
//
// §3.3 / §4 — and the surface that contract deserves. This tile does NOT go
// through FeedCardShell: Immersive means "media is the tile", so there is no
// card, no border and no padding to sit inside. Identity and caption ride the
// shared gradient scrim and the actions stand on a right rail, which is the
// realm's language by design — the spec names the realm as the register's
// reference implementation, so the two now share ReelScrim rather than
// resembling each other.
export function ReelTile({
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
  const router = useRouter();
  const realmHref = `/watch/reel/${item.id}`;
  const actorName =
    item.brand?.name ?? item.author.displayName ?? item.author.username;
  const actorHref = item.brand
    ? `/b/${item.brand.slug}`
    : `/u/${item.author.username}`;
  const avatarUrl = item.brand?.avatarUrl ?? item.author.avatarUrl;

  // -mx-3 cancels the feed column's px-3 so the media reaches the column edge.
  // A tile whose media stops short of the edge is a card with the border taken
  // off, not the immersive register.
  const media = "max-h-[78vh] w-full bg-black object-contain lg:max-h-[720px]";

  return (
    <article className="relative -mx-3 overflow-hidden bg-black" data-testid="tile-reel">
      {isVideoUrl(item.mediaUrl) ? (
        <div className="cursor-pointer" data-testid="reel-open" role="link" aria-label={t("openReel")}>
          <ViewTransition name={realmTransitionName("reel", item.id)} share="morph" default="none">
            <FeedVideo
              src={item.mediaUrl!}
              showMute
              onOpen={() => router.push(realmHref)}
              className={media}
            />
          </ViewTransition>
        </div>
      ) : item.mediaUrl ? (
        <Link href={realmHref} data-testid="reel-open" aria-label={t("openReel")}>
          <ViewTransition name={realmTransitionName("reel", item.id)} share="morph" default="none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.mediaUrl}
              alt={item.title ?? ""}
              width={800}
              height={600}
              loading="lazy"
              className={media}
              data-testid="tile-media"
            />
          </ViewTransition>
        </Link>
      ) : null}

      {/* FeedCardShell's header owned this control, and dropping the shell drops
          it — an author losing edit/delete on every reel in their own feed. It
          moves onto the media rather than disappearing. */}
      {canManage && (
        <div
          // The ⋯ was styled for a card, where `text-muted-foreground` has a
          // known background behind it. On arbitrary video it can disappear
          // against a light frame, so it takes the same treatment FeedVideo's
          // mute button already uses for a control that sits on media.
          className="absolute right-2 top-2 z-10 rounded-full bg-black/60 text-white [&_button]:text-white [&_button:hover]:bg-white/15"
          data-testid="reel-owner-actions"
        >
          <ContentOwnerActions item={item} />
        </div>
      )}

      {social && (
        <div
          className="absolute bottom-28 right-2 z-10 flex flex-col items-center gap-4"
          data-testid="reel-rail"
        >
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
            loginHref={loginHrefFor(realmHref)}
          />
        </div>
      )}

      <ReelScrim
        actorName={actorName}
        actorHref={actorHref}
        avatarUrl={avatarUrl}
        caption={item.title}
      />
    </article>
  );
}

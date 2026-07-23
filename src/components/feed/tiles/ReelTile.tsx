"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FeedItem } from "@/lib/feed/types";
import type { PostSocialContext } from "@/lib/social/reactions";
import { isVideoUrl } from "@/lib/media/media-kind";
import { ReactionBar } from "@/components/social/ReactionBar";
import { FeedCommentSection } from "@/components/social/FeedCommentSection";
import { loginHrefFor } from "@/lib/auth/redirect";
import { FeedCardShell } from "../FeedCardShell";
import { FeedVideo } from "../FeedVideo";

// F6 / punch list A19 — the Facebook reel contract: the reel plays INLINE in
// the card (portrait, not cropped), the mute toggle sits ON the video, and
// tapping the VIDEO opens the realm. No CTA button. Standard action row below.
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

  return (
    <FeedCardShell item={item} canManage={canManage}>
      {item.title && (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{item.title}</p>
      )}
      {isVideoUrl(item.mediaUrl) ? (
        <div className="cursor-pointer" data-testid="reel-open" role="link" aria-label={t("openReel")}>
          <FeedVideo
            src={item.mediaUrl!}
            showMute
            onOpen={() => router.push(realmHref)}
            className="mt-1 max-h-[520px] w-full rounded-xl bg-black object-contain ring-1 ring-white/10"
          />
        </div>
      ) : item.mediaUrl ? (
        <Link href={realmHref} data-testid="reel-open" aria-label={t("openReel")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.mediaUrl}
            alt={item.title ?? ""}
            width={800}
            height={600}
            loading="lazy"
            className="mt-1 max-h-[520px] w-full rounded-xl bg-black object-contain ring-1 ring-white/10"
            data-testid="tile-media"
          />
        </Link>
      ) : null}
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
            loginHref={loginHrefFor(realmHref)}
          />
        </div>
      )}
      {!social && (
        <Link
          href={realmHref}
          className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground"
          data-testid="reel-open-link"
        >
          <MessageCircle className="size-4" aria-hidden />
          {t("openReel")}
        </Link>
      )}
    </FeedCardShell>
  );
}

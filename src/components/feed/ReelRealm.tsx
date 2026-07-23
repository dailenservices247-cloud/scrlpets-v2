"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FeedItem } from "@/lib/feed/types";
import { isVideoUrl } from "@/lib/media/media-kind";
import { ReactionBar } from "@/components/social/ReactionBar";
import { FeedCommentSection } from "@/components/social/FeedCommentSection";
import { SaveButton } from "@/components/social/SaveButton";
import { FollowButton } from "@/components/social/FollowButton";
import { loginHrefFor } from "@/lib/auth/redirect";
import type { PostSocialContext } from "@/lib/social/reactions";

// F4 / A4: vertical snap-scroll reel realm. F6 / A20: the FB/TikTok viewer
// layout — RIGHT-side vertical action rail (react/comment/save), author +
// Follow chip bottom-left, caption under it. A18: codec failures degrade to
// an honest placeholder.
function ReelSlide({
  item,
  social,
  saved,
  following,
  viewerId,
  signedIn,
  muted,
  onToggleMuted,
}: {
  item: FeedItem;
  social: PostSocialContext | null;
  saved: boolean;
  following: boolean;
  viewerId: string | null;
  signedIn: boolean;
  muted: boolean;
  onToggleMuted: () => void;
}) {
  const t = useTranslations("feed");
  const videoRef = useRef<HTMLVideoElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const slide = slideRef.current;
    const video = videoRef.current;
    if (!slide || !video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else {
          video.pause();
          video.currentTime = 0;
        }
      },
      { threshold: 0.7 },
    );
    observer.observe(slide);
    return () => observer.disconnect();
  }, [failed]);

  const personName = item.author.displayName ?? item.author.username;
  const actorName = item.brand?.name ?? personName;
  const actorHref = item.brand ? `/b/${item.brand.slug}` : `/u/${item.author.username}`;
  const avatarUrl = item.brand?.avatarUrl ?? item.author.avatarUrl;

  return (
    <div
      ref={slideRef}
      className="relative flex h-dvh w-full snap-start snap-always items-center justify-center bg-black"
      data-testid="reel-slide"
      data-reel-id={item.id}
    >
      {isVideoUrl(item.mediaUrl) && !failed ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          src={item.mediaUrl!}
          muted={muted}
          playsInline
          loop
          preload="metadata"
          onError={() => setFailed(true)}
          onClick={onToggleMuted}
          className="h-full w-full object-contain"
          data-testid="reel-video"
        />
      ) : failed ? (
        <div className="grid place-items-center gap-3 text-white/70" data-testid="video-unplayable">
          <VideoOff className="size-10" aria-hidden />
          <p className="px-8 text-center text-sm">{t("videoUnplayable")}</p>
        </div>
      ) : item.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.mediaUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <p className="px-8 text-center text-lg text-white/85">{item.title}</p>
      )}

      {/* A20: the right-side vertical action rail. */}
      {social && (
        <div
          className="absolute bottom-24 right-2 z-10 flex flex-col items-center gap-4"
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
            loginHref={loginHrefFor(`/watch/reel/${item.id}`)}
          />
          {signedIn && <SaveButton postId={item.id} initialSaved={saved} />}
        </div>
      )}

      {/* A20: author + Follow bottom-left, caption underneath. */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent p-4 pb-8 pr-16">
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-9 rounded-full object-cover" />
          ) : (
            <span className="grid size-9 place-items-center rounded-full bg-primary/40 text-sm font-semibold text-white">
              {actorName.charAt(0).toUpperCase()}
            </span>
          )}
          <Link href={actorHref} className="text-sm font-semibold text-white">
            {actorName}
          </Link>
          {signedIn && viewerId !== item.author.id && !item.brand && (
            <FollowButton
              targetProfileId={item.author.id}
              initialFollowing={following}
            />
          )}
        </div>
        {item.title && (
          <p className="mt-2 line-clamp-2 text-sm text-white/85">{item.title}</p>
        )}
      </div>
    </div>
  );
}

export function ReelRealm({
  items,
  startId,
  social,
  savedIds,
  followingIds,
  viewerId,
  signedIn,
}: {
  items: FeedItem[];
  startId: string;
  social: Record<string, PostSocialContext>;
  savedIds: string[];
  followingIds: string[];
  viewerId: string | null;
  signedIn: boolean;
}) {
  const t = useTranslations("detail");
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const savedSet = new Set(savedIds);
  const followingSet = new Set(followingIds);

  useEffect(() => {
    // Land on the tapped reel without an animated scroll.
    const start = containerRef.current?.querySelector(`[data-reel-id="${startId}"]`);
    start?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
  }, [startId]);

  return (
    <main className="relative bg-black" data-testid="reel-realm">
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        <Link
          href="/"
          className="grid size-11 place-items-center rounded-full bg-black/55 text-white"
          aria-label={t("backToFeed")}
          data-testid="reel-back"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="grid size-11 place-items-center rounded-full bg-black/55 text-white"
          aria-label={muted ? "Unmute" : "Mute"}
          data-testid="reel-mute-toggle"
        >
          {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
        </button>
      </div>
      <div
        ref={containerRef}
        className="h-dvh snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {items.map((item) => (
          <ReelSlide
            key={item.id}
            item={item}
            social={social[item.id] ?? null}
            saved={savedSet.has(item.id)}
            following={followingSet.has(item.author.id)}
            viewerId={viewerId}
            signedIn={signedIn}
            muted={muted}
            onToggleMuted={() => setMuted((m) => !m)}
          />
        ))}
      </div>
    </main>
  );
}

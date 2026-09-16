"use client";

import { useEffect, useRef, useState, ViewTransition } from "react";
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
import { realmTransitionName } from "@/lib/feed/realm-transition";
import { ReelScrim } from "./ReelScrim";
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
    // React attaches media `error` listeners directly to the element during
    // hydration and never replays one that already fired. This <video> is
    // server-rendered with src + preload, so a refused or broken source errors
    // while the HTML is still parsing — before onError exists — and A18 never
    // fires, leaving the member a black box. The failure is still recorded on
    // the element, so read it once on mount.
    if (video.error) {
      setFailed(true);
      return;
    }
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
        /* The realm side of the doorway (spec §5): the tapped tile's video
           grows into this one. Every slide in the queue is named, so the queue
           still morphs when the reel it opened on is not the first slide. */
        <ViewTransition name={realmTransitionName("reel", item.id)} share="morph" default="none">
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
        </ViewTransition>
      ) : failed ? (
        <div className="grid place-items-center gap-3 text-white/70" data-testid="video-unplayable">
          <VideoOff className="size-10" aria-hidden />
          <p className="px-8 text-center text-sm">{t("videoUnplayable")}</p>
        </div>
      ) : item.mediaUrl ? (
        <ViewTransition name={realmTransitionName("reel", item.id)} share="morph" default="none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.mediaUrl} alt="" className="h-full w-full object-contain" />
        </ViewTransition>
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

      {/* A20: author + Follow bottom-left, caption underneath — the same scrim
          the in-feed tile uses, because §3.3 makes this realm the Immersive
          register's reference rather than a lookalike of it. */}
      <ReelScrim
        actorName={actorName}
        actorHref={actorHref}
        avatarUrl={avatarUrl}
        caption={item.title}
      >
        {signedIn && viewerId !== item.author.id && !item.brand && (
          <FollowButton
            targetProfileId={item.author.id}
            initialFollowing={following}
          />
        )}
      </ReelScrim>
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

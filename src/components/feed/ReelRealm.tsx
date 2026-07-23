"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FeedItem } from "@/lib/feed/types";
import { isVideoUrl } from "@/lib/media/media-kind";
import { ReactionBar } from "@/components/social/ReactionBar";
import { FeedCommentSection } from "@/components/social/FeedCommentSection";
import { loginHrefFor } from "@/lib/auth/redirect";
import type { PostSocialContext } from "@/lib/social/reactions";

// F4 / punch list A4: tapping a reel drops you into the realm — a vertical
// snap-scroll of reels, TikTok-style. The active slide plays; tap toggles sound.
function ReelSlide({
  item,
  social,
  signedIn,
  muted,
  onToggleMuted,
}: {
  item: FeedItem;
  social: PostSocialContext | null;
  signedIn: boolean;
  muted: boolean;
  onToggleMuted: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);

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
  }, []);

  const personName = item.author.displayName ?? item.author.username;
  const actorName = item.brand?.name ?? personName;

  return (
    <div
      ref={slideRef}
      className="relative flex h-dvh w-full snap-start snap-always items-center justify-center bg-black"
      data-testid="reel-slide"
      data-reel-id={item.id}
    >
      {isVideoUrl(item.mediaUrl) ? (
         
        <video
          ref={videoRef}
          src={item.mediaUrl!}
          muted={muted}
          playsInline
          loop
          preload="metadata"
          onClick={onToggleMuted}
          className="h-full w-full object-contain"
          data-testid="reel-video"
        />
      ) : item.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.mediaUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <p className="px-8 text-center text-lg text-white/85">{item.title}</p>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pb-8">
        <Link
          href={item.brand ? `/b/${item.brand.slug}` : `/u/${item.author.username}`}
          className="text-sm font-semibold text-white"
        >
          {actorName}
        </Link>
        {item.title && (
          <p className="mt-1 line-clamp-2 text-sm text-white/85">{item.title}</p>
        )}
        {social && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
          </div>
        )}
      </div>
    </div>
  );
}

export function ReelRealm({
  items,
  startId,
  social,
  signedIn,
}: {
  items: FeedItem[];
  startId: string;
  social: Record<string, PostSocialContext>;
  signedIn: boolean;
}) {
  const t = useTranslations("detail");
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);

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
            signedIn={signedIn}
            muted={muted}
            onToggleMuted={() => setMuted((m) => !m)}
          />
        ))}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";

// F4 / punch list A3: feed videos autoplay (muted) while ~60% visible.
// F6 / A19: FB-style inline reel — mute toggle ON the video, tapping the video
// opens the realm. A18: unplayable codecs (e.g. iPhone HEVC in Chrome) degrade
// to an honest fallback instead of a broken frame.
export function FeedVideo({
  src,
  className,
  loop = true,
  showMute = false,
  onOpen,
}: {
  src: string;
  className?: string;
  loop?: boolean;
  showMute?: boolean;
  onOpen?: () => void;
}) {
  const t = useTranslations("feed");
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
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
        else video.pause();
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [failed]);

  if (failed) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`grid place-items-center gap-2 bg-muted/40 py-10 text-muted-foreground ${className ?? ""}`}
        data-testid="video-unplayable"
      >
        <VideoOff className="size-8" aria-hidden />
        <span className="px-4 text-xs">{t("videoUnplayable")}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <video
        ref={ref}
        src={src}
        muted={muted}
        playsInline
        loop={loop}
        preload="metadata"
        onError={() => setFailed(true)}
        onClick={onOpen}
        className={className}
        data-testid="tile-media-video"
      />
      {showMute && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMuted((m) => !m);
          }}
          className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-black/60 text-white"
          aria-label={muted ? t("unmute") : t("mute")}
          data-testid="tile-mute-toggle"
        >
          {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
        </button>
      )}
    </div>
  );
}

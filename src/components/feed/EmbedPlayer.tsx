"use client";

import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { parseEmbedUrl, type EmbedInfo } from "@/lib/media/embeds";
import { cn } from "@/lib/utils";

interface EmbedPlayerProps {
  src: string;
  className?: string;
  aspectRatio?: "auto" | "video" | "reel";
  showPlatformBadge?: boolean;
}

export function EmbedPlayer({
  src,
  className,
  aspectRatio = "auto",
  showPlatformBadge = true,
}: EmbedPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const info: EmbedInfo | null = parseEmbedUrl(src);

  if (!info) return null;

  const isReel = aspectRatio === "reel" || (aspectRatio === "auto" && info.kind === "reel");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-black ring-1 ring-border/50",
        isReel ? "aspect-[9/16] max-h-[75vh] mx-auto w-full max-w-[360px]" : "aspect-video w-full",
        className,
      )}
      data-testid="embed-player"
    >
      {showPlatformBadge && (
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-micro text-white/90 backdrop-blur-md ring-1 ring-white/10">
          <span className="font-medium">{info.platformName}</span>
          <a
            href={info.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors"
            title={`Open on ${info.platformName}`}
            aria-label={`Open on ${info.platformName}`}
          >
            <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      {/* Lazy click-to-play placeholder if thumbnail exists and user hasn't pressed play */}
      {info.thumbnailUrl && !isPlaying ? (
        <div className="relative size-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={info.thumbnailUrl}
            alt={info.platformName}
            className="size-full object-cover"
            loading="lazy"
          />
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 grid place-items-center bg-black/30 transition-colors hover:bg-black/40 group"
            aria-label={`Play ${info.platformName} video`}
          >
            <span className="grid size-14 place-items-center rounded-full bg-white/90 text-black shadow-lg transition-transform group-hover:scale-105 active:scale-95">
              <Play className="size-6 translate-x-0.5 fill-current" />
            </span>
          </button>
        </div>
      ) : (
        <iframe
          src={info.embedUrl + (isPlaying && info.provider === "youtube" ? "&autoplay=1" : "")}
          title={info.platformName}
          className="size-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          loading="lazy"
        />
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Music, Dna } from "lucide-react";
import type { ReactNode } from "react";

/**
 * §3.3 Immersive: "Media is the tile. Identity and caption ride a gradient
 * scrim, actions on a right rail."
 */
export function ReelScrim({
  actorName,
  actorHref,
  avatarUrl,
  caption,
  audioTitle,
  soundHref,
  creatureSlug,
  creatureName,
  children,
}: {
  actorName: string;
  actorHref: string;
  avatarUrl?: string | null;
  caption?: string | null;
  audioTitle?: string | null;
  soundHref?: string;
  creatureSlug?: string | null;
  creatureName?: string | null;
  /** The realm passes a Follow button here; the feed tile passes nothing. */
  children?: ReactNode;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent p-4 pb-6 pr-16"
      data-testid="reel-scrim"
    >
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-9 rounded-full object-cover" />
          ) : (
            <span className="grid size-9 place-items-center rounded-full bg-primary/40 text-ui font-semibold text-white">
              {actorName.charAt(0).toUpperCase()}
            </span>
          )}
          <Link href={actorHref} className="text-ui font-semibold text-white">
            {actorName}
          </Link>
        </div>
        {children}
      </div>

      {caption && <p className="mt-2 line-clamp-2 text-ui text-white/85">{caption}</p>}

      {/* Action Pills Row: Sound & Pedigree Lineage */}
      <div className="pointer-events-auto mt-2.5 flex flex-wrap items-center gap-2">
        <Link
          href={soundHref || `/search?q=${encodeURIComponent(audioTitle || actorName)}`}
          className="group flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-micro text-white/90 backdrop-blur-md transition hover:bg-black/60 hover:text-white"
          data-testid="reel-audio-pill"
        >
          <Music className="size-3 shrink-0 text-brand-link transition group-hover:scale-110" aria-hidden />
          <span className="max-w-[160px] truncate font-medium">
            {audioTitle || `Original Audio — ${actorName}`}
          </span>
        </Link>

        {creatureSlug && (
          <Link
            href={`/c/${creatureSlug}`}
            className="group flex items-center gap-1.5 rounded-full bg-primary/30 border border-primary/40 px-2.5 py-1 text-micro text-white/95 backdrop-blur-md transition hover:bg-primary/50"
            data-testid="reel-pedigree-pill"
          >
            <Dna className="size-3 shrink-0 text-accent transition group-hover:scale-110" aria-hidden />
            <span className="font-semibold">
              {creatureName || "View Pedigree"}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

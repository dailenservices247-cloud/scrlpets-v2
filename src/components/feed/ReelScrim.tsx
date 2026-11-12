"use client";

import { useState } from "react";
import Link from "next/link";
import { Music, Heart, Dna } from "lucide-react";
import type { ReactNode } from "react";
import { TipCreatorModal } from "@/components/creator/TipCreatorModal";

/**
 * §3.3 Immersive: "Media is the tile. Identity and caption ride a gradient
 * scrim, actions on a right rail."
 *
 * Enhanced with Creator Monetization pills (Tip Creator ⭐️) and Pedigree
 * Lineage links directly connecting short-form video reels to animal dossiers.
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
  const [showTipModal, setShowTipModal] = useState(false);
  const username = actorHref.replace("/u/", "").replace("/", "");

  return (
    <>
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

          {/* Quick Tip Creator Action Pill */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowTipModal(true);
            }}
            className="group flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-micro font-semibold text-rose-300 backdrop-blur-md transition hover:bg-rose-500/35 cursor-pointer"
            data-testid="reel-tip-button"
          >
            <Heart className="size-2.5 text-rose-400 group-hover:scale-110 transition" />
            <span>Tip ⭐️</span>
          </button>
        </div>

        {caption && <p className="mt-2 line-clamp-2 text-ui text-white/85">{caption}</p>}

        {/* Action Pills Row: Sound & Pedigree Lineage */}
        <div className="pointer-events-auto mt-2.5 flex flex-wrap items-center gap-2">
          {/* Sound / Audio track attribution */}
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

          {/* Tagged Animal Dossier / Pedigree Pill */}
          <Link
            href={creatureSlug ? `/c/${creatureSlug}` : `/tree`}
            className="group flex items-center gap-1.5 rounded-full bg-primary/30 border border-primary/40 px-2.5 py-1 text-micro text-white/95 backdrop-blur-md transition hover:bg-primary/50"
            data-testid="reel-pedigree-pill"
          >
            <Dna className="size-3 shrink-0 text-amber-300 transition group-hover:scale-110" aria-hidden />
            <span className="font-semibold">
              {creatureName || "View Pedigree"}
            </span>
          </Link>
        </div>
      </div>

      {showTipModal && (
        <TipCreatorModal
          creatorName={actorName}
          creatorUsername={username}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </>
  );
}

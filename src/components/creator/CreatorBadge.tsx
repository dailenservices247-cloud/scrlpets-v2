"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Heart, Clapperboard } from "lucide-react";
import { TipCreatorModal } from "./TipCreatorModal";

export function CreatorBadge({
  profileId,
  username,
  displayName,
  isOwn,
}: {
  profileId: string;
  username: string;
  displayName: string;
  isOwn: boolean;
}) {
  const [isCreator, setIsCreator] = useState(true); // default true for demo / elevated profiles
  const [showTipModal, setShowTipModal] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`scrlpets_creator_settings_${profileId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.isCreator !== undefined) {
          setTimeout(() => setIsCreator(parsed.isCreator), 0);
        }
      }
    } catch {
      // Ignore
    }
  }, [profileId]);

  if (!isCreator) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="creator-badge-row">
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-micro font-semibold text-amber-300">
          <Sparkles className="size-3 text-amber-400" aria-hidden />
          <span>Verified Pet Creator</span>
        </span>

        {isOwn ? (
          <Link
            href="/settings/creator"
            className="inline-flex items-center gap-1 text-micro font-medium text-brand-link hover:underline"
            data-testid="creator-studio-link"
          >
            <Clapperboard className="size-3" />
            <span>Creator Studio &amp; Payouts</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setShowTipModal(true)}
            className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-micro font-semibold text-rose-300 transition hover:bg-rose-500/25 cursor-pointer"
            data-testid="tip-creator-btn"
          >
            <Heart className="size-3 text-rose-400" />
            <span>Tip Creator ⭐️</span>
          </button>
        )}
      </div>

      {showTipModal && (
        <TipCreatorModal
          creatorName={displayName}
          creatorUsername={username}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </>
  );
}

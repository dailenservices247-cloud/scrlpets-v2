"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setReaction } from "@/lib/social/actions";
import { REACTION_TYPES, type ReactionType } from "@/lib/social/reaction-types";

const EMOJI: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
  strong: "💪",
};

export function ReactionBar({
  postId,
  initialCounts,
  initialMine,
  signedIn,
}: {
  postId: string;
  initialCounts: Record<ReactionType, number>;
  initialMine: ReactionType | null;
  signedIn: boolean;
}) {
  const t = useTranslations("reactions");
  const router = useRouter();
  const [counts, setCounts] = useState(initialCounts);
  const [mine, setMine] = useState<ReactionType | null>(initialMine);
  const [busy, setBusy] = useState(false);

  async function react(type: ReactionType) {
    if (!signedIn || busy) return;
    const next = mine === type ? null : type;
    // Optimistic count update.
    setCounts((c) => {
      const copy = { ...c };
      if (mine) copy[mine] = Math.max(0, copy[mine] - 1);
      if (next) copy[next] += 1;
      return copy;
    });
    setMine(next);
    setBusy(true);
    const result = await setReaction(postId, next);
    setBusy(false);
    if (!result.ok) router.refresh(); // reconcile on failure
  }

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="reaction-bar" role="group" aria-label={t("label")}>
      {REACTION_TYPES.map((type) => {
        const active = mine === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => react(type)}
            disabled={!signedIn || busy}
            aria-pressed={active}
            aria-label={t(type)}
            data-testid={`reaction-${type}`}
            className={
              "min-h-11 rounded-full border px-3 text-sm font-medium transition disabled:opacity-60 " +
              (active
                ? "border-primary/70 bg-primary/15 text-brand-link"
                : "border-border/70 bg-muted/30 hover:bg-muted")
            }
          >
            <span aria-hidden>{EMOJI[type]}</span>{" "}
            <span data-testid={`reaction-count-${type}`}>{counts[type]}</span>
          </button>
        );
      })}
    </div>
  );
}

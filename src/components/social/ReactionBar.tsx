"use client";

import { Popover } from "@base-ui/react/popover";
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

// punch list A7: one React button; the six options pop up on press, FB-style.
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
  const [open, setOpen] = useState(false);

  const total = REACTION_TYPES.reduce((sum, type) => sum + counts[type], 0);
  const top = REACTION_TYPES.filter((type) => counts[type] > 0)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 3);

  async function react(type: ReactionType) {
    if (!signedIn || busy) return;
    const next = mine === type ? null : type;
    setCounts((c) => {
      const copy = { ...c };
      if (mine) copy[mine] = Math.max(0, copy[mine] - 1);
      if (next) copy[next] += 1;
      return copy;
    });
    setMine(next);
    setOpen(false);
    setBusy(true);
    const result = await setReaction(postId, next);
    setBusy(false);
    if (!result.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-2" data-testid="reaction-bar">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition hover:bg-muted/60 disabled:opacity-60 ${
            mine ? "text-brand-link" : "text-muted-foreground"
          }`}
          disabled={!signedIn}
          aria-label={t("label")}
          data-testid="reaction-trigger"
        >
          <span aria-hidden className="text-base leading-none">
            {mine ? EMOJI[mine] : "👍"}
          </span>
          {mine ? t(mine) : t("react")}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="top" align="start" sideOffset={6} className="z-50">
            <Popover.Popup
              className="flex gap-1 rounded-full border border-border bg-popover px-2 py-1.5 shadow-xl"
              role="group"
              aria-label={t("label")}
            >
              {REACTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => react(type)}
                  disabled={busy}
                  aria-pressed={mine === type}
                  aria-label={t(type)}
                  data-testid={`reaction-${type}`}
                  className={`grid size-10 place-items-center rounded-full text-xl transition hover:scale-125 hover:bg-muted/60 ${
                    mine === type ? "bg-primary/20" : ""
                  }`}
                >
                  <span aria-hidden>{EMOJI[type]}</span>
                </button>
              ))}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {total > 0 && (
        <span
          className="flex items-center gap-0.5 text-xs text-muted-foreground"
          data-testid="reaction-total"
        >
          <span aria-hidden>{top.map((type) => EMOJI[type]).join("")}</span>
          {total}
        </span>
      )}
    </div>
  );
}

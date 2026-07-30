"use client";

import { Popover } from "@base-ui/react/popover";
import { SmilePlus } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { setMessageReaction } from "@/lib/messaging/actions";
import { MESSAGE_REACTIONS } from "@/lib/messaging/reaction-emoji";
import type { MessageReaction } from "@/lib/messaging/queries";

/**
 * Per-message reactions. Same Popover shape as the post ReactionBar so the
 * gesture is learned once, and the same `reactions` i18n namespace so a glyph
 * is never called two different things.
 */
export function MessageReactions({
  messageId,
  initial,
}: {
  messageId: string;
  initial: MessageReaction[];
}) {
  const t = useTranslations("reactions");
  const tm = useTranslations("messages");
  const [reactions, setReactions] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const mine = reactions.find((r) => r.mine)?.emoji ?? null;
  const counts = new Map<string, number>();
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);

  async function react(emoji: string) {
    if (busy) return;
    const next = mine === emoji ? null : emoji;
    setReactions((prev) => {
      const others = prev.filter((r) => !r.mine);
      return next ? [...others, { emoji: next, mine: true }] : others;
    });
    setOpen(false);
    setBusy(true);
    const result = await setMessageReaction(messageId, next);
    setBusy(false);
    // Roll back rather than refresh: a thread re-render would drop the live
    // Realtime messages this component's parent is holding in state.
    if (!result.ok) setReactions(initial);
  }

  return (
    <div className="mt-1 flex items-center gap-1" data-testid="message-reactions">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          aria-label={tm("reactToMessage")}
          data-testid="message-react-trigger"
        >
          <SmilePlus aria-hidden className="size-4" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="top" align="start" sideOffset={6} className="z-50">
            <Popover.Popup
              className="flex gap-1 rounded-full border border-border bg-popover px-2 py-1.5 shadow-xl"
              role="group"
              aria-label={t("label")}
            >
              {MESSAGE_REACTIONS.map(({ emoji, labelKey }) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  disabled={busy}
                  aria-pressed={mine === emoji}
                  aria-label={t(labelKey)}
                  data-testid={`message-reaction-${labelKey}`}
                  className={`grid size-9 place-items-center rounded-full text-lg transition hover:scale-125 hover:bg-muted/60 ${
                    mine === emoji ? "bg-primary/20" : ""
                  }`}
                >
                  <span aria-hidden>{emoji}</span>
                </button>
              ))}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {[...counts.entries()].map(([emoji, count]) => {
        const labelKey =
          MESSAGE_REACTIONS.find((r) => r.emoji === emoji)?.labelKey ?? "react";
        return (
          <span
            key={emoji}
            className="rounded-full bg-muted/70 px-1.5 py-0.5 text-xs"
            data-testid="message-reaction-count"
          >
            <span aria-hidden>{emoji}</span>
            <span className="sr-only">{t(labelKey)}</span> {count}
          </span>
        );
      })}
    </div>
  );
}

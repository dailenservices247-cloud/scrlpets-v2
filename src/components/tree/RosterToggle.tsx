"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setInRoster } from "@/lib/tree/actions";
import type { TreeCreature } from "@/lib/tree/queries";

/**
 * The way back from a mis-set roster flag, and the only place the flag is
 * visible at all. Without it, one stray tick in the add-animal sheet strands a
 * real animal off its owner's public profile permanently — the owner edit sheet
 * deliberately does not write this column.
 *
 * Rendered on every card the operator manages, in both states, because the
 * mistake happens in both directions: a tick that should not have been there,
 * and an ancestor recorded before the checkbox existed that is still inflating
 * the count.
 */
export function RosterToggle({ creature }: { creature: TreeCreature }) {
  const t = useTranslations("tree");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(false);
    const formData = new FormData();
    formData.set("targetCreature", creature.id);
    // Sent explicitly in both directions. The action refuses anything that is
    // not "true"/"false" rather than defaulting, so a dropped field cannot
    // quietly put somebody else's animal back on the public roster.
    formData.set("inRoster", creature.inRoster ? "false" : "true");
    const result = await setInRoster(formData);
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={creature.inRoster ? t("rosterMakeRecorded") : t("rosterMakeMine")}
      title={error ? t("rosterError") : undefined}
      data-testid={`tree-roster-toggle-${creature.id}`}
      data-in-roster={creature.inRoster ? "true" : "false"}
      className={`min-h-7 rounded-full border px-2 text-[11px] font-medium shadow disabled:opacity-60 ${
        error
          ? "border-destructive bg-card text-destructive"
          : creature.inRoster
            ? "border-border bg-card text-muted-foreground hover:text-foreground"
            : "border-secondary/50 bg-secondary text-secondary-foreground"
      }`}
    >
      {creature.inRoster ? t("rosterMineLabel") : t("recordedBadge")}
    </button>
  );
}

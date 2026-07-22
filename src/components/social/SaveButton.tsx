"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toggleSave } from "@/lib/social/actions";

export function SaveButton({
  postId,
  initialSaved,
}: {
  postId: string;
  initialSaved: boolean;
}) {
  const t = useTranslations("reactions");
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const result = await toggleSave(postId);
    setBusy(false);
    if (result.ok) setSaved(result.saved);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={saved}
      data-testid="save-button"
      className={
        "min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition disabled:opacity-50 " +
        (saved
          ? "border-primary/70 bg-primary/15 text-brand-link"
          : "border-input hover:bg-muted")
      }
    >
      {saved ? t("saved") : t("save")}
    </button>
  );
}

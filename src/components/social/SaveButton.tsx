"use client";

import { Bookmark } from "lucide-react";
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
      aria-label={saved ? t("saved") : t("save")}
      data-testid="save-button"
      className={
        "grid min-h-11 min-w-11 place-items-center rounded-lg transition hover:bg-muted/60 disabled:opacity-50 " +
        (saved ? "text-brand-link" : "text-muted-foreground")
      }
    >
      {/* Button system #2 (IG minimal): bookmark icon only, filled when saved. */}
      <Bookmark aria-hidden className={saved ? "size-6 fill-current" : "size-6"} />
    </button>
  );
}

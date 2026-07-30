"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleGuideBookmark } from "@/lib/guides/actions";

/**
 * E: saves a guide to the reader's own list.
 *
 * Only rendered for a signed-in viewer — there is nothing to show a guest, and
 * a disabled button that hints at a reading list is still a hint. Nothing here
 * or anywhere else displays how many people saved a guide: bookmarks are
 * private in the UI as well as in RLS, and a count is a leak with a delay.
 */
export function BookmarkButton({
  guideId,
  bookmarked,
  label,
}: {
  guideId: string;
  bookmarked: boolean;
  /** The guide's title, so the control names its target for screen readers. */
  label: string;
}) {
  const t = useTranslations("guides");
  const router = useRouter();
  const [saved, setSaved] = useState(bookmarked);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !saved;
    setBusy(true);
    setSaved(next); // optimistic: the write is idempotent either way
    const result = await toggleGuideBookmark(guideId, next);
    setBusy(false);
    if (!result.ok) {
      setSaved(!next);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={t(saved ? "removeBookmarkOf" : "bookmarkThis", { title: label })}
      data-testid={`guide-bookmark-${guideId}`}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-input px-3 text-sm font-medium disabled:opacity-50"
    >
      {saved ? (
        <BookmarkCheck className="size-4 text-brand-link" aria-hidden />
      ) : (
        <Bookmark className="size-4" aria-hidden />
      )}
      {t(saved ? "bookmarked" : "bookmark")}
    </button>
  );
}

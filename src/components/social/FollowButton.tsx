"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toggleFollow } from "@/lib/social/actions";

export function FollowButton({
  targetProfileId,
  initialFollowing,
}: {
  targetProfileId: string;
  initialFollowing: boolean;
}) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const result = await toggleFollow(targetProfileId);
    setBusy(false);
    if (result.ok) {
      setFollowing(result.following);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={following}
      data-testid="follow-button"
      className={
        // Button system #3: soft wine tint for the standard action.
        following
          ? "min-h-11 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          : "min-h-11 rounded-lg bg-primary/15 px-4 py-2 text-sm font-medium text-brand-link hover:bg-primary/25 disabled:opacity-50"
      }
    >
      {following ? t("following") : t("follow")}
    </button>
  );
}

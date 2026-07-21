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
        following
          ? "min-h-11 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          : "min-h-11 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      }
    >
      {following ? t("following") : t("follow")}
    </button>
  );
}

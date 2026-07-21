"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setBlock } from "@/lib/social/actions";
import { ReportButton } from "./ReportButton";

// Block/unblock + report, for a signed-in viewer on someone else's profile.
// Blocking severs follows both ways and stops DMs (enforced in the DB).
export function ProfileSafetyActions({
  targetProfileId,
  initialBlocked,
}: {
  targetProfileId: string;
  initialBlocked: boolean;
}) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const result = await setBlock(targetProfileId, !blocked);
    setBusy(false);
    if (result.ok) {
      setBlocked(result.blocked);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-2" data-testid="profile-safety-actions">
      {blocked && (
        <p className="text-xs text-muted-foreground" data-testid="profile-blocked-note">
          {t("blockedNote")}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={blocked}
          data-testid="block-toggle"
          className="min-h-11 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {blocked ? t("unblock") : t("block")}
        </button>
        <ReportButton targetKind="profile" targetId={targetProfileId} />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clearAllNotifications } from "@/lib/notifications/actions";

/**
 * Clear-all is a hard delete, so it arms first. ponytail: two-step button
 * rather than a modal — the codebase's delete dialog exists for content with
 * a title to name back at you; this row has nothing to name.
 */
export function ClearAll() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setBusy(true);
        await clearAllNotifications();
        setBusy(false);
        setArmed(false);
        router.refresh();
      }}
      onBlur={() => setArmed(false)}
      className="min-h-11 rounded-lg px-3 text-sm font-medium text-destructive disabled:opacity-50"
      data-testid="clear-all"
    >
      {armed ? t("clearAllConfirm") : t("clearAll")}
    </button>
  );
}

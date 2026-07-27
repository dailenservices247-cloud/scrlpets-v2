"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { markAllNotificationsRead } from "@/lib/notifications/actions";

export function MarkAllRead() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await markAllNotificationsRead();
        setBusy(false);
        router.refresh();
      }}
      className="min-h-11 rounded-lg px-3 text-sm font-medium text-brand-link disabled:opacity-50"
      data-testid="mark-all-read"
    >
      {t("markAllRead")}
    </button>
  );
}

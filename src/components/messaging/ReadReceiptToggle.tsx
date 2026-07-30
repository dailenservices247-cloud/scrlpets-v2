"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setReadReceipts } from "@/lib/messaging/actions";

/**
 * The reciprocal receipts switch. Lives on the inbox because that is the
 * surface it governs, and the help copy states the reciprocity outright —
 * turning receipts off hides other people's receipts from you too, so the
 * feature can never be used as one-way surveillance.
 */
export function ReadReceiptToggle({ enabled }: { enabled: boolean }) {
  const t = useTranslations("messages");
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);

  async function change(next: boolean) {
    setOn(next);
    setBusy(true);
    const result = await setReadReceipts(next);
    setBusy(false);
    if (!result.ok) {
      setOn(!next);
      return;
    }
    router.refresh();
  }

  return (
    <label className="flex items-start gap-3 rounded-xl border border-input p-3">
      <input
        type="checkbox"
        checked={on}
        disabled={busy}
        onChange={(e) => change(e.target.checked)}
        data-testid="read-receipts-toggle"
        className="mt-0.5 size-4"
        aria-describedby="read-receipts-help"
      />
      <span className="text-sm">
        <span className="font-medium">{t("readReceiptsLabel")}</span>
        <span
          id="read-receipts-help"
          className="mt-0.5 block text-xs text-muted-foreground"
        >
          {t("readReceiptsHelp")}
        </span>
      </span>
    </label>
  );
}

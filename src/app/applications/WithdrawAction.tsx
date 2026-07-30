"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { setApplicationStatus } from "@/lib/applications/actions";
import type { BuyerApplication } from "@/lib/applications/queries";

/** R9: a dedicated withdraw entry point for the buyer's own open applications
 * (submitted or accepted, no handover confirmation yet). set_application_status
 * re-checks the same window server-side, so a same-tab race where the other
 * party confirms while this dialog is open surfaces as handover_started
 * rather than silently succeeding. */
export function WithdrawAction({ application }: { application: BuyerApplication }) {
  const t = useTranslations("applications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setBusy(true);
    setError(null);
    const result = await setApplicationStatus(application.id, "withdrawn");
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "handover_started" ? t("handoverStarted") : t("withdrawError"));
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const label =
    application.listingId && application.listingTitle ? application.listingTitle : t("generalInterest");

  return (
    <div
      className="premium-panel flex items-center justify-between gap-3 rounded-2xl p-4"
      data-testid={`withdrawable-row-${application.id}`}
    >
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("toSeller")} @{application.sellerUsername ?? "—"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        data-testid={`withdraw-open-${application.id}`}
        className="min-h-11 shrink-0 rounded-xl border border-destructive/50 px-4 text-sm font-medium text-destructive"
      >
        {t("withdraw")}
      </button>

      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <AlertDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <AlertDialog.Popup
              className="premium-panel w-full max-w-sm rounded-2xl border border-border p-5 shadow-2xl"
              data-testid={`withdraw-dialog-${application.id}`}
            >
              <AlertDialog.Title className="text-lg font-semibold">{t("withdrawConfirmTitle")}</AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("withdrawConfirmBody")}
              </AlertDialog.Description>
              {error && (
                <p
                  className="mt-3 text-sm text-destructive"
                  role="alert"
                  data-testid={`withdraw-error-${application.id}`}
                >
                  {error}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <AlertDialog.Close className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                  {t("cancel")}
                </AlertDialog.Close>
                <button
                  type="button"
                  onClick={withdraw}
                  disabled={busy}
                  data-testid={`withdraw-confirm-${application.id}`}
                  className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {busy ? t("withdrawing") : t("withdraw")}
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

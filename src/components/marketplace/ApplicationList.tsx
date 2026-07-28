"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setApplicationStatus } from "@/lib/applications/actions";
import { confirmHandover } from "@/lib/reviews/actions";
import type { BuyerApplication } from "@/lib/applications/queries";

// D13: both sides of the same table. The seller decides, the buyer withdraws.
export function ApplicationList({
  applications,
  viewerId,
}: {
  applications: BuyerApplication[];
  viewerId: string;
}) {
  const t = useTranslations("applications");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function confirm(id: string) {
    setBusy(id);
    const result = await confirmHandover(id);
    setBusy(null);
    if (result.ok) router.refresh();
  }

  async function decide(id: string, status: "withdrawn" | "accepted" | "declined") {
    setBusy(id);
    const result = await setApplicationStatus(id, status);
    setBusy(null);
    if (result.ok) router.refresh();
  }

  if (applications.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground" data-testid="applications-empty">
        {t("empty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="applications-list">
      {applications.map((a) => {
        const viewerIsSeller = a.sellerId === viewerId;
        const counterparty = viewerIsSeller ? a.buyerUsername : a.sellerUsername;
        return (
          <li key={a.id} className="premium-panel rounded-2xl p-4" data-testid="application-row">
            <p className="eyebrow">
              {a.listingId ? t("kindApplication") : t("kindWaitlist")} · {t(`status.${a.status}`)}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {a.listingId && a.listingTitle ? (
                <Link href={`/listing/${a.listingId}`} className="text-brand-link underline">
                  {a.listingTitle}
                </Link>
              ) : (
                t("generalInterest")
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {viewerIsSeller ? t("fromBuyer") : t("toSeller")} @{counterparty ?? "—"}
            </p>
            {a.message && <p className="mt-2 text-sm">{a.message}</p>}

            {a.status === "accepted" && (
              <div className="mt-3">
                {(viewerIsSeller ? a.sellerConfirmedAt : a.buyerConfirmedAt) ? (
                  <p className="text-xs text-muted-foreground" data-testid={`handover-confirmed-${a.id}`}>
                    {a.buyerConfirmedAt && a.sellerConfirmedAt
                      ? t("handoverComplete")
                      : t("handoverAwaitingOther")}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => confirm(a.id)}
                    disabled={busy === a.id}
                    data-testid={`handover-confirm-${a.id}`}
                    className="min-h-11 w-full rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
                  >
                    {t("confirmHandover")}
                  </button>
                )}
              </div>
            )}

            {a.status === "submitted" && (
              <div className="mt-3 flex gap-2">
                {viewerIsSeller ? (
                  <>
                    <button
                      type="button"
                      onClick={() => decide(a.id, "accepted")}
                      disabled={busy === a.id}
                      data-testid={`application-accept-${a.id}`}
                      className="min-h-11 flex-1 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
                    >
                      {t("accept")}
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(a.id, "declined")}
                      disabled={busy === a.id}
                      data-testid={`application-decline-${a.id}`}
                      className="min-h-11 flex-1 rounded-xl border border-destructive/50 px-4 text-sm font-medium text-destructive disabled:opacity-50"
                    >
                      {t("decline")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => decide(a.id, "withdrawn")}
                    disabled={busy === a.id}
                    data-testid={`application-withdraw-${a.id}`}
                    className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
                  >
                    {t("withdraw")}
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

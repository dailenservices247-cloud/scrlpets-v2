"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/shop/format";
import { confirmDelivery } from "@/lib/jobs/actions";
import type { TransportJob } from "@/lib/jobs/queries";

/**
 * A driver's jobs, and the one action they own.
 *
 * The addresses are withheld by the database until the buyer's money is
 * captured, and this states WHY rather than showing an empty line. A blank field
 * reads as missing data; "shown once the buyer has paid" reads as a rule.
 */
export function JobList({ jobs }: { jobs: TransportJob[] }) {
  const t = useTranslations("jobs");

  if (jobs.length === 0) {
    return (
      <section className="premium-panel rounded-2xl p-4" data-testid="jobs-empty">
        <p className="text-sm font-medium">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
      </section>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="job-list">
      {jobs.map((job) => (
        <JobCard key={job.orderId} job={job} />
      ))}
    </ul>
  );
}

function JobCard({ job }: { job: TransportJob }) {
  const t = useTranslations("jobs");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The driver acts only at the door. Pickup is the seller's move — they hold the
  // scanner and the animal.
  const awaitingDelivery = job.status === "dispatched" && job.pickedUpAt !== null;

  async function deliver() {
    setBusy(true);
    setError(null);
    const result = await confirmDelivery(job.orderId, code);
    setBusy(false);
    if (!result.ok) {
      setError(
        result.error.includes("code_mismatch")
          ? t("errorWrongCode")
          : result.error.includes("never_picked_up")
            ? t("errorNotPickedUp")
            : result.error.includes("payments_disabled")
              ? t("errorPaymentsOff")
              : t("errorGeneric"),
      );
      return;
    }
    setCode("");
    router.refresh();
  }

  return (
    <li className="premium-panel rounded-2xl p-4" data-testid={`job-${job.orderId}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{job.title ?? t("untitled")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {job.pickupRegion} → {job.deliveryRegion}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{formatPrice(job.transportCents, "usd")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground" data-testid={`job-payout-${job.orderId}`}>
            {t(`payout.${job.payoutStatus ?? "none"}`)}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {t("parties", {
          seller: job.sellerUsername ?? "—",
          buyer: job.buyerUsername ?? "—",
        })}
      </p>

      {job.addressesVisible ? (
        <dl className="mt-3 flex flex-col gap-1 text-sm" data-testid={`job-addresses-${job.orderId}`}>
          <div>
            <dt className="text-xs text-muted-foreground">{t("pickup")}</dt>
            <dd>{job.pickupAddress ?? t("addressMissing")}</dd>
            {job.pickupContact && <dd className="text-xs text-muted-foreground">{job.pickupContact}</dd>}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("delivery")}</dt>
            <dd>{job.deliveryAddress ?? t("addressMissing")}</dd>
            {job.deliveryContact && (
              <dd className="text-xs text-muted-foreground">{job.deliveryContact}</dd>
            )}
          </div>
        </dl>
      ) : (
        // Stated as a rule, not rendered as a gap.
        <p className="mt-3 text-sm text-muted-foreground" data-testid={`job-addresses-hidden-${job.orderId}`}>
          {t("addressesHidden")}
        </p>
      )}

      {awaitingDelivery && (
        <div className="mt-3 flex flex-col gap-2" data-testid={`job-deliver-${job.orderId}`}>
          <label className="text-xs text-muted-foreground" htmlFor={`code-${job.orderId}`}>
            {t("codePrompt")}
          </label>
          <div className="flex gap-2">
            <input
              id={`code-${job.orderId}`}
              className="min-h-11 w-32 rounded-xl border border-input bg-transparent px-3 text-sm uppercase tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={8}
              data-testid={`job-code-${job.orderId}`}
            />
            <Button
              type="button"
              onClick={deliver}
              disabled={busy || code.trim().length < 6}
              data-testid={`job-confirm-${job.orderId}`}
            >
              {busy ? t("confirming") : t("confirmDelivery")}
            </Button>
          </div>
        </div>
      )}

      {job.handoverAt && (
        <p className="mt-3 text-sm" data-testid={`job-delivered-${job.orderId}`}>
          {t("delivered")}
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive" data-testid={`job-error-${job.orderId}`}>
          {error}
        </p>
      )}
    </li>
  );
}

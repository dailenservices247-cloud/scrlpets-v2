"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { startPayoutOnboarding, type PayoutStatus } from "@/lib/payments/actions";

/**
 * Four states, told apart on purpose.
 *
 * "Not enabled" would flatten three situations a seller must act on
 * differently: never started, started and still under review, and previously
 * working but Stripe has since asked for more. The third is the one that bites —
 * a seller whose account lapsed is silently unable to sell, and a vague message
 * gives them nothing to do about it.
 *
 * Stripe hosts the onboarding itself: Scrlpets never sees a bank account number
 * and cannot, which is the point of using Express accounts.
 */
export function PayoutSettings({ status }: { status: PayoutStatus }) {
  const t = useTranslations("payouts");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const result = await startPayoutOnboarding();
    if (!result.ok) {
      setBusy(false);
      setError(result.error === "not_configured" ? t("notConfigured") : t("couldNotStart"));
      return;
    }
    // Stripe's onboarding link is single-use and short-lived by design, so it is
    // followed immediately rather than stored or rendered as a link.
    window.location.href = result.url;
  }

  if (!status.configured) {
    return (
      <section className="premium-panel rounded-2xl p-4" data-testid="payouts-unconfigured">
        <p className="text-sm font-medium">{t("stateUnavailable")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("notConfigured")}</p>
      </section>
    );
  }

  const state = !status.hasAccount
    ? "none"
    : status.payoutsEnabled
      ? "ready"
      : status.detailsSubmitted
        ? "review"
        : "started";

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="payout-settings">
      <p className="text-sm font-medium" data-testid={`payout-state-${state}`}>
        {t(`state.${state}`)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t(`stateHelp.${state}`)}</p>

      {status.requirementsDue.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground" data-testid="payout-requirements">
          {status.requirementsDue.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {state !== "ready" && (
        <Button type="button" className="mt-3" onClick={start} disabled={busy} data-testid="payout-start">
          {busy ? t("opening") : t(state === "none" ? "startCta" : "continueCta")}
        </Button>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive" data-testid="payout-error">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{t("stripeHolds")}</p>
    </section>
  );
}

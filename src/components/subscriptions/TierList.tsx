"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { subscribeToTier } from "@/lib/subscriptions/actions";
import { formatPrice } from "@/lib/shop/format";
import type { SubscriptionTier } from "@/lib/subscriptions/queries";

/**
 * A plan changes the seller's fee RATE and nothing else — the seller pays the
 * fee on every tier, so a buyer never sees a different price. There is no
 * listing quota to display because none exists in the schema.
 *
 * While subscriptions are off, no tier renders a button: a control that always
 * fails is a worse lie than saying plainly that plans are not switched on.
 */
export function TierList({
  tiers,
  enabled,
  currentTierKey,
}: {
  tiers: SubscriptionTier[];
  enabled: boolean;
  currentTierKey: string | null;
}) {
  const t = useTranslations("subscriptions");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(tier: SubscriptionTier) {
    setBusy(tier.key);
    setError(null);
    const result = await subscribeToTier(tier.key);
    setBusy(null);
    if (!result.ok) {
      setError(
        result.error.includes("subscriptions_disabled")
          ? t("notEnabled")
          : result.error.includes("tier_not_available")
            ? t("tierNotAvailable")
            : result.error,
      );
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3" data-testid="tier-list">
      {tiers.map((tier) => (
        <div key={tier.key} className="premium-panel rounded-2xl p-4" data-testid={`tier-${tier.key}`}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">{tier.name}</p>
            <span className="shrink-0 text-sm font-semibold">
              {tier.monthlyPriceCents === 0
                ? t("freePrice")
                : t("perMonth", { amount: formatPrice(tier.monthlyPriceCents, "usd") })}
            </span>
          </div>

          <p className="mt-1 text-xs font-medium">
            {t("feeRate", { rate: (tier.feeBps / 100).toFixed(2) })}
          </p>
          {tier.description && (
            <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>
          )}

          {currentTierKey === tier.key && (
            <p className="mt-2 text-xs text-muted-foreground" data-testid={`tier-current-${tier.key}`}>
              {t("currentPlan")}
            </p>
          )}

          {enabled && tier.enabled && currentTierKey !== tier.key && (
            <button
              type="button"
              onClick={() => subscribe(tier)}
              disabled={busy === tier.key}
              data-testid={`tier-subscribe-${tier.key}`}
              className="mt-3 min-h-11 w-full rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
            >
              {t("choosePlan")}
            </button>
          )}
        </div>
      ))}

      {!enabled && (
        <p className="text-xs text-muted-foreground" data-testid="subscriptions-off">
          {t("notEnabled")}
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive" data-testid="subscription-error">
          {error}
        </p>
      )}
    </div>
  );
}

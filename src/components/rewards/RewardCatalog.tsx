"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { redeemReward } from "@/lib/rewards/actions";
import type { Reward } from "@/lib/rewards/queries";

/**
 * Redemptions buy goods and fee credit, never money and never reach. There is
 * no cash option and no 'cash' kind exists in the schema — adding one is a
 * legal decision, not a code change.
 *
 * Spending is charged to the BALANCE and never to standing. Legacy paid rewards
 * out of the same number its ladder was computed from, so redeeming demoted
 * you; the two numbers are now separate all the way down to the SQL.
 *
 * While payments are off, the fee credit renders no button. A discount on a fee
 * that does not exist would burn real points for nothing, and a control that
 * always fails is a worse lie than saying plainly that it is not switched on —
 * the same call /settings/subscription makes for plans.
 */
export function RewardCatalog({
  rewards,
  balance,
  paymentsEnabled,
}: {
  rewards: Reward[];
  balance: number;
  paymentsEnabled: boolean;
}) {
  const t = useTranslations("rewards");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function redeem(reward: Reward) {
    setBusy(reward.key);
    setError(null);
    const result = await redeemReward(reward.key);
    setBusy(null);
    if (!result.ok) {
      setError(
        result.error.includes("insufficient_points")
          ? t("notEnoughPoints")
          : result.error.includes("payments_disabled")
            ? t("feeCreditNotLive")
            : result.error.includes("reward_not_available")
              ? t("notAvailable")
              : result.error,
      );
      return;
    }
    router.refresh();
  }

  /**
   * An empty shelf is the honest state now, not a bug. The one thing points buy
   * is a discount applied to a specific order's platform fee at checkout, which
   * cannot be a catalogue row: a flat credit has no order in scope, and so no
   * fee to be capped at half of. Saying that here matters — an empty container
   * is literally how this page broke when the last reward was switched off.
   */
  if (rewards.length === 0) {
    return (
      <div className="premium-panel rounded-2xl p-4" data-testid="reward-catalog-empty">
        <p className="text-sm font-medium">{t("catalogEmptyHeading")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("catalogEmptyBody")}</p>
        {!paymentsEnabled && (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="reward-catalog-not-live">
            {t("catalogEmptyNotLive")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="reward-catalog">
      {rewards.map((r) => {
        const affordable = balance >= r.costPoints;
        // Everything here is enabled — getCatalog() filters withdrawn rewards
        // out rather than advertising them. The only remaining gate is money.
        const live = r.kind !== "fee_credit" || paymentsEnabled;
        return (
          <div key={r.key} className="premium-panel rounded-2xl p-4" data-testid={`reward-${r.key}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">{r.title}</p>
              <span className="shrink-0 text-sm font-semibold">{r.costPoints}</span>
            </div>
            {r.description && (
              <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
            )}

            <p className="mt-2 text-xs text-muted-foreground">{t("spendsBalanceOnly")}</p>

            {live ? (
              <button
                type="button"
                onClick={() => redeem(r)}
                disabled={busy === r.key || !affordable}
                data-testid={`reward-redeem-${r.key}`}
                className="mt-3 min-h-11 w-full rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
              >
                {affordable ? t("redeem") : t("needMore", { n: r.costPoints - balance })}
              </button>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground" data-testid={`reward-not-live-${r.key}`}>
                {t("feeCreditNotLive")}
              </p>
            )}
          </div>
        );
      })}
      {error && (
        <p className="text-xs text-destructive" data-testid="reward-error">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { redeemReward } from "@/lib/rewards/actions";
import type { Reward } from "@/lib/rewards/queries";

/**
 * Redemptions buy distribution, never money. There is no cash option and no
 * 'cash' kind exists in the schema — adding one is a legal decision, not a
 * code change. Boosts are labelled as promoted wherever they appear.
 */
export function RewardCatalog({
  rewards,
  balance,
  boostablePosts,
}: {
  rewards: Reward[];
  balance: number;
  boostablePosts: { id: string; label: string }[];
}) {
  const t = useTranslations("rewards");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postFor, setPostFor] = useState<Record<string, string>>({});

  async function redeem(reward: Reward) {
    setBusy(reward.key);
    setError(null);
    const target = reward.kind === "visibility" ? postFor[reward.key] : undefined;
    const result = await redeemReward(reward.key, target);
    setBusy(null);
    if (!result.ok) {
      setError(
        result.error.includes("insufficient_points")
          ? t("notEnoughPoints")
          : result.error.includes("target_post_required")
            ? t("choosePost")
            : result.error.includes("reward_not_available")
              ? t("notAvailable")
              : result.error,
      );
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3" data-testid="reward-catalog">
      {rewards.map((r) => {
        const affordable = balance >= r.costPoints;
        return (
          <div key={r.key} className="premium-panel rounded-2xl p-4" data-testid={`reward-${r.key}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">{r.title}</p>
              <span className="shrink-0 text-sm font-semibold">{r.costPoints}</span>
            </div>
            {r.description && (
              <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
            )}

            {!r.enabled && (
              <p className="mt-2 text-xs text-muted-foreground" data-testid={`reward-disabled-${r.key}`}>
                {t("pendingLegalReview")}
              </p>
            )}

            {r.enabled && r.kind === "visibility" && (
              <label className="mt-3 block text-xs">
                <span className="text-muted-foreground">{t("choosePostLabel")}</span>
                <select
                  value={postFor[r.key] ?? ""}
                  onChange={(e) => setPostFor((p) => ({ ...p, [r.key]: e.target.value }))}
                  data-testid={`reward-post-${r.key}`}
                  className="mt-1 min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">{t("selectPost")}</option>
                  {boostablePosts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {r.enabled && (
              <button
                type="button"
                onClick={() => redeem(r)}
                disabled={busy === r.key || !affordable}
                data-testid={`reward-redeem-${r.key}`}
                className="mt-3 min-h-11 w-full rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
              >
                {affordable ? t("redeem") : t("needMore", { n: r.costPoints - balance })}
              </button>
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

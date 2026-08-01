import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { RewardCatalog } from "@/components/rewards/RewardCatalog";
import {
  STANDING_TIERS,
  getBadges,
  getBalance,
  getCatalog,
  getLedger,
  getMyRedemptions,
  getStanding,
} from "@/lib/rewards/queries";
import { isPaymentsEnabled } from "@/lib/orders/queries";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Two numbers, deliberately not one.
 *
 * STANDING is earned and never falls — it counts completed handovers, reviews
 * other people wrote about you, and capped account age. BALANCE is spendable
 * and falls when you redeem. Legacy computed its ladder from the balance and
 * paid rewards out of it, so redeeming demoted you. Separating them is the fix,
 * and the page says so out loud rather than leaving it to be inferred.
 *
 * Nothing here claims a fee is charged. Standing's ladder is real and ruled,
 * but payments are off and no code path reads standing to price anything yet,
 * so the ladder renders under a plain "not switched on" notice.
 */
export default async function RewardsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [t, standing, balance, ledger, catalog, redemptions, badges, paymentsEnabled] =
    await Promise.all([
      getTranslations("rewards"),
      getStanding(),
      getBalance(),
      getLedger(),
      getCatalog(),
      getMyRedemptions(),
      getBadges(),
      isPaymentsEnabled(),
    ]);

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>

      {standing && (
        <section className="px-3 pb-3">
          <div className="premium-panel rounded-2xl p-4" data-testid="standing-panel">
            <p className="eyebrow">{t("standingHeading")}</p>
            <p className="mt-1 text-4xl font-semibold" data-testid="standing-points">
              {standing.standingPoints}
            </p>
            <p className="mt-1 text-sm font-medium" data-testid="standing-tier">
              {t("standingTier", { tier: standing.tier, of: STANDING_TIERS })}
            </p>

            {/* The whole point of the change, stated where it is doubted. */}
            <p className="mt-2 text-xs font-medium" data-testid="standing-never-falls">
              {t("standingNeverFalls")}
            </p>

            <ul className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
              <li data-testid="standing-input-handovers">
                {t("standingFromHandovers", { count: standing.handovers })}
              </li>
              <li data-testid="standing-input-reviews">
                {t("standingFromReviews", { count: standing.reviewsReceived })}
              </li>
              <li data-testid="standing-input-tenure">
                {t("standingFromTenure", { count: standing.tenureMonths })}
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{t("standingNotPoints")}</p>

            {/* Honest about the ladder: ruled, wired to nothing, off. */}
            <p className="mt-3 text-xs text-muted-foreground" data-testid="standing-fee-ladder">
              {t("feeLadder", { rate: (standing.tierFeeBps / 100).toFixed(2) })}
            </p>
            {!paymentsEnabled && (
              <p className="mt-1 text-xs text-muted-foreground" data-testid="fees-not-live">
                {t("feesNotLive")}
              </p>
            )}
          </div>
        </section>
      )}

      <section className="px-3 pb-3">
        <div className="premium-panel rounded-2xl p-4" data-testid="balance-panel">
          <p className="eyebrow">{t("balance")}</p>
          <p className="mt-1 text-4xl font-semibold" data-testid="points-balance">
            {balance}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{t("earnHelp")}</p>
          <p className="mt-2 text-xs text-muted-foreground" data-testid="balance-vs-standing">
            {t("balanceIsSeparate")}
          </p>
        </div>
      </section>

      {badges.length > 0 && (
        <section className="px-3 pb-3">
          <h2 className="pb-2 text-sm font-semibold">{t("badgesHeading")}</h2>
          <div className="flex flex-wrap gap-2" data-testid="badges">
            {badges.map((b) => (
              <span
                key={b.key}
                className="rounded-full border border-secondary/40 bg-secondary/15 px-3 py-1 text-xs text-secondary-foreground"
                data-testid={`badge-${b.key}`}
              >
                {t(`badge.${b.key}`, { count: b.count })}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("badgesNotice")}</p>
        </section>
      )}

      <section className="px-3 pb-3">
        <h2 className="pb-2 text-sm font-semibold">{t("spendHeading")}</h2>
        <RewardCatalog rewards={catalog} balance={balance} paymentsEnabled={paymentsEnabled} />
      </section>

      {redemptions.length > 0 && (
        <section className="px-3 pb-3">
          <h2 className="pb-2 text-sm font-semibold">{t("redemptionsHeading")}</h2>
          <ul className="flex flex-col gap-2" data-testid="redemptions">
            {redemptions.map((r) => (
              <li key={r.id} className="rounded-xl border bg-card p-3 text-sm">
                <span className="font-medium">{r.rewardKey}</span> ·{" "}
                <span className="text-muted-foreground">
                  {r.pointsSpent} · {t(`redemptionStatus.${r.status}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="px-3 pb-6">
        <h2 className="pb-2 text-sm font-semibold">{t("historyHeading")}</h2>
        {ledger.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" data-testid="ledger-empty">
            {t("noHistory")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="ledger">
            {ledger.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 border-b py-2 text-sm">
                <span className="text-muted-foreground">{e.reason}</span>
                <span className={e.delta > 0 ? "font-medium text-secondary-foreground" : "font-medium"}>
                  {e.delta > 0 ? `+${e.delta}` : e.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppPage>
  );
}

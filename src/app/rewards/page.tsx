import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { RewardCatalog } from "@/components/rewards/RewardCatalog";
import {
  getBadges,
  getBalance,
  getBoostablePosts,
  getCatalog,
  getLedger,
  getMyRedemptions,
} from "@/lib/rewards/queries";
import { getSessionUser } from "@/lib/auth/session";

// Points pay for the behaviours that make a marketplace work before there is
// enough volume to make them worth doing. Nothing here converts to cash.
export default async function RewardsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [t, balance, ledger, catalog, redemptions, badges, posts] = await Promise.all([
    getTranslations("rewards"),
    getBalance(),
    getLedger(),
    getCatalog(),
    getMyRedemptions(),
    getBadges(),
    getBoostablePosts(),
  ]);

  return (
    <AppPage>
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      </header>

      <section className="px-3 pb-3">
        <div className="premium-panel rounded-2xl p-4">
          <p className="eyebrow">{t("balance")}</p>
          <p className="mt-1 text-4xl font-semibold" data-testid="points-balance">
            {balance}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{t("earnHelp")}</p>
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
        <RewardCatalog rewards={catalog} balance={balance} boostablePosts={posts} />
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

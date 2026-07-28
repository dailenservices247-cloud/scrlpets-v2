import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { TierList } from "@/components/subscriptions/TierList";
import {
  getMySubscription,
  getTiers,
  isSubscriptionsEnabled,
} from "@/lib/subscriptions/queries";

// Subscription MRR is the revenue model: a plan buys a lower fee rate on the
// seller's own sales. It buys no reach, no ranking, and no listing headroom.
export default async function SubscriptionSettingsPage() {
  const [t, tiers, subscription, enabled] = await Promise.all([
    getTranslations("subscriptions"),
    getTiers(),
    getMySubscription(),
    isSubscriptionsEnabled(),
  ]);

  return (
    <AppPage>
      <header className="flex items-center justify-between px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href="/menu" className="text-sm text-brand-link underline">
          {t("back")}
        </Link>
      </header>

      <section className="px-3 pb-3">
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        {/* Said on the page, not just in the schema: the plan never moves the
            fee onto the buyer, so nobody shops a seller's plan. */}
        <p className="mt-2 text-xs text-muted-foreground">{t("sellerPaysNotice")}</p>
      </section>

      {subscription && (
        <section className="px-3 pb-3">
          <div className="premium-panel rounded-2xl p-4" data-testid="current-subscription">
            <p className="eyebrow">{t("currentHeading")}</p>
            <p className="mt-1 text-sm font-semibold">{subscription.tierKey}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(`status.${subscription.status}`)}
            </p>
          </div>
        </section>
      )}

      <section className="px-3 pb-6">
        <h2 className="pb-2 text-sm font-semibold">{t("plansHeading")}</h2>
        <TierList
          tiers={tiers}
          enabled={enabled}
          currentTierKey={subscription?.status === "active" ? subscription.tierKey : null}
        />
      </section>
    </AppPage>
  );
}

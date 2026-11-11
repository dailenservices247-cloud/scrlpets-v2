import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { TierList } from "@/components/subscriptions/TierList";
import { PausePanel } from "@/components/subscriptions/PausePanel";
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
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
          <Link
            href="/settings"
            className="grid size-9 place-items-center rounded-xl border border-border/70 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-muted/60 hover:text-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </header>

        <section className="mb-6 rounded-2xl border border-border/70 bg-card/40 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">{t("sellerPaysNotice")}</p>
        </section>

        {subscription && (
          <section className="mb-6">
            <div className="premium-panel rounded-2xl p-4" data-testid="current-subscription">
              <p className="eyebrow">{t("currentHeading")}</p>
              <p className="mt-1 text-sm font-semibold">{subscription.tierKey}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(`status.${subscription.status}`)}
              </p>
            </div>
            <div className="pt-3">
              <PausePanel
                subscription={subscription}
                tier={tiers.find((tier) => tier.key === subscription.tierKey) ?? null}
              />
            </div>
          </section>
        )}

        <section className="pb-6">
          <TierList tiers={tiers} currentTierKey={subscription?.tierKey ?? null} enabled={enabled} />
        </section>
      </div>
    </AppPage>
  );
}

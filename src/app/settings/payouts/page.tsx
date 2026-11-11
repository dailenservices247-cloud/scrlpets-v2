import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { getPayoutStatus } from "@/lib/payments/actions";
import { PayoutSettings } from "@/components/payments/PayoutSettings";

/**
 * Where a seller connects the account their money arrives in.
 *
 * Nothing else in the commerce chain works without this: create_order refuses a
 * seller who cannot receive payouts, and the transporter gate refuses a driver
 * for the same reason. It is the first link, not a settings detail.
 */
export default async function PayoutSettingsPage() {
  const t = await getTranslations("payouts");
  await getSessionUser(); // proxy gates /settings
  const status = await getPayoutStatus();

  return (
    <AppPage>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage your connected banking, payout frequency, and Stripe balance.
            </p>
          </div>
          <Link
            href="/settings"
            className="grid size-9 place-items-center rounded-xl border border-border/70 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-muted/60 hover:text-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </header>
        <div className="pb-6">
          <PayoutSettings status={status} />
        </div>
      </div>
    </AppPage>
  );
}

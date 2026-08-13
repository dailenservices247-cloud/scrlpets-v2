import Link from "next/link";
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
      <header className="flex items-center justify-between px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href="/menu" className="text-sm text-brand-link underline">
          {t("back")}
        </Link>
      </header>
      <div className="px-3 pb-6">
        <PayoutSettings status={status} />
      </div>
    </AppPage>
  );
}

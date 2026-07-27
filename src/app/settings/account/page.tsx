import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { AccountSettings } from "@/components/account/AccountSettings";

// R10: account safety surface (email, password, export, deletion).
export default async function AccountSettingsPage() {
  const t = await getTranslations("account");
  const user = (await getSessionUser())!; // proxy gates /settings
  return (
    <AppPage>
      <header className="flex items-center justify-between px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href="/menu" className="text-sm text-brand-link underline">
          {t("back")}
        </Link>
      </header>
      <div className="px-3 pb-6">
        <AccountSettings currentEmail={user.email ?? ""} />
      </div>
    </AppPage>
  );
}

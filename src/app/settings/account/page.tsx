import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { AccountSettings } from "@/components/account/AccountSettings";
import { MfaPanel } from "@/components/account/MfaPanel";
import { recoveryCodesRemaining } from "@/lib/mfa/actions";
import { createClient } from "@/lib/supabase/server";

// R10: account safety surface (email, password, export, deletion).
export default async function AccountSettingsPage() {
  const t = await getTranslations("account");
  const user = (await getSessionUser())!; // proxy gates /settings

  // Read from the SESSION rather than a profile column: Supabase owns factor
  // state, and a mirrored copy would be the thing that goes stale.
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const enrolled = (factors?.totp ?? []).some((f) => f.status === "verified");
  const codesLeft = enrolled ? await recoveryCodesRemaining() : 0;

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
        <MfaPanel enrolled={enrolled} codesLeft={codesLeft} />
      </div>
    </AppPage>
  );
}

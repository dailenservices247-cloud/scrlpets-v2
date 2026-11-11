import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage your credentials, two-factor authentication, and account safety.
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
        <div className="space-y-6">
          <AccountSettings currentEmail={user.email ?? ""} />
          <MfaPanel enrolled={enrolled} codesLeft={codesLeft} />
        </div>
      </div>
    </AppPage>
  );
}

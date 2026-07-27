import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { getMyCreatures } from "@/lib/compose/actions";
import { VerificationPanel } from "@/components/verification/VerificationPanel";
import { getAttestedCreatureIds, getMyTrustState } from "@/lib/verification/queries";
import { isIdentityConfigured } from "@/lib/verification/stripe-identity";

// Phase 2: the person's own trust surface.
export default async function VerificationPage() {
  const t = await getTranslations("verification");
  await getSessionUser(); // proxy gates /settings
  const [state, creatures] = await Promise.all([getMyTrustState(), getMyCreatures()]);
  const attested = await getAttestedCreatureIds(creatures.map((c) => c.id));

  return (
    <AppPage>
      <header className="flex items-center justify-between px-3 pb-3 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Link href="/menu" className="text-sm text-brand-link underline">
          {t("back")}
        </Link>
      </header>
      <div className="px-3 pb-6">
        <VerificationPanel
          state={state}
          creatures={creatures}
          attestedIds={[...attested]}
          identityConfigured={isIdentityConfigured()}
        />
      </div>
    </AppPage>
  );
}

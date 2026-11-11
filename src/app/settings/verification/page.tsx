import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { getMyCreatures } from "@/lib/compose/actions";
import { VerificationPanel } from "@/components/verification/VerificationPanel";
import { getAttestedCreatureIds, getMyTrustState } from "@/lib/verification/queries";
import { isIdentityConfigured } from "@/lib/verification/stripe-identity";
import { getStandingPolicy, getSellerComplianceProfile } from "@/lib/contracts/queries";

// Phase 2: the person's own trust surface.
export default async function VerificationPage() {
  const t = await getTranslations("verification");
  const user = await getSessionUser(); // proxy gates /settings
  const [state, creatures, standingPolicy, complianceProfile] = await Promise.all([
    getMyTrustState(),
    getMyCreatures(),
    user ? getStandingPolicy(user.id) : null,
    user ? getSellerComplianceProfile(user.id) : null,
  ]);
  const attested = await getAttestedCreatureIds(creatures.map((c) => c.id));

  return (
    <AppPage>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t("title")}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Verify your identity, attest companion lineage, and maintain seller standing.
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
          <VerificationPanel
            state={state}
            creatures={creatures}
            attestedIds={[...attested]}
            identityConfigured={isIdentityConfigured()}
            standingPolicy={standingPolicy}
            complianceProfile={complianceProfile}
          />
        </div>
      </div>
    </AppPage>
  );
}

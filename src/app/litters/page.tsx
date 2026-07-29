import Link from "next/link";
import { PawPrint } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { LittersPanel } from "@/components/litters/LittersPanel";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { listMyLitters, listOwnBreedingCreatures, listOwnCreatures } from "@/lib/litters/queries";

export const dynamic = "force-dynamic";


export const metadata = {
  title: "Your litters",
  description: "Record keeping for litters you own on Scrlpets.",
};

// Not middleware-gated (see src/lib/auth/access.ts) — this page renders its
// own sign-in prompt instead of redirecting, matching /tree's build spec.
export default async function LittersPage() {
  const t = await getTranslations("litters");
  const user = await getSessionUser();

  if (!user) {
    return (
      <AppPage>
        <section className="px-3 pb-3 pt-4" data-testid="litters-signin-prompt">
          <div className="premium-panel rounded-2xl p-6 text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-accent/35 bg-accent/15 text-accent">
              <PawPrint className="size-7" aria-hidden />
            </div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-1 text-2xl font-semibold">{t("signInTitle")}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {t("signInBody")}
            </p>
            <Link
              href={loginHrefFor("/litters")}
              data-testid="litters-signin-cta"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
            >
              {t("signInCta")}
            </Link>
          </div>
        </section>
      </AppPage>
    );
  }

  const [litters, breedingCreatures, linkableCreatures] = await Promise.all([
    listMyLitters(user.id),
    listOwnBreedingCreatures(user.id),
    listOwnCreatures(user.id),
  ]);

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("subtitle")}</p>
      </section>
      <LittersPanel
        litters={litters}
        breedingCreatures={breedingCreatures}
        linkableCreatures={linkableCreatures}
      />
    </AppPage>
  );
}

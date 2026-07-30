import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { SpeciesInterests } from "@/components/onboarding/SpeciesInterests";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor, safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * One screen, answered once. `onboarded_at` is written whether someone picks
 * interests or skips, so this never shows twice — and the gate is here rather
 * than in PROTECTED_PREFIXES, which stays a pure signed-in/signed-out rule.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getSessionUser();
  if (!user) {
    redirect(loginHrefFor(`/onboarding?next=${encodeURIComponent(nextPath)}`));
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("onboarded_at,species_interests")
    .eq("id", user.id)
    .maybeSingle();
  if (data?.onboarded_at) redirect(nextPath);

  const t = await getTranslations("onboarding");
  return (
    <AppPage showBottomNav={false}>
      <header className="px-4 pb-2 pt-8">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("body")}</p>
      </header>
      <SpeciesInterests
        nextPath={nextPath}
        initial={(data?.species_interests as string[] | null) ?? []}
      />
    </AppPage>
  );
}

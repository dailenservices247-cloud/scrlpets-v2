import { redirect } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { BreederBranch } from "@/components/onboarding/BreederBranch";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor, safeNextPath } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";

/**
 * Reachable only after the species step, but it does NOT re-gate on
 * `onboarded_at` — that flag is already set by then, and gating here would make
 * the branch unreachable the moment it is needed.
 */
export default async function BreederOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor(`/onboarding/breeder?next=${encodeURIComponent(nextPath)}`));

  return (
    <AppPage showBottomNav={false}>
      <BreederBranch nextPath={nextPath} />
    </AppPage>
  );
}

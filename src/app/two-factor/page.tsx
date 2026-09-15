import { redirect } from "next/navigation";
import { TwoFactorChallenge } from "@/components/auth/TwoFactorChallenge";
import { loginHrefFor, safeNextPath } from "@/lib/auth/redirect";
import { owesSecondFactor } from "@/lib/auth/second-factor";
import { createClient } from "@/lib/supabase/server";

/**
 * The one page a session that owes its second factor can open (proxy.ts).
 *
 * Re-checks rather than trusting the redirect: a member who already passed goes
 * straight on, and a visitor with no session is sent to sign in.
 */
export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(loginHrefFor(nextPath));
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!owesSecondFactor(user.factors, session?.access_token)) redirect(nextPath);

  const factor = user.factors?.find(
    (candidate) => candidate.factor_type === "totp" && candidate.status === "verified",
  );
  return <TwoFactorChallenge nextPath={nextPath} factorId={factor?.id ?? null} />;
}

import { LoginForm } from "@/components/auth/LoginForm";
import { safeAuthErrorKey, safeAuthNoticeKey } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/redirect";
import { sanitizeReferralCode } from "@/lib/referrals/code";
import { getSessionUser } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    next?: string;
    notice?: string;
    mode?: string;
    ref?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const nextPath = safeNextPath(params.next);
  return (
    <LoginForm
      currentUserEmail={user?.email ?? null}
      nextPath={nextPath}
      initialError={safeAuthErrorKey(params.error)}
      notice={safeAuthNoticeKey(params.notice)}
      initialMode={params.mode === "signup" ? "signup" : "signin"}
      referralCode={sanitizeReferralCode(params.ref)}
    />
  );
}

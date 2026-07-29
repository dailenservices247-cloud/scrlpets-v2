import { LoginForm } from "@/components/auth/LoginForm";
import { safeAuthErrorKey, safeAuthNoticeKey } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/redirect";
import { sanitizeReferralCode } from "@/lib/referrals/code";

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
  const nextPath = safeNextPath(params.next);
  return (
    <LoginForm
      nextPath={nextPath}
      initialError={safeAuthErrorKey(params.error)}
      notice={safeAuthNoticeKey(params.notice)}
      initialMode={params.mode === "signup" ? "signup" : "signin"}
      referralCode={sanitizeReferralCode(params.ref)}
    />
  );
}

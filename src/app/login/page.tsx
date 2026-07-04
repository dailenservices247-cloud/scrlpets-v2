import { LoginForm } from "@/components/auth/LoginForm";
import { safeAuthErrorKey, safeAuthNoticeKey } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  return (
    <LoginForm
      nextPath={nextPath}
      initialError={safeAuthErrorKey(params.error)}
      notice={safeAuthNoticeKey(params.notice)}
    />
  );
}

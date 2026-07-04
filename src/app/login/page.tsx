import { LoginForm } from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/auth/redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = safeNextPath((await searchParams).next);
  return <LoginForm nextPath={nextPath} />;
}

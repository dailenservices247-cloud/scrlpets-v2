import { redirect } from "next/navigation";

/**
 * Referral links point at /signup?ref=CODE, but auth lives at /login with a
 * signin/signup toggle. This preserves the ref value across the redirect so an
 * invite is not lost the moment someone clicks it.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const params = new URLSearchParams({ mode: "signup" });
  if (ref) params.set("ref", ref);
  redirect(`/login?${params.toString()}`);
}

"use server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sanitizeReferralCode } from "@/lib/referrals/code";
import { authErrorKey, type AuthErrorKey } from "./errors";
import { passwordProblems } from "./password";
import { safeNextPath } from "./redirect";

export type SignUpResult =
  /** Confirmation email sent; no session yet. */
  | { status: "verify" }
  /** Confirmation is off (dev/E2E): cookies are already set on this response. */
  | { status: "session" }
  | { status: "already_registered" }
  | { status: "error"; error: AuthErrorKey };

/** The origin the visitor actually used, so confirmation links work off-prod. */
async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    return (
      process.env.NEXT_PUBLIC_SITE_URL || "https://scrlpets-v2.vercel.app"
    ).replace(/\/$/, "");
  }
  return `${headerList.get("x-forwarded-proto") ?? "http"}://${host}`;
}

/**
 * Signup runs HERE, not in the browser, because the password rule has to be a
 * control rather than a suggestion — a scripted POST straight at Supabase would
 * sail past any client-side check, and the same is true of the age checkbox.
 * Both are re-decided on the server; the form's copy just mirrors the answer.
 *
 * ponytail: sign-IN stays in the browser. Moving it here would mean re-homing
 * the whole session handshake for no security gain, since the lockout counter
 * it depends on is already a SECURITY DEFINER decision in the database.
 */
export async function signUpWithPassword(formData: FormData): Promise<SignUpResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ageConfirmed = formData.get("ageConfirmed") === "true";
  const referralCode = sanitizeReferralCode(formData.get("referralCode") as string | null);
  const nextPath = safeNextPath(formData.get("nextPath") as string | null);

  if (!email || !password) return { status: "error", error: "unknown" };
  if (passwordProblems(password).length > 0) {
    return { status: "error", error: "weak_password" };
  }
  // The checkbox is `required` in the markup too, but markup is not a gate.
  if (!ageConfirmed) return { status: "error", error: "age_unconfirmed" };

  // New accounts meet onboarding first and continue to wherever they were
  // headed afterwards. Routed through the `next` the callback already honours,
  // so a confirmation link opened on another device lands the same way.
  const afterConfirm = `/onboarding?next=${encodeURIComponent(nextPath)}`;
  const callback = new URL("/auth/callback", await requestOrigin());
  callback.searchParams.set("next", afterConfirm);
  if (referralCode) callback.searchParams.set("ref", referralCode);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callback.toString(),
      // The confirmation link may be opened on another device, where the ref
      // query param no longer exists. Metadata survives the hop; the callback
      // claims it and clears the key.
      ...(referralCode ? { data: { referral_code: referralCode } } : {}),
    },
  });
  if (error) return { status: "error", error: authErrorKey(error.message) };
  // With email confirmation on, Supabase obfuscates existing confirmed accounts
  // as a success with no identities — no email will arrive.
  if (data.user && data.user.identities?.length === 0) {
    return { status: "already_registered" };
  }
  if (!data.session) return { status: "verify" };
  // Confirmation off (dev/E2E): the session exists right here and no callback
  // will ever run, so this is the only chance to claim. Best effort — every
  // real refusal lives in the definer and stays silent.
  if (referralCode) await supabase.rpc("claim_referral", { code: referralCode });
  return { status: "session" };
}

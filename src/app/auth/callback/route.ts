import { NextResponse } from "next/server";
import type { EmailOtpType, SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { sanitizeReferralCode } from "@/lib/referrals/code";

const OTP_TYPES: ReadonlySet<string> = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/**
 * Best-effort referral claim, once a session exists. The code arrives either as
 * a callback query param (OAuth path) or in signup metadata (email path, which
 * may complete on a different device). Refusals are the definer's job and stay
 * silent — a brand-new user should never see referral noise. The metadata key
 * is cleared after the attempt so later sign-ins don't re-fire the RPC forever.
 */
async function attemptReferralClaim(
  supabase: SupabaseClient,
  user: User | null,
  refParam: string | null,
) {
  const metaRef = sanitizeReferralCode(user?.user_metadata?.referral_code);
  const code = sanitizeReferralCode(refParam) ?? metaRef;
  if (code) await supabase.rpc("claim_referral", { code });
  if (metaRef) await supabase.auth.updateUser({ data: { referral_code: null } });
}

function failureRedirect(origin: string, nextPath: string, errorCode: string | null) {
  const login = new URL("/login", origin);
  // Expired links get recovery-appropriate copy instead of the generic failure.
  login.searchParams.set(
    "error",
    errorCode === "otp_expired" ? "link_expired" : "confirmation_failed",
  );
  login.searchParams.set("next", nextPath);
  return NextResponse.redirect(login);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type");
  const nextPath = safeNextPath(searchParams.get("next"));
  const providerErrorCode = searchParams.get("error_code");

  if (providerErrorCode || searchParams.get("error")) {
    return failureRedirect(origin, nextPath, providerErrorCode);
  }

  const supabase = await createClient();

  // token_hash links work in any browser/device; PKCE `code` links only work
  // in the browser that initiated the flow.
  if (tokenHash && otpType && OTP_TYPES.has(otpType)) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: otpType as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) {
      return failureRedirect(origin, nextPath, "otp_expired");
    }
    await attemptReferralClaim(supabase, data.user, searchParams.get("ref"));
    return NextResponse.redirect(
      new URL(otpType === "recovery" ? "/reset-password" : nextPath, origin),
    );
  }

  if (!code) {
    return failureRedirect(origin, nextPath, null);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return failureRedirect(origin, nextPath, null);
  }

  await attemptReferralClaim(supabase, data.user, searchParams.get("ref"));
  return NextResponse.redirect(new URL(nextPath, origin));
}

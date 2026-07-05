import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";

const OTP_TYPES: ReadonlySet<string> = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

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
    const { error } = await supabase.auth.verifyOtp({
      type: otpType as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) {
      return failureRedirect(origin, nextPath, "otp_expired");
    }
    return NextResponse.redirect(
      new URL(otpType === "recovery" ? "/reset-password" : nextPath, origin),
    );
  }

  if (!code) {
    return failureRedirect(origin, nextPath, null);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return failureRedirect(origin, nextPath, null);
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}

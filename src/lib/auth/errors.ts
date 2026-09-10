export type AuthErrorKey =
  | "age_unconfirmed"
  | "already_registered"
  | "code_invalid"
  | "confirmation_failed"
  | "email_not_confirmed"
  | "invalid_credentials"
  | "link_expired"
  | "locked_out"
  | "rate_limited"
  | "unknown"
  | "weak_password";

const AUTH_ERROR_KEYS = new Set<AuthErrorKey>([
  "age_unconfirmed",
  "already_registered",
  "code_invalid",
  "confirmation_failed",
  "email_not_confirmed",
  "invalid_credentials",
  "link_expired",
  "locked_out",
  "rate_limited",
  "unknown",
  "weak_password",
]);

export function authErrorKey(message: string): AuthErrorKey {
  const normalized = message.toLowerCase();
  if (normalized.includes("email not confirmed")) return "email_not_confirmed";
  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists")
  ) {
    return "already_registered";
  }
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials")
  ) {
    return "invalid_credentials";
  }
  // Supabase's own password policy can refuse before ours does (its minimum is
  // configured per project): "Password should be at least N characters".
  if (normalized.includes("password") && normalized.includes("should be")) {
    return "weak_password";
  }
  if (
    normalized.includes("expired") ||
    normalized.includes("otp") ||
    normalized.includes("session missing")
  ) {
    return "link_expired";
  }
  if (
    normalized.includes("rate") ||
    normalized.includes("too many") ||
    // Supabase per-user cooldown: "For security purposes, you can only request this after N seconds"
    normalized.includes("security purposes")
  ) {
    return "rate_limited";
  }
  return "unknown";
}

/**
 * Supabase refusing an address that has no account, because we asked it not to
 * create one (`shouldCreateUser: false` on the email-code path).
 *
 * This refusal must never reach the person typing. Answering "no account here"
 * turns the code box into a membership oracle anyone can query one address at a
 * time. The caller swallows it and shows the same "code sent" screen a real
 * account gets — the same bargain `/forgot-password` already makes.
 *
 * Deliberately narrow. Matching loosely would also swallow the rate-limit
 * refusal, and someone would sit waiting for an email that was never sent.
 */
export function isUnknownAccountOtp(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("signups not allowed") ||
    normalized.includes("otp_disabled")
  );
}

export function safeAuthErrorKey(value: string | null | undefined): AuthErrorKey | null {
  return value && AUTH_ERROR_KEYS.has(value as AuthErrorKey)
    ? (value as AuthErrorKey)
    : null;
}

export type AuthNoticeKey = "password_updated";

export function safeAuthNoticeKey(
  value: string | null | undefined,
): AuthNoticeKey | null {
  return value === "password_updated" ? value : null;
}

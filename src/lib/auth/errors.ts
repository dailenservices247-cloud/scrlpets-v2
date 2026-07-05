export type AuthErrorKey =
  | "already_registered"
  | "confirmation_failed"
  | "email_not_confirmed"
  | "invalid_credentials"
  | "link_expired"
  | "rate_limited"
  | "unknown";

const AUTH_ERROR_KEYS = new Set<AuthErrorKey>([
  "already_registered",
  "confirmation_failed",
  "email_not_confirmed",
  "invalid_credentials",
  "link_expired",
  "rate_limited",
  "unknown",
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

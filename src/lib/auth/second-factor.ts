/**
 * Whether a signed-in session still owes its second factor.
 *
 * `factors` MUST be the list `supabase.auth.getUser()` returned — Supabase's own
 * answer. The SDK's no-argument `getAuthenticatorAssuranceLevel()` reads the copy
 * stored inside the session cookie instead, and the browser controls that
 * cookie: blank the list and the challenge never appears (auth-js 2.108.1).
 *
 * `accessToken` is the token `getUser()` just validated, so its `aal` claim can
 * be trusted. A token that cannot be read counts as owing — fail closed.
 */
export const SECOND_FACTOR_PATH = "/two-factor";

// The only requests an owing session may make. The two static files are linked
// from every page (manifest) or fetched by old service workers (sw.js); sending
// them to the challenge only produces console errors.
const EXEMPT_PATHS: ReadonlySet<string> = new Set([
  SECOND_FACTOR_PATH,
  "/auth/callback",
  "/auth/signout",
  "/manifest.webmanifest",
  "/sw.js",
]);

export function owesSecondFactor(
  factors: ReadonlyArray<{ status: string }> | undefined,
  accessToken: string | undefined,
): boolean {
  if (!factors?.some((factor) => factor.status === "verified")) return false;
  return tokenAssuranceLevel(accessToken) !== "aal2";
}

export function secondFactorExempt(pathname: string): boolean {
  return EXEMPT_PATHS.has(pathname);
}

function tokenAssuranceLevel(accessToken: string | undefined): string | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const aal = (JSON.parse(json) as { aal?: unknown }).aal;
    return typeof aal === "string" ? aal : null;
  } catch {
    return null;
  }
}

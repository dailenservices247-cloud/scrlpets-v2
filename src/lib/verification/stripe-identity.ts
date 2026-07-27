/**
 * Phase 2 / D1: Stripe Identity — the vendor holds every document; we keep
 * status + a session reference only (D5).
 *
 * Not configured yet (A1 = Dailen creates the account and supplies the key).
 * Until then this reports `not_configured` honestly instead of pretending, and
 * the state machine is exercised directly by tests.
 */
export type IdentitySessionResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; reason: "not_configured" | "provider_error" };

export function isIdentityConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export async function createIdentitySession(
  profileId: string,
  returnUrl: string,
): Promise<IdentitySessionResult> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, reason: "not_configured" };

  const body = new URLSearchParams({
    type: "document",
    "metadata[profile_id]": profileId,
    return_url: returnUrl,
  });

  const response = await fetch("https://api.stripe.com/v1/identity/verification_sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) return { ok: false, reason: "provider_error" };
  const session = (await response.json()) as { id: string; url: string };
  return { ok: true, url: session.url, sessionId: session.id };
}

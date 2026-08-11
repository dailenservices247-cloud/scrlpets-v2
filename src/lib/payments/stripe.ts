/**
 * Stripe Connect, in the same shape as `verification/stripe-identity.ts`: plain
 * fetch against the REST API, form-encoded. No SDK — the identity integration
 * established that pattern, one dependency is one more thing to keep current,
 * and these are four endpoints.
 *
 * Nothing here decides anything. Account state is written by the webhook through
 * `upsert_payout_account`, because payout eligibility is Stripe's assertion and
 * not a claim this process is entitled to make.
 */

const API = "https://api.stripe.com/v1";

export type ConnectResult<T> = { ok: true; data: T } | { ok: false; reason: string };

function key(): string | null {
  return process.env.STRIPE_SECRET_KEY ?? null;
}

export function isStripeConfigured(): boolean {
  return Boolean(key());
}

async function post<T>(path: string, body: URLSearchParams): Promise<ConnectResult<T>> {
  const k = key();
  if (!k) return { ok: false, reason: "not_configured" };
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${k}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await response.json()) as T & { error?: { code?: string; message?: string } };
  if (!response.ok) return { ok: false, reason: json.error?.code ?? json.error?.message ?? "provider_error" };
  return { ok: true, data: json };
}

export type StripeAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: { currently_due?: string[] };
};

/**
 * An Express account: Stripe hosts the onboarding, holds the bank details and
 * owns the identity/KYC obligation. That is the point — Scrlpets should never
 * see a seller's bank account, and Express means it cannot.
 */
export async function createConnectAccount(profileId: string, email?: string) {
  const body = new URLSearchParams({
    type: "express",
    "capabilities[transfers][requested]": "true",
    "metadata[profile_id]": profileId,
    business_type: "individual",
  });
  if (email) body.set("email", email);
  return post<StripeAccount>("/accounts", body);
}

/**
 * A single-use onboarding link. Deliberately short-lived by Stripe's design, so
 * it is generated on demand rather than stored — a persisted link is a link that
 * has expired by the time somebody clicks it.
 */
export async function createAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
  return post<{ url: string }>(
    "/account_links",
    new URLSearchParams({
      account: accountId,
      type: "account_onboarding",
      refresh_url: refreshUrl,
      return_url: returnUrl,
    }),
  );
}

export async function fetchAccount(accountId: string): Promise<ConnectResult<StripeAccount>> {
  const k = key();
  if (!k) return { ok: false, reason: "not_configured" };
  const response = await fetch(`${API}/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${k}` },
  });
  const json = (await response.json()) as StripeAccount & { error?: { code?: string } };
  if (!response.ok) return { ok: false, reason: json.error?.code ?? "provider_error" };
  return { ok: true, data: json };
}

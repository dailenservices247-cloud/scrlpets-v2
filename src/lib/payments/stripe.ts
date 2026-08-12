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

export type StripePaymentIntent = { id: string; client_secret: string; status: string };

/**
 * Charge the buyer into the PLATFORM account, not the seller's.
 *
 * This is the "separate charges and transfers" half of the architecture, and the
 * absence of `transfer_data` is the whole point: a destination charge would pay
 * the seller the moment the buyer's card cleared, which is precisely the buyer
 * protection this platform sells. The money sits until code + anchor prove the
 * right animal reached the right person, and only then is it transferred.
 *
 * `transfer_group` is the order id, so every later transfer — seller,
 * transporter, reversal — is linked to the charge it came from. Without it the
 * Stripe balance is a pile of unattributable money at reconciliation time.
 *
 * `on_behalf_of` makes the SELLER the merchant of record for the sale. Legacy
 * used it as a liability shield and the intent is worth keeping; it is omitted
 * rather than faked when the seller has no usable connected account.
 *
 * The amount is passed in from `order_payment_amount()` and is never computed
 * here — a client-side figure is a client-controlled figure.
 */
export async function createPaymentIntent(input: {
  amountCents: number;
  currency: string;
  orderId: string;
  paymentKind: "deposit" | "balance" | "full";
  sellerStripeAccountId?: string | null;
}): Promise<ConnectResult<StripePaymentIntent>> {
  const body = new URLSearchParams({
    amount: String(input.amountCents),
    currency: input.currency,
    "automatic_payment_methods[enabled]": "true",
    transfer_group: input.orderId,
    "metadata[order_id]": input.orderId,
    "metadata[payment_kind]": input.paymentKind,
  });
  if (input.sellerStripeAccountId) body.set("on_behalf_of", input.sellerStripeAccountId);
  return post<StripePaymentIntent>("/payment_intents", body);
}

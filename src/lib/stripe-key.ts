/**
 * The one place that decides whether `STRIPE_SECRET_KEY` may be used.
 *
 * Both Stripe clients read the same variable — `payments/stripe.ts` and
 * `verification/stripe-identity.ts` — so the mode assertion lives here rather
 * than in each of them. Two copies of a security condition is two places for it
 * to drift, and the half that drifts is the half nobody notices.
 *
 * The key is examined by PREFIX only. Nothing here logs it, returns it in an
 * error, or puts it anywhere a caller might.
 */

export type StripeKeyResult =
  | { ok: true; key: string }
  | { ok: false; reason: "not_configured" | "test_key_in_production" };

export function stripeKey(): StripeKeyResult {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, reason: "not_configured" };

  /**
   * The symmetric half of the webhook's livemode guard (`webhook-handler.ts`).
   * That one refuses a test-mode event arriving in production; this one refuses
   * to SEND in the wrong mode, which is the direction money leaves in.
   *
   * Without it, a test key in production creates a TEST PaymentIntent against a
   * real order: the buyer's card is never charged, and the inbound guard then
   * rejects the test-mode webhook that comes back — so the order sits stuck
   * rather than failing. Refusing to transact is the only outcome that is loud.
   */
  if (process.env.VERCEL_ENV === "production" && !key.startsWith("sk_live_")) {
    return { ok: false, reason: "test_key_in_production" };
  }

  return { ok: true, key };
}

/** Configured AND usable in this environment — a test key in production is neither. */
export function isStripeKeyUsable(): boolean {
  return stripeKey().ok;
}

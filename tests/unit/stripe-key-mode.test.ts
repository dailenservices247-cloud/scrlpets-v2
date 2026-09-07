import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The OUTBOUND half of the livemode guard.
 *
 * `webhook-handler.ts` already refuses a test-mode event arriving in production.
 * Nothing guarded the direction money actually leaves in: every Stripe request
 * is built from `STRIPE_SECRET_KEY` with no assertion about which Stripe it
 * reaches. A test key in production would create a TEST PaymentIntent against a
 * real order — the buyer's card is never really charged — and the inbound guard
 * would then reject the test-mode webhook that came back. The order sits stuck
 * instead of failing, which is the worst shape a money bug can take.
 *
 * The assertion that matters in each test is that `fetch` was NEVER CALLED. An
 * error returned after the request has already gone to Stripe has prevented
 * nothing; the point is refusing to transact, not reporting afterwards.
 *
 * The key is only ever examined by prefix. Nothing here logs or echoes it.
 */

const LIVE = "sk_live_pretend";
const TEST = "sk_test_pretend";

function stripeOk() {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ id: "obj_1", client_secret: "cs_1", status: "requires_payment_method" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
}

const INTENT = {
  amountCents: 103000,
  currency: "usd",
  orderId: "22222222-2222-2222-2222-222222222222",
  paymentKind: "full" as const,
};

describe("stripe key mode — outbound guard", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
    delete process.env.VERCEL_ENV;
    delete process.env.STRIPE_SECRET_KEY;
  });

  afterEach(() => {
    process.env = env;
    vi.unstubAllGlobals();
  });

  it("refuses to create a PaymentIntent when production holds a test key", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = TEST;
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { createPaymentIntent } = await import("@/lib/payments/stripe");
    const result = await createPaymentIntent(INTENT);

    expect(result).toEqual({ ok: false, reason: "test_key_in_production" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses to transfer money out when production holds a test key", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = TEST;
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { createTransfer } = await import("@/lib/payments/stripe");
    const result = await createTransfer({
      amountCents: 50000,
      currency: "usd",
      destinationAccountId: "acct_seller_1",
      orderId: INTENT.orderId,
      payoutId: "33333333-3333-3333-3333-333333333333",
      leg: "seller",
    });

    expect(result).toEqual({ ok: false, reason: "test_key_in_production" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("charges normally when production holds a live key", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = LIVE;
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { createPaymentIntent } = await import("@/lib/payments/stripe");
    const result = await createPaymentIntent(INTENT);

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves a test key alone outside production, so preview and local still work", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.STRIPE_SECRET_KEY = TEST;
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { createPaymentIntent } = await import("@/lib/payments/stripe");
    const result = await createPaymentIntent(INTENT);

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("reports Stripe as unconfigured in production rather than offering a checkout that cannot pay", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = TEST;

    const { isStripeConfigured } = await import("@/lib/payments/stripe");

    expect(isStripeConfigured()).toBe(false);
  });

  it("still says not_configured when there is no key at all", async () => {
    process.env.VERCEL_ENV = "production";
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { createPaymentIntent } = await import("@/lib/payments/stripe");
    const result = await createPaymentIntent(INTENT);

    expect(result).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  /**
   * Identity is NOT behind `payments_enabled`, so it is the surface that would
   * actually reach a wrongly-moded Stripe first. Test-mode Identity accepts
   * synthetic documents, and a verified badge is what unlocks animal listings —
   * the same threat the inbound guard was built for, from the other side.
   */
  it("refuses to open an identity session when production holds a test key", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = TEST;
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { createIdentitySession } = await import("@/lib/verification/stripe-identity");
    const result = await createIdentitySession("11111111-1111-1111-1111-111111111111", "https://scrlpets.com/x");

    expect(result).toEqual({ ok: false, reason: "test_key_in_production" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports identity as unconfigured in production when the key is a test key", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.STRIPE_SECRET_KEY = TEST;

    const { isIdentityConfigured } = await import("@/lib/verification/stripe-identity");

    expect(isIdentityConfigured()).toBe(false);
  });
});

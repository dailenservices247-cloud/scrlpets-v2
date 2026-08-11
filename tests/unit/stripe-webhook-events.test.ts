import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The payment and Connect halves of the webhook. The livemode guard is covered
 * for identity in identity-webhook-livemode.test.ts; it is re-asserted here for
 * PAYMENTS because the consequence is worse: a test-mode
 * `payment_intent.succeeded` reaching production would book money as captured
 * against a real order and the animal would ship against a payment that does not
 * exist.
 */

const SECRET = "whsec_test_secret";

function signed(body: unknown) {
  const payload = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", SECRET).update(`${t}.${payload}`).digest("hex");
  return new Request("https://example.com/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": `t=${t},v1=${v1}` },
  });
}

const rpc = vi.fn().mockResolvedValue({ error: null });
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

const ORDER = "22222222-2222-2222-2222-222222222222";
const PROFILE = "11111111-1111-1111-1111-111111111111";

function paymentEvent(livemode: boolean, over?: Record<string, unknown>) {
  return {
    type: "payment_intent.succeeded",
    livemode,
    data: {
      object: {
        id: "pi_test_1",
        amount: 108000,
        amount_received: 108000,
        metadata: { order_id: ORDER, payment_kind: "balance" },
        ...over,
      },
    },
  };
}

describe("stripe webhook — payments and connect", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    rpc.mockClear();
    process.env = {
      ...env,
      STRIPE_WEBHOOK_SECRET: SECRET,
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      VERCEL_ENV: "preview",
    };
  });

  afterEach(() => {
    process.env = env;
  });

  it("books a captured payment through record_order_payment", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(signed(paymentEvent(false)));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("record_order_payment", {
      target_order: ORDER,
      payment_kind: "balance",
      amount: 108000,
      payment_intent_id: "pi_test_1",
    });
  });

  it("books what STRIPE captured, never an amount supplied in metadata", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    // A crafted intent claiming a larger amount in metadata must not be believed.
    await POST(
      signed(
        paymentEvent(false, {
          amount_received: 5000,
          metadata: { order_id: ORDER, payment_kind: "balance", amount: "999999" },
        }),
      ),
    );

    expect(rpc).toHaveBeenCalledWith(
      "record_order_payment",
      expect.objectContaining({ amount: 5000 }),
    );
  });

  it("REFUSES a test-mode payment event in production and books nothing", async () => {
    process.env.VERCEL_ENV = "production";
    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const res = await POST(signed(paymentEvent(false)));

    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ignores a payment intent that carries no order, without failing", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(signed(paymentEvent(false, { metadata: {} })));

    // 200 on purpose: a non-2xx makes Stripe retry an event this app will never
    // be able to handle.
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("writes payout eligibility from account.updated", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(
      signed({
        type: "account.updated",
        livemode: false,
        data: {
          object: {
            id: "acct_test_1",
            metadata: { profile_id: PROFILE },
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
            requirements: { currently_due: [] },
          },
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("upsert_payout_account", {
      target_profile: PROFILE,
      account_id: "acct_test_1",
      charges: true,
      payouts: true,
      submitted: true,
      requirements: [],
    });
  });

  it("carries a REVOKED payout state through, not just a granted one", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    await POST(
      signed({
        type: "account.updated",
        livemode: false,
        data: {
          object: {
            id: "acct_test_1",
            metadata: { profile_id: PROFILE },
            charges_enabled: true,
            payouts_enabled: false,
            details_submitted: true,
            requirements: { currently_due: ["individual.verification.document"] },
          },
        },
      }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "upsert_payout_account",
      expect.objectContaining({
        payouts: false,
        requirements: ["individual.verification.document"],
      }),
    );
  });

  it("acknowledges an unrecognised event rather than making Stripe retry forever", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(
      signed({ type: "invoice.paid", livemode: false, data: { object: { id: "in_1" } } }),
    );

    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses an unsigned request", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(
      new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(paymentEvent(false)),
      }),
    );

    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

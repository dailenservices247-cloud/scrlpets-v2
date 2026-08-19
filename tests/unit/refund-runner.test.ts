import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The refund runner moves real money BACK, and it shipped with no test at all
 * while the payout runner beside it had five.
 *
 * The property that matters most here is the one that cost this session: a
 * refund can span TWO PaymentIntents — a deposit and a balance — and Stripe
 * refunds one intent at a time. Paying one leg and closing the debt is a buyer
 * short-paid by the other charge, recorded as settled. Every test below exists
 * to make that unrepresentable.
 */

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

const REFUND = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const LEG_BALANCE = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const LEG_DEPOSIT = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const ORDER = "ffffffff-ffff-ffff-ffff-ffffffffffff";

const balanceLeg = {
  leg_id: LEG_BALANCE,
  refund_id: REFUND,
  order_id: ORDER,
  amount_cents: 83000,
  payment_intent_id: "pi_balance",
};
const depositLeg = {
  leg_id: LEG_DEPOSIT,
  refund_id: REFUND,
  order_id: ORDER,
  amount_cents: 20000,
  payment_intent_id: "pi_deposit",
};

type FetchArgs = [string | URL | Request, RequestInit | undefined];

/** Stripe echoes the amount it actually refunded, which is not always the ask. */
function stripeRefunding(amountByIntent: Record<string, number>) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const body = new URLSearchParams(String(init?.body ?? ""));
    const intent = body.get("payment_intent") ?? "";
    return new Response(
      JSON.stringify({ id: `re_${intent}`, amount: amountByIntent[intent], status: "succeeded" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
}

function queue(rows: unknown[]) {
  rpc.mockImplementation(async (fn: string) =>
    fn === "pending_refunds" ? { data: rows, error: null } : { data: null, error: null },
  );
}

describe("refund runner", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    rpc.mockReset();
    process.env = {
      ...env,
      STRIPE_SECRET_KEY: "sk_test_x",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    };
  });

  afterEach(() => {
    process.env = env;
  });

  it("refunds a deposit-and-balance order across BOTH charges", async () => {
    queue([balanceLeg, depositLeg]);
    const fetchSpy = stripeRefunding({ pi_balance: 83000, pi_deposit: 20000 });
    vi.stubGlobal("fetch", fetchSpy);

    const { runPendingRefunds } = await import("@/lib/payments/payouts");
    const result = await runPendingRefunds();

    expect(result.refunded).toBe(2);
    expect(result.blocked).toEqual([]);

    const intents = fetchSpy.mock.calls.map(
      ([, init]) => new URLSearchParams(String((init as RequestInit)?.body ?? "")).get("payment_intent"),
    );
    expect(intents).toEqual(["pi_balance", "pi_deposit"]);

    const sent = fetchSpy.mock.calls.map(
      ([, init]) => new URLSearchParams(String((init as RequestInit)?.body ?? "")).get("amount"),
    );
    expect(sent.map(Number).reduce((a, b) => a + b, 0)).toBe(103000);
  });

  it("keys each leg separately, so the second is not swallowed as a replay of the first", async () => {
    queue([balanceLeg, depositLeg]);
    const fetchSpy = stripeRefunding({ pi_balance: 83000, pi_deposit: 20000 });
    vi.stubGlobal("fetch", fetchSpy);

    const { runPendingRefunds } = await import("@/lib/payments/payouts");
    await runPendingRefunds();

    const keys = fetchSpy.mock.calls.map(([, init]) => {
      const headers = (init as RequestInit).headers as Record<string, string>;
      return headers["Idempotency-Key"];
    });
    expect(keys).toEqual([`refund_${LEG_BALANCE}`, `refund_${LEG_DEPOSIT}`]);
    expect(new Set(keys).size).toBe(2);
  });

  it("does NOT close the debt when Stripe refunds less than the leg asked for", async () => {
    // Stripe caps a refund at the intent's remaining refundable balance. It
    // returns ok, with a smaller amount. Marking it paid is the short-pay.
    queue([balanceLeg]);
    vi.stubGlobal("fetch", stripeRefunding({ pi_balance: 40000 }));

    const { runPendingRefunds } = await import("@/lib/payments/payouts");
    const result = await runPendingRefunds();

    expect(result.refunded).toBe(0);
    expect(result.blocked).toEqual([
      { refundId: LEG_BALANCE, reason: "partial_refund:40000_of_83000" },
    ]);
    expect(rpc).not.toHaveBeenCalledWith("mark_refund_leg_paid", expect.anything());
  });

  it("surfaces a debt with no captured charge instead of dropping it", async () => {
    // The obligation exists, nothing was ever captured, so there is no leg and
    // no intent. It must still appear — invisible is worse than blocked.
    queue([{ leg_id: null, refund_id: REFUND, order_id: ORDER, amount_cents: 103000, payment_intent_id: null }]);
    const fetchSpy = stripeRefunding({});
    vi.stubGlobal("fetch", fetchSpy);

    const { runPendingRefunds } = await import("@/lib/payments/payouts");
    const result = await runPendingRefunds();

    expect(result.attempted).toBe(1);
    expect(result.refunded).toBe(0);
    expect(result.blocked).toEqual([{ refundId: REFUND, reason: "no_captured_charge" }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("leaves a failed leg owed, and still sends the other one", async () => {
    queue([balanceLeg, depositLeg]);
    const fetchSpy = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const intent = new URLSearchParams(String(init?.body ?? "")).get("payment_intent");
      if (intent === "pi_balance") {
        return new Response(JSON.stringify({ error: { code: "charge_already_refunded" } }), {
          status: 402,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ id: "re_pi_deposit", amount: 20000, status: "succeeded" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { runPendingRefunds } = await import("@/lib/payments/payouts");
    const result = await runPendingRefunds();

    expect(result.refunded).toBe(1);
    expect(result.blocked).toEqual([
      { refundId: LEG_BALANCE, reason: "charge_already_refunded" },
    ]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The payout runner moves real money OUT, so the two properties tested here are
 * the ones that cannot be recovered from if they are wrong.
 *
 * IDEMPOTENCY. A runner that crashes after Stripe succeeded but before the row
 * was marked will retry. Without a stable key that retry is a second real
 * transfer, and nobody can un-send it.
 *
 * A FAILED TRANSFER STAYS OWED. Marking it anything but pending loses the debt
 * silently — the seller is simply never paid and no row says so.
 */

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

const PAYOUT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORDER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const ROW = {
  payout_id: PAYOUT,
  order_id: ORDER,
  recipient_id: "seller-1",
  leg: "seller",
  amount_cents: 95000,
  destination_account: "acct_seller_1",
  currency: "usd",
};

type FetchArgs = [string | URL | Request, RequestInit | undefined];

function stripe(ok: boolean) {
  return vi.fn(async () =>
    new Response(
      JSON.stringify(
        ok
          ? { id: "tr_1", amount: 95000, destination: "acct_seller_1" }
          : { error: { code: "balance_insufficient" } },
      ),
      { status: ok ? 200 : 402, headers: { "content-type": "application/json" } },
    ),
  );
}

describe("payout runner", () => {
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

  it("sends the transfer keyed on the payout id, so a retry cannot pay twice", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "pending_payouts" ? { data: [ROW], error: null } : { data: null, error: null },
    );
    const fetchSpy = stripe(true);
    vi.stubGlobal("fetch", fetchSpy);

    const { runPendingPayouts } = await import("@/lib/payments/payouts");
    const result = await runPendingPayouts();

    expect(result.paid).toBe(1);
    const [, init] = fetchSpy.mock.calls[0] as unknown as FetchArgs;
    const headers = init!.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe(`payout_${PAYOUT}`);
  });

  it("sends the amount the DATABASE owes, not one the runner computed", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "pending_payouts" ? { data: [ROW], error: null } : { data: null, error: null },
    );
    const fetchSpy = stripe(true);
    vi.stubGlobal("fetch", fetchSpy);

    const { runPendingPayouts } = await import("@/lib/payments/payouts");
    await runPendingPayouts();

    const [, init] = fetchSpy.mock.calls[0] as unknown as FetchArgs;
    const body = init!.body as URLSearchParams;
    expect(body.get("amount")).toBe("95000");
    expect(body.get("destination")).toBe("acct_seller_1");
    // Ties the payout back to the charge it came from, or the balance is
    // unattributable at reconciliation.
    expect(body.get("transfer_group")).toBe(ORDER);
  });

  it("leaves a FAILED transfer owed rather than marking it sent", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "pending_payouts" ? { data: [ROW], error: null } : { data: null, error: null },
    );
    vi.stubGlobal("fetch", stripe(false));

    const { runPendingPayouts } = await import("@/lib/payments/payouts");
    const result = await runPendingPayouts();

    expect(result.paid).toBe(0);
    expect(result.failed[0].reason).toContain("balance_insufficient");
    const marked = rpc.mock.calls.map((c) => c[0]);
    expect(marked, "a failed transfer must stay a debt").not.toContain("mark_payout_paid");
  });

  it("calls Stripe BEFORE recording, never the reverse", async () => {
    const order: string[] = [];
    rpc.mockImplementation(async (fn: string) => {
      order.push(`rpc:${fn}`);
      return fn === "pending_payouts" ? { data: [ROW], error: null } : { data: null, error: null };
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        order.push("stripe:transfer");
        return new Response(JSON.stringify({ id: "tr_1", amount: 95000, destination: "x" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const { runPendingPayouts } = await import("@/lib/payments/payouts");
    await runPendingPayouts();

    // Recording first would risk marking a payout sent that never left.
    expect(order.indexOf("stripe:transfer")).toBeLessThan(order.indexOf("rpc:mark_payout_paid"));
  });

  it("does nothing at all when there is nothing owed", async () => {
    rpc.mockImplementation(async () => ({ data: [], error: null }));
    const fetchSpy = stripe(true);
    vi.stubGlobal("fetch", fetchSpy);

    const { runPendingPayouts } = await import("@/lib/payments/payouts");
    const result = await runPendingPayouts();

    expect(result).toEqual({ attempted: 0, paid: 0, failed: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

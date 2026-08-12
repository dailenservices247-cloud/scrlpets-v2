import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The charge path, pinned at the two places it could quietly become the wrong
 * architecture.
 *
 * ABSENCE OF `transfer_data` IS THE FEATURE. A destination charge pays the
 * seller the instant the buyer's card clears, which is exactly the buyer
 * protection this platform sells. If somebody "fixes" this by adding
 * transfer_data, every guarantee about holding funds until code + anchor
 * silently stops being true, and nothing else in the system would notice.
 *
 * THE AMOUNT COMES FROM THE DATABASE. A checkout that computes its own total can
 * be told to charge $1 for a $2,000 animal, and record_order_payment would book
 * that underpayment as a valid capture.
 */

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, from }),
}));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => ({ id: "buyer-1", email: "b@example.com" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const ORDER = "22222222-2222-2222-2222-222222222222";

type FetchArgs = [string | URL | Request, RequestInit | undefined];

/** The form body Stripe was actually sent, or a clear failure if it never was. */
function sentBody(spy: { mock: { calls: FetchArgs[] } }): URLSearchParams {
  const call = spy.mock.calls[0];
  if (!call) throw new Error("Stripe was never called");
  return call[1]!.body as URLSearchParams;
}

function stripeOk() {
  return vi.fn(async () =>
    new Response(
      JSON.stringify({ id: "pi_1", client_secret: "pi_1_secret", status: "requires_payment_method" }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
}

describe("charge path", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    rpc.mockReset();
    from.mockReset();
    process.env = { ...env, STRIPE_SECRET_KEY: "sk_test_x" };
    from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { currency: "usd" } }) }) }),
    });
  });

  afterEach(() => {
    process.env = env;
  });

  it("charges the amount the DATABASE says, not one supplied by the caller", async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "order_payment_amount") return { data: 103000, error: null };
      if (fn === "order_seller_stripe_account") return { data: null, error: null };
      return { data: null, error: null };
    });
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { startOrderPayment } = await import("@/lib/payments/actions");
    const res = await startOrderPayment(ORDER, "full");

    expect(res.ok && res.amountCents).toBe(103000);
    const body = sentBody(fetchSpy as unknown as { mock: { calls: FetchArgs[] } });
    expect(body.get("amount")).toBe("103000");
  });

  it("does NOT send transfer_data — the seller is not paid at capture", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "order_payment_amount"
        ? { data: 50000, error: null }
        : { data: "acct_seller_1", error: null },
    );
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { startOrderPayment } = await import("@/lib/payments/actions");
    await startOrderPayment(ORDER, "full");

    const body = sentBody(fetchSpy as unknown as { mock: { calls: FetchArgs[] } });
    expect(body.get("transfer_data[destination]"), "a destination charge pays the seller instantly").toBeNull();
    // transfer_group links every later transfer to the charge it came from;
    // without it the Stripe balance is unattributable at reconciliation.
    expect(body.get("transfer_group")).toBe(ORDER);
    // on_behalf_of makes the SELLER merchant of record — legacy's liability shield.
    expect(body.get("on_behalf_of")).toBe("acct_seller_1");
  });

  it("omits on_behalf_of rather than faking it when the seller has no account", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "order_payment_amount" ? { data: 50000, error: null } : { data: null, error: null },
    );
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { startOrderPayment } = await import("@/lib/payments/actions");
    await startOrderPayment(ORDER, "full");

    const body = sentBody(fetchSpy as unknown as { mock: { calls: FetchArgs[] } });
    expect(body.get("on_behalf_of")).toBeNull();
  });

  it("carries the order and kind in metadata, which is all the webhook has to go on", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "order_payment_amount" ? { data: 20000, error: null } : { data: null, error: null },
    );
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { startOrderPayment } = await import("@/lib/payments/actions");
    await startOrderPayment(ORDER, "deposit");

    const body = sentBody(fetchSpy as unknown as { mock: { calls: FetchArgs[] } });
    expect(body.get("metadata[order_id]")).toBe(ORDER);
    expect(body.get("metadata[payment_kind]")).toBe("deposit");
  });

  it("refuses when the database says there is nothing left to pay", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "order_payment_amount"
        ? { data: null, error: { message: "nothing_left_to_pay" } }
        : { data: null, error: null },
    );
    const fetchSpy = stripeOk();
    vi.stubGlobal("fetch", fetchSpy);

    const { startOrderPayment } = await import("@/lib/payments/actions");
    const res = await startOrderPayment(ORDER, "balance");

    expect(res.ok).toBe(false);
    expect(fetchSpy, "no card is touched when the order owes nothing").not.toHaveBeenCalled();
  });

  it("does not record the payment itself — only Stripe's webhook may do that", async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === "order_payment_amount" ? { data: 50000, error: null } : { data: null, error: null },
    );
    vi.stubGlobal("fetch", stripeOk());

    const { startOrderPayment } = await import("@/lib/payments/actions");
    await startOrderPayment(ORDER, "full");

    const called = rpc.mock.calls.map((c) => c[0]);
    expect(called, "a client that books its own payment is the hole this closes").not.toContain(
      "record_order_payment",
    );
  });
});

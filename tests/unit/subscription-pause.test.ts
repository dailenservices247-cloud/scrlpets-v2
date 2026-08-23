import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pause has SEVEN distinct ways to refuse, and they mean very different things
 * to someone who is paying. "Your plan does not allow pausing" and "you have an
 * order in flight" lead to opposite next actions, so flattening both into a
 * generic failure is the difference between a self-serve answer and a ticket.
 */
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("pauseSubscription", () => {
  it("passes the month count through to the definer", async () => {
    rpc.mockResolvedValue({ error: null });
    const { pauseSubscription } = await import("@/lib/subscriptions/actions");
    expect(await pauseSubscription(2)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("pause_subscription", { months: 2 });
  });

  it("returns each refusal reason distinctly, not flattened", async () => {
    const reasons = [
      "no_active_subscription",
      "already_paused",
      "plan_does_not_allow_pausing",
      "no_pauses_remaining",
      "pause_allowance_exceeded",
      "too_soon_to_pause",
      "order_in_flight",
    ];
    const { pauseSubscription } = await import("@/lib/subscriptions/actions");
    for (const reason of reasons) {
      rpc.mockResolvedValue({ error: { message: reason } });
      expect(await pauseSubscription(1)).toEqual({ ok: false, error: reason });
    }
  });

  it("refuses a non-positive month count without calling the database", async () => {
    // The definer refuses too. Checking here as well means the user gets an
    // answer without a round trip, not that the database check is optional.
    const { pauseSubscription } = await import("@/lib/subscriptions/actions");
    expect(await pauseSubscription(0)).toEqual({ ok: false, error: "months_must_be_positive" });
    expect(await pauseSubscription(-1)).toEqual({ ok: false, error: "months_must_be_positive" });
    expect(await pauseSubscription(1.5)).toEqual({ ok: false, error: "months_must_be_positive" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("resumeSubscription", () => {
  it("calls the definer with no arguments", async () => {
    rpc.mockResolvedValue({ error: null });
    const { resumeSubscription } = await import("@/lib/subscriptions/actions");
    expect(await resumeSubscription()).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("resume_subscription");
  });

  it("reports not_paused distinctly", async () => {
    rpc.mockResolvedValue({ error: { message: "not_paused" } });
    const { resumeSubscription } = await import("@/lib/subscriptions/actions");
    expect(await resumeSubscription()).toEqual({ ok: false, error: "not_paused" });
  });
});

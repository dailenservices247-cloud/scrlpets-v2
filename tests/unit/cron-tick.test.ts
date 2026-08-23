import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The scheduled tick.
 *
 * The property that matters most: one failing job must not starve the others.
 * A refund that throws while a payout is due would, in a naive sequential
 * runner, mean the payout silently never happens — and "money owed, nothing
 * reported" is the exact failure this whole layer exists to prevent.
 */
const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

const runPendingPayouts = vi.fn();
const runPendingRefunds = vi.fn();
vi.mock("@/lib/payments/payouts", () => ({ runPendingPayouts, runPendingRefunds }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-for-tests";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  rpc.mockResolvedValue({ data: 0, error: null });
  runPendingRefunds.mockResolvedValue({ attempted: 0, refunded: 0, blocked: [] });
  runPendingPayouts.mockResolvedValue({ attempted: 0, paid: 0, failed: [] });
});

describe("runScheduledJobs", () => {
  it("runs all four jobs", async () => {
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    const result = await runScheduledJobs();
    expect(rpc).toHaveBeenCalledWith("release_expired_inspections");
    expect(rpc).toHaveBeenCalledWith("overdue_shipments");
    expect(runPendingRefunds).toHaveBeenCalledOnce();
    expect(runPendingPayouts).toHaveBeenCalledOnce();
    expect(result.errors).toEqual([]);
  });

  it("runs refunds BEFORE payouts", async () => {
    // They move money in opposite directions. A refund that is owed should not
    // queue behind a payout batch.
    const order: string[] = [];
    runPendingRefunds.mockImplementation(async () => {
      order.push("refunds");
      return { attempted: 0, refunded: 0, blocked: [] };
    });
    runPendingPayouts.mockImplementation(async () => {
      order.push("payouts");
      return { attempted: 0, paid: 0, failed: [] };
    });
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    await runScheduledJobs();
    expect(order).toEqual(["refunds", "payouts"]);
  });

  it("keeps running after a job throws, and reports which one", async () => {
    // THE test. A thrown refund must not prevent a due payout from being sent.
    runPendingRefunds.mockRejectedValue(new Error("stripe unreachable"));
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    const result = await runScheduledJobs();
    expect(runPendingPayouts).toHaveBeenCalledOnce();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].job).toBe("refunds");
    expect(result.errors[0].reason).toContain("stripe unreachable");
  });

  it("survives a thrown SQL job too, and still pays out", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "release_expired_inspections"
        ? { data: null, error: { message: "deadlock detected" } }
        : { data: [], error: null },
    );
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    const result = await runScheduledJobs();
    expect(runPendingPayouts).toHaveBeenCalledOnce();
    expect(result.errors.map((e) => e.job)).toContain("inspections");
  });

  it("reports the counts each job returned", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "release_expired_inspections"
        ? { data: 3, error: null }
        : { data: [{ order_id: "o1" }, { order_id: "o2" }], error: null },
    );
    runPendingRefunds.mockResolvedValue({ attempted: 2, refunded: 1, blocked: [] });
    runPendingPayouts.mockResolvedValue({ attempted: 5, paid: 5, failed: [] });
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    const result = await runScheduledJobs();
    expect(result.inspectionsReleased).toBe(3);
    expect(result.overdueShipments).toBe(2);
    expect(result.refunds.refunded).toBe(1);
    expect(result.payouts.paid).toBe(5);
  });

  it("does nothing at all without a service key", async () => {
    // Not a silent no-op: it is reported, because a tick that quietly did
    // nothing for weeks looks identical to a tick with nothing to do.
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { runScheduledJobs } = await import("@/lib/payments/cron");
    const result = await runScheduledJobs();
    expect(result.skipped).toBe("no_service_key");
    expect(rpc).not.toHaveBeenCalled();
    expect(runPendingPayouts).not.toHaveBeenCalled();
  });
});

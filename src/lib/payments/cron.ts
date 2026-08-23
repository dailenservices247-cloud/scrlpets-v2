import { createClient } from "@supabase/supabase-js";
import { runPendingPayouts, runPendingRefunds } from "./payouts";
import type { PayoutRunResult, RefundRunResult } from "./payouts";

/**
 * The scheduled tick: everything that has to happen without a human present.
 *
 * ONE route rather than four, because four cron entries need a paid Vercel plan
 * while one works anywhere, needs one secret, and gives one place to look when
 * something has not run.
 * ponytail: split per-job when payments are live and the schedules actually differ.
 *
 * Every job is isolated. A thrown refund must not prevent a due payout from
 * being sent — "money owed, nothing reported" is the failure this layer exists
 * to prevent, and a bare sequential runner reintroduces it.
 */
export type CronJobError = { job: string; reason: string };

export type CronRunResult = {
  skipped?: "no_service_key";
  inspectionsReleased: number;
  overdueShipments: number;
  refunds: RefundRunResult;
  payouts: PayoutRunResult;
  errors: CronJobError[];
};

const EMPTY_REFUNDS: RefundRunResult = { attempted: 0, refunded: 0, blocked: [] };
const EMPTY_PAYOUTS: PayoutRunResult = { attempted: 0, paid: 0, failed: [] };

async function isolate<T>(
  job: string,
  errors: CronJobError[],
  fallback: T,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    errors.push({ job, reason: e instanceof Error ? e.message : String(e) });
    return fallback;
  }
}

export async function runScheduledJobs(): Promise<CronRunResult> {
  const errors: CronJobError[] = [];
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // Reported, never silent. A tick that quietly did nothing for weeks looks
    // exactly like a tick with nothing to do.
    return {
      skipped: "no_service_key",
      inspectionsReleased: 0,
      overdueShipments: 0,
      refunds: EMPTY_REFUNDS,
      payouts: EMPTY_PAYOUTS,
      errors,
    };
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

  // 1. The clock. This is the ONE job with no `payments_enabled` guard: an
  //    inspection window elapsing is a fact about time, not about Stripe.
  const inspectionsReleased = await isolate("inspections", errors, 0, async () => {
    const { data, error } = await supabase.rpc("release_expired_inspections");
    if (error) throw new Error(error.message);
    return (data as number | null) ?? 0;
  });

  // 2. Refunds before payouts: opposite directions, and money owed back should
  //    not wait behind a payout batch.
  const refunds = await isolate("refunds", errors, EMPTY_REFUNDS, runPendingRefunds);

  // 3. Payouts.
  const payouts = await isolate("payouts", errors, EMPTY_PAYOUTS, runPendingPayouts);

  // 4. Read-only. Surfaces shipped orders stuck at `dispatched`, which is what
  //    the admin queue acts on — there is no carrier webhook to close them.
  const overdueShipments = await isolate("overdue_shipments", errors, 0, async () => {
    const { data, error } = await supabase.rpc("overdue_shipments");
    if (error) throw new Error(error.message);
    return (data as unknown[] | null)?.length ?? 0;
  });

  return { inspectionsReleased, overdueShipments, refunds, payouts, errors };
}

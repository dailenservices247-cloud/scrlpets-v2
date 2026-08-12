import { createClient } from "@supabase/supabase-js";
import { createTransfer } from "./stripe";

/**
 * Executes the payouts a released order owes.
 *
 * Runs with the service key, because `pending_payouts` and `mark_payout_paid`
 * are executable by no client role — a member has no business enumerating who is
 * owed what, still less marking it sent.
 *
 * The database decides WHAT is owed and to WHOM; this only performs the Stripe
 * call and records the result. Nothing here computes an amount.
 *
 * ORDER OF OPERATIONS. Stripe is called first, then the row is marked. The
 * reverse would risk marking a payout sent that never left. Crashing between the
 * two is safe: the transfer carries the payout id as its idempotency key, so the
 * retry returns Stripe's original response rather than sending twice, and
 * `mark_payout_paid` is idempotent on the transfer id.
 */
export type PayoutRunResult = {
  attempted: number;
  paid: number;
  failed: { payoutId: string; reason: string }[];
};

export async function runPendingPayouts(): Promise<PayoutRunResult> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { attempted: 0, paid: 0, failed: [] };

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
  const { data, error } = await supabase.rpc("pending_payouts");
  if (error) throw new Error(`pending_payouts unavailable: ${error.message}`);

  const rows = (data ?? []) as {
    payout_id: string;
    order_id: string;
    recipient_id: string;
    leg: string;
    amount_cents: number;
    destination_account: string;
    currency: string;
  }[];

  const failed: PayoutRunResult["failed"] = [];
  let paid = 0;

  for (const row of rows) {
    const transfer = await createTransfer({
      amountCents: row.amount_cents,
      currency: row.currency,
      destinationAccountId: row.destination_account,
      orderId: row.order_id,
      payoutId: row.payout_id,
      leg: row.leg,
    });

    if (!transfer.ok) {
      // Left pending on purpose. A failed transfer is money still owed, and the
      // next run retries it — marking it anything else would lose the debt.
      failed.push({ payoutId: row.payout_id, reason: transfer.reason });
      continue;
    }

    const { error: markError } = await supabase.rpc("mark_payout_paid", {
      target_payout: row.payout_id,
      transfer_id: transfer.data.id,
    });
    if (markError) {
      failed.push({ payoutId: row.payout_id, reason: `sent_but_unrecorded:${markError.message}` });
      continue;
    }
    paid += 1;
  }

  return { attempted: rows.length, paid, failed };
}

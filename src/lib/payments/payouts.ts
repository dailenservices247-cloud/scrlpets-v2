import { createClient } from "@supabase/supabase-js";
import { createRefund, createTransfer } from "./stripe";

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

export type RefundRunResult = {
  attempted: number;
  refunded: number;
  blocked: { refundId: string; reason: string }[];
};

/**
 * Sends the money a settled order owes the buyer.
 *
 * Deliberately separate from `runPendingPayouts`. They move money in opposite
 * directions, and one failing must never stop the other: a stuck refund should
 * not hold up an unrelated seller's payout.
 *
 * `pending_refunds` already excludes orders with an unreversed transfer, so this
 * cannot pay a buyer money that has already gone to a seller.
 *
 * It returns one row per LEG — one per PaymentIntent the refund draws on. A
 * deposit-then-balance order refunds twice, against two charges, and the debt
 * closes only when both have gone out. There is no longer a `needs_manual_split`
 * case to surface: the split is representable, so it is simply paid.
 */
export async function runPendingRefunds(): Promise<RefundRunResult> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { attempted: 0, refunded: 0, blocked: [] };

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
  const { data, error } = await supabase.rpc("pending_refunds");
  if (error) throw new Error(`pending_refunds unavailable: ${error.message}`);

  const rows = (data ?? []) as {
    leg_id: string | null;
    refund_id: string;
    order_id: string;
    amount_cents: number;
    payment_intent_id: string | null;
  }[];

  const blocked: RefundRunResult["blocked"] = [];
  let refunded = 0;

  for (const row of rows) {
    if (!row.leg_id || !row.payment_intent_id) {
      // A debt with nothing captured behind it. It has no leg because there is
      // no charge to refund against, and it surfaces here rather than vanishing
      // from the queue — the buyer is owed money and a human has to find it.
      blocked.push({ refundId: row.refund_id, reason: "no_captured_charge" });
      continue;
    }

    const refund = await createRefund({
      paymentIntentId: row.payment_intent_id,
      amountCents: row.amount_cents,
      // The LEG's id, not the refund's: two legs of one debt are two separate
      // Stripe calls and must not share an idempotency key, or the second would
      // replay the first's response and never send.
      refundId: row.leg_id,
      orderId: row.order_id,
    });
    if (!refund.ok) {
      // Left pending: an unsent refund is still owed, and the next run retries.
      blocked.push({ refundId: row.leg_id, reason: refund.reason });
      continue;
    }

    // Stripe caps a refund at the intent's REMAINING refundable balance and
    // reports what it actually sent. Marking the leg paid on `ok` alone would
    // close the debt for whatever came back, which is a short-pay recorded as
    // settled. Retrying is safe — the idempotency key replays the same response
    // — so the leg stays visibly owed until a human looks at it.
    if (refund.data.amount !== row.amount_cents) {
      blocked.push({
        refundId: row.leg_id,
        reason: `partial_refund:${refund.data.amount}_of_${row.amount_cents}`,
      });
      continue;
    }

    const { error: markError } = await supabase.rpc("mark_refund_leg_paid", {
      target_leg: row.leg_id,
      stripe_id: refund.data.id,
    });
    if (markError) {
      blocked.push({ refundId: row.leg_id, reason: `sent_but_unrecorded:${markError.message}` });
      continue;
    }
    refunded += 1;
  }

  return { attempted: rows.length, refunded, blocked };
}

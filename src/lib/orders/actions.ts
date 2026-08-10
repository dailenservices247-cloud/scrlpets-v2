"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OrderResult = { ok: true; orderId?: string } | { ok: false; error: string };

/**
 * D10 rails. These call definers that raise `payments_disabled` while the DB
 * flag is off, so this file is complete but inert until A3 clears. Do not add
 * a client-side flag check as the gate — the DB is the gate; a check here is
 * only for showing an honest message.
 */
export async function createOrder(listingId: string): Promise<OrderResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", { target_listing: listingId });
  if (error) return { ok: false, error: error.message };
  // /orders has never existed as a route. The order lifecycle is shown on
  // /applications, so that is what has to be refreshed.
  revalidatePath("/applications");
  return { ok: true, orderId: data as string };
}

/**
 * The only two transitions a party may simply assert. Everything else is
 * earned: capture is proven by Stripe, handover by code plus anchor, release by
 * the buyer or the clock. Typed rather than free-form because `advance_order`
 * no longer accepts anything else and a string would hide that at compile time.
 */
export async function advanceOrder(
  orderId: string,
  newStatus: "awaiting_payment" | "cancelled",
  note?: string,
): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_order", {
    target_order: orderId,
    new_status: newStatus,
    note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}

/** The buyer's handover code. Returns null for anyone else — including the seller. */
export async function getHandoverCode(orderId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_handover_code", { target_order: orderId });
  return (data as string | null) ?? null;
}

/** Seller releases the animal. Refuses unless the capture already happened. */
export async function markDispatched(orderId: string, note?: string): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_dispatched", {
    target_order: orderId,
    note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}

/**
 * The handover itself. `anchor_mismatch` is deliberately NOT flattened into a
 * generic failure: it means the animal presented was not the animal listed,
 * which is a §3 dispute and an account review, and the caller has to be able to
 * tell it apart from a mistyped code.
 */
export async function confirmHandover(
  orderId: string,
  enteredCode: string,
  scannedAnchor: string,
): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_handover_and_hold", {
    target_order: orderId,
    entered_code: enteredCode,
    scanned_anchor: scannedAnchor,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}

/** Buyer ends their own inspection window early. */
export async function acceptDelivery(orderId: string): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_delivery", { target_order: orderId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}

/** Either party stops the release clock pending adjudication. */
export async function disputeOrder(orderId: string, reason: string): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dispute_order", { target_order: orderId, reason });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}

/**
 * Settlement branches, named exactly as the published dispute policy names them.
 * The split is derived in the database from the branch — never passed in — so
 * the same failure mode cannot settle two different ways.
 */
export type SettlementBranch =
  | "refusal_no_cause"
  | "no_show_buyer"
  | "no_show_seller"
  | "wrong_animal"
  | "guarantee_upheld"
  | "guarantee_not_covered"
  | "guarantee_ambiguous"
  | "seller_refund";

export async function settleOrder(
  orderId: string,
  branch: SettlementBranch,
  note?: string,
): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_order", {
    target_order: orderId,
    branch,
    note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}

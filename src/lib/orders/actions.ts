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
/**
 * Transport is booked as PART of the purchase, not alongside it — the only shape
 * where "the transporter is always paid" is structurally true, because the
 * platform holds the money when the obligation arises.
 *
 * The route is sent so the database can verify coverage itself. The checkout
 * only offers transporters who cover both ends, but a booking that has to be
 * cancelled later is worse than one refused now.
 */
export type TransportChoice = {
  serviceId: string;
  pickupRegion: string;
  deliveryRegion: string;
};

export async function createOrder(
  listingId: string,
  transport?: TransportChoice,
): Promise<OrderResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", {
    target_listing: listingId,
    transport_service: transport?.serviceId ?? null,
    pickup_region: transport?.pickupRegion ?? null,
    delivery_region: transport?.deliveryRegion ?? null,
  });
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
  revalidatePath("/admin");
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
  revalidatePath("/admin");
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
  revalidatePath("/admin");
  return { ok: true };
}

/** Buyer ends their own inspection window early. */
export async function acceptDelivery(orderId: string): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_delivery", { target_order: orderId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  revalidatePath("/admin");
  return { ok: true };
}

/** Either party stops the release clock pending adjudication. */
export async function disputeOrder(orderId: string, reason: string): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dispute_order", { target_order: orderId, reason });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  revalidatePath("/admin");
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
  // §4 remedies, named as real guarantees name them. `guarantee_upheld` is gone
  // deliberately: it refunded everything unconditionally, which is the one
  // remedy no real contract offers and the shape that let a buyer keep both the
  // animal and the money.
  | "guarantee_vet_costs"
  | "guarantee_replacement"
  | "guarantee_refund_on_return"
  | "guarantee_not_covered"
  | "guarantee_ambiguous"
  | "seller_refund";

export async function settleOrder(
  orderId: string,
  branch: SettlementBranch,
  note?: string,
  /** Vet costs to reimburse, in cents. Only read for `guarantee_vet_costs`. */
  remedyCents?: number,
): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_order", {
    target_order: orderId,
    branch,
    note: note ?? null,
    remedy: remedyCents ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Each party supplies the address they actually know: the seller where the
 * animal is, the buyer where it is going. The definer decides which column your
 * uid may write, so passing both from one caller cannot cross the wires.
 */
export async function setOrderAddresses(
  orderId: string,
  fields: { pickup?: string; pickupPhone?: string; delivery?: string; deliveryPhone?: string },
): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_addresses", {
    target_order: orderId,
    pickup: fields.pickup ?? null,
    pickup_phone: fields.pickupPhone ?? null,
    delivery: fields.delivery ?? null,
    delivery_phone: fields.deliveryPhone ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/jobs");
  return { ok: true };
}

/** The shipped path's dispatch. Tracking is mandatory — the definer refuses without it. */
export async function recordShipment(
  orderId: string,
  carrier: string,
  tracking: string,
): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_shipment", {
    target_order: orderId,
    ship_carrier: carrier,
    tracking,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/applications");
  return { ok: true };
}

/**
 * The SELLER's step, not the driver's, and the split is the point: the seller
 * proves the right animal got in the van, the buyer's code proves it reached the
 * right person, and neither can fake the chain alone. `anchor_mismatch` means
 * the animal presented was not the animal listed — a §3 dispute, not a typo.
 */
export async function confirmPickup(orderId: string, scannedAnchor: string): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_pickup", {
    target_order: orderId,
    scanned_anchor: scannedAnchor,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/jobs");
  return { ok: true };
}

/**
 * The return leg of a refund-on-return remedy. Idempotent in the definer — a
 * second call returns without writing — so a double click cannot restate it.
 */
export async function confirmAnimalReturned(orderId: string): Promise<OrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_animal_returned", { target_order: orderId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/admin");
  return { ok: true };
}

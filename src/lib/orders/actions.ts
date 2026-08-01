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

export async function advanceOrder(
  orderId: string,
  newStatus: string,
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

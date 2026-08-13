"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type JobResult = { ok: true } | { ok: false; error: string };

/**
 * The driver's one action: enter the buyer's code at the door.
 *
 * They do NOT scan the animal — transporters do not carry microchip readers, and
 * the anchor was already proven by the seller at pickup. Splitting the two
 * proofs across the journey is stronger than asking one party for both: the
 * seller proves the right animal got in the van, the buyer's code proves it
 * reached the right person, and neither can fake the chain alone.
 */
export async function confirmDelivery(orderId: string, code: string): Promise<JobResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_delivery_with_code", {
    target_order: orderId,
    entered_code: code.trim(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jobs");
  return { ok: true };
}

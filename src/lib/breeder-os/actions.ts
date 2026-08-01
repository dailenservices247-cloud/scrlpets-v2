"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BreederOsResult = { ok: true } | { ok: false; error: string };

/**
 * Phase 4 added listings.availability but no way to change it. This closes
 * that gap. The existing "own or managed brand update listings" policy is the
 * authority — a non-owner's update simply affects zero rows.
 */
export async function setListingAvailability(
  listingId: string,
  availability: "available" | "pending" | "sold",
): Promise<BreederOsResult> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("listings")
    .update({ availability }, { count: "exact" })
    .eq("id", listingId);
  if (error) return { ok: false, error: error.message };
  if ((count ?? 0) === 0) return { ok: false, error: "not_permitted" };
  revalidatePath("/brand-os");
  revalidatePath(`/listing/${listingId}`);
  revalidatePath("/market");
  return { ok: true };
}

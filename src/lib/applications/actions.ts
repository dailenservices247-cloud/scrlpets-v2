"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ApplicationResult = { ok: true } | { ok: false; error: string };

/**
 * D13: submit an application (listingId set) or join a seller's waitlist
 * (listingId null). RLS enforces buyer identity, suspension and blocks —
 * this only shapes the row.
 */
export async function submitApplication(
  sellerId: string,
  listingId: string | null,
  message: string,
): Promise<ApplicationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const { error } = await supabase.from("buyer_applications").insert({
    buyer_id: user.id,
    seller_id: sellerId,
    listing_id: listingId,
    message: message.trim() || null,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.toLowerCase().includes("duplicate") ? "already_applied" : error.message,
    };
  }
  revalidatePath("/applications");
  if (listingId) revalidatePath(`/listing/${listingId}`);
  return { ok: true };
}

/**
 * Withdraw (buyer) or decide (seller). Both go through one definer that
 * checks which party is calling — there is no client UPDATE policy, so a
 * buyer cannot write themselves an acceptance.
 */
export async function setApplicationStatus(
  applicationId: string,
  status: "withdrawn" | "accepted" | "declined",
): Promise<ApplicationResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_application_status", {
    target_application: applicationId,
    new_status: status,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/applications");
  return { ok: true };
}

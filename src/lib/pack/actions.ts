"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PackActionResult = { ok: true } | { ok: false; error: string };

/**
 * Both writes lean on RLS rather than re-checking roles here: only the
 * addressee may flip a link to `accepted`, and only the two parties may delete
 * one. A refused write comes back as zero affected rows, so the caller reports
 * "couldn't" instead of claiming a change the row store never made.
 */
function revalidatePack() {
  revalidatePath("/pack");
  // The notification that pointed at this link now renders differently.
  revalidatePath("/notifications");
}

/**
 * The only way a `pending` link is ever created by a person. Without this the
 * pack surface could only ever fill from the handover trigger, and the Requests
 * section was unreachable — the feature would have shipped looking complete and
 * doing nothing, which is the exact legacy failure this rebuild is correcting.
 *
 * Ordering is not normalised: pack_links records who asked (requester) and who
 * decides (addressee), and resolve depends on that direction. The unique pair
 * index is what stops a second request in either direction.
 */
export async function sendPackRequest(addresseeId: string): Promise<PackActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };
  if (user.id === addresseeId) return { ok: false, error: "self" };

  const { error } = await supabase.from("pack_links").insert({
    requester_id: user.id,
    addressee_id: addresseeId,
    status: "pending",
    origin: "invite",
  });
  // A duplicate is not a failure worth shouting about: a link already stands or
  // a request is already waiting, which is what the caller wanted anyway.
  if (error) {
    return { ok: false, error: error.code === "23505" ? "already_linked" : error.message };
  }
  revalidatePack();
  return { ok: true };
}

export async function acceptPackRequest(linkId: string): Promise<PackActionResult> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("pack_links")
    .update({ status: "accepted" }, { count: "exact" })
    .eq("id", linkId);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "not_found" };
  revalidatePack();
  return { ok: true };
}

/**
 * Decline, withdraw and leave are ONE operation: the link row is deleted, for
 * both people at once. The three buttons differ only in the copy above them,
 * because the user's intent differs — the effect does not, and the UI says so.
 */
export async function removePackLink(linkId: string): Promise<PackActionResult> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("pack_links")
    .delete({ count: "exact" })
    .eq("id", linkId);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "not_found" };
  revalidatePack();
  return { ok: true };
}

/** Plain-`<form action>` wrappers: the page re-renders from the database after. */
export async function acceptPackRequestForm(linkId: string): Promise<void> {
  await acceptPackRequest(linkId);
}

export async function declinePackRequestForm(linkId: string): Promise<void> {
  await removePackLink(linkId);
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SubscriptionResult =
  | { ok: true; subscriptionId?: string }
  | { ok: false; error: string };

/**
 * Calls a definer that raises `subscriptions_disabled` while the DB flag is
 * off, so this file is complete but inert until A3 clears. Do not add a
 * client-side flag check as the gate — the DB is the gate; the check in the UI
 * exists only to avoid showing a button that cannot work.
 */
export async function subscribeToTier(tierKey: string): Promise<SubscriptionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("subscribe_to_tier", { tier: tierKey });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/subscription");
  return { ok: true, subscriptionId: data as string };
}

/**
 * Pause a plan without losing it.
 *
 * The definer refuses SEVEN different ways and each means something different
 * to someone paying — `plan_does_not_allow_pausing` and `order_in_flight` lead
 * to opposite next actions. The raw reason is returned rather than flattened,
 * and the panel maps it to a sentence.
 *
 * The month check is duplicated here only so the answer arrives without a round
 * trip. The database check is the one that counts.
 */
export async function pauseSubscription(months: number): Promise<SubscriptionResult> {
  if (!Number.isInteger(months) || months < 1) {
    return { ok: false, error: "months_must_be_positive" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("pause_subscription", { months });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/subscription");
  return { ok: true };
}

/** Resume a paused plan. Refuses `not_paused`, which the panel says plainly. */
export async function resumeSubscription(): Promise<SubscriptionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resume_subscription");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/subscription");
  return { ok: true };
}

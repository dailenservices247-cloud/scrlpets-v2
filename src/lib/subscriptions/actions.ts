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

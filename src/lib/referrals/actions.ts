"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReferralResult = { ok: true } | { ok: false; error: string };

/**
 * Records who invited the CALLING user — call it once, right after the invited
 * person has an account (signup carries the code as `?ref=`).
 *
 * Every refusal lives in the definer, not here: self-referral, an unknown code,
 * a second referrer, a suspended caller, and an account that was already active
 * before it claimed. A client-side check would be advice; this is a rule.
 *
 * Claiming pays nothing. Points reach the referrer only when the invited person
 * publishes a listing or completes a confirmed handover.
 */
export async function claimReferral(code: string): Promise<ReferralResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_referral", { code });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/referrals");
  return { ok: true };
}

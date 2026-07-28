"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RewardResult = { ok: true } | { ok: false; error: string };

/**
 * The only way to spend points. Balance check, catalog check and the debit all
 * happen inside one database transaction, so a balance cannot go negative and
 * a redemption cannot exist unpaid.
 */
export async function redeemReward(
  rewardKey: string,
  targetPostId?: string,
): Promise<RewardResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_reward", {
    reward: rewardKey,
    target_post: targetPostId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rewards");
  revalidatePath("/");
  return { ok: true };
}

/** Admin decision on a goods redemption. Rejecting refunds the points. */
export async function reviewRedemption(
  redemptionId: string,
  decision: "approved" | "rejected" | "fulfilled",
  notes?: string,
): Promise<RewardResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_redemption", {
    target_redemption: redemptionId,
    decision,
    notes: notes ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

import { createClient } from "@/lib/supabase/server";

/**
 * `converted` is the only number that means anything. `total` counts people who
 * used the link; `converted` counts the ones who then did something real, which
 * is the only thing that ever paid points.
 */
export type ReferralStats = { total: number; converted: number };

/**
 * The viewer's own code, minted on first look. The definer is idempotent, so
 * asking for it twice is free — and no code is created for the large majority
 * of accounts that never open this page.
 */
export async function getMyReferralCode(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ensure_referral_code");
  return (data as string | null) ?? null;
}

export async function getMyReferralStats(): Promise<ReferralStats> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { total: 0, converted: 0 };

  const [total, converted] = await Promise.all([
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", user.id),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", user.id)
      .not("converted_at", "is", null),
  ]);

  return { total: total.count ?? 0, converted: converted.count ?? 0 };
}

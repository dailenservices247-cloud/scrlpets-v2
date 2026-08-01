import { createClient } from "@/lib/supabase/server";

export type LedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
};

export type Reward = {
  key: string;
  title: string;
  description: string | null;
  costPoints: number;
  kind: "visibility" | "goods" | "fee_credit";
};

export type Redemption = {
  id: string;
  rewardKey: string;
  pointsSpent: number;
  status: string;
  createdAt: string;
};

/**
 * Badges describe what a person DID. They are never a platform judgment —
 * that distinction is what separates this from the legacy trust score, where
 * 20 of 100 points were a paid subscription.
 */
export type Badge = { key: string; count: number };

/**
 * Standing is EARNED and never falls. It is a separate number from the balance
 * and shares no term with it: the ledger's debits are excluded by
 * profile_standing(), so redeeming a reward cannot demote anyone. Legacy
 * computed its ladder from the live balance and did exactly that.
 *
 * `tierFeeBps` is the already-ruled fee ladder, not a rate anything charges
 * today — payments are off and public.fee_bps() is still the flat global flag.
 * Every surface rendering it has to say so.
 */
export type Standing = {
  handovers: number;
  reviewsReceived: number;
  tenureMonths: number;
  standingPoints: number;
  tier: number;
  tierFeeBps: number;
};

/** Highest rung of the ladder, so a surface can render "tier N of TIERS". */
export const STANDING_TIERS = 5;

export async function getStanding(): Promise<Standing | null> {
  const supabase = await createClient();
  // No argument: the RPC resolves the caller itself, so one member can never
  // ask for another's rung.
  const { data } = await supabase.rpc("my_standing");
  const row = (
    data as
      | {
          handovers: number;
          reviews_received: number;
          tenure_months: number;
          standing_points: number;
          standing_tier: number;
          tier_fee_bps: number;
        }[]
      | null
  )?.[0];
  if (!row) return null;
  return {
    handovers: row.handovers,
    reviewsReceived: row.reviews_received,
    tenureMonths: row.tenure_months,
    standingPoints: row.standing_points,
    tier: row.standing_tier,
    tierFeeBps: row.tier_fee_bps,
  };
}

export async function getBalance(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase.rpc("points_balance", { target_profile: user.id });
  return (data as number | null) ?? 0;
}

export async function getLedger(): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("point_ledger")
    .select("id,delta,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as { id: string; delta: number; reason: string; created_at: string }[]).map(
    (r) => ({ id: r.id, delta: r.delta, reason: r.reason, createdAt: r.created_at }),
  );
}

/**
 * Only what is actually for sale. A disabled row is not "a reward you cannot
 * have yet" — the two visibility rewards were withdrawn because they charged
 * points and did nothing, and listing a withdrawn reward would advertise it.
 * The fee credit is enabled and gated on payments instead, so it still shows.
 */
export async function getCatalog(): Promise<Reward[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reward_catalog")
    .select("key,title,description,cost_points,kind")
    .eq("enabled", true)
    .order("cost_points", { ascending: true });
  return ((data ?? []) as {
    key: string;
    title: string;
    description: string | null;
    cost_points: number;
    kind: Reward["kind"];
  }[]).map((r) => ({
    key: r.key,
    title: r.title,
    description: r.description,
    costPoints: r.cost_points,
    kind: r.kind,
  }));
}

export async function getMyRedemptions(): Promise<Redemption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("redemptions")
    .select("id,reward_key,points_spent,status,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as {
    id: string;
    reward_key: string;
    points_spent: number;
    status: string;
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    rewardKey: r.reward_key,
    pointsSpent: r.points_spent,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/** Counts of things the viewer actually did. Nothing weighted, nothing bought. */
export async function getBadges(): Promise<Badge[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [listings, handovers, reviews, animals] = await Promise.all([
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .is("deleted_at", null),
    supabase
      .from("buyer_applications")
      .select("id", { count: "exact", head: true })
      .not("buyer_confirmed_at", "is", null)
      .not("seller_confirmed_at", "is", null),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewer_id", user.id),
    supabase
      .from("creatures")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),
  ]);

  return [
    { key: "listings", count: listings.count ?? 0 },
    { key: "handovers", count: handovers.count ?? 0 },
    { key: "reviews", count: reviews.count ?? 0 },
    { key: "animals", count: animals.count ?? 0 },
  ].filter((b) => b.count > 0);
}

// getBoostablePosts() is gone with the boost. It fetched 20 posts on every
// /rewards load to fill a picker for two rewards that are no longer sold.

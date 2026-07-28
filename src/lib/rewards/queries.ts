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
  enabled: boolean;
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

export async function getCatalog(): Promise<Reward[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reward_catalog")
    .select("key,title,description,cost_points,kind,enabled")
    .order("cost_points", { ascending: true });
  return ((data ?? []) as {
    key: string;
    title: string;
    description: string | null;
    cost_points: number;
    kind: Reward["kind"];
    enabled: boolean;
  }[]).map((r) => ({
    key: r.key,
    title: r.title,
    description: r.description,
    costPoints: r.cost_points,
    kind: r.kind,
    enabled: r.enabled,
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

/** Posts the viewer can boost — their own, newest first. */
export async function getBoostablePosts(): Promise<{ id: string; label: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("posts")
    .select("id,body,created_at")
    .eq("author_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  return ((data ?? []) as { id: string; body: string | null }[]).map((p) => ({
    id: p.id,
    label: p.body?.slice(0, 60) || "(no caption)",
  }));
}

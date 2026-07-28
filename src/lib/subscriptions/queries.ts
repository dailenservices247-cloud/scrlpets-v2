import { createClient } from "@/lib/supabase/server";

export type SubscriptionTier = {
  key: string;
  name: string;
  monthlyPriceCents: number;
  feeBps: number;
  description: string | null;
  enabled: boolean;
};

export type Subscription = {
  id: string;
  tierKey: string;
  status: string;
  currentPeriodEnd: string | null;
};

/**
 * Subscriptions are OFF until legal review (A3) clears, same as payments.
 * This reads the DB flag rather than an env var so the UI cannot offer a plan
 * while `subscribe_to_tier` is still refusing — one source of truth, and it is
 * the one that actually blocks.
 */
export async function isSubscriptionsEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_flags")
    .select("enabled")
    .eq("key", "subscriptions_enabled")
    .maybeSingle();
  return (data as { enabled: boolean } | null)?.enabled === true;
}

/** The published catalog. Public read, so this works signed out too. */
export async function getTiers(): Promise<SubscriptionTier[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_tiers")
    .select("key,name,monthly_price_cents,fee_bps,description,enabled")
    .order("sort_order", { ascending: true });
  return ((data ?? []) as {
    key: string;
    name: string;
    monthly_price_cents: number;
    fee_bps: number;
    description: string | null;
    enabled: boolean;
  }[]).map((t) => ({
    key: t.key,
    name: t.name,
    monthlyPriceCents: t.monthly_price_cents,
    feeBps: t.fee_bps,
    description: t.description,
    enabled: t.enabled,
  }));
}

/** The viewer's plan. Returns null for everyone else, via RLS. */
export async function getMySubscription(): Promise<Subscription | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id,tier_key,status,current_period_end")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as {
    id: string;
    tier_key: string;
    status: string;
    current_period_end: string | null;
  } | null;
  return row
    ? {
        id: row.id,
        tierKey: row.tier_key,
        status: row.status,
        currentPeriodEnd: row.current_period_end,
      }
    : null;
}

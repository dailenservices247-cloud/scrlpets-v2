import { createClient } from "@/lib/supabase/server";

export type Order = {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId: string | null;
  titleSnapshot: string | null;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

/**
 * D10: money is OFF until legal review (A3) clears. This reads the DB flag
 * rather than an env var so the UI cannot claim payments are live while
 * `create_order` is still refusing — one source of truth, and it is the one
 * that actually blocks.
 */
export async function isPaymentsEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_flags")
    .select("enabled")
    .eq("key", "payments_enabled")
    .maybeSingle();
  return (data as { enabled: boolean } | null)?.enabled === true;
}

/** Orders the viewer is a party to. Returns [] for everyone else, via RLS. */
export async function getMyOrders(): Promise<Order[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id,buyer_id,seller_id,listing_id,title_snapshot,amount_cents,currency,status,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as {
    id: string;
    buyer_id: string;
    seller_id: string;
    listing_id: string | null;
    title_snapshot: string | null;
    amount_cents: number;
    currency: string;
    status: string;
    created_at: string;
  }[]).map((o) => ({
    id: o.id,
    buyerId: o.buyer_id,
    sellerId: o.seller_id,
    listingId: o.listing_id,
    titleSnapshot: o.title_snapshot,
    amountCents: o.amount_cents,
    currency: o.currency,
    status: o.status,
    createdAt: o.created_at,
  }));
}

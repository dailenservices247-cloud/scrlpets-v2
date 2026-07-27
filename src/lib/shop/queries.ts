import { createClient } from "@/lib/supabase/server";

export type ShopProduct = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priceCents: number;
  currency: string;
  availability: string;
  mediaUrl: string | null;
  sellerUsername: string | null;
  brand: { id: string; name: string; slug: string } | null;
};

type Row = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  currency: string;
  availability: string;
  media_url: string | null;
  profiles: { username: string } | null;
  brands: { id: string; name: string; slug: string } | null;
};

const SELECT =
  "id,title,description,category,price_cents,currency,availability,media_url,profiles!listings_seller_id_fkey(username),brands(id,name,slug)";

function toProduct(r: Row): ShopProduct {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    priceCents: r.price_cents,
    currency: r.currency,
    availability: r.availability,
    mediaUrl: r.media_url,
    sellerUsername: r.profiles?.username ?? null,
    brand: r.brands ?? null,
  };
}

/**
 * D9: the shop is non-animal listings. There is deliberately no separate
 * products table — animals and products share one table so the Phase 2
 * listing gate cannot be sidestepped through a second code path.
 */
export async function listShopProducts(category?: string): Promise<ShopProduct[]> {
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select(SELECT)
    .is("creature_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);
  if (category) query = query.eq("category", category);
  const { data } = await query;
  return ((data ?? []) as unknown as Row[]).map(toProduct);
}

/** Products sold by one brand — the brand shop half of D9. */
export async function listBrandProducts(brandId: string): Promise<ShopProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(SELECT)
    .eq("brand_id", brandId)
    .is("creature_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as unknown as Row[]).map(toProduct);
}

export async function listShopCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("category")
    .is("creature_id", null)
    .is("deleted_at", null)
    .not("category", "is", null)
    .limit(200);
  const seen = new Set(((data ?? []) as { category: string }[]).map((r) => r.category));
  return [...seen].sort();
}

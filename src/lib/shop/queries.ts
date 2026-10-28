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
  sellerSource: "merchant" | "distributor";
  merchantName: string | null;
  externalSku: string | null;
  externalUrl: string | null;
  saleMode: "direct_checkout" | "contract_escrow";
  recommender?: { username: string; note: string | null } | null;
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
  seller_source?: string | null;
  merchant_name?: string | null;
  external_sku?: string | null;
  external_url?: string | null;
  sale_mode?: string | null;
  profiles: { username: string } | null;
  brands: { id: string; name: string; slug: string } | null;
};

const SELECT =
  "id,title,description,category,price_cents,currency,availability,media_url,seller_source,merchant_name,external_sku,external_url,sale_mode,profiles!listings_seller_id_fkey(username),brands(id,name,slug)";

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
    sellerSource: (r.seller_source as "merchant" | "distributor") || "distributor",
    merchantName: r.merchant_name ?? null,
    externalSku: r.external_sku ?? null,
    externalUrl: r.external_url ?? null,
    saleMode: (r.sale_mode as "direct_checkout" | "contract_escrow") || "direct_checkout",
  };
}

/**
 * D9: the shop is non-animal listings. There is deliberately no separate
 * products table — animals and products share one table so the Phase 2
 * listing gate cannot be sidestepped through a second code path.
 */
export async function listShopProducts(
  categoryOrOptions?: string | { category?: string; source?: "all" | "merchant" | "distributor" | "recommended" },
): Promise<ShopProduct[]> {
  const supabase = await createClient();
  const options =
    typeof categoryOrOptions === "string"
      ? { category: categoryOrOptions, source: "all" as const }
      : (categoryOrOptions ?? { source: "all" as const });
  const category = options.category;
  const source = options.source ?? "all";

  if (source === "recommended") {
    const { data: recs } = await supabase
      .from("product_recommendations")
      .select("listing_id, note, profiles(username)")
      .order("created_at", { ascending: false })
      .limit(60);

    if (!recs || recs.length === 0) return [];

    const listingIds = [...new Set(recs.map((r) => r.listing_id))];
    const { data: listings } = await supabase
      .from("listings")
      .select(SELECT)
      .in("id", listingIds)
      .is("deleted_at", null);

    const recByListing = new Map<string, { username: string; note: string | null }>();
    for (const r of recs) {
      if (!recByListing.has(r.listing_id)) {
        recByListing.set(r.listing_id, {
          username: (r.profiles as unknown as { username: string })?.username ?? "someone",
          note: r.note,
        });
      }
    }

    return ((listings ?? []) as unknown as Row[]).map((r) => {
      const prod = toProduct(r);
      prod.recommender = recByListing.get(r.id) ?? null;
      return prod;
    });
  }

  let query = supabase
    .from("listings")
    .select(SELECT)
    .eq("listing_kind", "sale")
    .is("creature_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);

  if (category) query = query.eq("category", category);
  if (source === "merchant") query = query.eq("seller_source", "merchant");
  if (source === "distributor") query = query.eq("seller_source", "distributor");

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
    .eq("listing_kind", "sale")
    .is("creature_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as unknown as Row[]).map(toProduct);
}

/** Products sold by a specific profile (`/u/[username]` or `/c/[slug]` seller). */
export async function listProfileProducts(profileId: string): Promise<ShopProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(SELECT)
    .eq("seller_id", profileId)
    .eq("listing_kind", "sale")
    .is("creature_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  return ((data ?? []) as unknown as Row[]).map(toProduct);
}

export async function listShopCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("category")
    .eq("listing_kind", "sale")
    .is("creature_id", null)
    .is("deleted_at", null)
    .not("category", "is", null)
    .limit(200);
  const seen = new Set(((data ?? []) as { category: string }[]).map((r) => r.category));
  return [...seen].sort();
}

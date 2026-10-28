import { createClient } from "@/lib/supabase/server";

export type ListingMarketplaceDetail = {
  id: string;
  sellerId: string;
  priceCents: number;
  currency: string;
  description: string | null;
  category: string | null;
  availability: string;
};

export type ListingInquiryContext = {
  id: string;
  listingId: string | null;
  title: string;
  priceCents: number;
  creatureId: string | null;
  creatureSlug: string | null;
  creatureName: string | null;
  brandName: string | null;
  createdAt: string;
};

export async function getListingMarketplaceDetail(
  listingId: string,
): Promise<ListingMarketplaceDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id,seller_id,price_cents,currency,description,category,availability")
    .eq("id", listingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    sellerId: data.seller_id,
    priceCents: data.price_cents,
    currency: data.currency,
    description: data.description,
    category: data.category,
    availability: data.availability,
  };
}

export async function getListingInquiryContexts(
  conversationId: string,
): Promise<ListingInquiryContext[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_inquiries")
    .select(
      "id,listing_id,listing_title_snapshot,price_cents_snapshot,creature_id_snapshot,creature_name_snapshot,brand_name_snapshot,created_at",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const listingIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.listing_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const activeListingIds = new Set<string>();
  if (listingIds.length > 0) {
    const { data: activeListings, error: activeError } = await supabase
      .from("listings")
      .select("id")
      .in("id", listingIds);
    if (activeError) throw activeError;
    for (const listing of activeListings ?? []) {
      activeListingIds.add(listing.id);
    }
  }

  const creatureIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.creature_id_snapshot)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const creatureSlugById = new Map<string, string>();
  if (creatureIds.length > 0) {
    const { data: creatures } = await supabase
      .from("creatures")
      .select("id,slug")
      .in("id", creatureIds);
    for (const c of (creatures ?? []) as { id: string; slug: string }[]) {
      creatureSlugById.set(c.id, c.slug);
    }
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    listingId:
      row.listing_id && activeListingIds.has(row.listing_id)
        ? row.listing_id
        : null,
    title: row.listing_title_snapshot,
    priceCents: row.price_cents_snapshot,
    creatureId: row.creature_id_snapshot ?? null,
    creatureSlug: row.creature_id_snapshot
      ? (creatureSlugById.get(row.creature_id_snapshot) ?? null)
      : null,
    creatureName: row.creature_name_snapshot,
    brandName: row.brand_name_snapshot,
    createdAt: row.created_at,
  }));
}

import { createClient } from "@/lib/supabase/server";

export type ListingMarketplaceDetail = {
  id: string;
  sellerId: string;
  priceCents: number;
};

export type ListingInquiryContext = {
  id: string;
  listingId: string | null;
  title: string;
  priceCents: number;
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
    .select("id,seller_id,price_cents")
    .eq("id", listingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    sellerId: data.seller_id,
    priceCents: data.price_cents,
  };
}

export async function getListingInquiryContexts(
  conversationId: string,
): Promise<ListingInquiryContext[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_inquiries")
    .select(
      "id,listing_id,listing_title_snapshot,price_cents_snapshot,creature_name_snapshot,brand_name_snapshot,created_at",
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

  return (data ?? []).map((row) => ({
    id: row.id,
    listingId:
      row.listing_id && activeListingIds.has(row.listing_id)
        ? row.listing_id
        : null,
    title: row.listing_title_snapshot,
    priceCents: row.price_cents_snapshot,
    creatureName: row.creature_name_snapshot,
    brandName: row.brand_name_snapshot,
    createdAt: row.created_at,
  }));
}

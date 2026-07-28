import { createClient } from "@/lib/supabase/server";

export type ApplicationStatus = "submitted" | "accepted" | "declined" | "withdrawn";

export type BuyerApplication = {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId: string | null;
  listingTitle: string | null;
  message: string | null;
  status: ApplicationStatus;
  createdAt: string;
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  buyerUsername: string | null;
  sellerUsername: string | null;
};

type Row = {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string | null;
  message: string | null;
  status: ApplicationStatus;
  created_at: string;
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
  listings: { title: string } | null;
  buyer: { username: string } | null;
  seller: { username: string } | null;
};

const SELECT =
  "id,buyer_id,seller_id,listing_id,message,status,created_at," +
  "buyer_confirmed_at,seller_confirmed_at," +
  "listings(title)," +
  "buyer:profiles!buyer_applications_buyer_id_fkey(username)," +
  "seller:profiles!buyer_applications_seller_id_fkey(username)";

function toApplication(r: Row): BuyerApplication {
  return {
    id: r.id,
    buyerId: r.buyer_id,
    sellerId: r.seller_id,
    listingId: r.listing_id,
    listingTitle: r.listings?.title ?? null,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    buyerConfirmedAt: r.buyer_confirmed_at,
    sellerConfirmedAt: r.seller_confirmed_at,
    buyerUsername: r.buyer?.username ?? null,
    sellerUsername: r.seller?.username ?? null,
  };
}

/**
 * D13: one object serves both cases. A row with a listing is an application
 * for that animal or product; the same row with listing_id null is a waitlist
 * entry with that seller. RLS returns only rows the viewer is a party to.
 */
export async function getMyApplications(): Promise<BuyerApplication[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("buyer_applications")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as Row[]).map(toApplication);
}

/** Whether the viewer already has an open application/waitlist entry here. */
export async function getOpenApplication(
  sellerId: string,
  listingId: string | null,
): Promise<BuyerApplication | null> {
  const supabase = await createClient();
  let query = supabase
    .from("buyer_applications")
    .select(SELECT)
    .eq("seller_id", sellerId)
    .eq("status", "submitted");
  query = listingId ? query.eq("listing_id", listingId) : query.is("listing_id", null);
  const { data } = await query.maybeSingle();
  return data ? toApplication(data as unknown as Row) : null;
}

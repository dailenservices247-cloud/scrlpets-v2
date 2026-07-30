import { createClient } from "@/lib/supabase/server";

export type ListingPhoto = {
  id: string;
  photoUrl: string;
  caption: string | null;
  displayOrder: number;
};

type ListingPhotoRow = {
  id: string;
  photo_url: string;
  caption: string | null;
  display_order: number;
};

/** V2-01: the gallery. RLS already defers to the listing's own visibility, so
 * a soft-deleted listing's photos simply stop coming back here. */
export async function getListingPhotos(listingId: string): Promise<ListingPhoto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_photos")
    .select("id,photo_url,caption,display_order")
    .eq("listing_id", listingId)
    .order("display_order", { ascending: true });
  return ((data ?? []) as ListingPhotoRow[]).map((r) => ({
    id: r.id,
    photoUrl: r.photo_url,
    caption: r.caption,
    displayOrder: r.display_order,
  }));
}

// Species is deliberately excluded — the structured panel spec covers breed,
// gender, color, markings, registration number and the Born/Weaned dates
// only; species already surfaces via the listing's own category/creature name.
export type ListingAnimalDetails = {
  breed: string | null;
  gender: string | null;
  color: string | null;
  markings: string | null;
  registrationNumber: string | null;
  birthDate: string | null;
  weanedDate: string | null;
};

type ListingAnimalDetailsRow = {
  breed: string | null;
  gender: string | null;
  color: string | null;
  markings: string | null;
  registration_number: string | null;
  birth_date: string | null;
  weaned_date: string | null;
};

/** V2-01: the structured pet-details panel's data, keyed off the listing's
 * attached creature. Public read (RLS follows creature visibility). */
export async function getListingAnimalDetails(
  creatureId: string,
): Promise<ListingAnimalDetails | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures")
    .select("breed,gender,color,markings,registration_number,birth_date,weaned_date")
    .eq("id", creatureId)
    .maybeSingle();
  if (!data) return null;
  const r = data as ListingAnimalDetailsRow;
  return {
    breed: r.breed,
    gender: r.gender,
    color: r.color,
    markings: r.markings,
    registrationNumber: r.registration_number,
    birthDate: r.birth_date,
    weanedDate: r.weaned_date,
  };
}

/**
 * V2-02: the seller's REAL identity-verification state, in exactly the
 * services-page pattern (src/lib/services/queries.ts) — one RPC call that
 * returns only matching ids, never any document data.
 */
export async function isSellerIdentityVerified(sellerId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("verified_profile_ids", { profile_ids: [sellerId] });
  return ((data ?? []) as { profile_id: string }[]).some((v) => v.profile_id === sellerId);
}

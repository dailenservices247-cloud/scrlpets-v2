import { createClient } from "@/lib/supabase/server";
import type { AnchorType, AssuranceLevel } from "@/lib/creatures/types";

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
  /** The identity anchor's public half: the derived assurance level and the
   * marker TYPE. `anchor_value` is revoked from every client role and is not
   * reachable from here at all — that is the point of it. */
  assurance: AssuranceLevel;
  anchorType: AnchorType | null;
};

type ListingAnimalDetailsRow = {
  breed: string | null;
  gender: string | null;
  color: string | null;
  markings: string | null;
  registration_number: string | null;
  birth_date: string | null;
  weaned_date: string | null;
  anchor_type: AnchorType | null;
};

/** V2-01: the structured pet-details panel's data, keyed off the listing's
 * attached creature. Public read (RLS follows creature visibility). */
export async function getListingAnimalDetails(
  creatureId: string,
): Promise<ListingAnimalDetails | null> {
  const supabase = await createClient();
  // Assurance is derived by the DB rather than recomputed here, so the listing
  // and the animal's own page can never disagree about the same animal.
  const [{ data }, { data: assurance }] = await Promise.all([
    supabase
      .from("creatures")
      .select("breed,gender,color,markings,registration_number,birth_date,weaned_date,anchor_type")
      .eq("id", creatureId)
      .maybeSingle(),
    supabase.rpc("creature_assurance", { target_creature: creatureId }),
  ]);
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
    // Falls back to the WEAKEST level: a failed read must never be able to
    // upgrade what a listing claims about an animal.
    assurance: (assurance as AssuranceLevel | null) ?? "declared",
    anchorType: r.anchor_type,
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

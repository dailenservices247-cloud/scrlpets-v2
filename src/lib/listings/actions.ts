"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getListingPhotos, type ListingPhoto } from "./queries";

type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_GALLERY_PHOTOS = 10;

/** Client-callable read for the seller's own gallery editor (edit mode loads
 * its existing rows this way, since a "use client" component cannot import
 * the server-only Supabase client directly). Same public data the listing
 * page itself renders — no extra auth needed beyond the table's own RLS. */
export async function loadListingPhotosForEditor(listingId: string): Promise<ListingPhoto[]> {
  return getListingPhotos(listingId);
}

/** Bulk-add photos to an existing listing's gallery. Pre-checks the DB's own
 * 10-photo cap so a full gallery fails with a clean reason instead of a raw
 * RLS error, and computes display_order after whatever is already there so
 * repeated add calls across edit sessions never collide. */
export async function addListingPhotos(
  listingId: string,
  photos: { url: string; caption: string }[],
): Promise<ActionResult> {
  if (photos.length === 0) return { ok: true };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const { count } = await supabase
    .from("listing_photos")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  const existing = count ?? 0;
  if (existing + photos.length > MAX_GALLERY_PHOTOS) {
    return { ok: false, error: "gallery_full" };
  }

  const rows = photos.map((p, i) => ({
    listing_id: listingId,
    photo_url: p.url,
    caption: p.caption.trim() || null,
    display_order: existing + i,
  }));
  const { error } = await supabase.from("listing_photos").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/listing/${listingId}`);
  return { ok: true };
}

export async function removeListingPhoto(photoId: string, listingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };
  const { error } = await supabase.from("listing_photos").delete().eq("id", photoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/listing/${listingId}`);
  return { ok: true };
}

export async function updateListingPhotoCaption(
  photoId: string,
  listingId: string,
  caption: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };
  const { error } = await supabase
    .from("listing_photos")
    .update({ caption: caption.trim() || null })
    .eq("id", photoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/listing/${listingId}`);
  return { ok: true };
}

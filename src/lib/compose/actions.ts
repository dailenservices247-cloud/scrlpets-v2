"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { validatePost, validateListing, parsePriceCents } from "./validation";

type ActionResult = { ok: true } | { ok: false; error: string };

// Slice C: the shrunken subject enum — animals reference via FK columns.
const ABOUT_TYPES = new Set(["none", "product", "brand", "litter", "service"]);

type Attribution = {
  posting_as_type: "person" | "brand";
  brand_id: string | null;
  about_type: string;
  about_id: string | null;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

/**
 * Resolve attribution from client FormData and RE-VERIFY brand membership server-side.
 * Never trust a client-submitted brand_id: RLS is the backstop, this is the app-layer guard.
 * Returns null when posting as a brand the caller has no membership for.
 */
async function resolveAttribution(
  supabase: SupabaseClient,
  userId: string,
  formData: FormData,
): Promise<Attribution | null> {
  const postingAsType = formData.get("postingAsType") === "brand" ? "brand" : "person";
  const rawAbout = String(formData.get("aboutType") ?? "none");
  const aboutType = ABOUT_TYPES.has(rawAbout) ? rawAbout : "none";
  const aboutId = (formData.get("aboutId") as string) || null;

  if (postingAsType === "person") {
    return { posting_as_type: "person", brand_id: null, about_type: aboutType, about_id: aboutId };
  }

  const brandId = (formData.get("brandId") as string) || null;
  if (!brandId) return null;
  const { data, error } = await supabase
    .from("brand_memberships")
    .select("role, brands ( restrict_posting_to_managers )")
    .eq("brand_id", brandId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  // matrix row 3: contributors may not post as a restricted brand. The insert
  // RLS is the real gate; this returns the clean brand_denied instead of an
  // RLS failure. Supabase types the embedded relation as an array.
  const membership = data as {
    role: string;
    brands: { restrict_posting_to_managers: boolean } | { restrict_posting_to_managers: boolean }[] | null;
  };
  const rel = membership.brands;
  const brand = Array.isArray(rel) ? rel[0] : rel;
  const isManager = membership.role === "owner" || membership.role === "admin";
  if (brand?.restrict_posting_to_managers && !isManager) return null;
  return { posting_as_type: "brand", brand_id: brandId, about_type: aboutType, about_id: aboutId };
}

export async function createPost(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const body = String(formData.get("body") ?? "");
  const mediaUrl = (formData.get("mediaUrl") as string) || null;
  const creatureId = (formData.get("creatureId") as string) || null;
  const v = validatePost({ body, mediaUrl });
  if (!v.ok) return { ok: false, error: v.error };
  const attribution = await resolveAttribution(supabase, user.id, formData);
  if (!attribution) return { ok: false, error: "brand_denied" };
  // Group posts are person-voice only (matches the in-group composer); a brand
  // publishing into a breed community is a moderation surface that stays
  // banked. Membership itself is enforced by the RESTRICTIVE RLS policy.
  const groupId =
    attribution.posting_as_type === "person"
      ? (formData.get("groupId") as string) || null
      : null;
  // F4: a video upload publishes as a reel or long video; anything else is a post.
  const requestedType = String(formData.get("contentType") ?? "post");
  const contentType =
    (requestedType === "reel" || requestedType === "long_video") && mediaUrl
      ? requestedType
      : "post";
  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    content_type: contentType,
    body: body.trim() || null,
    media_url: mediaUrl,
    tagged_creature_id: creatureId,
    group_id: groupId,
    ...attribution,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function createListing(
  formData: FormData,
): Promise<ActionResult & { id?: string }> {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "");
  const rawPrice = String(formData.get("price") ?? "").trim();
  const mediaUrl = (formData.get("mediaUrl") as string) || null;
  const creatureId = (formData.get("creatureId") as string) || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const category = (formData.get("category") as string)?.trim() || null;
  // R17: adoption is the same entity under the same gate; only intent differs,
  // and it requires an animal (enforced by a DB check constraint too).
  const listingKind = formData.get("listingKind") === "adoption" && creatureId ? "adoption" : "sale";
  // A rehoming with no fee is legitimate; parsePriceCents deliberately treats
  // "0" as invalid for sales, so free adoptions are resolved here instead.
  const priceCents =
    listingKind === "adoption" && (rawPrice === "" || /^0(\.0{1,2})?$/.test(rawPrice))
      ? 0
      : parsePriceCents(rawPrice);
  const v = validateListing({ title, priceCents }, { allowFree: listingKind === "adoption" });
  if (!v.ok) return { ok: false, error: v.error };
  const attribution = await resolveAttribution(supabase, user.id, formData);
  if (!attribution) return { ok: false, error: "brand_denied" };
  // Returns the new row's id (like createCreature already does) so the caller
  // can attach gallery photos to THIS listing rather than re-finding it by
  // title, which misfires when a seller publishes two identical titles at once.
  const { data, error } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      title: title.trim(),
      price_cents: priceCents!,
      media_url: mediaUrl,
      creature_id: creatureId,
      description,
      category,
      listing_kind: listingKind,
      ...attribution,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true, id: data.id as string };
}

export async function editPost(postId: string, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const body = String(formData.get("body") ?? "");
  const mediaUrl = (formData.get("mediaUrl") as string) || null;
  const v = validatePost({ body, mediaUrl });
  if (!v.ok) return { ok: false, error: v.error };

  const { count, error } = await supabase
    .from("posts")
    .update({
      body: body.trim() || null,
      media_url: mediaUrl,
    }, { count: "exact" })
    .eq("id", postId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  revalidatePath(`/watch/${postId}`);
  revalidatePath(`/watch/reel/${postId}`);
  return { ok: true };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  // Soft-delete via author-or-manager RPC (mirrors deleteListing). Post rows
  // are now retained with deleted_at; the SELECT policy hides them everywhere.
  const { data, error } = await supabase.rpc("soft_delete_managed_post", {
    target_post_id: postId,
  });
  if (error) return { ok: false, error: error.message };
  if (data !== true) return { ok: false, error: "not_found" };

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  revalidatePath(`/watch/${postId}`);
  revalidatePath(`/watch/reel/${postId}`);
  return { ok: true };
}

export async function editListing(listingId: string, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const title = String(formData.get("title") ?? "");
  const priceCents = parsePriceCents(String(formData.get("price") ?? ""));
  const mediaUrl = (formData.get("mediaUrl") as string) || null;
  const v = validateListing({ title, priceCents });
  if (!v.ok) return { ok: false, error: v.error };

  const { count, error } = await supabase
    .from("listings")
    .update({
      title: title.trim(),
      price_cents: priceCents!,
      media_url: mediaUrl,
    }, { count: "exact" })
    .eq("id", listingId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };

  revalidatePath("/");
  revalidatePath(`/listing/${listingId}`);
  return { ok: true };
}

export async function deleteListing(listingId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("soft_delete_managed_listing", {
    target_listing_id: listingId,
  });
  if (error) return { ok: false, error: error.message };
  if (data !== true) return { ok: false, error: "not_found" };

  revalidatePath("/");
  revalidatePath(`/listing/${listingId}`);
  return { ok: true };
}

export async function createCreature(formData: FormData): Promise<ActionResult & { id?: string }> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const species = String(formData.get("species") ?? "").trim() || null;
  if (!name) return { ok: false, error: "required" };
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID().slice(0, 4)}`;
  const { data, error } = await supabase
    .from("creatures")
    .insert({ owner_id: user.id, name, species, slug })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

export async function getMyCreatures(): Promise<{ id: string; name: string }[]> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("creatures")
    .select("id,name")
    .eq("owner_id", user.id)
    .is("archived_at", null)
    .order("created_at");
  return data ?? [];
}

"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { validatePost, validateListing, parsePriceCents } from "./validation";

type ActionResult = { ok: true } | { ok: false; error: string };

const ABOUT_TYPES = new Set(["none", "animal", "litter", "product", "service", "brand", "collaboration"]);

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
    .select("id")
    .eq("brand_id", brandId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (error || !data) return null;
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
  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    content_type: "post",
    body: body.trim() || null,
    media_url: mediaUrl,
    tagged_creature_id: creatureId,
    ...attribution,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function createListing(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "");
  const priceCents = parsePriceCents(String(formData.get("price") ?? ""));
  const mediaUrl = (formData.get("mediaUrl") as string) || null;
  const creatureId = (formData.get("creatureId") as string) || null;
  const v = validateListing({ title, priceCents });
  if (!v.ok) return { ok: false, error: v.error };
  const attribution = await resolveAttribution(supabase, user.id, formData);
  if (!attribution) return { ok: false, error: "brand_denied" };
  const { error } = await supabase.from("listings").insert({
    seller_id: user.id,
    title: title.trim(),
    price_cents: priceCents!,
    media_url: mediaUrl,
    creature_id: creatureId,
    ...attribution,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
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
    .order("created_at");
  return data ?? [];
}

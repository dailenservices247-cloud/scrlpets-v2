"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePost, validateListing, parsePriceCents } from "./validation";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

export async function createPost(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const body = String(formData.get("body") ?? "");
  const mediaUrl = (formData.get("mediaUrl") as string) || null;
  const creatureId = (formData.get("creatureId") as string) || null;
  const v = validatePost({ body, mediaUrl });
  if (!v.ok) return { ok: false, error: v.error };
  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    content_type: "post",
    body: body.trim() || null,
    media_url: mediaUrl,
    tagged_creature_id: creatureId,
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
  const { error } = await supabase.from("listings").insert({
    seller_id: user.id,
    title: title.trim(),
    price_cents: priceCents!,
    media_url: mediaUrl,
    creature_id: creatureId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
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

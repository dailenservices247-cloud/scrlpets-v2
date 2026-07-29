"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BrandKitActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("auth_required");
  return { supabase, user };
}

function str(fd: FormData, key: string): string | null {
  return String(fd.get(key) ?? "").trim() || null;
}

/** Direct table UPDATE — brands now grants column-level UPDATE on the kit
 * fields to managers (RLS: is_brand_manager(id)); no RPC needed, unlike the
 * older banner/avatar path in lib/brands/actions.ts. */
export async function updateBrandKit(
  brandId: string,
  brandSlug: string,
  formData: FormData,
): Promise<BrandKitActionResult> {
  const { supabase } = await requireUser();
  const tagline = str(formData, "tagline");
  if (tagline && tagline.length > 120) return { ok: false, error: "tagline_length" };
  const yearsRaw = str(formData, "yearsExperience");
  const yearsExperience = yearsRaw === null ? null : Number(yearsRaw);
  if (yearsExperience !== null && (Number.isNaN(yearsExperience) || yearsExperience < 0 || yearsExperience > 100)) {
    return { ok: false, error: "years_range" };
  }
  const specialties = formData
    .getAll("specialties")
    .map((v) => String(v).trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("brands")
    .update({
      tagline,
      founded_on: str(formData, "foundedOn"),
      philosophy: str(formData, "philosophy"),
      years_experience: yearsExperience,
      specialties,
    })
    .eq("id", brandId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/brand-os");
  revalidatePath(`/b/${brandSlug}`);
  return { ok: true };
}

/** DB caps at 12/brand (brand_gallery insert policy); this surfaces that as a
 * normal error rather than a crash if a race slips one in first. */
export async function addGalleryPhoto(
  brandId: string,
  brandSlug: string,
  formData: FormData,
): Promise<BrandKitActionResult> {
  const { supabase } = await requireUser();
  const photoUrl = str(formData, "photoUrl");
  if (!photoUrl) return { ok: false, error: "required" };
  const { count } = await supabase
    .from("brand_gallery")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId);

  const { error } = await supabase.from("brand_gallery").insert({
    brand_id: brandId,
    photo_url: photoUrl,
    caption: str(formData, "caption"),
    display_order: count ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/brand-os");
  revalidatePath(`/b/${brandSlug}`);
  return { ok: true };
}

export async function updateGalleryCaption(
  photoId: string,
  brandSlug: string,
  caption: string | null,
): Promise<BrandKitActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("brand_gallery").update({ caption }).eq("id", photoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/brand-os");
  revalidatePath(`/b/${brandSlug}`);
  return { ok: true };
}

export async function deleteGalleryPhoto(photoId: string, brandSlug: string): Promise<BrandKitActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("brand_gallery").delete().eq("id", photoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/brand-os");
  revalidatePath(`/b/${brandSlug}`);
  return { ok: true };
}

import { createClient } from "@/lib/supabase/server";

export type BrandKit = {
  tagline: string | null;
  foundedOn: string | null;
  philosophy: string | null;
  yearsExperience: number | null;
  specialties: string[];
};

type BrandKitRow = {
  tagline: string | null;
  founded_on: string | null;
  philosophy: string | null;
  years_experience: number | null;
  specialties: string[] | null;
};

const EMPTY_KIT: BrandKit = {
  tagline: null,
  foundedOn: null,
  philosophy: null,
  yearsExperience: null,
  specialties: [],
};

/** Phase B.2 brand identity kit fields (20260729180850_brand_identity_kit.sql). */
export async function getBrandKit(brandId: string): Promise<BrandKit> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("tagline,founded_on,philosophy,years_experience,specialties")
    .eq("id", brandId)
    .maybeSingle();
  if (!data) return EMPTY_KIT;
  const r = data as BrandKitRow;
  return {
    tagline: r.tagline,
    foundedOn: r.founded_on,
    philosophy: r.philosophy,
    yearsExperience: r.years_experience,
    specialties: r.specialties ?? [],
  };
}

export type BrandGalleryPhoto = {
  id: string;
  photoUrl: string;
  caption: string | null;
  displayOrder: number;
};

type BrandGalleryRow = {
  id: string;
  photo_url: string;
  caption: string | null;
  display_order: number;
};

/** Public read; capped at 12/brand at the DB (brand_gallery insert policy). */
export async function getBrandGallery(brandId: string): Promise<BrandGalleryPhoto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brand_gallery")
    .select("id,photo_url,caption,display_order")
    .eq("brand_id", brandId)
    .order("display_order", { ascending: true });
  return ((data ?? []) as BrandGalleryRow[]).map((r) => ({
    id: r.id,
    photoUrl: r.photo_url,
    caption: r.caption,
    displayOrder: r.display_order,
  }));
}

import { createClient } from "@/lib/supabase/server";

export type BrandType =
  | "kennel"
  | "llc"
  | "pet_shop"
  | "product_brand"
  | "rescue"
  | "service_provider"
  | "creator"
  | "independent_seller";

export type MyBrand = {
  id: string;
  name: string;
  brandType: BrandType;
  avatarUrl: string | null;
};

type BrandRow = { id: string; name: string; brand_type: BrandType; avatar_url: string | null };

/** Brands the signed-in user can post as (owner-only this slice, via brand_memberships). */
export async function getMyBrands(userId: string): Promise<MyBrand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_memberships")
    .select("brands ( id, name, brand_type, avatar_url )")
    .eq("profile_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  // Supabase types the embedded relation as an array; brand_id is many-to-one so
  // at runtime it's a single object. Normalize both shapes.
  return (data ?? [])
    .flatMap((row) => {
      const rel = (row as { brands: BrandRow | BrandRow[] | null }).brands;
      return rel ? (Array.isArray(rel) ? rel : [rel]) : [];
    })
    .map((b) => ({ id: b.id, name: b.name, brandType: b.brand_type, avatarUrl: b.avatar_url }));
}

/** Honest content counts for a brand, from existing tables only (no fabricated metrics). */
export async function getBrandContentCounts(brandId: string): Promise<{ posts: number; listings: number }> {
  const supabase = await createClient();
  const [posts, listings] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("brand_id", brandId),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("brand_id", brandId),
  ]);
  return { posts: posts.count ?? 0, listings: listings.count ?? 0 };
}

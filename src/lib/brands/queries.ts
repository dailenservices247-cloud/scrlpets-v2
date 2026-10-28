import { createClient } from "@/lib/supabase/server";
import type { BrandRole } from "./types";

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
  slug: string;
  brandType: BrandType;
  avatarUrl: string | null;
  bannerUrl: string | null;
  restrictPostingToManagers: boolean;
};

export type BrandAccess = MyBrand & {
  membershipId: string;
  role: BrandRole;
  // matrix row 3: may post as this brand when a manager, or the brand is unrestricted.
  canPostAs: boolean;
};

export type BrandMember = {
  membershipId: string;
  profileId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: BrandRole;
  joinedAt: string;
};

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  brand_type: BrandType;
  avatar_url: string | null;
  banner_url: string | null;
  restrict_posting_to_managers: boolean;
};

function toMyBrand(b: BrandRow): MyBrand {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    brandType: b.brand_type,
    avatarUrl: b.avatar_url,
    bannerUrl: b.banner_url,
    restrictPostingToManagers: b.restrict_posting_to_managers,
  };
}

/** Every brand the signed-in person can operate as, with their fixed role. */
export async function getMyBrands(userId: string): Promise<BrandAccess[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_memberships")
    .select(
      "id, role, brands ( id, name, slug, brand_type, avatar_url, banner_url, restrict_posting_to_managers )",
    )
    .eq("profile_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  // Supabase types the embedded relation as an array; brand_id is many-to-one so
  // at runtime it's a single object. Normalize both shapes.
  return (data ?? []).flatMap((row) => {
    const membership = row as {
      id: string;
      role: BrandRole;
      brands: BrandRow | BrandRow[] | null;
    };
    const rel = membership.brands;
    const brands = rel ? (Array.isArray(rel) ? rel : [rel]) : [];
    return brands.map((brand) => {
      const my = toMyBrand(brand);
      const isManager = membership.role === "owner" || membership.role === "admin";
      return {
        ...my,
        membershipId: membership.id,
        role: membership.role,
        canPostAs: isManager || !my.restrictPostingToManagers,
      };
    });
  });
}

export async function getBrandRole(
  userId: string,
  brandId: string,
): Promise<BrandRole | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_memberships")
    .select("role")
    .eq("brand_id", brandId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as BrandRole | undefined) ?? null;
}

export async function getManageableBrandIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_memberships")
    .select("brand_id")
    .eq("profile_id", userId)
    .in("role", ["owner", "admin"]);
  if (error) throw error;
  return (data ?? []).map((row) => row.brand_id);
}

export async function getBrandMembers(brandId: string): Promise<BrandMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_memberships")
    .select("id, profile_id, role, created_at, profiles ( id, username, display_name, avatar_url )")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const membership = row as {
      id: string;
      profile_id: string;
      role: BrandRole;
      created_at: string;
      profiles:
        | { id: string; username: string; display_name: string | null; avatar_url: string | null }
        | { id: string; username: string; display_name: string | null; avatar_url: string | null }[]
        | null;
    };
    const profile = Array.isArray(membership.profiles)
      ? membership.profiles[0]
      : membership.profiles;
    if (!profile) return [];
    return [{
      membershipId: membership.id,
      profileId: membership.profile_id,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      role: membership.role,
      joinedAt: membership.created_at,
    }];
  });
}

export type PublicBrand = MyBrand & { ownerId: string; createdAt: string };

/** Public brand lookup for /b/[slug] (brands are public-read per G1-A). */
export async function getBrandBySlug(slug: string): Promise<PublicBrand | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name, slug, brand_type, avatar_url, banner_url, restrict_posting_to_managers, owner_id, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return { ...toMyBrand(data as BrandRow), ownerId: data.owner_id, createdAt: data.created_at };
}

/** Brands owned by a profile — for the person-profile managed-brand card (real data only). */
export async function getBrandsByOwner(ownerId: string): Promise<MyBrand[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name, slug, brand_type, avatar_url, banner_url, restrict_posting_to_managers")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as BrandRow[]).map(toMyBrand);
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

export type PublicBrandTeamMember = {
  profileId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: BrandRole;
  isVerified: boolean;
};

type PublicBrandTeamRow = {
  profile_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: BrandRole;
  is_verified: boolean;
};

/**
 * The people running an establishment (`owner`, `admin`, `contributor`) for
 * public display on `/b/[slug]`. Uses the security-definer RPC so visitors can
 * see and click through to the team without opening raw `brand_memberships` RLS.
 */
export async function getPublicBrandTeam(brandId: string): Promise<PublicBrandTeamMember[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_brand_team", { target_brand: brandId });
  return ((data ?? []) as PublicBrandTeamRow[]).map((r) => ({
    profileId: r.profile_id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    role: r.role,
    isVerified: Boolean(r.is_verified),
  }));
}

export type ProfilePublicBrand = MyBrand & { role?: BrandRole };

type ProfilePublicBrandRow = BrandRow & { role: BrandRole };

/**
 * All active establishments a profile helps operate (`owner`, `admin`, or
 * `contributor`) for `/u/[username]`. Falls back to `getBrandsByOwner` if the
 * RPC returns nothing.
 */
export async function getProfilePublicBrands(profileId: string): Promise<ProfilePublicBrand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("profile_public_brands", {
    target_profile: profileId,
  });
  if (!error && Array.isArray(data) && data.length > 0) {
    return (data as ProfilePublicBrandRow[]).map((b) => ({
      ...toMyBrand(b),
      role: b.role,
    }));
  }
  return getBrandsByOwner(profileId);
}

export type BrandRosterCreature = {
  id: string;
  name: string;
  slug: string;
  species: string | null;
  breed: string | null;
  avatarUrl: string | null;
  creatureRole: string;
  deceasedAt: string | null;
};

/**
 * Public animals belonging to an establishment's operator roster (visible,
 * non-archived, in_roster=true), including memorialized foundation animals.
 */
export async function listBrandCreatures(ownerId: string): Promise<BrandRosterCreature[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures")
    .select("id,name,slug,species,breed,avatar_url,creature_role,deceased_at")
    .eq("owner_id", ownerId)
    .eq("in_roster", true)
    .eq("page_visible", true)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(24);
  return (
    (data ?? []) as {
      id: string;
      name: string;
      slug: string;
      species: string | null;
      breed: string | null;
      avatar_url: string | null;
      creature_role: string;
      deceased_at: string | null;
    }[]
  ).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    species: c.species,
    breed: c.breed,
    avatarUrl: c.avatar_url,
    creatureRole: c.creature_role,
    deceasedAt: c.deceased_at,
  }));
}

export type BrandPublicLitter = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  status: string;
  expectedDate: string | null;
  birthDate: string | null;
};

/** Litters attributed to this brand or its primary operator. */
export async function listBrandLitters(
  brandId: string,
  ownerId: string,
): Promise<BrandPublicLitter[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("litters")
    .select("id,name,species,breed,status,expected_date,birth_date")
    .or(`brand_id.eq.${brandId},owner_id.eq.${ownerId}`)
    .order("created_at", { ascending: false })
    .limit(12);
  return (
    (data ?? []) as {
      id: string;
      name: string;
      species: string | null;
      breed: string | null;
      status: string;
      expected_date: string | null;
      birth_date: string | null;
    }[]
  ).map((l) => ({
    id: l.id,
    name: l.name,
    species: l.species,
    breed: l.breed,
    status: l.status,
    expectedDate: l.expected_date,
    birthDate: l.birth_date,
  }));
}

import { createClient } from "@/lib/supabase/server";

/**
 * The record-keeping shape: every field the wizard can edit, plus a computed
 * young count. Returning the full row (not a list-only summary) means opening
 * the edit wizard on a card never needs a second fetch — mirrors MyService in
 * src/lib/services/queries.ts.
 */
export type MyLitter = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  description: string | null;
  expectedDate: string | null;
  birthDate: string | null;
  status: string;
  sireId: string | null;
  damId: string | null;
  brandId: string | null;
  youngCount: number;
};

type LitterRow = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  description: string | null;
  expected_date: string | null;
  birth_date: string | null;
  status: string;
  sire_id: string | null;
  dam_id: string | null;
  brand_id: string | null;
};

/** Owner-scoped (R16 convention): a litter's owner_id is always the person who recorded it, brand-attached or not. */
export async function listMyLitters(ownerId: string): Promise<MyLitter[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("litters")
    .select(
      "id,name,species,breed,description,expected_date,birth_date,status,sire_id,dam_id,brand_id",
    )
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as LitterRow[];
  if (rows.length === 0) return [];

  // One round trip for every litter's young count, joined client-side —
  // mirrors getRoster's listing-count Map in src/lib/breeder-os/queries.ts.
  const { data: young } = await supabase
    .from("creatures")
    .select("litter_id")
    .in(
      "litter_id",
      rows.map((r) => r.id),
    );
  const counts = new Map<string, number>();
  for (const y of (young ?? []) as { litter_id: string }[]) {
    counts.set(y.litter_id, (counts.get(y.litter_id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    breed: r.breed,
    description: r.description,
    expectedDate: r.expected_date,
    birthDate: r.birth_date,
    status: r.status,
    sireId: r.sire_id,
    damId: r.dam_id,
    brandId: r.brand_id,
    youngCount: counts.get(r.id) ?? 0,
  }));
}

export type BreedingCreature = { id: string; name: string };

/** Dam/sire picker options: the caller's own creatures marked as breeding stock (the DB trigger enforces ownership regardless). */
export async function listOwnBreedingCreatures(ownerId: string): Promise<BreedingCreature[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures")
    .select("id,name")
    .eq("owner_id", ownerId)
    .is("archived_at", null)
    .eq("creature_role", "breeding")
    .order("name")
    .limit(200);
  return (data ?? []) as BreedingCreature[];
}

export type LinkableCreature = {
  id: string;
  name: string;
  species: string | null;
  litterId: string | null;
};

/**
 * Every creature the caller owns, for the wizard's "link existing young" step.
 * Fetched once for the whole /litters page; each wizard instance filters to
 * litterId === null || litterId === thisLitter.id client-side.
 */
export async function listOwnCreatures(ownerId: string): Promise<LinkableCreature[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures")
    .select("id,name,species,litter_id")
    .eq("owner_id", ownerId)
    .order("name")
    .limit(500);
  return (
    (data ?? []) as { id: string; name: string; species: string | null; litter_id: string | null }[]
  ).map((c) => ({ id: c.id, name: c.name, species: c.species, litterId: c.litter_id }));
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type PublicLitterParent = {
  id: string;
  name: string;
  slug: string;
} | null;

export type PublicLitter = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  description: string | null;
  expectedDate: string | null;
  birthDate: string | null;
  status: string;
  ownerId: string;
  owner: { username: string } | null;
  brand: { name: string; slug: string } | null;
  dam: PublicLitterParent;
  sire: PublicLitterParent;
};

type PublicLitterRow = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  description: string | null;
  expected_date: string | null;
  birth_date: string | null;
  status: string;
  owner_id: string;
  profiles: { username: string } | { username: string }[] | null;
  brands: { name: string; slug: string } | { name: string; slug: string }[] | null;
  dam: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
  sire: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};

/**
 * Public litter page. Every embed here (dam/sire/brand/owner) rides the SAME
 * request-scoped RLS-aware client as the top-level select, so PostgREST
 * applies each embedded table's own RLS row-by-row: a hidden dam/sire simply
 * resolves to null for a non-owner visitor (creatures' "public read visible
 * creatures" policy) with no app-layer visibility check needed here.
 */
export async function getPublicLitter(id: string): Promise<PublicLitter | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("litters")
    .select(
      "id,name,species,breed,description,expected_date,birth_date,status,owner_id," +
        "profiles!litters_owner_id_fkey(username)," +
        "brands!litters_brand_id_fkey(name,slug)," +
        "dam:creatures!litters_dam_id_fkey(id,name,slug)," +
        "sire:creatures!litters_sire_id_fkey(id,name,slug)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as PublicLitterRow;
  const dam = unwrapOne(row.dam);
  const sire = unwrapOne(row.sire);
  const owner = unwrapOne(row.profiles);
  const brand = unwrapOne(row.brands);

  return {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    description: row.description,
    expectedDate: row.expected_date,
    birthDate: row.birth_date,
    status: row.status,
    ownerId: row.owner_id,
    owner: owner ? { username: owner.username } : null,
    brand: brand ? { name: brand.name, slug: brand.slug } : null,
    dam: dam ? { id: dam.id, name: dam.name, slug: dam.slug } : null,
    sire: sire ? { id: sire.id, name: sire.name, slug: sire.slug } : null,
  };
}

export type LitterYoung = {
  id: string;
  name: string;
  slug: string;
  species: string | null;
  listingId: string | null;
};

type YoungRow = { id: string; name: string; slug: string; species: string | null };

/**
 * A litter's young, RLS-scoped: a visitor sees page_visible creatures only,
 * the owner sees all of theirs (same "public read visible creatures" policy
 * that gates getCreatureBySlug in src/lib/profiles/queries.ts).
 */
export async function getLitterYoung(litterId: string): Promise<LitterYoung[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures")
    .select("id,name,slug,species")
    .eq("litter_id", litterId)
    .order("created_at");
  const rows = (data ?? []) as YoungRow[];
  if (rows.length === 0) return [];

  // "Available" = a non-deleted listing exists for that young, per the build spec.
  const { data: listings } = await supabase
    .from("listings")
    .select("id,creature_id")
    .in(
      "creature_id",
      rows.map((r) => r.id),
    )
    .is("deleted_at", null);
  const listingByCreature = new Map(
    ((listings ?? []) as { id: string; creature_id: string }[]).map((l) => [l.creature_id, l.id]),
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    species: r.species,
    listingId: listingByCreature.get(r.id) ?? null,
  }));
}

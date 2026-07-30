import { createClient } from "@/lib/supabase/server";

export type SearchResults = {
  people: { username: string; displayName: string | null; avatarUrl: string | null }[];
  brands: { slug: string; name: string; avatarUrl: string | null }[];
  animals: { slug: string; name: string; avatarUrl: string | null }[];
  listings: { id: string; title: string; priceCents: number | null }[];
};

// V7-04: server-side listing filters. All optional — undefined means unset.
export type SearchFilters = {
  species?: string;
  listingKind?: "sale" | "adoption";
  minPriceCents?: number;
  maxPriceCents?: number;
};

const EMPTY: SearchResults = { people: [], brands: [], animals: [], listings: [] };

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    Boolean(filters.species) ||
    Boolean(filters.listingKind) ||
    filters.minPriceCents != null ||
    filters.maxPriceCents != null
  );
}

// Escape LIKE wildcards so a literal % or _ can't widen the match.
function likePattern(raw: string): string {
  return `%${raw.replace(/[%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * R11 + V7-04: search across the public entities, plus filters applied in the
 * query (species, listing kind, price range) scoped to the listings arm.
 * Filters can narrow a listing browse even with no free text; people/brands/
 * animals still need >=2 chars, unchanged from before. ILIKE is right at this
 * scale; swap to a tsvector index when the row counts justify it.
 */
export async function search(rawQuery: string, filters: SearchFilters = {}): Promise<SearchResults> {
  const q = rawQuery.trim();
  const textSearch = q.length >= 2;
  if (!textSearch && !hasActiveFilters(filters)) return EMPTY;

  const supabase = await createClient();
  const pattern = textSearch ? likePattern(q) : null;

  // The species filter only makes sense for listings with an animal attached,
  // so it inner-joins creatures (excluding shop/product listings) — otherwise
  // skip the join entirely rather than carry an unused embed.
  const selectCols = filters.species
    ? "id, title, price_cents, creatures!inner(species)"
    : "id, title, price_cents";
  let listingsQuery = supabase
    .from("listings")
    .select(selectCols)
    // Matches the sibling shop/adoption listing queries — a soft-deleted
    // listing has no business surfacing in a filtered browse either.
    .is("deleted_at", null);
  if (pattern) listingsQuery = listingsQuery.ilike("title", pattern);
  if (filters.species) {
    // Exact, case-insensitive — no wildcards. The saved-search notify trigger
    // matches species with `lower(c.species) = lower(s.species)`, not a
    // substring; a fuzzy filter here would preview broader results than the
    // alerts a saved copy of this same search would ever actually send.
    listingsQuery = listingsQuery.ilike("creatures.species", filters.species);
  }
  if (filters.listingKind) listingsQuery = listingsQuery.eq("listing_kind", filters.listingKind);
  if (filters.minPriceCents != null) listingsQuery = listingsQuery.gte("price_cents", filters.minPriceCents);
  if (filters.maxPriceCents != null) listingsQuery = listingsQuery.lte("price_cents", filters.maxPriceCents);

  type ListingRow = { id: string; title: string; price_cents: number | null };
  type PersonRow = { username: string; display_name: string | null; avatar_url: string | null };
  type NamedRow = { slug: string; name: string; avatar_url: string | null };

  const peoplePromise = pattern
    ? supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
        .limit(10)
    : null;
  const brandsPromise = pattern
    ? supabase.from("brands").select("slug, name, avatar_url").ilike("name", pattern).limit(10)
    : null;
  const animalsPromise = pattern
    ? supabase.from("creatures").select("slug, name, avatar_url").ilike("name", pattern).limit(10)
    : null;

  const [listingsRes, peopleRes, brandsRes, animalsRes] = await Promise.all([
    listingsQuery.limit(10),
    peoplePromise,
    brandsPromise,
    animalsPromise,
  ]);

  return {
    people: ((peopleRes?.data ?? []) as unknown as PersonRow[]).map((r) => ({
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
    })),
    brands: ((brandsRes?.data ?? []) as unknown as NamedRow[]).map((r) => ({
      slug: r.slug,
      name: r.name,
      avatarUrl: r.avatar_url,
    })),
    animals: ((animalsRes?.data ?? []) as unknown as NamedRow[]).map((r) => ({
      slug: r.slug,
      name: r.name,
      avatarUrl: r.avatar_url,
    })),
    listings: ((listingsRes.data ?? []) as unknown as ListingRow[]).map((r) => ({
      id: r.id,
      title: r.title,
      priceCents: r.price_cents,
    })),
  };
}

// V2-04: saved searches. RLS is own-CRUD and the DB caps 20/user — this file
// only reads; src/lib/search/actions.ts owns the writes.
export type SavedSearch = {
  id: string;
  name: string;
  query: string;
  species: string | null;
  listingKind: "sale" | "adoption" | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  notifyEnabled: boolean;
};

type SavedSearchRow = {
  id: string;
  name: string;
  query: string;
  species: string | null;
  listing_kind: "sale" | "adoption" | null;
  min_price_cents: number | null;
  max_price_cents: number | null;
  notify_enabled: boolean;
};

/**
 * The species filter matches exactly (case-insensitively) so a saved search's
 * results and its future alerts agree — notify_saved_search_matches compares
 * the same way. Exact matching only works if the real values are discoverable,
 * hence this list: species is free text with no DB constraint, so it is read
 * from the animals actually listed rather than a hardcoded vocabulary that
 * would silently hide geckos, parakeets and everything else.
 */
export async function listListedSpecies(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("creatures!inner(species)")
    .is("deleted_at", null)
    .limit(500);
  const rows = (data ?? []) as unknown as { creatures: { species: string | null } | null }[];
  const seen = new Map<string, string>();
  for (const r of rows) {
    const s = r.creatures?.species?.trim();
    if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export async function listSavedSearches(profileId: string): Promise<SavedSearch[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_searches")
    .select("id,name,query,species,listing_kind,min_price_cents,max_price_cents,notify_enabled")
    .eq("profile_id", profileId)
    .order("name");
  return ((data ?? []) as unknown as SavedSearchRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    query: r.query,
    species: r.species,
    listingKind: r.listing_kind,
    minPriceCents: r.min_price_cents,
    maxPriceCents: r.max_price_cents,
    notifyEnabled: r.notify_enabled,
  }));
}

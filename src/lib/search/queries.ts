import { createClient } from "@/lib/supabase/server";

export type SearchResults = {
  people: { username: string; displayName: string | null; avatarUrl: string | null }[];
  brands: { slug: string; name: string; avatarUrl: string | null }[];
  animals: { slug: string; name: string; avatarUrl: string | null }[];
  listings: { id: string; title: string; priceCents: number | null }[];
};

const EMPTY: SearchResults = { people: [], brands: [], animals: [], listings: [] };

/**
 * R11: search across the public entities. ILIKE is right at this scale; swap to
 * a tsvector index when the row counts justify it.
 */
export async function search(rawQuery: string): Promise<SearchResults> {
  const q = rawQuery.trim();
  if (q.length < 2) return EMPTY;
  // Escape LIKE wildcards so a literal % or _ can't widen the match.
  const pattern = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const supabase = await createClient();

  const [people, brands, animals, listings] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
      .limit(10),
    supabase.from("brands").select("slug, name, avatar_url").ilike("name", pattern).limit(10),
    supabase.from("creatures").select("slug, name, avatar_url").ilike("name", pattern).limit(10),
    supabase.from("listings").select("id, title, price_cents").ilike("title", pattern).limit(10),
  ]);

  return {
    people: ((people.data ?? []) as { username: string; display_name: string | null; avatar_url: string | null }[]).map(
      (r) => ({ username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url }),
    ),
    brands: ((brands.data ?? []) as { slug: string; name: string; avatar_url: string | null }[]).map((r) => ({
      slug: r.slug,
      name: r.name,
      avatarUrl: r.avatar_url,
    })),
    animals: ((animals.data ?? []) as { slug: string; name: string; avatar_url: string | null }[]).map((r) => ({
      slug: r.slug,
      name: r.name,
      avatarUrl: r.avatar_url,
    })),
    listings: ((listings.data ?? []) as { id: string; title: string; price_cents: number | null }[]).map((r) => ({
      id: r.id,
      title: r.title,
      priceCents: r.price_cents,
    })),
  };
}

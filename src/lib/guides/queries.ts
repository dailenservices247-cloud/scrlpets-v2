import { createClient } from "@/lib/supabase/server";

export type GuideAudience = "owner" | "breeder" | "buyer";

export type Guide = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  audience: GuideAudience;
  /** E: both nullable — an uncategorised general guide is valid, not a defect. */
  category: string | null;
  species: string | null;
  publishedAt: string | null;
};

export type GuideDetail = Guide & { body: string };

/** E: what the browse form can narrow by. Every field optional; unset = no filter. */
export type GuideFilters = {
  q?: string;
  category?: string;
  species?: string;
  /** Restrict to these guide ids — how "only my bookmarks" is expressed. */
  onlyIds?: string[];
};

const GUIDE_COLUMNS = "id,slug,title,summary,audience,category,species,published_at";

type GuideRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  audience: GuideAudience;
  category: string | null;
  species: string | null;
  published_at: string | null;
};

function toGuide(g: GuideRow): Guide {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    summary: g.summary,
    audience: g.audience,
    category: g.category,
    species: g.species,
    publishedAt: g.published_at,
  };
}

/**
 * Escape LIKE wildcards so a literal % or _ cannot widen the match. Same shape
 * as the one in src/lib/search/queries.ts — three lines, deliberately copied
 * rather than exported across two feature libraries that share nothing else.
 */
function likePattern(raw: string): string {
  return `%${raw.replace(/[%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * D5: education surfaces. RLS returns only published guides to everyone except
 * admins, so an unapproved draft can never leak into the public list.
 *
 * E adds filters. They are applied in the QUERY, matching how /search does it,
 * so the page stays a plain server render with the filters in the URL —
 * shareable, back-button-correct, and no client-side list state to drift.
 */
export async function listGuides(filters: GuideFilters = {}): Promise<Guide[]> {
  const supabase = await createClient();
  let query = supabase
    .from("guides")
    .select(GUIDE_COLUMNS)
    .not("published_at", "is", null);

  const q = filters.q?.trim();
  if (q) {
    const pattern = likePattern(q);
    query = query.or(`title.ilike.${pattern},summary.ilike.${pattern}`);
  }
  // Exact and case-insensitive, no wildcards: these come from the facet lists
  // below, which are built from the values actually stored, so a substring
  // match would only ever widen a choice the reader made from a fixed set.
  if (filters.category) query = query.ilike("category", filters.category);
  if (filters.species) query = query.ilike("species", filters.species);
  if (filters.onlyIds) {
    if (filters.onlyIds.length === 0) return [];
    query = query.in("id", filters.onlyIds);
  }

  const { data } = await query
    .order("audience", { ascending: true })
    .order("published_at", { ascending: false });
  return ((data ?? []) as GuideRow[]).map(toGuide);
}

/**
 * The category and species values that published guides actually carry.
 *
 * Read from the data, never hardcoded — the same reasoning as listListedSpecies
 * in src/lib/search/queries.ts. A fixed vocabulary would quietly hide every
 * guide written about a species someone forgot to add to the list, which for an
 * app covering all animals sold as pets is most of them.
 */
export async function listGuideFacets(): Promise<{ categories: string[]; species: string[] }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guides")
    .select("category,species")
    .not("published_at", "is", null)
    .limit(500);
  const rows = (data ?? []) as { category: string | null; species: string | null }[];
  const pick = (key: "category" | "species") => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const v = r[key]?.trim();
      if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  };
  return { categories: pick("category"), species: pick("species") };
}

/**
 * The VIEWER's own bookmarks, and nobody else's. RLS is own-read only, so this
 * cannot return another person's rows even if it were asked to — and nothing in
 * the app ever asks. There is deliberately no count, no "popular guides" and no
 * reader list: what someone reads about is not other people's business.
 */
export async function getMyBookmarkedGuideIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from("guide_bookmarks")
    .select("guide_id")
    .eq("profile_id", user.id);
  return new Set(((data ?? []) as { guide_id: string }[]).map((r) => r.guide_id));
}

/**
 * Guides authored FOR one breed/species community. Same RLS as the public list,
 * so a group tab can only ever show published guides. A group with none gets an
 * empty array and an empty state — never a general guide dressed up as the
 * community's own.
 */
export async function listGuidesForGroup(groupId: string): Promise<Guide[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guides")
    .select(GUIDE_COLUMNS)
    .eq("group_id", groupId)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });
  return ((data ?? []) as GuideRow[]).map(toGuide);
}

/** Admin-only: drafts awaiting Dailen's approval. RLS returns [] to everyone else. */
export async function getDraftGuides(): Promise<GuideDetail[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guides")
    .select(`${GUIDE_COLUMNS},body`)
    .is("published_at", null)
    .order("created_at", { ascending: true });
  return ((data ?? []) as (GuideRow & { body: string })[]).map((g) => ({
    ...toGuide(g),
    body: g.body,
  }));
}

export async function getGuideBySlug(slug: string): Promise<GuideDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guides")
    .select(`${GUIDE_COLUMNS},body`)
    .eq("slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();
  if (!data) return null;
  const g = data as GuideRow & { body: string };
  return { ...toGuide(g), body: g.body };
}

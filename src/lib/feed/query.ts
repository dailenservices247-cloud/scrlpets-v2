import type { FeedItem, FeedItemType } from "./types";

export type Row = {
  id: string; kind: string; subtype: string | null; author_id: string;
  username: string; display_name: string | null; avatar_url: string | null;
  creature_id: string | null; creature_name: string | null; creature_slug: string | null; creature_avatar: string | null;
  title: string | null; media_url: string | null; created_at: string; updated_at: string;
  posting_as_type: string | null; brand_id: string | null; brand_name: string | null; brand_avatar: string | null;
  brand_slug: string | null;
};

export function rowToFeedItem(r: Row): FeedItem {
  const type = (r.subtype ?? r.kind) as FeedItemType; // reel/long_video come via subtype
  return {
    id: r.id,
    type,
    author: { id: r.author_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url },
    brand:
      r.posting_as_type === "brand" && r.brand_id && r.brand_slug
        ? { id: r.brand_id, name: r.brand_name ?? "Brand", slug: r.brand_slug, avatarUrl: r.brand_avatar }
        : null,
    creature: r.creature_id
      ? { id: r.creature_id, name: r.creature_name!, slug: r.creature_slug!, avatarUrl: r.creature_avatar }
      : null,
    title: r.title,
    mediaUrl: r.media_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function isE2EDemoItem(item: FeedItem): boolean {
  return item.title?.startsWith("E2E ") ?? false;
}

export type FeedTab = "following" | "for_you";

/** Deterministic string hash — stable For-You ordering without a ranker (real ranking deferred). */
export function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Following = content from profiles the signed-in viewer follows (plus their own).
 * Until you follow anyone (and for guests, who can't follow), Following falls back
 * to all public content — a discovery bootstrap so a new or guest feed is never
 * empty and G1 discovery never breaks. Once you follow someone it becomes a real
 * filtered feed. For You = all public content, stable hash shuffle.
 */
/**
 * Fixture hiding is a DEPLOYMENT concern, not a build-mode one.
 *
 * It used to key off NODE_ENV, which broke the moment the E2E suite moved to a
 * production build (2026-07-29): the suite's own `E2E *` markers became
 * invisible to the feed it was asserting on — ten specs failed for doing
 * exactly what they were written to do. `E2E_KEEP_FIXTURES=1` is set only by
 * the test server, so real deploys keep hiding fixtures as before.
 */
function hideFixtures(): boolean {
  if (process.env.E2E_KEEP_FIXTURES === "1") return false;
  return process.env.NODE_ENV === "production";
}

export async function getFeed(
  tab: FeedTab,
  viewerId?: string | null,
): Promise<FeedItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  let query = supabase
    .from("unified_feed")
    .select("*")
    .order("created_at", { ascending: false });
  if (hideFixtures()) {
    // NULL-safe: `not like` alone is NULL-eliminating in SQL and would drop
    // caption-less media posts (NULL title) from the production feed.
    query = query.or("title.is.null,title.not.like.E2E *");
  }
  if (viewerId) {
    const { getBlockedFeedIds } = await import("@/lib/social/follows");
    const blocked = await getBlockedFeedIds(viewerId);
    // Hide content from anyone you blocked or who blocked you, on both tabs.
    if (blocked.length > 0) {
      query = query.not(
        "author_id",
        "in",
        `(${blocked.join(",")})`,
      );
    }
  }
  if (tab === "following" && viewerId) {
    const { getFollowingIds } = await import("@/lib/social/follows");
    const followed = await getFollowingIds(viewerId);
    // Only filter once you actually follow someone; otherwise show all content
    // (discovery bootstrap) so the default feed is never empty on first run.
    if (followed.length > 0) {
      query = query.in("author_id", [...followed, viewerId]); // + your own posts
    }
  }
  const { data, error } = await query.limit(hideFixtures() ? 50 : 200);
  if (error) throw error;
  const items = (data as Row[]).map(rowToFeedItem);
  if (tab === "for_you") items.sort((a, b) => hashId(a.id) - hashId(b.id));
  return items;
}

/** All content published AS a brand (posts + listings carrying brand_id). Public per G1-A. */
export async function getBrandFeed(brandId: string): Promise<FeedItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unified_feed")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as Row[]).map(rowToFeedItem);
}

export async function getFeedItemById(id: string): Promise<FeedItem | null> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unified_feed")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToFeedItem(data as Row) : null;
}

/**
 * F3 / punch list A6: the listing destination is a gateway into the seller's
 * world — other live listings from the same brand (or the same person when
 * unbranded), newest first.
 */
export async function getMoreListingsFrom(
  item: FeedItem,
  limit = 6,
): Promise<FeedItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  let query = supabase
    .from("unified_feed")
    .select("*")
    .eq("kind", "listing")
    .neq("id", item.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  query = item.brand
    ? query.eq("brand_id", item.brand.id)
    : query.eq("author_id", item.author.id).is("brand_id", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data as Row[]).map(rowToFeedItem);
}

/** F4 / punch list A4: the reel realm's vertical queue, newest first. */
export async function getReelQueue(limit = 50): Promise<FeedItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unified_feed")
    .select("*")
    .eq("subtype", "reel")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Row[]).map(rowToFeedItem);
}

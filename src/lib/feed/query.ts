import type { FeedItem, FeedItemType } from "./types";

/** post/reel/long_video are all rows in `posts`; listing/promo are not. */
export const POST_FAMILY: readonly FeedItemType[] = ["post", "reel", "long_video"];

export type Row = {
  id: string; kind: string; subtype: string | null; author_id: string;
  username: string; display_name: string | null; avatar_url: string | null;
  creature_id: string | null; creature_name: string | null; creature_slug: string | null; creature_avatar: string | null;
  title: string | null; media_url: string | null; created_at: string; updated_at: string;
  posting_as_type: string | null; brand_id: string | null; brand_name: string | null; brand_avatar: string | null;
  brand_slug: string | null;
  // Optional so the existing hand-written Row literals in the unit tests keep
  // compiling; the view supplies all three on every branch.
  group_id?: string | null; group_slug?: string | null; group_name?: string | null;
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
    // slug gates the chip, not group_id: the chip is a link and there is
    // nowhere to send someone without it.
    group:
      r.group_id && r.group_slug
        ? { id: r.group_id, slug: r.group_slug, name: r.group_name ?? r.group_slug }
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
 * Below MIN_FOLLOWING_FOR_FILTER follows (and for guests, who can't follow at
 * all) Following falls back to all public content — a discovery bootstrap so a
 * new or guest feed is never empty and G1 discovery never breaks. Once the
 * graph is real it becomes a real filtered feed. For You = all public content,
 * stable hash shuffle.
 *
 * Anything that broadens has to SAY it broadened: `followingFeedBroadened`
 * exists so the tab can label itself honestly instead of presenting strangers
 * as people you follow.
 */
export const MIN_FOLLOWING_FOR_FILTER = 3;

/**
 * True when the Following tab is showing more than the viewer's own graph.
 * Guests are always broadened — they have no graph to filter by.
 */
export async function followingFeedBroadened(
  viewerId?: string | null,
): Promise<boolean> {
  if (!viewerId) return true;
  const { countFollowing } = await import("@/lib/social/follows");
  return (await countFollowing(viewerId)) < MIN_FOLLOWING_FOR_FILTER;
}

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

/**
 * Commercial density caps: at most one listing and one promo per DENSITY_WINDOW
 * items. Legacy had this rule and it was right — without it the feed is purely
 * reverse-chronological, so a burst of listings starves every other content
 * type. That is not hypothetical: 209 accumulated listings once filled all 200
 * feed slots and pushed every post, reel and video off the surface entirely.
 *
 * Overflow is DROPPED rather than reordered — a listing that has to jump 40
 * slots to be shown is no longer "recent", and silently re-sorting by
 * commercial type is how a marketplace feed becomes an ad feed.
 */
export const DENSITY_WINDOW = 8;

export function applyDensityCaps(items: FeedItem[]): FeedItem[] {
  const out: FeedItem[] = [];
  let sinceListing = DENSITY_WINDOW;
  let sincePromo = DENSITY_WINDOW;
  for (const item of items) {
    const commercial =
      item.type === "listing" ? "listing" : item.type === "promo" ? "promo" : null;
    if (commercial === "listing") {
      if (sinceListing < DENSITY_WINDOW) continue;
      sinceListing = 0;
    } else if (commercial === "promo") {
      if (sincePromo < DENSITY_WINDOW) continue;
      sincePromo = 0;
    }
    out.push(item);
    if (commercial !== "listing") sinceListing++;
    if (commercial !== "promo") sincePromo++;
  }
  return out;
}

export async function getFeed(
  tab: FeedTab,
  viewerId?: string | null,
): Promise<FeedItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // Only filter once the graph is big enough to carry a feed; below that, show
  // all content (discovery bootstrap) so a first-run feed is never a near-empty
  // page. FeedTabs labels the broadened case.
  //
  // A COUNT, not a list. Reading `.length` off every followed id is what put
  // 430 UUIDs in a URL.
  let followingOnly = false;
  if (tab === "following" && viewerId) {
    const { countFollowing } = await import("@/lib/social/follows");
    followingOnly = (await countFollowing(viewerId)) >= MIN_FOLLOWING_FOR_FILTER;
  }

  // Both filters — followed authors and blocked profiles — now happen in SQL.
  // They used to be PostgREST `in` lists, which put every id in the query
  // string and stopped fitting in a request line somewhere past 400 of either.
  // The block filter was the worse of the two: it ran for every signed-in
  // viewer on both tabs, so its overflow broke the feed outright.
  const { data, error } = await supabase.rpc("feed_rows", {
    following_only: followingOnly,
    hide_fixtures: hideFixtures(),
    max_rows: hideFixtures() ? 50 : 200,
  });
  if (error) throw error;
  const items = (data as Row[]).map(rowToFeedItem);
  if (tab === "for_you") items.sort((a, b) => hashId(a.id) - hashId(b.id));
  return applyDensityCaps(items);
}

export type PostFlags = { pinnedAt: string | null; commentsEnabled: boolean };

/**
 * `pinned_at` and `comments_enabled` live on `posts`, but `unified_feed` is a
 * three-table UNION and widening it needs a migration this lane does not own.
 * One batched read keyed by id costs a single round trip per rendered list.
 */
export async function getPostFlags(
  postIds: string[],
): Promise<Map<string, PostFlags>> {
  const flags = new Map<string, PostFlags>();
  if (postIds.length === 0) return flags;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id,pinned_at,comments_enabled")
    .in("id", postIds);
  for (const row of (data ?? []) as {
    id: string;
    pinned_at: string | null;
    comments_enabled: boolean;
  }[]) {
    flags.set(row.id, {
      pinnedAt: row.pinned_at,
      commentsEnabled: row.comments_enabled,
    });
  }
  return flags;
}

/**
 * Attaches pin/comment state to post-family items that don't already carry it,
 * so a caller that already loaded the flags (the profile feed, which sorts by
 * them) doesn't pay for a second read.
 */
export async function attachPostFlags(items: FeedItem[]): Promise<FeedItem[]> {
  const missing = items.filter(
    (item) => POST_FAMILY.includes(item.type) && item.commentsEnabled === undefined,
  );
  if (missing.length === 0) return items;
  const flags = await getPostFlags(missing.map((item) => item.id));
  return items.map((item) => {
    const flag = flags.get(item.id);
    return flag ? { ...item, ...flag } : item;
  });
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

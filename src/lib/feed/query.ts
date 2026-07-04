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

/** Following = chronological. For You = stable hash shuffle (placeholder until real ranking). */
export async function getFeed(tab: FeedTab): Promise<FeedItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  let query = supabase
    .from("unified_feed")
    .select("*")
    .order("created_at", { ascending: false });
  if (process.env.NODE_ENV === "production") {
    query = query.not("title", "like", "E2E %");
  }
  const { data, error } = await query.limit(
    process.env.NODE_ENV === "production" ? 50 : 200,
  );
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

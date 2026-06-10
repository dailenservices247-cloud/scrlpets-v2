import type { FeedItem, FeedItemType } from "./types";

export type Row = {
  id: string; kind: string; subtype: string | null; author_id: string;
  username: string; display_name: string | null; avatar_url: string | null;
  creature_id: string | null; creature_name: string | null; creature_slug: string | null; creature_avatar: string | null;
  title: string | null; media_url: string | null; created_at: string;
};

export function rowToFeedItem(r: Row): FeedItem {
  const type = (r.subtype ?? r.kind) as FeedItemType; // reel/long_video come via subtype
  return {
    id: r.id,
    type,
    author: { id: r.author_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url },
    creature: r.creature_id
      ? { id: r.creature_id, name: r.creature_name!, slug: r.creature_slug!, avatarUrl: r.creature_avatar }
      : null,
    title: r.title,
    mediaUrl: r.media_url,
    createdAt: r.created_at,
  };
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
  const { data, error } = await supabase
    .from("unified_feed")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const items = (data as Row[]).map(rowToFeedItem);
  if (tab === "for_you") items.sort((a, b) => hashId(a.id) - hashId(b.id));
  return items;
}

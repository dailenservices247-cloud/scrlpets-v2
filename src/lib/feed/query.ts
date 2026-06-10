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

/** Slice 1: both tabs return the same recent feed (Following/For-You ranking deferred). */
export async function getFeed(_tab: FeedTab): Promise<FeedItem[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unified_feed")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as Row[]).map(rowToFeedItem);
}

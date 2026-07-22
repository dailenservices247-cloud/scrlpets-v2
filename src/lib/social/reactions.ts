import { createClient } from "@/lib/supabase/server";
import { REACTION_TYPES, type ReactionType } from "./reaction-types";

export { REACTION_TYPES };
export type { ReactionType };

export type ReactionSummary = {
  counts: Record<ReactionType, number>;
  mine: ReactionType | null;
};

function emptyCounts(): Record<ReactionType, number> {
  return { like: 0, love: 0, laugh: 0, wow: 0, sad: 0, strong: 0 };
}

export async function getReactionSummary(
  postId: string,
  viewerId?: string | null,
): Promise<ReactionSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("post_reactions")
    .select("reaction_type, user_id")
    .eq("post_id", postId);
  const counts = emptyCounts();
  let mine: ReactionType | null = null;
  for (const row of (data ?? []) as { reaction_type: ReactionType; user_id: string }[]) {
    if (counts[row.reaction_type] !== undefined) counts[row.reaction_type] += 1;
    if (viewerId && row.user_id === viewerId) mine = row.reaction_type;
  }
  return { counts, mine };
}

export async function isSaved(
  viewerId: string,
  postId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_posts")
    .select("id")
    .eq("user_id", viewerId)
    .eq("post_id", postId)
    .maybeSingle();
  return !!data;
}

export type SavedItem = {
  postId: string;
  title: string | null;
  subtype: string | null;
  createdAt: string;
};

/** The viewer's saved posts, newest first (owner-only per RLS). */
export async function getSavedPosts(viewerId: string): Promise<SavedItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_posts")
    .select("post_id, created_at, posts ( body, content_type )")
    .eq("user_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((row) => {
    const r = row as {
      post_id: string;
      created_at: string;
      posts: { body: string | null; content_type: string | null } | { body: string | null; content_type: string | null }[] | null;
    };
    const post = Array.isArray(r.posts) ? r.posts[0] : r.posts;
    return {
      postId: r.post_id,
      title: post?.body ?? null,
      subtype: post?.content_type ?? null,
      createdAt: r.created_at,
    };
  });
}

export type PostSocialContext = {
  reactions: ReactionSummary;
  commentCount: number;
};

/** Batched per-post social context for a page of feed items (one query per table). */
export async function getFeedSocialContext(
  postIds: string[],
  viewerId?: string | null,
): Promise<Map<string, PostSocialContext>> {
  const map = new Map<string, PostSocialContext>();
  if (postIds.length === 0) return map;
  const supabase = await createClient();
  const [{ data: reactions }, { data: comments }] = await Promise.all([
    supabase
      .from("post_reactions")
      .select("post_id, reaction_type, user_id")
      .in("post_id", postIds),
    supabase
      .from("comments")
      .select("post_id, deleted_at")
      .in("post_id", postIds),
  ]);
  for (const id of postIds) {
    map.set(id, { reactions: { counts: emptyCounts(), mine: null }, commentCount: 0 });
  }
  for (const row of (reactions ?? []) as {
    post_id: string;
    reaction_type: ReactionType;
    user_id: string;
  }[]) {
    const ctx = map.get(row.post_id);
    if (!ctx) continue;
    if (ctx.reactions.counts[row.reaction_type] !== undefined)
      ctx.reactions.counts[row.reaction_type] += 1;
    if (viewerId && row.user_id === viewerId) ctx.reactions.mine = row.reaction_type;
  }
  for (const row of (comments ?? []) as { post_id: string; deleted_at: string | null }[]) {
    const ctx = map.get(row.post_id);
    if (ctx && row.deleted_at === null) ctx.commentCount += 1;
  }
  return map;
}

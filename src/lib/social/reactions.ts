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

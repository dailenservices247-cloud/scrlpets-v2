import { createClient } from "@/lib/supabase/server";
import { REACTION_TYPES, type ReactionType } from "./reaction-types";

export type CommentReactions = {
  counts: Record<ReactionType, number>;
  mine: ReactionType | null;
};

export type CommentNode = {
  id: string;
  body: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  createdAt: string;
  edited: boolean;
  isMine: boolean;
  isDeleted: boolean;
  reactions: CommentReactions;
  replies: CommentNode[];
};

type Row = {
  id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  profiles:
    | { username: string; display_name: string | null; avatar_url: string | null }
    | { username: string; display_name: string | null; avatar_url: string | null }[]
    | null;
};

function emptyCounts(): Record<ReactionType, number> {
  return { like: 0, love: 0, laugh: 0, wow: 0, sad: 0, strong: 0 };
}

function toNode(r: Row, viewerId?: string | null): CommentNode {
  const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  const isDeleted = r.deleted_at !== null;
  return {
    id: r.id,
    // Never surface a deleted comment's body (the DB copy is blanked anyway).
    body: isDeleted ? "" : r.body,
    authorId: r.author_id,
    authorUsername: p?.username ?? "unknown",
    authorDisplayName: p?.display_name ?? null,
    authorAvatarUrl: p?.avatar_url ?? null,
    createdAt: r.created_at,
    edited: new Date(r.updated_at).getTime() > new Date(r.created_at).getTime(),
    isMine: !!viewerId && r.author_id === viewerId,
    isDeleted,
    reactions: { counts: emptyCounts(), mine: null },
    replies: [],
  };
}

/**
 * Root comments + one reply level. Blocked authors are hidden. A deleted root is
 * kept as a "[deleted]" tombstone only when it still has visible replies (so the
 * conversation stays readable); deleted leaves are dropped. `count` counts live
 * comments only. Each node carries its reaction summary (A16).
 */
export async function getComments(
  postId: string,
  viewerId?: string | null,
): Promise<{ nodes: CommentNode[]; count: number }> {
  const supabase = await createClient();
  let blocked: string[] = [];
  if (viewerId) {
    const { data } = await supabase.rpc("blocked_profile_ids");
    blocked = (data as { profile_id: string }[] | null)?.map((r) => r.profile_id) ?? [];
  }
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, author_id, parent_id, body, deleted_at, created_at, updated_at, profiles ( username, display_name, avatar_url )",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const blockedSet = new Set(blocked);
  const rows = ((data ?? []) as Row[]).filter((r) => !blockedSet.has(r.author_id));

  const byId = new Map<string, CommentNode>();
  for (const r of rows) byId.set(r.id, toNode(r, viewerId));

  // One batched reactions query for every visible comment (A16).
  if (rows.length > 0) {
    const { data: reactionRows } = await supabase
      .from("comment_reactions")
      .select("comment_id, reaction_type, user_id")
      .in(
        "comment_id",
        rows.map((r) => r.id),
      );
    for (const row of (reactionRows ?? []) as {
      comment_id: string;
      reaction_type: ReactionType;
      user_id: string;
    }[]) {
      const node = byId.get(row.comment_id);
      if (!node) continue;
      if (node.reactions.counts[row.reaction_type] !== undefined)
        node.reactions.counts[row.reaction_type] += 1;
      if (viewerId && row.user_id === viewerId) node.reactions.mine = row.reaction_type;
    }
  }

  const roots = new Map<string, CommentNode>();
  for (const r of rows) {
    if (r.parent_id === null) roots.set(r.id, byId.get(r.id)!);
  }
  for (const r of rows) {
    if (r.parent_id !== null && r.deleted_at === null) {
      roots.get(r.parent_id)?.replies.push(byId.get(r.id)!);
    }
  }
  const nodes = [...roots.values()].filter(
    (n) => !n.isDeleted || n.replies.length > 0,
  );
  const count = rows.filter((r) => r.deleted_at === null).length;
  return { nodes, count };
}

export { REACTION_TYPES };

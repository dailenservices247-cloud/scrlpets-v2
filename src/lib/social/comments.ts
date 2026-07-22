import { createClient } from "@/lib/supabase/server";

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
    replies: [],
  };
}

/**
 * Root comments + one reply level. Blocked authors are hidden. A deleted root is
 * kept as a "[deleted]" tombstone only when it still has visible replies (so the
 * conversation stays readable); deleted leaves are dropped. `count` counts live
 * comments only.
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

  const roots = new Map<string, CommentNode>();
  for (const r of rows) {
    if (r.parent_id === null) roots.set(r.id, toNode(r, viewerId));
  }
  for (const r of rows) {
    if (r.parent_id !== null && r.deleted_at === null) {
      roots.get(r.parent_id)?.replies.push(toNode(r, viewerId));
    }
  }
  // Drop deleted roots with no surviving replies; keep the rest.
  const nodes = [...roots.values()].filter(
    (n) => !n.isDeleted || n.replies.length > 0,
  );
  const count = rows.filter((r) => r.deleted_at === null).length;
  return { nodes, count };
}

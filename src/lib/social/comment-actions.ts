"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CommentResult = { ok: true; id?: string } | { ok: false; error: string };

const MAX_LEN = 2000;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  return { supabase, user };
}

export async function addComment(
  postId: string,
  body: string,
  parentId?: string | null,
): Promise<CommentResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "auth_required" };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  if (trimmed.length > MAX_LEN) return { ok: false, error: "too_long" };

  let parent: string | null = null;
  if (parentId) {
    // One reply level: a reply's parent must be a ROOT comment on this post.
    const { data: p } = await supabase
      .from("comments")
      .select("id, parent_id, post_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!p || p.post_id !== postId) return { ok: false, error: "invalid_parent" };
    // Replying to a reply reparents to that reply's root.
    parent = p.parent_id ?? p.id;
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, author_id: user.id, parent_id: parent, body: trimmed })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/post/${postId}`);
  return { ok: true, id: data.id };
}

export async function editComment(
  commentId: string,
  body: string,
): Promise<CommentResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "auth_required" };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "empty" };
  if (trimmed.length > MAX_LEN) return { ok: false, error: "too_long" };

  const { count, error } = await supabase
    .from("comments")
    .update({ body: trimmed }, { count: "exact" })
    .eq("id", commentId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidatePath("/");
  return { ok: true };
}

// Soft-delete: blank the body and stamp deleted_at so a deleted root survives as
// a tombstone for its replies without leaking its content.
export async function deleteComment(commentId: string): Promise<CommentResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "auth_required" };
  const { count, error } = await supabase
    .from("comments")
    .update({ body: "", deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", commentId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidatePath("/");
  return { ok: true };
}

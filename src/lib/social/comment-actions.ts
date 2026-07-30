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

  // Every comment and reply, from every surface, goes through this function, so
  // this is the one place the toggle has to hold. Hiding the composer is a
  // courtesy to the reader; THIS is the control.
  const { data: post } = await supabase
    .from("posts")
    .select("comments_enabled")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return { ok: false, error: "not_found" };
  if (post.comments_enabled === false)
    return { ok: false, error: "comments_disabled" };

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

// F5 / punch list A16: one active reaction per user per comment; null clears.
export async function setCommentReaction(
  commentId: string,
  type: string | null,
): Promise<CommentResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "auth_required" };
  if (type === null) {
    const { error } = await supabase
      .from("comment_reactions")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const { error } = await supabase
    .from("comment_reactions")
    .upsert(
      { comment_id: commentId, user_id: user.id, reaction_type: type },
      { onConflict: "comment_id,user_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// F5 / punch list A17: the feed fetches a post's thread on expand. It carries
// the comment toggle back with it, so every inline surface (post tile, reel
// tile, reel realm) learns the composer is closed from the same call that
// loads the thread — no per-surface plumbing to forget.
export async function fetchComments(postId: string) {
  const { getComments } = await import("./comments");
  const { supabase } = await requireUser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [thread, { data: post }] = await Promise.all([
    getComments(postId, user?.id ?? null),
    supabase.from("posts").select("comments_enabled").eq("id", postId).maybeSingle(),
  ]);
  return { ...thread, commentsEnabled: post?.comments_enabled !== false };
}

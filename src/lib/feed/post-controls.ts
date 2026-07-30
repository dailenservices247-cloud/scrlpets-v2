"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ControlResult = { ok: true } | { ok: false; error: string };

/**
 * Both controls are the same one-column update on a post the caller may manage.
 * The posts UPDATE policy (author OR manager of the attributed brand) is the
 * real gate; `count !== 1` is how an RLS refusal surfaces here, since PostgREST
 * reports a blocked update as zero rows rather than an error.
 */
async function patchPost(
  postId: string,
  patch: Record<string, string | boolean | null>,
): Promise<ControlResult> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("posts")
    .update(patch, { count: "exact" })
    .eq("id", postId)
    .is("deleted_at", null);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

/** Pin to profile. Timestamped rather than boolean so several pins can order. */
export async function setPostPinned(
  postId: string,
  pinned: boolean,
): Promise<ControlResult> {
  return patchPost(postId, {
    pinned_at: pinned ? new Date().toISOString() : null,
  });
}

/**
 * Per-post comment toggle. Turning comments OFF does not delete what is already
 * there — existing comments stay readable, only new ones are refused (in
 * `addComment`, server-side).
 */
export async function setPostCommentsEnabled(
  postId: string,
  enabled: boolean,
): Promise<ControlResult> {
  return patchPost(postId, { comments_enabled: enabled });
}

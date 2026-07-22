"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FollowResult =
  | { ok: true; following: boolean }
  | { ok: false; error: string };

// Toggle the viewer's follow edge to a profile. RLS also enforces
// follower_id = auth.uid(); the self-follow DB check is the real guard.
export async function toggleFollow(
  targetProfileId: string,
): Promise<FollowResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };
  if (user.id === targetProfileId) return { ok: false, error: "self" };

  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", targetProfileId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("follows").delete().eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true, following: false };
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: targetProfileId });
  // A racing double-follow hits the unique constraint; treat as already-following.
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/");
  return { ok: true, following: true };
}

export type BlockResult =
  | { ok: true; blocked: boolean }
  | { ok: false; error: string };

// Block via the definer RPC (records the block + severs both follow edges).
export async function setBlock(
  targetProfileId: string,
  blocked: boolean,
): Promise<BlockResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };
  if (user.id === targetProfileId) return { ok: false, error: "self" };

  const { error } = await supabase.rpc(blocked ? "block_user" : "unblock_user", {
    target_id: targetProfileId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true, blocked };
}

const REPORT_REASONS = new Set([
  "spam",
  "harassment",
  "scam",
  "inappropriate",
  "other",
]);
const REPORT_KINDS = new Set(["post", "listing", "profile", "comment"]);

export type ReportResult = { ok: true } | { ok: false; error: string };

export async function createReport(formData: FormData): Promise<ReportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const targetKind = String(formData.get("targetKind") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const details = (String(formData.get("details") ?? "").trim() || null)?.slice(0, 2000) ?? null;
  if (!REPORT_KINDS.has(targetKind) || !targetId || !REPORT_REASONS.has(reason)) {
    return { ok: false, error: "invalid" };
  }

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    target_kind: targetKind,
    target_id: targetId,
    reason,
    details,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const REACTION_TYPES = new Set([
  "like",
  "love",
  "laugh",
  "wow",
  "sad",
  "strong",
]);

export type ReactionResult =
  | { ok: true; mine: string | null }
  | { ok: false; error: string };

// Set (or clear, when type is null) the viewer's single reaction on a post.
export async function setReaction(
  postId: string,
  type: string | null,
): Promise<ReactionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  if (type === null) {
    const { error } = await supabase
      .from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    return { ok: true, mine: null };
  }

  if (!REACTION_TYPES.has(type)) return { ok: false, error: "invalid" };
  // Upsert on the (post_id, user_id) unique pair so re-reacting swaps the type.
  const { error } = await supabase
    .from("post_reactions")
    .upsert(
      { post_id: postId, user_id: user.id, reaction_type: type },
      { onConflict: "post_id,user_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true, mine: type };
}

export type SaveResult = { ok: true; saved: boolean } | { ok: false; error: string };

export async function toggleSave(postId: string): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const { data: existing } = await supabase
    .from("saved_posts")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("saved_posts").delete().eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/saved");
    return { ok: true, saved: false };
  }
  const { error } = await supabase
    .from("saved_posts")
    .insert({ user_id: user.id, post_id: postId });
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return { ok: false, error: error.message };
  }
  revalidatePath("/saved");
  return { ok: true, saved: true };
}

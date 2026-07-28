"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePost } from "@/lib/compose/validation";

export type GroupPostResult = { ok: true } | { ok: false; error: string };

/**
 * Join and leave are plain <form action> targets on a server-rendered page, so
 * they return void: the page re-renders from the database afterwards and shows
 * the true state. No client component and no optimistic state to get wrong.
 * If RLS refuses the write the button simply has no effect, which is honest —
 * the UI never claims a membership that does not exist.
 */
export async function joinGroup(groupId: string, slug: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // A racing double-join hits the composite primary key; already a member is
  // the outcome either way.
  await supabase.from("group_memberships").insert({ group_id: groupId, profile_id: user.id });
  revalidatePath(`/groups/${slug}`);
}

export async function leaveGroup(groupId: string, slug: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("group_memberships")
    .delete()
    .eq("group_id", groupId)
    .eq("profile_id", user.id);
  revalidatePath(`/groups/${slug}`);
}

/**
 * A group post is an ordinary post row with a group_id, so this only shapes the
 * row. Membership, suspension and blocking are all enforced by RLS — the
 * RESTRICTIVE "group posts require membership" policy is the real gate, and a
 * non-member simply gets an error back.
 */
export async function createGroupPost(
  groupId: string,
  slug: string,
  formData: FormData,
): Promise<GroupPostResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const body = String(formData.get("body") ?? "");
  const mediaUrl = (formData.get("mediaUrl") as string) || null;
  const v = validatePost({ body, mediaUrl });
  if (!v.ok) return { ok: false, error: v.error };

  // ponytail: group posts publish as `post` even when the media is a video.
  // Reel vs long-video is a distribution choice that belongs in the main
  // composer; TileMedia renders the video either way. Split it here only if
  // groups ever need their own reel shelf.
  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    content_type: "post",
    body: body.trim() || null,
    media_url: mediaUrl,
    group_id: groupId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/groups/${slug}`);
  return { ok: true };
}

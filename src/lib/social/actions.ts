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

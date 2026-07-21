import { createClient } from "@/lib/supabase/server";

export async function getFollowCounts(
  profileId: string,
): Promise<{ followers: number; following: number }> {
  const supabase = await createClient();
  const [followers, following] = await Promise.all([
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", profileId),
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", profileId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function isFollowing(
  viewerId: string,
  targetId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", viewerId)
    .eq("following_id", targetId)
    .maybeSingle();
  return !!data;
}

/** Profile ids the viewer follows — the Following feed filter set. */
export async function getFollowingIds(viewerId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId);
  return (data ?? []).map((row) => row.following_id as string);
}

/** Has the viewer blocked this profile? (Only the blocker can read their blocks.) */
export async function hasBlocked(
  viewerId: string,
  targetId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blocks")
    .select("id")
    .eq("blocker_id", viewerId)
    .eq("blocked_id", targetId)
    .maybeSingle();
  return !!data;
}

/**
 * Profile ids to hide from the viewer's feed: everyone they blocked, plus anyone
 * who blocked them. `is_blocked_between` (definer) lets the viewer see the second
 * set without reading others' block rows directly.
 */
export async function getBlockedFeedIds(viewerId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("blocked_profile_ids");
  if (data) return (data as { profile_id: string }[]).map((r) => r.profile_id);
  // Fallback (RPC absent): only the outgoing direction, which the viewer can read.
  const { data: outgoing } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", viewerId);
  return (outgoing ?? []).map((r) => r.blocked_id as string);
}

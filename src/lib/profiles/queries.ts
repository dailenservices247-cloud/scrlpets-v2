import { createClient } from "@/lib/supabase/server";
import { attachPostFlags, rowToFeedItem, type Row } from "@/lib/feed/query";
import type { FeedItem } from "@/lib/feed/types";

export type Profile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  /** Optional because the follow-list read deliberately does not fetch it. */
  coverUrl?: string | null;
};

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,cover_url,bio,created_at")
    .eq("username", username)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    coverUrl: data.cover_url,
    bio: data.bio,
    createdAt: data.created_at,
  };
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,cover_url,bio,created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    coverUrl: data.cover_url,
    bio: data.bio,
    createdAt: data.created_at,
  };
}

/**
 * The profile timeline. Pinned posts float to the top (newest pin first), which
 * is the whole point of pinning — every other surface keeps strict reverse
 * chronology, so a pin changes your profile and nothing else.
 *
 * ponytail: the pin sort runs over the 50 rows the query already returns, so a
 * post pinned AFTER 50 newer ones have been published falls off the page
 * instead of leading it. Fix by unioning a pinned-rows query when someone hits
 * it; a second round trip on every profile view is not worth paying today.
 */
export async function getProfileFeed(authorId: string): Promise<FeedItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("unified_feed")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(50);
  const items = await attachPostFlags(((data ?? []) as Row[]).map(rowToFeedItem));
  return items.sort((a, b) => {
    if (a.pinnedAt === b.pinnedAt) return 0;
    if (!a.pinnedAt) return 1;
    if (!b.pinnedAt) return -1;
    return b.pinnedAt.localeCompare(a.pinnedAt);
  });
}

export type FollowListKind = "followers" | "following";

/**
 * ponytail: one un-paginated read capped at FOLLOW_LIST_MAX. The profile header
 * derives its counts from this SAME call, so a count can never disagree with
 * the names behind it — including at the cap, where both are clipped together.
 * Swap both for an RPC returning (total, page) when a real account crosses it.
 */
export const FOLLOW_LIST_MAX = 1000;

type FollowRow = {
  profiles:
    | { id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null; created_at: string }
    | null;
};

/**
 * `followers` = profiles that follow this one; `following` = profiles it
 * follows. Rows whose profile is unreadable are dropped, and because the count
 * is this array's length, dropping one drops it from the count too.
 */
export async function getFollowList(
  profileId: string,
  kind: FollowListKind,
): Promise<Profile[]> {
  const supabase = await createClient();
  const joinColumn = kind === "followers" ? "follower_id" : "following_id";
  const matchColumn = kind === "followers" ? "following_id" : "follower_id";
  const { data } = await supabase
    .from("follows")
    .select(
      `created_at, profiles!follows_${joinColumn}_fkey (id,username,display_name,avatar_url,bio,created_at)`,
    )
    .eq(matchColumn, profileId)
    .order("created_at", { ascending: false })
    .limit(FOLLOW_LIST_MAX);
  return ((data ?? []) as unknown as FollowRow[])
    .map((row) => row.profiles)
    .filter((p): p is NonNullable<FollowRow["profiles"]> => p !== null)
    .map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      bio: p.bio,
      createdAt: p.created_at,
    }));
}

export type CreatureProfile = {
  id: string;
  name: string;
  species: string | null;
  slug: string;
  avatarUrl: string | null;
  ownerId: string;
  owner: { username: string; displayName: string | null };
};

export async function getCreatureBySlug(slug: string): Promise<CreatureProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures")
    .select("id,name,species,slug,avatar_url,owner_id,profiles(username,display_name)")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const owner = data.profiles as unknown as { username: string; display_name: string | null };
  return {
    id: data.id,
    name: data.name,
    species: data.species,
    slug: data.slug,
    avatarUrl: data.avatar_url,
    ownerId: data.owner_id,
    owner: { username: owner.username, displayName: owner.display_name },
  };
}

export async function getCreatureFeed(creatureId: string): Promise<FeedItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("unified_feed")
    .select("*")
    .eq("creature_id", creatureId)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as Row[]).map(rowToFeedItem);
}

export type OwnedCreature = {
  id: string;
  name: string;
  species: string | null;
  slug: string;
  avatar_url: string | null;
};

export async function getCreaturesByOwner(ownerId: string): Promise<OwnedCreature[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures")
    .select("id,name,species,slug,avatar_url")
    .eq("owner_id", ownerId)
    .order("created_at");
  return data ?? [];
}

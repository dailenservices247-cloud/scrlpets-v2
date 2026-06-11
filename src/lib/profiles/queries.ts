import { createClient } from "@/lib/supabase/server";
import { rowToFeedItem, type Row } from "@/lib/feed/query";
import type { FeedItem } from "@/lib/feed/types";

export type Profile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
};

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,bio,created_at")
    .eq("username", username)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    bio: data.bio,
    createdAt: data.created_at,
  };
}

export async function getProfileFeed(authorId: string): Promise<FeedItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("unified_feed")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as Row[]).map(rowToFeedItem);
}

export type CreatureProfile = {
  id: string;
  name: string;
  species: string | null;
  slug: string;
  avatarUrl: string | null;
  owner: { username: string; displayName: string | null };
};

export async function getCreatureBySlug(slug: string): Promise<CreatureProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creatures")
    .select("id,name,species,slug,avatar_url,profiles(username,display_name)")
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

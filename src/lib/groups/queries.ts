import { createClient } from "@/lib/supabase/server";
import type { FeedItem } from "@/lib/feed/types";

export type BreedGroup = {
  id: string;
  slug: string;
  name: string;
  species: string;
  description: string | null;
  memberCount: number;
};

export type GroupDetail = BreedGroup & { viewerIsMember: boolean };

type GroupRow = {
  id: string;
  slug: string;
  name: string;
  species: string;
  description: string | null;
};

/**
 * Member counts for a page of groups in one round trip.
 *
 * ponytail: tallies membership rows client-side rather than N head-count
 * queries or a PostgREST embedded aggregate. The catalogue is admin-curated so
 * the row count is small; move this to an RPC when a single group's membership
 * gets big enough to matter.
 */
async function countMembers(groupIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const id of groupIds) counts.set(id, 0);
  if (groupIds.length === 0) return counts;
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_memberships")
    .select("group_id")
    .in("group_id", groupIds);
  for (const row of (data ?? []) as { group_id: string }[]) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Groups are breed/species communities only, so the catalogue is curated and
 * short — no pagination, and ordering by species groups the dogs together.
 */
export async function listGroups(): Promise<BreedGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("id,slug,name,species,description")
    .order("species", { ascending: true })
    .order("name", { ascending: true });

  const rows = (data ?? []) as GroupRow[];
  const counts = await countMembers(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, memberCount: counts.get(r.id) ?? 0 }));
}

export async function getGroupBySlug(
  slug: string,
  viewerId?: string | null,
): Promise<GroupDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("groups")
    .select("id,slug,name,species,description")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const group = data as GroupRow;

  const [counts, membership] = await Promise.all([
    countMembers([group.id]),
    viewerId
      ? supabase
          .from("group_memberships")
          .select("profile_id")
          .eq("group_id", group.id)
          .eq("profile_id", viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...group,
    memberCount: counts.get(group.id) ?? 0,
    viewerIsMember: Boolean(membership.data),
  };
}

export type MyGroup = { id: string; slug: string; name: string };

/** Composer: the groups the viewer has joined — the only ones they may post into. */
export async function listMyGroups(userId: string): Promise<MyGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_memberships")
    .select("groups(id,slug,name)")
    .eq("profile_id", userId);
  return ((data ?? []) as unknown as { groups: MyGroup | null }[])
    .map((r) => r.groups)
    .filter((g): g is MyGroup => g !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

type PostRow = {
  id: string;
  content_type: string;
  body: string | null;
  media_url: string | null;
  created_at: string;
  updated_at: string;
  author_id: string;
  posting_as_type: string | null;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  creatures: { id: string; name: string; slug: string; avatar_url: string | null } | null;
  brands: { id: string; name: string; slug: string; avatar_url: string | null } | null;
};

const POST_SELECT =
  "id,content_type,body,media_url,created_at,updated_at,author_id,posting_as_type," +
  "profiles!posts_author_id_fkey(username,display_name,avatar_url)," +
  "creatures(id,name,slug,avatar_url)," +
  "brands(id,name,slug,avatar_url)";

/**
 * A group timeline is a filtered read of `posts`, which is the entire payoff of
 * storing group posts as post rows: soft-deleted and moderator-hidden rows are
 * already excluded by the SELECT policy, and the result maps onto FeedItem so
 * the existing tiles render reactions and comments with no group-specific code.
 */
export async function listGroupPosts(
  groupId: string,
  viewerId?: string | null,
): Promise<FeedItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Blocking is a promise the rest of the app already keeps; a group timeline
  // is not a loophole back into someone you blocked.
  if (viewerId) {
    const { getBlockedFeedIds } = await import("@/lib/social/follows");
    const blocked = await getBlockedFeedIds(viewerId);
    if (blocked.length > 0) query = query.not("author_id", "in", `(${blocked.join(",")})`);
  }

  const { data } = await query;
  return ((data ?? []) as unknown as PostRow[]).map((r) => ({
    id: r.id,
    type: (r.content_type === "reel" || r.content_type === "long_video"
      ? r.content_type
      : "post") as FeedItem["type"],
    author: {
      id: r.author_id,
      username: r.profiles?.username ?? "",
      displayName: r.profiles?.display_name ?? null,
      avatarUrl: r.profiles?.avatar_url ?? null,
    },
    brand:
      r.posting_as_type === "brand" && r.brands
        ? {
            id: r.brands.id,
            name: r.brands.name,
            slug: r.brands.slug,
            avatarUrl: r.brands.avatar_url,
          }
        : null,
    creature: r.creatures
      ? {
          id: r.creatures.id,
          name: r.creatures.name,
          slug: r.creatures.slug,
          avatarUrl: r.creatures.avatar_url,
        }
      : null,
    // Deliberately null: every post on this page is in this group, so the chip
    // would say what the page already says.
    group: null,
    title: r.body,
    mediaUrl: r.media_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

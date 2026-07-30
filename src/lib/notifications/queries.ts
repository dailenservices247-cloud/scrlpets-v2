import { createClient } from "@/lib/supabase/server";

/**
 * Every kind notifications_kind_check admits. The pack and saved-search kinds
 * have been written by triggers since A.6/A.9 but were missing here, so those
 * rows rendered against an absent `kind.*` i18n key — widened to match the
 * constraint, which is the canonical list.
 */
export type NotificationKind =
  | "follow"
  | "reaction"
  | "comment"
  | "comment_reply"
  | "inquiry"
  | "pack_invite"
  | "pack_accepted"
  | "saved_search_match";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  actorName: string;
  actorUsername: string | null;
  actorAvatarUrl: string | null;
  targetKind: string | null;
  targetId: string | null;
  read: boolean;
  createdAt: string;
};

type Row = {
  id: string;
  kind: NotificationKind;
  target_kind: string | null;
  target_id: string | null;
  read_at: string | null;
  created_at: string;
  profiles:
    | { username: string; display_name: string | null; avatar_url: string | null }
    | { username: string; display_name: string | null; avatar_url: string | null }[]
    | null;
};

/** R12: the viewer's notifications, newest first (owner-only per RLS). */
export async function getNotifications(limit = 50): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, kind, target_kind, target_id, read_at, created_at, profiles!notifications_actor_id_fkey ( username, display_name, avatar_url )",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      kind: r.kind,
      actorName: p?.display_name ?? p?.username ?? "Someone",
      actorUsername: p?.username ?? null,
      actorAvatarUrl: p?.avatar_url ?? null,
      targetKind: r.target_kind,
      targetId: r.target_id,
      read: r.read_at !== null,
      createdAt: r.created_at,
    };
  });
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

/**
 * Where a notification points. Dead targets fall back to the actor's profile.
 * Structural parameter so a grouped row resolves through the same rule.
 */
export function notificationHref(n: {
  targetKind: string | null;
  targetId: string | null;
  actorUsername: string | null;
}): string {
  if (n.targetKind === "post" && n.targetId) return `/post/${n.targetId}`;
  if (n.targetKind === "listing" && n.targetId) return `/listing/${n.targetId}`;
  if (n.actorUsername) return `/u/${n.actorUsername}`;
  return "/";
}

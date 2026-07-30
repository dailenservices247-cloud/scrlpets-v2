import type { NotificationItem, NotificationKind } from "./queries";

export type GroupedNotification = {
  /** The newest notification in the group — what the row links to. */
  id: string;
  /** Every notification folded into this row, newest first. */
  ids: string[];
  kind: NotificationKind;
  actorName: string;
  actorUsername: string | null;
  actorAvatarUrl: string | null;
  targetKind: string | null;
  targetId: string | null;
  /** Distinct actors beyond the newest one — "X and {othersCount} others". */
  othersCount: number;
  /** Read only when every folded notification is read. */
  read: boolean;
  createdAt: string;
};

/**
 * Actionable notifications keep their own row: folding a pack invite into
 * "and 4 others" would bury the accept/decline control for four people.
 */
export function isActionable(kind: NotificationKind): boolean {
  return kind === "pack_invite";
}

/**
 * Collapse repeated actor/kind pairs into one row: five people reacting to the
 * same post is one line, not five.
 *
 * The key is kind + target, so a `follow` (no target) groups by kind alone —
 * which is exactly right, since "followed you" has no other object. Input is
 * expected newest-first, so the first item of a group is its representative.
 *
 * ponytail: groups over the fetched page only, so an actor whose older
 * notification fell past the query limit counts as a separate row. Move the
 * fold into SQL if the page limit ever stops covering a real inbox.
 */
export function groupNotifications(items: NotificationItem[]): GroupedNotification[] {
  const groups = new Map<string, GroupedNotification>();
  const actorsSeen = new Map<string, Set<string>>();

  for (const item of items) {
    const key = isActionable(item.kind)
      ? `actionable|${item.id}`
      : `${item.kind}|${item.targetKind ?? ""}|${item.targetId ?? ""}`;
    const actor = item.actorUsername ?? item.actorName;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        id: item.id,
        ids: [item.id],
        kind: item.kind,
        actorName: item.actorName,
        actorUsername: item.actorUsername,
        actorAvatarUrl: item.actorAvatarUrl,
        targetKind: item.targetKind,
        targetId: item.targetId,
        othersCount: 0,
        read: item.read,
        createdAt: item.createdAt,
      });
      actorsSeen.set(key, new Set([actor]));
      continue;
    }
    existing.ids.push(item.id);
    existing.read = existing.read && item.read;
    const actors = actorsSeen.get(key)!;
    if (!actors.has(actor)) {
      actors.add(actor);
      existing.othersCount += 1;
    }
  }

  return [...groups.values()];
}

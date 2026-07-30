import { createClient } from "@/lib/supabase/server";

/**
 * E: the admin pack's read side. Every table below is admin-gated by RLS
 * (redemptions, support_tickets and moderation_actions all carry an
 * `is_platform_admin()` select policy), so a non-admin who reaches these
 * functions gets empty arrays rather than data. The page still 404s first —
 * that is the courtesy, this is the control.
 */

export type SuspendedAccount = {
  profileId: string;
  username: string | null;
  suspendedAt: string;
  actorUsername: string | null;
  reason: string | null;
};

export type RedemptionReviewRow = {
  id: string;
  username: string | null;
  rewardKey: string;
  rewardTitle: string | null;
  pointsSpent: number;
  status: "requested" | "approved" | "rejected" | "fulfilled";
  adminNotes: string | null;
  createdAt: string;
};

export type SupportTicketRow = {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type ModerationLogRow = {
  id: string;
  actorUsername: string | null;
  action: string;
  targetKind: string | null;
  targetId: string | null;
  notes: string | null;
  createdAt: string;
};

/**
 * One lookup for every id-to-username mapping on this page. The alternative is
 * a PostgREST embed per query, and account_suspensions has TWO foreign keys
 * into profiles (subject and actor) — that embed needs a disambiguating
 * constraint name, which silently breaks if a constraint is ever renamed. A
 * plain `in` list cannot.
 */
async function usernamesByIds(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id,username").in("id", unique);
  return new Map(((data ?? []) as { id: string; username: string }[]).map((p) => [p.id, p.username]));
}

/** Who is currently suspended, when, by whom, and why. */
export async function getSuspendedAccounts(): Promise<SuspendedAccount[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("account_suspensions")
    .select("profile_id,suspended_at,actor_id,reason")
    .order("suspended_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as {
    profile_id: string;
    suspended_at: string;
    actor_id: string | null;
    reason: string | null;
  }[];
  const names = await usernamesByIds(rows.flatMap((r) => [r.profile_id, r.actor_id]));
  return rows.map((r) => ({
    profileId: r.profile_id,
    username: names.get(r.profile_id) ?? null,
    suspendedAt: r.suspended_at,
    actorUsername: r.actor_id ? (names.get(r.actor_id) ?? null) : null,
    reason: r.reason,
  }));
}

/**
 * Redemptions still needing a human: `requested` always, plus `approved` goods
 * that have not been marked fulfilled. Rejected and fulfilled rows are done and
 * drop out — the audit of what happened to them lives on the redemption row
 * itself, which the member can already see on /rewards.
 */
export async function getRedemptionQueue(): Promise<RedemptionReviewRow[]> {
  const supabase = await createClient();
  const [redemptions, catalog] = await Promise.all([
    supabase
      .from("redemptions")
      .select("id,profile_id,reward_key,points_spent,status,admin_notes,created_at")
      .in("status", ["requested", "approved"])
      .order("created_at", { ascending: true })
      .limit(100),
    supabase.from("reward_catalog").select("key,title"),
  ]);
  const rows = (redemptions.data ?? []) as {
    id: string;
    profile_id: string;
    reward_key: string;
    points_spent: number;
    status: RedemptionReviewRow["status"];
    admin_notes: string | null;
    created_at: string;
  }[];
  const titles = new Map(
    ((catalog.data ?? []) as { key: string; title: string }[]).map((r) => [r.key, r.title]),
  );
  const names = await usernamesByIds(rows.map((r) => r.profile_id));
  return rows.map((r) => ({
    id: r.id,
    username: names.get(r.profile_id) ?? null,
    rewardKey: r.reward_key,
    rewardTitle: titles.get(r.reward_key) ?? null,
    pointsSpent: r.points_spent,
    status: r.status,
    adminNotes: r.admin_notes,
    createdAt: r.created_at,
  }));
}

/**
 * Unresolved tickets, oldest first — a support queue sorted newest-first is a
 * queue that never reaches the bottom.
 */
export async function getOpenTickets(): Promise<SupportTicketRow[]> {
  const supabase = await createClient();
  // admin_notes is deliberately NOT in this select. SELECT on that column is
  // revoked from both client roles, because RLS filters rows and the ticket's
  // own author could otherwise read the staff notes written about them. The
  // notes come back through admin_ticket_notes(), which checks
  // is_platform_admin() itself.
  const { data } = await supabase
    .from("support_tickets")
    .select("id,name,email,category,subject,message,status,resolved_at,created_at")
    .in("status", ["open", "in_progress"])
    .order("created_at", { ascending: true })
    .limit(100);
  const rows = (data ?? []) as (Omit<
    SupportTicketRow,
    "adminNotes" | "resolvedAt" | "createdAt"
  > & {
    resolved_at: string | null;
    created_at: string;
  })[];

  const notes = await Promise.all(
    rows.map((r) =>
      supabase
        .rpc("admin_ticket_notes", { target_ticket: r.id })
        .then(({ data: note }) => (note as string | null) ?? null),
    ),
  );

  return rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    category: r.category,
    subject: r.subject,
    message: r.message,
    status: r.status,
    adminNotes: notes[i],
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
  }));
}

/**
 * The append-only audit trail. This is the answer to "who hid that, and why" —
 * the reason an admin typed at decision time is the `notes` column here, so a
 * decision made with no stated reason is visible as one.
 *
 * ponytail: newest 100, no pagination. Add a cursor when an admin actually has
 * to scroll past a hundred decisions to find one.
 */
export async function getModerationLog(): Promise<ModerationLogRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("moderation_actions")
    .select("id,actor_id,action,target_kind,target_id,notes,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as {
    id: string;
    actor_id: string | null;
    action: string;
    target_kind: string | null;
    target_id: string | null;
    notes: string | null;
    created_at: string;
  }[];
  const names = await usernamesByIds(rows.map((r) => r.actor_id));
  return rows.map((r) => ({
    id: r.id,
    actorUsername: r.actor_id ? (names.get(r.actor_id) ?? null) : null,
    action: r.action,
    targetKind: r.target_kind,
    targetId: r.target_id,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

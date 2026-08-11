import { createClient } from "@/lib/supabase/server";

/**
 * E: the admin pack's read side. The page 404s for a non-admin — that is the
 * courtesy; RLS is the control. Note what RLS does NOT do here: only
 * moderation_actions is admin-read-only. redemptions and support_tickets also
 * carry own-read policies, so a non-admin reaching those functions gets their
 * OWN rows back, not an empty array. That is fine for what those queries now
 * select, and it is exactly why the staff-written columns are no longer among
 * them — see admin_redemption_notes() and admin_ticket_notes() below.
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
  // admin_notes is deliberately NOT in this select, for the same reason it is
  // absent from the ticket select below: the redemption's own owner can read
  // their row, so the column is revoked from both client roles and the notes
  // come back through admin_redemption_notes(), which checks is_platform_admin()
  // itself.
  const [redemptions, catalog] = await Promise.all([
    supabase
      .from("redemptions")
      .select("id,profile_id,reward_key,points_spent,status,created_at")
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
    created_at: string;
  }[];
  const titles = new Map(
    ((catalog.data ?? []) as { key: string; title: string }[]).map((r) => [r.key, r.title]),
  );
  // One batched read, not one per row: the queue caps at 100, and 100 parallel
  // round trips measured ~1.66 s against ~0.15 s batched.
  const [names, noteRows] = await Promise.all([
    usernamesByIds(rows.map((r) => r.profile_id)),
    supabase
      .rpc("admin_redemption_notes_bulk", { target_redemptions: rows.map((r) => r.id) })
      .then(({ data }) => (data ?? []) as { redemption_id: string; notes: string | null }[]),
  ]);
  const notes = new Map(noteRows.map((n) => [n.redemption_id, n.notes]));
  return rows.map((r) => ({
    id: r.id,
    username: names.get(r.profile_id) ?? null,
    rewardKey: r.reward_key,
    rewardTitle: titles.get(r.reward_key) ?? null,
    pointsSpent: r.points_spent,
    status: r.status,
    adminNotes: notes.get(r.id) ?? null,
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

  // One batched read, not one per row — see the redemption queue above.
  const { data: noteRows } = await supabase.rpc("admin_ticket_notes_bulk", {
    target_tickets: rows.map((r) => r.id),
  });
  const notes = new Map(
    ((noteRows ?? []) as { ticket_id: string; notes: string | null }[]).map((n) => [
      n.ticket_id,
      n.notes,
    ]),
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    category: r.category,
    subject: r.subject,
    message: r.message,
    status: r.status,
    adminNotes: notes.get(r.id) ?? null,
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

export type DisputeRow = {
  orderId: string;
  buyerUsername: string | null;
  sellerUsername: string | null;
  titleSnapshot: string | null;
  fulfilment: "in_person" | "transported" | "shipped";
  amountCents: number;
  depositCents: number;
  transportCents: number;
  pickedUpAt: string | null;
  handoverAt: string | null;
  deliveredAt: string | null;
  animalReturnedAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  anchorVerified: boolean;
  guaranteeBranch: string | null;
  guaranteeHeadline: string | null;
  disputeReason: string | null;
  createdAt: string;
};

/**
 * Orders waiting on the adjudicator, with their evidence.
 *
 * Read through a definer rather than the table: `orders` RLS is buyer-or-seller
 * only, so an admin can DECIDE an order (settle_order checks is_platform_admin)
 * but could not READ one. A verdict button with no case file behind it.
 *
 * The same fields are the chargeback representment package — timestamped
 * handover, anchor scan, tracking, delivery, and the seller's own published
 * remedy — which is why they come out of one query rather than being assembled
 * per surface.
 */
export async function getDisputeQueue(): Promise<DisputeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_dispute_queue");
  return ((data ?? []) as {
    order_id: string;
    buyer_username: string | null;
    seller_username: string | null;
    title_snapshot: string | null;
    fulfilment: DisputeRow["fulfilment"];
    amount_cents: number;
    deposit_cents: number;
    transport_cents: number;
    picked_up_at: string | null;
    handover_at: string | null;
    delivered_at: string | null;
    animal_returned_at: string | null;
    carrier: string | null;
    tracking_number: string | null;
    anchor_verified: boolean;
    guarantee_branch: string | null;
    guarantee_headline: string | null;
    dispute_reason: string | null;
    created_at: string;
  }[]).map((r) => ({
    orderId: r.order_id,
    buyerUsername: r.buyer_username,
    sellerUsername: r.seller_username,
    titleSnapshot: r.title_snapshot,
    fulfilment: r.fulfilment,
    amountCents: r.amount_cents,
    depositCents: r.deposit_cents,
    transportCents: r.transport_cents,
    pickedUpAt: r.picked_up_at,
    handoverAt: r.handover_at,
    deliveredAt: r.delivered_at,
    animalReturnedAt: r.animal_returned_at,
    carrier: r.carrier,
    trackingNumber: r.tracking_number,
    anchorVerified: r.anchor_verified,
    guaranteeBranch: r.guarantee_branch,
    guaranteeHeadline: r.guarantee_headline,
    disputeReason: r.dispute_reason,
    createdAt: r.created_at,
  }));
}

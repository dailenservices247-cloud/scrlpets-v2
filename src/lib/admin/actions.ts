"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/verification/queries";

/**
 * A CLOSED set of codes, because the UI renders them through `t(...)` and a raw
 * Postgres message would both miss its translation key and leak internals into
 * the page. Unexpected database failures collapse to `failed`.
 */
export type AdminError =
  | "reason_required"
  | "admin_required"
  | "auth_required"
  | "not_found"
  | "self"
  | "already_suspended"
  | "not_suspended"
  | "failed";

export type AdminResult = { ok: true } | { ok: false; error: AdminError };

/**
 * A stated reason is the point of the feature, so it is checked here as well as
 * stored. Server Actions are reachable by direct POST, so this is a trust
 * boundary, not a form-validation nicety.
 */
const REASON_MIN = 4;
const REASON_MAX = 500;

function cleanReason(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const reason = raw.trim();
  return reason.length >= REASON_MIN && reason.length <= REASON_MAX ? reason : null;
}

/**
 * Suspend an account that nobody reported.
 *
 * The admin check below is defence in depth, NOT the authority: `resolve_report`
 * is a SECURITY DEFINER that re-checks `is_platform_admin()` and raises
 * `admin_required` on its own. Checking first only means a non-admin's call
 * leaves no trace at all instead of a stray report row.
 *
 * ponytail: suspension is routed through a self-filed profile report because
 * `resolve_report` is the ONLY definer permitted to write account_suspensions —
 * that table has no client insert policy, by design. The side effect is one
 * admin-authored, immediately-resolved report per direct suspension, which the
 * moderation log then explains. Replace this with a dedicated
 * `suspend_account(uuid, text)` definer the next time migrations are open.
 */
export async function suspendAccount(
  username: string,
  reason: string,
): Promise<AdminResult> {
  const stated = cleanReason(reason);
  if (!stated) return { ok: false, error: "reason_required" };
  if (!(await isPlatformAdmin())) return { ok: false, error: "admin_required" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  // Case-insensitive, but the LIKE wildcards are escaped: a username is free
  // text, and an unescaped `%` would turn a lookup into a pattern that could
  // match somebody else. Two usernames differing only in case would make
  // maybeSingle error, which lands on not_found — refusing beats suspending
  // whichever of them the database happened to return first.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username.trim().replace(/[%_]/g, (c) => `\\${c}`))
    .maybeSingle();
  const target = (profile as { id: string } | null)?.id;
  if (!target) return { ok: false, error: "not_found" };
  if (target === user.id) return { ok: false, error: "self" };

  // resolve_report's insert is `on conflict do nothing`, so re-suspending an
  // already-suspended account would write an audit row and silently keep the
  // OLD reason. Refusing is honest; the existing reason stays the true one.
  const { data: existing } = await supabase
    .from("account_suspensions")
    .select("profile_id")
    .eq("profile_id", target)
    .maybeSingle();
  if (existing) return { ok: false, error: "already_suspended" };

  const report = await supabase
    .from("content_reports")
    .insert({
      reporter_id: user.id,
      target_kind: "profile",
      target_id: target,
      reason: "other",
      details: stated,
    })
    .select("id")
    .single();
  if (report.error) return { ok: false, error: "failed" };

  const { error } = await supabase.rpc("resolve_report", {
    target_report: (report.data as { id: string }).id,
    decision: "account_suspended",
    notes: stated,
  });
  if (error) return { ok: false, error: error.message.includes("admin_required") ? "admin_required" : "failed" };
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Move a support ticket along its lifecycle. `update_support_ticket` is the
 * definer: it re-checks admin, validates the status against the same three
 * values the CHECK constraint allows, appends the note to admin_notes rather
 * than overwriting it, and stamps resolved_at on resolve.
 */
export async function updateTicket(
  ticketId: string,
  status: "open" | "in_progress" | "resolved",
  note?: string,
): Promise<AdminResult> {
  if (!(await isPlatformAdmin())) return { ok: false, error: "admin_required" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_support_ticket", {
    target_ticket: ticketId,
    new_status: status,
    note: note?.trim() || null,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("admin_required")
        ? "admin_required"
        : error.message.includes("not_found")
          ? "not_found"
          : "failed",
    };
  }
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Undo a suspension.
 *
 * Nothing called `reactivate_account`, so suspending was a ONE-WAY DOOR: the
 * only exit was a hand-written statement against production. The definer
 * requires a reason and writes it to `moderation_actions`, so an unsuspension
 * is as accountable as the suspension it reverses — which is why the reason is
 * checked here too, the same way `suspendAccount` checks it.
 *
 * The admin check is defence in depth, not the authority: the definer re-checks
 * `is_platform_admin()` itself. Checking first only means a non-admin's call
 * leaves no trace instead of a refused RPC in the logs.
 */
export async function reactivateAccount(
  profileId: string,
  reason: string,
): Promise<AdminResult> {
  const stated = cleanReason(reason);
  if (!stated) return { ok: false, error: "reason_required" };
  if (!(await isPlatformAdmin())) return { ok: false, error: "admin_required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reactivate_account", {
    target_profile: profileId,
    reason: stated,
  });
  if (error) {
    // The closed set, so nothing raw reaches a translation key or the page.
    const known: AdminError[] = ["not_suspended", "admin_required", "auth_required", "reason_required"];
    const hit = known.find((k) => error.message.includes(k));
    return { ok: false, error: hit ?? "failed" };
  }
  revalidatePath("/admin");
  return { ok: true };
}

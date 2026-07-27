"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ModerationDecision = "dismissed" | "content_hidden" | "account_suspended";

/**
 * D4: every moderation outcome goes through the DB definer, which checks the
 * admin role and writes an append-only moderation_actions row. Nothing here is
 * the authority — this is just the caller.
 */
export async function resolveReport(
  reportId: string,
  decision: ModerationDecision,
  notes?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_report", {
    target_report: reportId,
    decision,
    notes: notes ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

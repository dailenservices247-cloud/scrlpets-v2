"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GuideDetail } from "./queries";

/**
 * D5/A7: Claude drafts, Dailen approves. Publishing goes through the admin-only
 * definer, so nothing reaches the public /guides surface without this click.
 */
export async function publishGuide(
  guide: GuideDetail,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_guide", {
    guide_slug: guide.slug,
    guide_title: guide.title,
    guide_summary: guide.summary,
    guide_body: guide.body,
    guide_audience: guide.audience,
    publish: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/guides");
  return { ok: true };
}

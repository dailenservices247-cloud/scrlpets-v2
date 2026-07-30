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

export type BookmarkResult =
  | { ok: true; bookmarked: boolean }
  | { ok: false; error: "auth_required" | "failed" };

/**
 * E: private reading list. RLS on guide_bookmarks is own-read / own-insert /
 * own-delete with no shared-read policy at all, so the `profile_id` written here
 * is the only one this session could ever write or read back — passing someone
 * else's id would be refused by the database, not by this function.
 *
 * Idempotent in both directions: the insert ignores the conflict on the
 * composite primary key, and the delete of a row that is not there is a no-op.
 * A double-tapped button therefore lands on the state the user asked for.
 */
export async function toggleGuideBookmark(
  guideId: string,
  bookmarked: boolean,
): Promise<BookmarkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth_required" };

  const { error } = bookmarked
    ? await supabase
        .from("guide_bookmarks")
        .upsert({ profile_id: user.id, guide_id: guideId }, { ignoreDuplicates: true })
    : await supabase
        .from("guide_bookmarks")
        .delete()
        .eq("profile_id", user.id)
        .eq("guide_id", guideId);
  if (error) return { ok: false, error: "failed" };

  revalidatePath("/guides");
  return { ok: true, bookmarked };
}

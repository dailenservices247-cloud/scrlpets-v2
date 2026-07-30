"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateHighlight } from "./limits";

export type HighlightResult = { ok: true } | { ok: false; error: string };

/**
 * Ownership is enforced by the insert/delete policies on creature_highlights
 * (they follow creatures.owner_id). Re-checking it here would be a second copy
 * of the rule that can drift from the first; the validation that IS here is the
 * part RLS can't express as a sentence.
 */
export async function createHighlight(
  creatureId: string,
  slug: string,
  title: string,
  mediaUrls: string[],
): Promise<HighlightResult> {
  const valid = validateHighlight({ title, mediaUrls });
  if (!valid.ok) return { ok: false, error: valid.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("creature_highlights")
    .insert({ creature_id: creatureId, title: valid.title, media_urls: mediaUrls });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}

export async function deleteHighlight(
  id: string,
  slug: string,
): Promise<HighlightResult> {
  const supabase = await createClient();
  // A blocked delete comes back as zero rows, not an error.
  const { count, error } = await supabase
    .from("creature_highlights")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (count !== 1) return { ok: false, error: "not_found" };
  revalidatePath(`/c/${slug}`);
  return { ok: true };
}

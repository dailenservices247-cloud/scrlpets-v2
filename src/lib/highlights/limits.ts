/**
 * Mirrors the two CHECK constraints on `creature_highlights` so the picker can
 * stop at ten and the title box can stop at sixty, instead of the database
 * being the first thing that tells the owner they went too far. The DB remains
 * the real limit — this is the copy that produces a sentence, not a 23514.
 */
export const MAX_HIGHLIGHT_MEDIA = 10;
export const MAX_HIGHLIGHT_TITLE = 60;

export type HighlightError =
  | "title_required"
  | "title_too_long"
  | "media_required"
  | "too_much_media";

/** Pure, so the client form and the server action agree by construction. */
export function validateHighlight(input: {
  title: string;
  mediaUrls: string[];
}): { ok: true; title: string } | { ok: false; error: HighlightError } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "title_required" };
  if (title.length > MAX_HIGHLIGHT_TITLE) return { ok: false, error: "title_too_long" };
  if (input.mediaUrls.length === 0) return { ok: false, error: "media_required" };
  if (input.mediaUrls.length > MAX_HIGHLIGHT_MEDIA)
    return { ok: false, error: "too_much_media" };
  return { ok: true, title };
}

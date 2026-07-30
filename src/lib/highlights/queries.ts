import { createClient } from "@/lib/supabase/server";

export type Highlight = {
  id: string;
  title: string;
  mediaUrls: string[];
  createdAt: string;
};

/**
 * An animal's story highlights, newest first. RLS already scopes reads to
 * creatures that are neither archived nor hidden, so a hidden animal's
 * highlights disappear with its page and no app-side visibility check is needed
 * (or wanted — a second copy of that rule would only drift from the first).
 */
export async function listHighlights(creatureId: string): Promise<Highlight[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("creature_highlights")
    .select("id,title,media_urls,created_at")
    .eq("creature_id", creatureId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as {
    id: string;
    title: string;
    media_urls: string[] | null;
    created_at: string;
  }[]).map((row) => ({
    id: row.id,
    title: row.title,
    mediaUrls: row.media_urls ?? [],
    createdAt: row.created_at,
  }));
}

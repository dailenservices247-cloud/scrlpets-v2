import { createClient } from "@/lib/supabase/server";
import { parseSponsoredContent, type ParsedSponsoredAd } from "./types";

export type MyPromoCampaign = {
  id: string;
  authorId: string;
  mediaUrl: string | null;
  createdAt: string;
  ad: ParsedSponsoredAd;
  budgetCents?: number;
  tier?: string;
  status: "active" | "draft" | "completed";
};

export async function listMyPromos(userId: string): Promise<MyPromoCampaign[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promos")
    .select("id, author_id, title, media_url, created_at")
    .eq("author_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const ad = parseSponsoredContent(row.title, row.id);
    let budgetCents = 1000;
    let tier = "starter";
    if (row.title && row.title.startsWith("{") && row.title.endsWith("}")) {
      try {
        const parsed = JSON.parse(row.title);
        if (parsed.budgetCents) budgetCents = parsed.budgetCents;
        if (parsed.tier) tier = parsed.tier;
      } catch {
        // ignore
      }
    }
    return {
      id: row.id,
      authorId: row.author_id,
      mediaUrl: row.media_url,
      createdAt: row.created_at,
      ad,
      budgetCents,
      tier,
      status: "active",
    };
  });
}

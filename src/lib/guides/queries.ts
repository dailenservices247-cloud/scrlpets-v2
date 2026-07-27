import { createClient } from "@/lib/supabase/server";

export type GuideAudience = "owner" | "breeder" | "buyer";

export type Guide = {
  slug: string;
  title: string;
  summary: string | null;
  audience: GuideAudience;
  publishedAt: string | null;
};

export type GuideDetail = Guide & { body: string };

/**
 * D5: education surfaces. RLS returns only published guides to everyone except
 * admins, so an unapproved draft can never leak into the public list.
 */
export async function listGuides(): Promise<Guide[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guides")
    .select("slug,title,summary,audience,published_at")
    .not("published_at", "is", null)
    .order("audience", { ascending: true })
    .order("published_at", { ascending: false });
  return ((data ?? []) as {
    slug: string;
    title: string;
    summary: string | null;
    audience: GuideAudience;
    published_at: string | null;
  }[]).map((g) => ({
    slug: g.slug,
    title: g.title,
    summary: g.summary,
    audience: g.audience,
    publishedAt: g.published_at,
  }));
}

/** Admin-only: drafts awaiting Dailen's approval. RLS returns [] to everyone else. */
export async function getDraftGuides(): Promise<GuideDetail[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guides")
    .select("slug,title,summary,body,audience,published_at")
    .is("published_at", null)
    .order("created_at", { ascending: true });
  return ((data ?? []) as {
    slug: string;
    title: string;
    summary: string | null;
    body: string;
    audience: GuideAudience;
    published_at: string | null;
  }[]).map((g) => ({
    slug: g.slug,
    title: g.title,
    summary: g.summary,
    body: g.body,
    audience: g.audience,
    publishedAt: g.published_at,
  }));
}

export async function getGuideBySlug(slug: string): Promise<GuideDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guides")
    .select("slug,title,summary,body,audience,published_at")
    .eq("slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();
  if (!data) return null;
  const g = data as {
    slug: string;
    title: string;
    summary: string | null;
    body: string;
    audience: GuideAudience;
    published_at: string | null;
  };
  return {
    slug: g.slug,
    title: g.title,
    summary: g.summary,
    body: g.body,
    audience: g.audience,
    publishedAt: g.published_at,
  };
}

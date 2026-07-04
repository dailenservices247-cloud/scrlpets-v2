import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://scrlpets-v2.vercel.app").replace(/\/$/, "");

function contentPath(item: { id: string; kind: string; subtype: string | null }) {
  if (item.kind === "listing") return `/listing/${item.id}`;
  if (item.kind === "promo") return `/shop/product/${item.id}`;
  if (item.subtype === "reel") return `/watch/reel/${item.id}`;
  if (item.subtype === "long_video") return `/watch/${item.id}`;
  return `/post/${item.id}`;
}

/** Public discovery surfaces only. Private/account routes stay out of search. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [
    { data: profiles },
    { data: creatures },
    { data: brands },
    { data: content },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("username")
      .not("username", "like", "scrlpets-rbac-%")
      .limit(1000),
    supabase.from("creatures").select("slug").limit(1000),
    supabase
      .from("brands")
      .select("slug")
      .not("slug", "like", "e2e-%")
      .limit(1000),
    supabase
      .from("unified_feed")
      .select("id,kind,subtype")
      .not("title", "like", "E2E %")
      .limit(1000),
  ]);

  return [
    { url: BASE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/shop`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE_URL}/terms`, changeFrequency: "monthly", priority: 0.2 },
    ...(profiles ?? []).map((p) => ({
      url: `${BASE_URL}/u/${p.username}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...(creatures ?? []).map((c) => ({
      url: `${BASE_URL}/c/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...(brands ?? []).map((brand) => ({
      url: `${BASE_URL}/b/${brand.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...(content ?? []).map((item) => ({
      url: `${BASE_URL}${contentPath(item)}`,
      changeFrequency: "daily" as const,
      priority: item.kind === "listing" ? 0.8 : 0.6,
    })),
  ];
}

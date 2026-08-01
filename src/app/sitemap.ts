import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://scrlpets-v2.vercel.app").replace(/\/$/, "");

function contentPath(item: { id: string; kind: string; subtype: string | null }) {
  if (item.kind === "listing") return `/listing/${item.id}`;
  if (item.subtype === "reel") return `/watch/reel/${item.id}`;
  if (item.subtype === "long_video") return `/watch/${item.id}`;
  return `/post/${item.id}`;
}

/** Public discovery surfaces only. Private/account routes stay out of search. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  // Profile URLs stay out of the sitemap until username editing ships:
  // auto-generated usernames derive from the email localpart, and the privacy
  // notice promises email addresses are not public.
  const [{ data: creatures }, { data: brands }, { data: content }, { data: litters }] =
    await Promise.all([
      supabase.from("creatures").select("slug").limit(1000),
      supabase
        .from("brands")
        .select("slug")
        .not("slug", "like", "e2e-%")
        .limit(1000),
      supabase
        .from("unified_feed")
        .select("id,kind,subtype")
        // NULL-safe: plain `not like` would drop caption-less media posts.
        .or("title.is.null,title.not.like.E2E *")
        .limit(1000),
      supabase
        .from("litters")
        .select("id")
        .not("name", "like", "E2E %")
        .limit(1000),
    ]);

  return [
    { url: BASE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE_URL}/market`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE_URL}/terms`, changeFrequency: "monthly", priority: 0.2 },
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
    // Promos are excluded: `promos` has no insert policy for any role and the
    // composer's Promotion mode is live:false, so nobody can create one. A dead
    // content type has no business being advertised to a crawler.
    ...(content ?? [])
      .filter((item) => item.kind !== "promo")
      .map((item) => ({
        url: `${BASE_URL}${contentPath(item)}`,
        changeFrequency: "daily" as const,
        priority: item.kind === "listing" ? 0.8 : 0.6,
      })),
    ...(litters ?? []).map((l) => ({
      url: `${BASE_URL}/litters/${l.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}

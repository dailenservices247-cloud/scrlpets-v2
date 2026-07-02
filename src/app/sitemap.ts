import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = "https://scrlpets-v2.vercel.app";

/** Public G1-A surfaces: home + person profiles + creature pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const [{ data: profiles }, { data: creatures }] = await Promise.all([
    supabase.from("profiles").select("username").limit(1000),
    supabase.from("creatures").select("slug").limit(1000),
  ]);

  return [
    { url: BASE_URL, changeFrequency: "hourly", priority: 1 },
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
  ];
}

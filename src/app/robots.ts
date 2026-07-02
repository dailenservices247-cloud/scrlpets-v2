import type { MetadataRoute } from "next";

const BASE_URL = "https://scrlpets-v2.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authed/private surfaces — nothing indexable behind these.
      disallow: ["/compose", "/settings", "/messages", "/brands", "/brand-os", "/menu", "/auth"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

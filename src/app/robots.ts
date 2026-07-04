import type { MetadataRoute } from "next";

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://scrlpets-v2.vercel.app").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/auth",
        "/brand-os",
        "/brands",
        "/compose",
        "/forgot-password",
        "/login",
        "/menu",
        "/messages",
        "/reset-password",
        "/settings",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

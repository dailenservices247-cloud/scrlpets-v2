import type { MetadataRoute } from "next";

/**
 * Installability, and nothing more. There is no service worker on purpose:
 * offline caching and push notifications are banked, so the manifest must not
 * imply either. Next serves this at /manifest.webmanifest and injects the
 * <link rel="manifest"> itself.
 *
 * ponytail: no `purpose: "maskable"` entry. A maskable icon needs its own
 * padded artwork — declaring the unpadded mark as maskable would let Android
 * crop the logo. Add a padded 512 when brand supplies one.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scrlpets — The Trusted Home for Animals",
    short_name: "Scrlpets",
    description: "The trusted home for animals. Verified breeders, escrow protection, deal room contracts, and pet care.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#18181b",
    theme_color: "#18181b",
    categories: ["pets", "lifestyle", "shopping", "social"],
    icons: [
      { src: "/brand/scrlpets-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/scrlpets-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcuts: [
      {
        name: "Marketplace",
        url: "/market",
        description: "Browse verified animals, supplies, and services",
      },
      {
        name: "Deal Room",
        url: "/messages",
        description: "View negotiations, contracts, and escrow status",
      },
      {
        name: "Brand OS",
        url: "/brand-os",
        description: "Manage kennel, roster, litters, and catalog",
      },
      {
        name: "Post Update",
        url: "/compose",
        description: "Share a reel, video, or animal update",
      },
    ],
  };
}

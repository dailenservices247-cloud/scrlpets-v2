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
    name: "Scrlpets",
    short_name: "Scrlpets",
    // Same sentence as the site metadata, so the two cannot drift.
    description: "The trusted home for animals.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Matches the forced-dark app shell in globals.css.
    background_color: "#2a2a2d",
    theme_color: "#2a2a2d",
    icons: [
      { src: "/brand/scrlpets-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/scrlpets-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

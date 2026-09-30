import type { FeedItem } from "./types";

/**
 * The three surface registers (visual system spec §3.3), as the class strings
 * both a tile and the realm behind it read from.
 *
 * One home for them on purpose: §4 says the room matches the tile, and the
 * destination shell had its own copy of the accent colours below — the same
 * values, written twice, which is how a tile and its realm drift apart without
 * anyone editing either one on purpose. (Immersive has no entry: it is the
 * absence of a surface, and the reel realm already speaks it.)
 */

/** Something someone said. Not an object on a surface — an entry in a column. */
export const EDITORIAL_SURFACE = "flex flex-col gap-3 px-1";

/** Something carrying price, state or verification. */
export const PANEL_SURFACE = "premium-panel gap-3 overflow-hidden rounded-2xl p-4";

/** One accent family per content type (§3.5). Post is editorial, so it has none. */
export const PANEL_ACCENT: Record<FeedItem["type"], string> = {
  post: "",
  reel: "border-[color:var(--brand-wine-bright)]",
  long_video: "border-secondary/45",
  listing: "border-primary/60",
  promo: "border-accent/45",
};

/**
 * §4's inheritance question, asked once: does it carry price, state or
 * verification? A post is the only thing in the feed that does not.
 */
export function registerFor(type: FeedItem["type"]): "editorial" | "panel" {
  return type === "post" ? "editorial" : "panel";
}

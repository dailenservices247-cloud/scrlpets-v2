import type { FeedItemType } from "./types";

/**
 * The name a tile and its realm share so the browser can morph one into the
 * other (visual system spec §5, "the doorway rule").
 *
 * Both sides of a navigation call this with the same kind and id, which is the
 * whole mechanism: React's `<ViewTransition name=…>` matches the old and new
 * element by this string, and animates between their positions. Get the string
 * wrong on one side and nothing errors — the page simply cuts, exactly as it
 * does today.
 *
 * `view-transition-name` takes a CSS custom-ident, so it cannot start with a
 * digit and cannot carry arbitrary characters. Feed ids are uuids, and roughly
 * six in ten start with a digit, so the prefix is load-bearing rather than
 * decorative. Anything outside [a-z0-9-] is replaced rather than stripped, so
 * two different ids can never collapse onto one name.
 */
export function realmTransitionName(kind: FeedItemType, id: string): string {
  const safeId = id.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `realm-${kind.replace(/_/g, "-")}-${safeId}`;
}

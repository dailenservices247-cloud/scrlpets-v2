import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The doorway rule (visual system spec §5, frozen criterion 5): every tile that
 * opens a realm declares a `ViewTransition` name matching its destination hero.
 *
 * Asserted against source rather than the DOM on purpose. React writes
 * `view-transition-name` onto the element only WHILE a transition is running,
 * so at rest there is nothing to query. What can actually rot is the pairing —
 * a new doorway tile that forgets the name, or a destination that stops calling
 * the shared function — and reading both sides is what catches that.
 *
 * The measurement that a morph really animates, and really stops animating
 * under `prefers-reduced-motion`, lives in tests/e2e/realm-morph.spec.ts.
 */

/**
 * Tile -> the surface its destination hero lives on. A tile absent from this
 * list does not open a realm (an alumni update, a "more from this seller"
 * thumbnail) and must NOT be named: an unmatched name animates on its own.
 */
const doorways: Array<[string, string]> = [
  ["src/components/feed/tiles/ListingTile.tsx", "src/components/feed/FeedDestinationShell.tsx"],
  ["src/components/feed/tiles/LongVideoTile.tsx", "src/components/feed/FeedDestinationShell.tsx"],
  ["src/components/feed/tiles/PromoTile.tsx", "src/components/feed/FeedDestinationShell.tsx"],
  ["src/components/feed/tiles/PostTile.tsx", "src/components/feed/FeedDestinationShell.tsx"],
  ["src/components/feed/tiles/ReelTile.tsx", "src/components/feed/ReelRealm.tsx"],
];

const read = (file: string) => readFileSync(file, "utf8");
// Both shapes count: `transitionName=` on TileMedia, and `name=` where the
// component wraps its own <ViewTransition> (the reel, which plays inline).
const named = /(?:transitionName|name)=\{realmTransitionName\(/;

describe("the doorway rule", () => {
  it.each(doorways)("%s names the media it opens from", (tile) => {
    expect(read(tile)).toMatch(named);
  });

  it.each(doorways)("the realm %s opens names the same media", (_tile, destination) => {
    expect(read(destination)).toMatch(named);
  });

  it("view transitions are enabled, or every name above is inert", () => {
    // Without the flag React's <ViewTransition> does nothing: the names are all
    // correct, the page cuts instead of morphing, and nothing errors to say so.
    expect(read("next.config.ts")).toMatch(/viewTransition:\s*true/);
  });

  it("the morph runs at the spec's duration on the one shared curve", () => {
    // Spec §6: 320ms for a realm morph, one easing curve defined once.
    const css = read("src/app/globals.css");
    expect(css).toMatch(/--duration-morph:\s*320ms/);
    expect(css).toMatch(/::view-transition-group\(\.morph\)/);
    expect(css).toMatch(/var\(--ease-realm\)/);
  });

  it("prefers-reduced-motion zeroes it — spec §6 calls this non-negotiable", () => {
    const css = read("src/app/globals.css");
    const query = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(query).toMatch(/::view-transition-group\(\*\)/);
    expect(query).toMatch(/animation-duration:\s*0s\s*!important/);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");

describe("type scale tokens", () => {
  it.each(["display", "title", "body", "ui", "meta"])(
    "defines --text-%s so it can be used as a utility",
    (role) => {
      expect(css).toContain(`--text-${role}:`);
    },
  );

  it("maps a serif family token", () => {
    expect(css).toContain("--font-serif:");
  });

  it("loads the display serif and exposes it as a CSS variable", () => {
    expect(layout).toContain("Instrument_Serif");
    expect(layout).toContain("--font-instrument-serif");
  });
});

/**
 * Grows one file per task. A component only joins this list once it has been
 * converted, so the list is a record of what the system actually covers rather
 * than a wish.
 */
const GUARDED = [
  "src/components/feed/AttributionStack.tsx",
  "src/components/feed/tiles/ListingTile.tsx",
  "src/components/feed/tiles/PromoTile.tsx",
  "src/components/feed/tiles/LongVideoTile.tsx",
  "src/app/b/[slug]/page.tsx",
  // The app chrome, 2026-09-30. These four carried `text-[15px]`, which is the
  // `ui` role's value exactly — a token swap that changes no rendered pixel.
  "src/components/app/SideNav.tsx",
  "src/app/menu/page.tsx",
  "src/app/settings/page.tsx",
  "src/components/feed/tiles/ReelTile.tsx",
];

/**
 * NOT guarded, with a reason rather than an omission.
 *
 * FeedDestinationShell was converted in the same pass as the brand page above
 * and is clean except for one thing: the pinned / edited / group chips are
 * `text-[10px]`, which is below `meta`, the smallest role the scale has. The
 * same three chips at the same size live in FeedCardShell, so moving only this
 * file's copy to `meta` would make one chip two sizes depending on which
 * surface you are looking at. Fixing it properly means one shared chip at one
 * role, which changes the /design baselines and wants a reviewed diff
 * (criterion 9) — a decision, not a cleanup. Add the file here when that lands.
 */


describe("feed components use the scale, not raw values", () => {
  it.each(GUARDED)("%s has no raw pixel font size", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/text-\[\d+(\.\d+)?px\]/);
  });

  it.each(GUARDED)("%s has no color literal", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|oklch\(|rgba?\(/);
  });
});

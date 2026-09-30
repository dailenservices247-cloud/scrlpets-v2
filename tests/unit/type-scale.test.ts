import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");

describe("type scale tokens", () => {
  it.each(["display", "title", "body", "ui", "meta", "micro"])(
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
  // The micro tier, 2026-09-30. Seventeen 9/10/11px values across these twelve
  // files had no role to come from: the scale stopped at `meta` 13px. They now
  // read `micro`, including the two chip files the previous pass deferred.
  "src/components/feed/FeedCardShell.tsx",
  "src/components/feed/FeedDestinationShell.tsx",
  "src/components/app/BottomNav.tsx",
  "src/components/app/AppHeader.tsx",
  "src/components/compose/ComposerTabs.tsx",
  "src/components/calendar/MonthGrid.tsx",
  "src/components/calendar/EventSheet.tsx",
  "src/components/health/HealthCenterClient.tsx",
  "src/components/health/ReminderSheet.tsx",
  "src/components/tree/TreeCard.tsx",
  "src/components/tree/RosterToggle.tsx",
];

/**
 * NOT guarded, with a reason rather than an omission.
 *
 * `src/components/social/ReactionBar.tsx` carries `text-[22px]`, and it stays.
 * That value sizes an `aria-hidden` emoji rendered as the reaction icon, so it
 * is an icon dimension wearing font-size's clothes, not a type role — the same
 * category as `size-4` on a lucide glyph. Routing it through the scale would
 * make the scale responsible for something it does not describe. If the emoji
 * ever becomes an SVG, this note goes away with it.
 */


describe("feed components use the scale, not raw values", () => {
  it.each(GUARDED)("%s has no raw pixel font size", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/text-\[\d+(\.\d+)?px\]/);
  });

  it.each(GUARDED)("%s has no color literal", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/#[0-9a-fA-F]{3,8}\b|oklch\(|rgba?\(/);
  });
});

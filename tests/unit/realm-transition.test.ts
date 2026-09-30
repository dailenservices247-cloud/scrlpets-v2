import { describe, expect, it } from "vitest";
import { realmTransitionName } from "@/lib/feed/realm-transition";

/**
 * The doorway rule (visual system spec §5): a tile that opens a realm morphs
 * into it, because the tapped media is the same element on both sides of the
 * navigation. "Same element" is expressed as a matching `view-transition-name`,
 * so the only thing that actually has to hold is that both sides compute the
 * same string, and that no two live elements ever compute the same one.
 *
 * Testing the name rather than the animation on purpose: the browser's
 * transition is not observable from a test, but a collision or a malformed
 * ident silently breaks the morph with no error anywhere.
 */
describe("realmTransitionName", () => {
  it("gives a tile and its destination the same name", () => {
    expect(realmTransitionName("listing", "abc")).toBe(
      realmTransitionName("listing", "abc"),
    );
  });

  it("is unique per item, so two tiles on one screen never claim one name", () => {
    expect(realmTransitionName("listing", "abc")).not.toBe(
      realmTransitionName("listing", "def"),
    );
  });

  it("is unique per kind, so a listing and a reel sharing an id cannot collide", () => {
    expect(realmTransitionName("listing", "abc")).not.toBe(
      realmTransitionName("reel", "abc"),
    );
  });

  it("is a valid CSS custom-ident — a uuid starting with a digit would break it", () => {
    // view-transition-name takes a custom-ident: it cannot start with a digit,
    // and cannot contain characters that are illegal in an identifier.
    expect(realmTransitionName("listing", "9f2c1d44-0000-4000-8000-000000000000")).toMatch(
      /^[a-z][a-z0-9-]*$/,
    );
  });
});

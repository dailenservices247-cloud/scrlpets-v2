import { describe, expect, it } from "vitest";
import { paidReadSurfaceVisible } from "@/lib/subscriptions/queries";

/**
 * The wrong version of this gate is ALSO inert today, which is why it needs a
 * test that does not depend on the flag's real value.
 *
 * `enabled && hasEnt` hides the surface from everyone right now.
 * `!enabled || hasEnt` shows it to everyone right now.
 * With subscriptions_enabled false, no e2e can tell them apart — and it stays
 * that way until the day the flag flips and every operator loses their stats.
 */
describe("paidReadSurfaceVisible", () => {
  it("shows the surface to everyone while subscriptions are off", () => {
    expect(paidReadSurfaceVisible(false, false)).toBe(true);
    expect(paidReadSurfaceVisible(false, true)).toBe(true);
  });

  it("gates on the entitlement once subscriptions are on", () => {
    expect(paidReadSurfaceVisible(true, true)).toBe(true);
    expect(paidReadSurfaceVisible(true, false)).toBe(false);
  });
});

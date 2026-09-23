import { describe, expect, it } from "vitest";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";

/**
 * Event names are a schema. Renaming one after data exists silently splits a
 * funnel across two names, and nothing fails — which is why they live in one
 * frozen object instead of as string literals at each call site.
 */
describe("FUNNEL_EVENTS", () => {
  it("covers every step of the seeded-launch funnel", () => {
    for (const key of [
      "signupCompleted",
      "onboardingSpeciesSaved",
      "onboardingSkipped",
      "breederBranchTaken",
      "breederBranchSkipped",
      "firstBrandCreated",
    ] as const) {
      expect(FUNNEL_EVENTS[key], `FUNNEL_EVENTS.${key} missing`).toBeTruthy();
    }
  });

  it("names the event that closes the loop for a breeder with nothing to list", () => {
    // Publishing an expecting litter is the terminal action for a breeder
    // between litters. Without its own name it is invisible in the funnel, and
    // the drop-off that stalled the first real breeder stays a guess.
    expect(FUNNEL_EVENTS.litterPublished).toBe("litter_published");
  });

  it("names the two-factor sign-in events", () => {
    expect(FUNNEL_EVENTS.mfaChallengePassed).toBe("mfa_challenge_passed");
    expect(FUNNEL_EVENTS.mfaRecoveryCodeUsed).toBe("mfa_recovery_code_used");
  });

  it("uses snake_case names with no collisions", () => {
    const names = Object.values(FUNNEL_EVENTS);
    expect(new Set(names).size, "duplicate event name").toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

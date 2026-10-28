import { describe, expect, it } from "vitest";
import { computeGoHomeTimeline } from "@/lib/creatures/go-home";

describe("computeGoHomeTimeline", () => {
  it("computes the 8-week (56-day) go-home date and remaining days for a puppy under 8 weeks", () => {
    const ref = new Date("2026-10-27T12:00:00Z");
    const res = computeGoHomeTimeline("dog", "2026-10-01", ref);
    expect(res).toEqual({
      birthDate: "2026-10-01",
      eligibleGoHomeDate: "2026-11-26",
      minAgeWeeks: 8,
      ageDays: 26,
      ageWeeks: 3,
      daysUntilReady: 30,
      isReadyToGoHome: false,
    });
  });

  it("marks a dog or cat at or above 56 days as ready to go home now", () => {
    const ref = new Date("2026-10-27T12:00:00Z");
    const res = computeGoHomeTimeline("Dog", "2026-08-01", ref);
    expect(res?.isReadyToGoHome).toBe(true);
    expect(res?.daysUntilReady).toBe(0);
    expect(res?.minAgeWeeks).toBe(8);
    expect(res?.ageWeeks).toBe(12);
  });

  it("returns null when birthDate is missing or malformed", () => {
    expect(computeGoHomeTimeline("dog", null)).toBeNull();
    expect(computeGoHomeTimeline("dog", "not-a-date")).toBeNull();
  });
});

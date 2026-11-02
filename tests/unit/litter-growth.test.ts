import { describe, it, expect } from "vitest";
import {
  calculateGrowthSummary,
  calculateBenchmarkCurve,
  gramsToOunces,
} from "@/lib/litters/growth";

describe("Breeder OS Litter Growth Calculations", () => {
  it("calculates initial birth weight summary with zero records", () => {
    const summary = calculateGrowthSummary(450, []);
    expect(summary.currentWeightGrams).toBe(450);
    expect(summary.totalGainGrams).toBe(0);
    expect(summary.percentageGain).toBe(0);
    expect(summary.status).toBe("healthy");
  });

  it("calculates healthy growth and average daily gain", () => {
    // 450g birth weight, reaches 900g on day 7 (doubled birth weight, healthy canine standard)
    const records = [
      { day: 0, weightGrams: 450 },
      { day: 3, weightGrams: 620 },
      { day: 7, weightGrams: 900 },
    ];
    const summary = calculateGrowthSummary(450, records);

    expect(summary.currentWeightGrams).toBe(900);
    expect(summary.totalGainGrams).toBe(450);
    expect(summary.percentageGain).toBe(100);
    expect(summary.averageDailyGainGrams).toBeCloseTo(450 / 7, 1);
    expect(summary.status).toBe("healthy");
  });

  it("flags lagging growth when weight decreases or gains insufficiently", () => {
    const records = [
      { day: 0, weightGrams: 500 },
      { day: 2, weightGrams: 490 }, // lost weight
    ];
    const summary = calculateGrowthSummary(500, records);
    expect(summary.status).toBe("lagging");
    expect(summary.last24hChangeGrams).toBe(-10);
  });

  it("generates compounding benchmark doubling curve", () => {
    const curve = calculateBenchmarkCurve(400, 10);
    expect(curve.length).toBe(11);
    expect(curve[0].weightGrams).toBe(400);
    // Doubling around day 8-10
    expect(curve[10].weightGrams).toBeGreaterThan(800);
  });

  it("converts grams to ounces accurately", () => {
    expect(gramsToOunces(454)).toBe(16); // 1 lb = 16 oz = ~454g
    expect(gramsToOunces(1000)).toBeCloseTo(35.3, 1);
  });
});

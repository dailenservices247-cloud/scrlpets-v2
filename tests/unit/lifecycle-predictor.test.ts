import { describe, it, expect } from "vitest";
import {
  predictAntNuptialFlight,
  calculateAntFoundingTimeline,
  calculateClutchIncubation,
  calculateMammalReproduction,
} from "@/lib/lifecycle/predictor";

describe("Universal Life-Cycle & Reproductive Predictor", () => {
  describe("Insects & Ant Keepers", () => {
    it("identifies optimal nuptial flight conditions on warm humid days post-rain", () => {
      const result = predictAntNuptialFlight({
        temperatureF: 82,
        humidityPercent: 75,
        daysSinceRain: 1,
        month: 6, // June
      });

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.condition).toBe("optimal");
      expect(result.recommendedSpecies.length).toBeGreaterThan(0);
    });

    it("identifies cold dry conditions as unlikely for flights", () => {
      const result = predictAntNuptialFlight({
        temperatureF: 58,
        humidityPercent: 30,
        daysSinceRain: 10,
        month: 1, // January
      });

      expect(result.score).toBeLessThan(50);
      expect(result.condition).toBe("unlikely");
    });

    it("generates correct chronological colony founding stages", () => {
      const stages = calculateAntFoundingTimeline();
      expect(stages.length).toBe(6);
      expect(stages[0].stage).toBe("capture");
      expect(stages[4].stage).toBe("nanitics");
      expect(stages[5].stage).toBe("outworld");
    });
  });

  describe("Reptiles & Aviary", () => {
    it("calculates egg incubation duration for bearded dragons", () => {
      const result = calculateClutchIncubation({
        speciesName: "bearded_dragon",
        clutchDate: "2026-06-01",
        incubationTempF: 83,
        humidityPercent: 65,
      });

      expect(result.estimatedDays).toBe(60);
      expect(result.projectedHatchDate).toBe("2026-07-31");
      expect(result.status).toBe("ideal");
    });

    it("provides temperature-dependent sex determination note for leopard geckos", () => {
      const femaleResult = calculateClutchIncubation({
        speciesName: "leopard_gecko",
        clutchDate: "2026-06-01",
        incubationTempF: 80,
        humidityPercent: 70,
      });
      expect(femaleResult.tsdNote).toContain("females");

      const maleResult = calculateClutchIncubation({
        speciesName: "leopard_gecko",
        clutchDate: "2026-06-01",
        incubationTempF: 89,
        humidityPercent: 70,
      });
      expect(maleResult.tsdNote).toContain("males");
    });
  });

  describe("Mammals & Domestic", () => {
    it("accurately identifies canine ovulation at 5.0 ng/mL progesterone", () => {
      const result = calculateMammalReproduction({
        species: "dog",
        eventDate: "2026-06-01",
        progesteroneLevelNgMl: 5.2,
      });

      expect(result.stage).toContain("Ovulation");
      expect(result.projectedDueDate).toBe("2026-08-03"); // 63 days
    });

    it("handles rabbit kindling with 31-day gestation", () => {
      const result = calculateMammalReproduction({
        species: "rabbit",
        eventDate: "2026-06-01",
      });

      expect(result.stage).toContain("Kindling");
      expect(result.projectedDueDate).toBe("2026-07-02"); // 31 days
    });
  });
});

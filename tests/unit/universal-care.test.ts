import { describe, it, expect } from "vitest";
import {
  calculateFeedingStatus,
  evaluateHabitatMetrics,
  getRecommendedCareDefaults,
  type HabitatParameters,
} from "@/lib/care/husbandry";

describe("Universal Pet Husbandry & Habitat Care System", () => {
  it("accurately evaluates feeding statuses: fed, due_soon, overdue", () => {
    const now = new Date("2026-11-02T12:00:00Z");

    // Fed 2 hours ago (daily frequency = due in 22h)
    const fed = calculateFeedingStatus("2026-11-02T10:00:00Z", "daily", now);
    expect(fed.status).toBe("fed");
    expect(fed.hoursRemaining).toBe(22);

    // Fed 18 hours ago (daily frequency = due in 6h -> due_soon)
    const dueSoon = calculateFeedingStatus("2026-11-01T18:00:00Z", "daily", now);
    expect(dueSoon.status).toBe("due_soon");
    expect(dueSoon.hoursRemaining).toBe(6);

    // Fed 30 hours ago (daily frequency = overdue by 6h -> overdue)
    const overdue = calculateFeedingStatus("2026-11-01T06:00:00Z", "daily", now);
    expect(overdue.status).toBe("overdue");
    expect(overdue.hoursRemaining).toBe(-6);
  });

  it("evaluates optimal, warning, and critical environmental metrics", () => {
    const optimalHabitat: HabitatParameters = {
      temperature: { warmZone: 90, coolZone: 78, ambient: 84, current: 85, unit: "F" },
      humidity: { targetMin: 40, targetMax: 60, current: 50 },
      enclosureType: "Bioactive Vivarium",
    };

    const resOptimal = evaluateHabitatMetrics(optimalHabitat);
    expect(resOptimal.tempStatus).toBe("optimal");
    expect(resOptimal.humidityStatus).toBe("optimal");
    expect(resOptimal.alerts).toHaveLength(0);

    const warningHabitat: HabitatParameters = {
      ...optimalHabitat,
      temperature: { ...optimalHabitat.temperature, current: 94 }, // slightly warm
      humidity: { ...optimalHabitat.humidity, current: 36 }, // slightly dry
    };

    const resWarning = evaluateHabitatMetrics(warningHabitat);
    expect(resWarning.tempStatus).toBe("warning");
    expect(resWarning.humidityStatus).toBe("warning");
    expect(resWarning.alerts.length).toBeGreaterThan(0);

    const criticalHabitat: HabitatParameters = {
      ...optimalHabitat,
      temperature: { ...optimalHabitat.temperature, current: 102 }, // dangerously hot
      humidity: { ...optimalHabitat.humidity, current: 15 }, // dangerously low
    };

    const resCritical = evaluateHabitatMetrics(criticalHabitat);
    expect(resCritical.tempStatus).toBe("critical");
    expect(resCritical.humidityStatus).toBe("critical");
  });

  it("provides tailored baseline care defaults across all animal families under one umbrella", () => {
    const antDefaults = getRecommendedCareDefaults("insect");
    expect(antDefaults.species).toBe("insect");
    expect(antDefaults.habitat.enclosureType).toContain("Formicarium");
    expect(antDefaults.milestones.colonyMetrics?.queenStatus).toBe("single_queen");
    expect(antDefaults.milestones.colonyMetrics?.brood.eggs).toBe(true);

    const reptileDefaults = getRecommendedCareDefaults("reptile");
    expect(reptileDefaults.species).toBe("reptile");
    expect(reptileDefaults.habitat.lighting?.uvbRating).toBeDefined();
    expect(reptileDefaults.milestones.shedOrMolt?.status).toBe("complete");

    const rabbitDefaults = getRecommendedCareDefaults("rabbit");
    expect(rabbitDefaults.species).toBe("rabbit");
    expect(rabbitDefaults.feeding.dietType).toContain("Hay");

    const dogDefaults = getRecommendedCareDefaults("dog");
    expect(dogDefaults.species).toBe("dog");
    expect(dogDefaults.habitat.substrate).toContain("Bedding");
  });
});

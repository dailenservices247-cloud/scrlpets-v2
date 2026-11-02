import { describe, it, expect } from "vitest";
import {
  listCommunityObservations,
  formatObservationCategoryLabel,
} from "@/lib/observations/community";

describe("Community Field & Habitat Observations", () => {
  it("filters observations by species category", () => {
    const insectObs = listCommunityObservations({ species: "insect" });
    expect(insectObs.length).toBeGreaterThan(0);
    expect(insectObs.every((obs) => obs.species === "insect")).toBe(true);

    const reptileObs = listCommunityObservations({ species: "reptile" });
    expect(reptileObs.length).toBeGreaterThan(0);
    expect(reptileObs.every((obs) => obs.species === "reptile")).toBe(true);
  });

  it("filters observations by category type", () => {
    const flightObs = listCommunityObservations({ category: "flight_sighting" });
    expect(flightObs.length).toBeGreaterThan(0);
    expect(flightObs[0].category).toBe("flight_sighting");

    const weatherObs = listCommunityObservations({ category: "weather_alert" });
    expect(weatherObs.length).toBeGreaterThan(0);
    expect(weatherObs[0].category).toBe("weather_alert");
  });

  it("filters observations by text search query", () => {
    const searchRes = listCommunityObservations({ searchQuery: "frost" });
    expect(searchRes.length).toBeGreaterThan(0);
    expect(searchRes[0].title.toLowerCase()).toContain("frost");
  });

  it("formats category labels accurately", () => {
    expect(formatObservationCategoryLabel("flight_sighting")).toBe("Flight Sighting");
    expect(formatObservationCategoryLabel("seasonal_transition")).toBe("Seasonal Transition");
    expect(formatObservationCategoryLabel("weather_alert")).toBe("Weather Advisory");
    expect(formatObservationCategoryLabel("husbandry_tip")).toBe("Husbandry Insight");
  });
});

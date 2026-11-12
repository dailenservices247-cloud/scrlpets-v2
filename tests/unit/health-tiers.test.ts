import { describe, it, expect } from "vitest";
import { calculateHealthTier } from "@/lib/verification/health-tiers";
import type { GeneticTest } from "@/lib/creatures/queries";

describe("calculateHealthTier", () => {
  it("assigns Elite tier when both OFA phenotypic clearances and genomic DNA panels are clear", () => {
    const tests: GeneticTest[] = [
      { id: "1", testType: "hip", conditionName: "OFA Hips / Radiograph", result: "normal", grade: null, geneName: null, genotype: null, provider: "OFA", testDate: "2026-01-01", certificateNumber: null, notes: null },
      { id: "2", testType: "elbow", conditionName: "OFA Elbows", result: "clear", grade: null, geneName: null, genotype: null, provider: "OFA", testDate: "2026-01-01", certificateNumber: null, notes: null },
      { id: "3", testType: "dna_panel", conditionName: "Embark DNA Health Panel", result: "clear", grade: null, geneName: null, genotype: null, provider: "Embark", testDate: "2026-01-01", certificateNumber: null, notes: null },
    ];
    const tier = calculateHealthTier({ tests, anchorVerified: true });
    expect(tier.tier).toBe("elite");
    expect(tier.label).toBe("Elite Health Clearance");
    expect(tier.criteriaMet.length).toBeGreaterThanOrEqual(2);
  });

  it("assigns Comprehensive tier when at least one phenotypic or DNA clearance is documented", () => {
    const tests: GeneticTest[] = [
      { id: "1", testType: "cardiac", conditionName: "OFA Cardiac Screening", result: "normal", grade: null, geneName: null, genotype: null, provider: "OFA", testDate: "2026-01-01", certificateNumber: null, notes: null },
    ];
    const tier = calculateHealthTier({ tests });
    expect(tier.tier).toBe("comprehensive");
    expect(tier.label).toBe("Comprehensive Clearance");
  });

  it("assigns Baseline tier when only microchip anchor is verified with no lab tests yet", () => {
    const tier = calculateHealthTier({ tests: [], anchorVerified: true, registrationNumber: "AKC-12345" });
    expect(tier.tier).toBe("baseline");
    expect(tier.label).toBe("Baseline Clearance");
  });

  it("assigns Pending tier when no clearances or anchors are present", () => {
    const tier = calculateHealthTier({ tests: [], anchorVerified: false, registrationNumber: null });
    expect(tier.tier).toBe("pending");
    expect(tier.label).toBe("Testing Pending");
  });
});

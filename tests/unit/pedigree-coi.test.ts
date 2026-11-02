import { describe, expect, it } from "vitest";
import { calculateCOI } from "@/lib/creatures/pedigree";

describe("Wright's Coefficient of Inbreeding (COI) calculations", () => {
  it("calculates 0% COI when sire and dam share no common ancestors", () => {
    // Sire S has parents S_F, S_M
    // Dam D has parents D_F, D_M
    const parentEdges = new Map<string, { sireId: string | null; damId: string | null }>();
    parentEdges.set("sire", { sireId: "sf", damId: "sm" });
    parentEdges.set("dam", { sireId: "df", damId: "dm" });

    const { coi, commonAncestorIds } = calculateCOI("sire", "dam", parentEdges);
    expect(coi).toBe(0);
    expect(commonAncestorIds).toEqual([]);
  });

  it("calculates 25% COI for full brother x sister mating", () => {
    // Both Sire and Dam have the exact same parents (F, M)
    const parentEdges = new Map<string, { sireId: string | null; damId: string | null }>();
    parentEdges.set("sire", { sireId: "grandpa", damId: "grandma" });
    parentEdges.set("dam", { sireId: "grandpa", damId: "grandma" });

    const { coi, commonAncestorIds } = calculateCOI("sire", "dam", parentEdges);
    // (1/2)^(1 + 1 + 1) + (1/2)^(1 + 1 + 1) = 0.125 + 0.125 = 0.25 (25%)
    expect(coi).toBeCloseTo(0.25, 4);
    expect(commonAncestorIds).toContain("grandpa");
    expect(commonAncestorIds).toContain("grandma");
  });

  it("calculates 12.5% COI for half brother x half sister mating", () => {
    // Share common father (grandpa), different mothers
    const parentEdges = new Map<string, { sireId: string | null; damId: string | null }>();
    parentEdges.set("sire", { sireId: "grandpa", damId: "grandma_sire" });
    parentEdges.set("dam", { sireId: "grandpa", damId: "grandma_dam" });

    const { coi, commonAncestorIds } = calculateCOI("sire", "dam", parentEdges);
    // (1/2)^(1 + 1 + 1) = 0.125 (12.5%)
    expect(coi).toBeCloseTo(0.125, 4);
    expect(commonAncestorIds).toEqual(["grandpa"]);
  });

  it("calculates 6.25% COI for first cousins", () => {
    // Sire's father and Dam's father are full brothers sharing GG_F and GG_M
    const parentEdges = new Map<string, { sireId: string | null; damId: string | null }>();
    parentEdges.set("sire", { sireId: "paternal_uncle", damId: "unrelated_1" });
    parentEdges.set("dam", { sireId: "maternal_uncle", damId: "unrelated_2" });
    parentEdges.set("paternal_uncle", { sireId: "gg_f", damId: "gg_m" });
    parentEdges.set("maternal_uncle", { sireId: "gg_f", damId: "gg_m" });

    const { coi, commonAncestorIds } = calculateCOI("sire", "dam", parentEdges);
    // (1/2)^(2 + 2 + 1) + (1/2)^(2 + 2 + 1) = 0.03125 + 0.03125 = 0.0625 (6.25%)
    expect(coi).toBeCloseTo(0.0625, 4);
    expect(commonAncestorIds).toContain("gg_f");
    expect(commonAncestorIds).toContain("gg_m");
  });

  it("returns 0 when sire or dam is undefined", () => {
    const parentEdges = new Map<string, { sireId: string | null; damId: string | null }>();
    expect(calculateCOI(null, "dam", parentEdges).coi).toBe(0);
    expect(calculateCOI("sire", null, parentEdges).coi).toBe(0);
  });
});

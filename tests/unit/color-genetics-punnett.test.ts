import { describe, expect, it } from "vitest";
import { calculatePunnettSquare } from "@/components/litters/ColorGeneticsForecaster";

describe("ColorGeneticsForecaster Mendelian Punnett calculations", () => {
  it("calculates 100% heterozygous outcome for homozygous dominant x homozygous recessive", () => {
    // E.g. Em/Em x e/e -> 100% Em/e
    const distribution = calculatePunnettSquare(["Em", "Em"], ["e", "e"]);
    expect(distribution["Em/e"]).toBe(100);
  });

  it("calculates 25% / 50% / 25% Mendelian ratio for heterozygous x heterozygous cross", () => {
    // E.g. D/d x D/d -> 25% D/D, 50% D/d, 25% d/d
    const distribution = calculatePunnettSquare(["D", "d"], ["D", "d"]);
    expect(distribution["D/D"]).toBe(25);
    expect(distribution["D/d"]).toBe(50);
    expect(distribution["d/d"]).toBe(25);
  });

  it("calculates 50% carrier / 50% homozygous for backcross", () => {
    // E.g. kbr/ky x ky/ky -> 50% kbr/ky (brindle carrier), 50% ky/ky (clear agouti/fawn)
    const distribution = calculatePunnettSquare(["kbr", "ky"], ["ky", "ky"]);
    expect(distribution["kbr/ky"]).toBe(50);
    expect(distribution["ky/ky"]).toBe(50);
  });
});

import { describe, expect, it } from "vitest";
import {
  REGULATORY_TIERS_META,
  lookupSpeciesProfile,
  verifySpeciesListingCompliance,
} from "@/lib/species/statutory-tiers";

describe("statutory-tiers architecture", () => {
  it("defines all six functional legal tiers", () => {
    expect(Object.keys(REGULATORY_TIERS_META)).toHaveLength(6);
    expect(REGULATORY_TIERS_META[1].title).toContain("Tier 1");
    expect(REGULATORY_TIERS_META[6].title).toContain("Tier 6");
  });

  describe("Tier 1: Universally Legal Domestic Companions", () => {
    it.each(["dog", "cat", "rabbit", "guinea_pig", "chinchilla", "pigeon"])(
      "classifies %s as Tier 1 domestic companion",
      (species) => {
        const profile = lookupSpeciesProfile(species);
        expect(profile).not.toBeNull();
        expect(profile?.tier).toBe(1);
        expect(profile?.commercialListingAllowed).toBe(true);
        expect(profile?.breedingPermitted).toBe(true);
      }
    );

    it("verifies Pit Bulls are legal by right under Toledo Municipal Code and Ohio law", () => {
      const dog = lookupSpeciesProfile("pit bull");
      expect(dog?.statutoryCitation).toContain("Pit bulls legal by right");
    });
  });

  describe("Tier 2: Broadly Legal Unregulated Exotics", () => {
    it.each(["ferret", "hedgehog", "sugar_glider", "savannah_cat", "wolfdog", "dwarf_caiman", "ball_python"])(
      "classifies %s as Tier 2 exotic companion with statutory basis",
      (species) => {
        const profile = lookupSpeciesProfile(species);
        expect(profile).not.toBeNull();
        expect(profile?.tier).toBe(2);
        expect(profile?.commercialListingAllowed).toBe(true);
      }
    );

    it("records Ohio statutory exemptions for Savannah cats, Wolfdogs, and Dwarf Caimans", () => {
      const savannah = lookupSpeciesProfile("savannah_cat");
      expect(savannah?.statutoryCitation).toContain("ORC § 935.01(C)(7)(e)");

      const wolfdog = lookupSpeciesProfile("wolfdog");
      expect(wolfdog?.statutoryCitation).toContain("ORC § 935.01(C)(2)");

      const caiman = lookupSpeciesProfile("dwarf_caiman");
      expect(caiman?.statutoryCitation).toContain("ORC § 935.01(C)(17)");
    });
  });

  describe("Tier 3: Domestic Livestock, Equines & Poultry", () => {
    it.each(["horse", "chicken", "goat", "pig", "alpaca", "duck"])(
      "classifies %s as Tier 3 livestock/equine/poultry",
      (species) => {
        const profile = lookupSpeciesProfile(species);
        expect(profile).not.toBeNull();
        expect(profile?.tier).toBe(3);
        expect(profile?.category).toBe("livestock_equine_poultry");
      }
    );

    it("records Toledo Municipal Code 6-hen rule and livestock permits", () => {
      const chicken = lookupSpeciesProfile("chicken");
      expect(chicken?.statutoryCitation).toContain("TMC § 1705.11");

      const pig = lookupSpeciesProfile("pig");
      expect(pig?.statutoryCitation).toContain("TMC § 1705.05");
    });
  });

  describe("Tier 4: Permit-Conditional Native Wildlife", () => {
    it("recognizes captive-bred native foxes under ODNR propagation statutes", () => {
      const fox = lookupSpeciesProfile("native_fox");
      expect(fox?.tier).toBe(4);
      expect(fox?.statutoryCitation).toContain("1533.71");
    });

    it("bars commercial listing of wild-captured native herpetofauna", () => {
      const herp = lookupSpeciesProfile("native_herp");
      expect(herp?.tier).toBe(4);
      expect(herp?.commercialListingAllowed).toBe(false);
      expect(herp?.complianceMechanism).toContain("PIT");
    });
  });

  describe("Tier 5: State-Restricted Species & Restricted Snakes", () => {
    it("recognizes registered small primates under ORC § 935.041", () => {
      const primate = lookupSpeciesProfile("registered_primate");
      expect(primate?.tier).toBe(5);
      expect(primate?.statutoryCitation).toContain("ORC § 935.041");
    });

    it("identifies Restricted Snakes 12ft and longer", () => {
      const snake = lookupSpeciesProfile("restricted_snake");
      expect(snake?.tier).toBe(5);
      expect(snake?.statutoryCitation).toContain("ORC §§ 935.08");
    });
  });

  describe("Tier 6: Federally Prohibited & Injurious Wildlife", () => {
    it("strictly blocks commercial listing of Big Cats under the Big Cat Public Safety Act", () => {
      const bigCat = lookupSpeciesProfile("big_cat");
      expect(bigCat?.tier).toBe(6);
      expect(bigCat?.commercialListingAllowed).toBe(false);
      expect(bigCat?.breedingPermitted).toBe(false);
      expect(bigCat?.statutoryCitation).toContain("16 U.S.C. § 3372");
    });

    it("blocks Lacey Act Injurious species under 18 U.S.C. § 42", () => {
      const injurious = lookupSpeciesProfile("injurious_wildlife");
      expect(injurious?.tier).toBe(6);
      expect(injurious?.commercialListingAllowed).toBe(false);
    });

    it("verifySpeciesListingCompliance returns refusal for prohibited apex felids", () => {
      const result = verifySpeciesListingCompliance("Bengal Tiger Cub");
      expect(result.allowed).toBe(false);
      expect(result.tier).toBe(6);
      expect(result.notice).toContain("Big Cat Public Safety Act");
    });

    it("verifySpeciesListingCompliance approves legal Tier 1 and Tier 2 species", () => {
      const presa = verifySpeciesListingCompliance("dog", "Presa Canario");
      expect(presa.allowed).toBe(true);
      expect(presa.tier).toBe(1);

      const ballPython = verifySpeciesListingCompliance("reptile", "Banana Pied Ball Python");
      expect(ballPython.allowed).toBe(true);
      expect(ballPython.tier).toBe(2);
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  generateListingDraft,
  generateUniversalContract,
  generateVetPrepChecklist,
} from "@/lib/ai/studio";

describe("Scrlpets AI Studio Suite", () => {
  describe("Species-Aware Listing Drafter", () => {
    it("drafts insect colony listings with proper terminology and shipping terms", () => {
      const result = generateListingDraft({
        species: "insect",
        rawNotes: "Camponotus pennsylvanicus queen with 8 nanitic workers.",
        priceCents: 4500,
      });

      expect(result.description).toContain("Keeper Notes:");
      expect(result.shippingTerms).toContain("test tube setup");
      expect(result.shippingTerms).toContain("Live Arrival Guarantee");
      expect(result.recommendedTags).toContain("#antkeeping");
    });

    it("drafts reptile listings with morph and genetics terms", () => {
      const result = generateListingDraft({
        species: "reptile",
        rawNotes: "Tangerine Tremper Albino Leopard Gecko, 45 grams.",
        priceCents: 12000,
      });

      expect(result.description).toContain("captive-bred reptile");
      expect(result.shippingTerms).toContain("certified reptile carriers");
      expect(result.recommendedTags).toContain("#reptiles");
    });

    it("drafts companion mammal listings with health records assurance", () => {
      const result = generateListingDraft({
        species: "dog",
        rawNotes: "Cane Corso puppy, champion lineage, socialized.",
        priceCents: 250000,
      });

      expect(result.description).toContain("health records");
      expect(result.shippingTerms).toContain("USDA-registered pet carriers");
    });
  });

  describe("Universal Purchase Agreement & LAG Contract", () => {
    it("includes Live Arrival Guarantee (LAG) with 2-hour unboxing rule for shipped live animals", () => {
      const contract = generateUniversalContract({
        species: "reptile",
        animalName: "Zeus",
        subtype: "Hypo Zero Bearded Dragon",
        sellerName: "Dragon Haven",
        buyerName: "Jane Smith",
        priceCents: 35000,
        lagHours: 2,
      });

      expect(contract).toContain("LIVE ARRIVAL GUARANTEE (LAG)");
      expect(contract).toContain("unboxing video proof within 2 hours");
      expect(contract).toContain("Scrlpets escrow protection");
    });

    it("includes health warranty and genetic guarantee for domestic companions", () => {
      const contract = generateUniversalContract({
        species: "dog",
        animalName: "Kratos",
        subtype: "Cane Corso",
        sellerName: "Danu's Ark",
        buyerName: "Mark Davis",
        priceCents: 250000,
      });

      expect(contract).toContain("HEALTH WARRANTY & GENETIC GUARANTEE");
      expect(contract).toContain("Document Vault");
    });
  });

  describe("Vet-Visit Prep Assistant", () => {
    it("includes reptile husbandry parameters like UVB and heat gradients", () => {
      const checklist = generateVetPrepChecklist("reptile", "Loss of appetite and lethargy");
      expect(checklist.some((i) => i.includes("UVB"))).toBe(true);
      expect(checklist.some((i) => i.includes("temperature"))).toBe(true);
    });

    it("includes insect formicarium moisture gradient questions", () => {
      const checklist = generateVetPrepChecklist("insect", "Workers clustering and not foraging");
      expect(checklist.some((i) => i.includes("moisture gradient"))).toBe(true);
    });
  });
});

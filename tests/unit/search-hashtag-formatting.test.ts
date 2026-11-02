import { describe, expect, it } from "vitest";
import { hasActiveFilters } from "@/lib/search/queries";

describe("search query helpers", () => {
  it("detects active filters correctly", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ species: "canecorso" })).toBe(true);
    expect(hasActiveFilters({ listingKind: "sale" })).toBe(true);
    expect(hasActiveFilters({ minPriceCents: 1000 })).toBe(true);
    expect(hasActiveFilters({ maxPriceCents: 50000 })).toBe(true);
  });

  it("handles normalized query string token extraction", () => {
    const rawTag = "#frenchbulldog";
    const normalizedTag = rawTag.replace(/^[#@]+/, "").trim();
    expect(normalizedTag).toBe("frenchbulldog");

    const rawMention = "@dailen";
    const normalizedMention = rawMention.replace(/^[#@]+/, "").trim();
    expect(normalizedMention).toBe("dailen");

    const plain = "frenchie";
    const normalizedPlain = plain.replace(/^[#@]+/, "").trim();
    expect(normalizedPlain).toBe("frenchie");
  });
});

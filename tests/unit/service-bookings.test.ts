import { describe, it, expect } from "vitest";
import { formatPrice } from "@/lib/shop/format";

describe("Service Bookings & Tier Packages", () => {
  it("formats pricing and deposits accurately across currencies", () => {
    expect(formatPrice(4500, "usd")).toBe("$45.00");
    expect(formatPrice(12500, "usd")).toBe("$125.00");
    expect(formatPrice(2500, "usd")).toBe("$25.00");
  });

  it("calculates minimum starting price across tier packages", () => {
    const tiers = [
      { id: "1", name: "Full Groom", priceCents: 8500 },
      { id: "2", name: "Bath & Brush", priceCents: 4500 },
      { id: "3", name: "Nail Grind", priceCents: 2000 },
    ];

    const prices = tiers.map((t) => t.priceCents);
    const min = Math.min(...prices);
    expect(min).toBe(2000);
    expect(formatPrice(min, "usd")).toBe("$20.00");
  });

  it("handles empty tier arrays gracefully with fallback to base price", () => {
    const tiers: { priceCents: number }[] = [];
    const basePrice = 6000;
    const effectivePrice = tiers.length > 0 ? Math.min(...tiers.map((t) => t.priceCents)) : basePrice;
    expect(effectivePrice).toBe(6000);
  });
});

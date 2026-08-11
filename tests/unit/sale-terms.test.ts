import { describe, expect, it } from "vitest";
import { parseSaleTerms } from "@/lib/compose/validation";

/**
 * The deposit ceiling and the inspection floor are the two numbers that decide
 * whether the escrow can still do its job, so they are asserted at the exact
 * boundary rather than "roughly".
 */
describe("parseSaleTerms", () => {
  it("defaults to no deposit and the 24h floor when a seller sets nothing", () => {
    const r = parseSaleTerms("", "");
    expect(r.ok && r.terms).toEqual({ depositBps: 0, inspectionHours: 24 });
  });

  it("converts a percentage to basis points", () => {
    const r = parseSaleTerms("20", "72");
    expect(r.ok && r.terms).toEqual({ depositBps: 2000, inspectionHours: 72 });
  });

  it("accepts exactly 25% and refuses a hair over", () => {
    expect(parseSaleTerms("25", "").ok).toBe(true);
    const over = parseSaleTerms("25.01", "");
    expect(over.ok).toBe(false);
    expect(!over.ok && over.error).toBe("deposit_too_large");
  });

  it("refuses a deposit large enough to empty the escrow", () => {
    // 90% up front leaves almost nothing to return, which is the whole point of
    // holding funds in the first place.
    const r = parseSaleTerms("90", "");
    expect(!r.ok && r.error).toBe("deposit_too_large");
  });

  it("accepts exactly 24 hours and refuses 23", () => {
    expect(parseSaleTerms("", "24").ok).toBe(true);
    const short = parseSaleTerms("", "23");
    expect(!short.ok && short.error).toBe("inspection_too_short");
  });

  it("accepts 14 days and refuses beyond it", () => {
    expect(parseSaleTerms("", "336").ok).toBe(true);
    const long = parseSaleTerms("", "337");
    expect(!long.ok && long.error).toBe("inspection_too_long");
  });

  it("refuses a negative deposit rather than treating it as zero", () => {
    const r = parseSaleTerms("-5", "");
    expect(!r.ok && r.error).toBe("deposit_invalid");
  });

  it("refuses text rather than silently defaulting", () => {
    // The dangerous version quietly reads NaN as 0 and publishes a listing whose
    // terms are not what the seller typed.
    expect(!parseSaleTerms("abc", "").ok).toBe(true);
    expect(!parseSaleTerms("", "abc").ok).toBe(true);
  });
});

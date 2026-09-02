import { describe, expect, it } from "vitest";
import { validateUsername, RESERVED_USERNAMES } from "@/lib/profiles/username";

/**
 * Usernames are generated today as `<email-local-part>_<4 hex>` and cannot be
 * changed at all, so a breeder's storefront lives at a URL like
 * /u/janesmith_a3f1 forever. Letting people choose is the fix; letting them
 * choose ANYTHING is a different problem.
 *
 * Legacy's entire validation was `value.replace(/\s/g, "")`, client-side. That
 * admits `admin`, 500-character names, and unicode lookalikes. The intent is
 * kept; the mechanism is not.
 */
describe("validateUsername", () => {
  it("accepts an ordinary handle", () => {
    expect(validateUsername("breeder_jane")).toEqual({ ok: true, value: "breeder_jane" });
  });

  it("lowercases, because two handles differing only in case are the same name to a reader", () => {
    expect(validateUsername("BreederJane")).toEqual({ ok: true, value: "breederjane" });
  });

  it("trims surrounding whitespace rather than rejecting a pasted value", () => {
    expect(validateUsername("  jane  ")).toEqual({ ok: true, value: "jane" });
  });

  it("refuses anything outside a-z, 0-9 and underscore", () => {
    for (const bad of ["jane smith", "jane-smith", "jane.smith", "jané", "jane/../admin", "jane@x"]) {
      expect(validateUsername(bad).ok, `"${bad}" must be refused`).toBe(false);
    }
  });

  it("requires a leading letter, so a handle is never mistaken for an id", () => {
    expect(validateUsername("1jane").ok).toBe(false);
    expect(validateUsername("_jane").ok).toBe(false);
  });

  it("bounds length at both ends", () => {
    expect(validateUsername("ab").ok).toBe(false);
    expect(validateUsername("a".repeat(31)).ok).toBe(false);
    expect(validateUsername("abc").ok).toBe(true);
    expect(validateUsername("a".repeat(30)).ok).toBe(true);
  });

  it("refuses names that would let someone pose as the platform", () => {
    for (const bad of ["admin", "support", "scrlpets", "staff", "official", "moderator"]) {
      expect(validateUsername(bad).ok, `"${bad}" must be refused`).toBe(false);
    }
    // Case-folding must happen BEFORE the reserved check, or "Admin" walks through.
    expect(validateUsername("ADMIN").ok).toBe(false);
  });

  it("names every reserved word in lowercase, so the check cannot be case-fooled", () => {
    for (const word of RESERVED_USERNAMES) expect(word).toBe(word.toLowerCase());
  });

  it("gives a reason, not just a refusal", () => {
    const r = validateUsername("admin");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBeTruthy();
  });
});

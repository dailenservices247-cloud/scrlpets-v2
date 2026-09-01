import { describe, expect, it } from "vitest";
import { brandRedirectTarget } from "@/lib/brands/actions";

/**
 * Extracted as a pure function because the redirect is the ONLY thing that
 * differs between the composer path and the onboarding path, and a redirect
 * inside a server action cannot be asserted directly.
 */
describe("brandRedirectTarget", () => {
  it("defaults to the composer with the new brand preselected", () => {
    expect(brandRedirectTarget("abc", null)).toBe("/compose?brand=abc");
  });

  it("honours an app-relative next path", () => {
    expect(brandRedirectTarget("abc", "/onboarding/breeder?done=1")).toBe(
      "/onboarding/breeder?done=1",
    );
  });

  it("refuses an absolute URL — next is attacker-supplied", () => {
    expect(brandRedirectTarget("abc", "https://evil.test/x")).toBe("/compose?brand=abc");
    expect(brandRedirectTarget("abc", "//evil.test/x")).toBe("/compose?brand=abc");
  });
});

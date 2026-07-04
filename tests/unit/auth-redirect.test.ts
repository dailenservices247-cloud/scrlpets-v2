import { describe, expect, it } from "vitest";
import { loginHrefFor, safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it("keeps same-origin paths and query strings", () => {
    expect(safeNextPath("/listing/abc?from=feed")).toBe(
      "/listing/abc?from=feed",
    );
  });

  it("rejects absolute, protocol-relative, and malformed destinations", () => {
    expect(safeNextPath("https://example.com")).toBe("/");
    expect(safeNextPath("//example.com/path")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});

describe("loginHrefFor", () => {
  it("encodes a safe return destination", () => {
    expect(loginHrefFor("/listing/abc?from=feed")).toBe(
      "/login?next=%2Flisting%2Fabc%3Ffrom%3Dfeed",
    );
  });

  it("falls back to the home feed for unsafe destinations", () => {
    expect(loginHrefFor("https://example.com")).toBe("/login?next=%2F");
  });
});

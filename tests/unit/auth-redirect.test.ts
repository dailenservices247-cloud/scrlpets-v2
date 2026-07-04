import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

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

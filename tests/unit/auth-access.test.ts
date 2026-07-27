import { describe, expect, it } from "vitest";
import {
  PUBLIC_DISCOVERY_PREFIXES,
  isProtectedPath,
} from "@/lib/auth/access";

describe("guest access contract", () => {
  it.each([
    "/compose",
    "/compose/new",
    "/messages",
    "/messages/abc",
    "/settings/profile",
    "/settings/account",
    "/notifications",
    "/saved",
    "/brands/new",
    "/brand-os",
    "/applications",
  ])("protects participation route %s", (pathname) => {
    expect(isProtectedPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/shop",
    "/shop/product/abc",
    "/listing/abc",
    "/u/breeder_jane",
    "/c/max-c1",
    "/b/example",
    "/post/abc",
    "/watch/abc",
    "/privacy",
    "/terms",
    "/search",
    "/guides",
    "/guides/puppy-first-week",
  ])("keeps discovery route %s public", (pathname) => {
    expect(isProtectedPath(pathname)).toBe(false);
  });

  it("documents the public discovery families", () => {
    expect(PUBLIC_DISCOVERY_PREFIXES).toContain("/listing/");
    expect(PUBLIC_DISCOVERY_PREFIXES).toContain("/shop");
    expect(PUBLIC_DISCOVERY_PREFIXES).toContain("/u/");
  });
});

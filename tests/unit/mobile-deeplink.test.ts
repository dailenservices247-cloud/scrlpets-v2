import { describe, it, expect } from "vitest";
import { parseDeepLinkPath } from "@/lib/mobile/capacitor-bridge";

describe("Mobile Deep Link & Push Handling", () => {
  it("parses relative path strings directly", () => {
    expect(parseDeepLinkPath("/messages/conv-123")).toBe("/messages/conv-123");
    expect(parseDeepLinkPath("/watch/reel/reel-456?autoplay=1")).toBe("/watch/reel/reel-456?autoplay=1");
  });

  it("parses custom scrlpets:// scheme deep links", () => {
    expect(parseDeepLinkPath("scrlpets://messages/conv-789")).toBe("/messages/conv-789");
    expect(parseDeepLinkPath("scrlpets://orders/order-999")).toBe("/orders/order-999");
  });

  it("parses full universal URLs matching platform hostname", () => {
    expect(parseDeepLinkPath("https://scrlpets.com/c/zeus-the-corso")).toBe("/c/zeus-the-corso");
    expect(parseDeepLinkPath("http://localhost:3000/tools")).toBe("/tools");
  });

  it("rejects malicious or foreign domain URLs", () => {
    expect(parseDeepLinkPath("https://phishing-site.com/steal-creds")).toBeNull();
    expect(parseDeepLinkPath("")).toBeNull();
    expect(parseDeepLinkPath(null)).toBeNull();
  });
});

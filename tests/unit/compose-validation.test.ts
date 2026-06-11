import { describe, it, expect } from "vitest";
import { validatePost, validateListing, parsePriceCents } from "@/lib/compose/validation";

describe("validatePost", () => {
  it("accepts body-only post", () => {
    expect(validatePost({ body: "hi", mediaUrl: null })).toEqual({ ok: true });
  });
  it("accepts photo-only post", () => {
    expect(validatePost({ body: "", mediaUrl: "https://x/y.jpg" })).toEqual({ ok: true });
  });
  it("rejects empty post", () => {
    expect(validatePost({ body: "  ", mediaUrl: null }).ok).toBe(false);
  });
  it("rejects body over 2000 chars", () => {
    expect(validatePost({ body: "a".repeat(2001), mediaUrl: null }).ok).toBe(false);
  });
});

describe("parsePriceCents", () => {
  it("parses dollars to cents", () => expect(parsePriceCents("1500")).toBe(150000));
  it("parses decimals", () => expect(parsePriceCents("12.50")).toBe(1250));
  it("rejects junk", () => expect(parsePriceCents("abc")).toBeNull());
  it("rejects negatives and zero", () => {
    expect(parsePriceCents("-5")).toBeNull();
    expect(parsePriceCents("0")).toBeNull();
  });
});

describe("validateListing", () => {
  it("requires title and positive price", () => {
    expect(validateListing({ title: "Pup", priceCents: 100 }).ok).toBe(true);
    expect(validateListing({ title: " ", priceCents: 100 }).ok).toBe(false);
    expect(validateListing({ title: "Pup", priceCents: 0 }).ok).toBe(false);
  });
});

import { describe, it, expect } from "vitest";

describe("Reel Sound & Audio Attribution", () => {
  it("formats default original audio attribution string from creator name", () => {
    const creatorName = "Danu's Ark";
    const audioTitle = null;
    const formatted = audioTitle || `Original Audio — ${creatorName}`;
    expect(formatted).toBe("Original Audio — Danu's Ark");
  });

  it("preserves custom sound title when provided", () => {
    const creatorName = "Danu's Ark";
    const customSound = "Working Dog Protection Drills #4";
    const formatted = customSound || `Original Audio — ${creatorName}`;
    expect(formatted).toBe("Working Dog Protection Drills #4");
  });

  it("constructs valid sound discovery search URL", () => {
    const soundTitle = "Original Audio — Danu's Ark";
    const url = `/search?q=${encodeURIComponent(soundTitle)}`;
    expect(url).toBe("/search?q=Original%20Audio%20%E2%80%94%20Danu's%20Ark");
  });
});

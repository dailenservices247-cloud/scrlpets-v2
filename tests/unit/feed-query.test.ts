import { describe, it, expect } from "vitest";
import { getFeedDestination } from "@/lib/feed/destinations";
import { rowToFeedItem } from "@/lib/feed/query";
import type { FeedItem, FeedItemType } from "@/lib/feed/types";

describe("rowToFeedItem", () => {
  it("maps a reel row to a creature-aware FeedItem", () => {
    const item = rowToFeedItem({
      id: "1", kind: "post", subtype: "reel", author_id: "a",
      username: "jane", display_name: "Jane", avatar_url: null,
      creature_id: "c1", creature_name: "Max", creature_slug: "max-c1", creature_avatar: null,
      title: "hi", media_url: null, created_at: "2026-01-01T00:00:00Z",
    });
    expect(item.type).toBe("reel");
    expect(item.creature?.name).toBe("Max");
    expect(item.author.username).toBe("jane");
  });
  it("maps a promo row (no creature) correctly", () => {
    const item = rowToFeedItem({
      id: "2", kind: "promo", subtype: null, author_id: "a",
      username: "jane", display_name: "Jane", avatar_url: null,
      creature_id: null, creature_name: null, creature_slug: null, creature_avatar: null,
      title: "deal", media_url: null, created_at: "2026-01-01T00:00:00Z",
    });
    expect(item.type).toBe("promo");
    expect(item.creature).toBeNull();
  });
});

import { hashId, isE2EDemoItem } from "@/lib/feed/query";

describe("getFeedDestination", () => {
  it.each([
    ["post", "/post/abc", "openPost"],
    ["reel", "/watch/reel/abc", "watchReel"],
    ["long_video", "/watch/abc", "watchVideo"],
    ["listing", "/listing/abc", "viewListing"],
    ["promo", "/shop/product/abc", "viewProduct"],
  ] as const)("routes %s items to the correct destination", (type, href, labelKey) => {
    const item: FeedItem = {
      id: "abc",
      type: type as FeedItemType,
      author: { id: "u1", username: "jane", displayName: null, avatarUrl: null },
      creature: null,
      title: "Title",
      mediaUrl: null,
      createdAt: "2026-01-01T00:00:00Z",
    };

    expect(getFeedDestination(item)).toMatchObject({ href, labelKey, kind: type });
  });
});

describe("hashId (For-You placeholder ordering)", () => {
  it("is deterministic", () => {
    expect(hashId("abc-123")).toBe(hashId("abc-123"));
  });
  it("orders differently than insertion for realistic uuids", () => {
    const ids = [
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "9c858901-8a57-4791-81fe-4c455b099bc9",
      "16fd2706-8baf-433b-82eb-8c7fada847da",
      "6ecd8c99-4036-403d-bf84-cf8400f67836",
      "3d813cbb-47fb-32ba-91df-831e1593ac29",
    ];
    const sorted = [...ids].sort((a, b) => hashId(a) - hashId(b));
    expect(sorted).not.toEqual(ids);
  });
});

describe("isE2EDemoItem", () => {
  it("detects generated e2e rows by visible title", () => {
    const item: FeedItem = {
      id: "abc",
      type: "post",
      author: { id: "u1", username: "jane", displayName: null, avatarUrl: null },
      creature: null,
      title: "E2E post 123",
      mediaUrl: null,
      createdAt: "2026-01-01T00:00:00Z",
    };
    expect(isE2EDemoItem(item)).toBe(true);
  });
});

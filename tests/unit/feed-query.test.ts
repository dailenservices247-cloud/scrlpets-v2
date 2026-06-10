import { describe, it, expect } from "vitest";
import { rowToFeedItem } from "@/lib/feed/query";

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

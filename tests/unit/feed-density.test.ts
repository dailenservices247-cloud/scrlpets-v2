import { describe, expect, it } from "vitest";
import { applyDensityCaps, DENSITY_WINDOW } from "@/lib/feed/query";
import type { FeedItem, FeedItemType } from "@/lib/feed/types";

function item(type: FeedItemType, id: string): FeedItem {
  return {
    id,
    type,
    author: { id: "a", username: "u", displayName: null, avatarUrl: null },
    brand: null,
    creature: null,
    title: null,
    mediaUrl: null,
    createdAt: "2026-07-29T00:00:00Z",
    updatedAt: "2026-07-29T00:00:00Z",
  } as FeedItem;
}

describe("feed commercial density caps", () => {
  it("keeps at most one listing per window", () => {
    const listings = Array.from({ length: 40 }, (_, i) => item("listing", `l${i}`));
    const kept = applyDensityCaps(listings);
    // Nothing separates them, so only the first survives — the rest are
    // dropped rather than reordered.
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe("l0");
  });

  it("THE REGRESSION: a burst of listings can never starve other content", () => {
    // 209 accumulated listings once filled all 200 feed slots on production and
    // pushed every post, reel and video off the surface.
    const flood = [
      ...Array.from({ length: 209 }, (_, i) => item("listing", `l${i}`)),
      item("reel", "r1"),
      item("long_video", "v1"),
      item("post", "p1"),
    ];
    const kept = applyDensityCaps(flood);
    const types = kept.map((k) => k.type);
    expect(types).toContain("reel");
    expect(types).toContain("long_video");
    expect(types).toContain("post");
    expect(types.filter((t) => t === "listing")).toHaveLength(1);
  });

  it("admits another listing once the window has passed", () => {
    const mixed = [
      item("listing", "l0"),
      ...Array.from({ length: DENSITY_WINDOW }, (_, i) => item("post", `p${i}`)),
      item("listing", "l1"),
    ];
    const kept = applyDensityCaps(mixed);
    expect(kept.filter((k) => k.type === "listing").map((k) => k.id)).toEqual([
      "l0",
      "l1",
    ]);
  });

  it("caps promos independently of listings", () => {
    const mixed = [
      item("listing", "l0"),
      item("promo", "m0"),
      item("promo", "m1"),
      item("listing", "l1"),
    ];
    const kept = applyDensityCaps(mixed);
    expect(kept.map((k) => k.id)).toEqual(["l0", "m0"]);
  });

  it("never drops non-commercial content", () => {
    const organic = [
      item("post", "p0"),
      item("reel", "r0"),
      item("long_video", "v0"),
      item("post", "p1"),
    ];
    expect(applyDensityCaps(organic)).toHaveLength(4);
  });
});

import type { FeedItem, FeedItemType } from "./types";

export type FeedDestination = {
  href: string;
  labelKey: "openPost" | "watchReel" | "watchVideo" | "viewListing" | "viewProduct";
  kind: FeedItemType;
};

export function getFeedDestination(item: FeedItem): FeedDestination {
  switch (item.type) {
    case "post":
      return { href: `/post/${item.id}`, labelKey: "openPost", kind: "post" };
    case "reel":
      return { href: `/watch/reel/${item.id}`, labelKey: "watchReel", kind: "reel" };
    case "long_video":
      return { href: `/watch/${item.id}`, labelKey: "watchVideo", kind: "long_video" };
    case "listing":
      return { href: `/listing/${item.id}`, labelKey: "viewListing", kind: "listing" };
    case "promo":
      return { href: `/shop/product/${item.id}`, labelKey: "viewProduct", kind: "promo" };
  }
}

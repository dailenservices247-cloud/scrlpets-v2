export type FeedItemType = "post" | "reel" | "long_video" | "listing" | "promo";

export type FeedItem = {
  id: string;
  type: FeedItemType;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  /** Set when the content was published as a brand; the author is the human operator behind it. */
  brand: { id: string; name: string; slug: string; avatarUrl: string | null } | null;
  creature: { id: string; name: string; slug: string; avatarUrl: string | null } | null;
  title: string | null;
  mediaUrl: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Post-family only, and OPTIONAL because `unified_feed` doesn't carry them —
   * `attachPostFlags` fills them in per rendered list. `undefined` means "not
   * loaded on this surface", which is why the comment composer treats only an
   * explicit `false` as "comments are off".
   */
  pinnedAt?: string | null;
  commentsEnabled?: boolean;
};

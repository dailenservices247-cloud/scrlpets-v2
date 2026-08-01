export type FeedItemType = "post" | "reel" | "long_video" | "listing" | "promo";

export type FeedItem = {
  id: string;
  type: FeedItemType;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  /** Set when the content was published as a brand; the author is the human operator behind it. */
  brand: { id: string; name: string; slug: string; avatarUrl: string | null } | null;
  creature: { id: string; name: string; slug: string; avatarUrl: string | null } | null;
  /**
   * Set when the post was made into a breed group. Groups are PUBLIC, so the
   * post is in everyone's feed — this is what lets the tile say so instead of
   * presenting it as an ordinary post. Optional for the same reason as
   * `pinnedAt`: surfaces that build items by hand (the group's own timeline,
   * where the chip would be redundant) simply leave it off.
   */
  group?: { id: string; slug: string; name: string } | null;
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

export type FeedItemType = "post" | "reel" | "long_video" | "listing" | "promo";

export type FeedItem = {
  id: string;
  type: FeedItemType;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  creature: { id: string; name: string; slug: string; avatarUrl: string | null } | null;
  title: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

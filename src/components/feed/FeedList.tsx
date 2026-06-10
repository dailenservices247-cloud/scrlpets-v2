import type { FeedItem } from "@/lib/feed/types";
import { PostTile } from "./tiles/PostTile";
import { ReelTile } from "./tiles/ReelTile";
import { LongVideoTile } from "./tiles/LongVideoTile";
import { ListingTile } from "./tiles/ListingTile";
import { PromoTile } from "./tiles/PromoTile";

const MAP = {
  post: PostTile,
  reel: ReelTile,
  long_video: LongVideoTile,
  listing: ListingTile,
  promo: PromoTile,
} as const;

export function FeedList({ items }: { items: FeedItem[] }) {
  if (items.length === 0)
    return (
      <p className="p-6 text-muted-foreground" data-testid="feed-empty">
        Nothing here yet.
      </p>
    );
  return (
    <div className="flex flex-col gap-3 p-3" data-testid="feed-list">
      {items.map((item) => {
        const Tile = MAP[item.type];
        return <Tile key={item.id} item={item} />;
      })}
    </div>
  );
}

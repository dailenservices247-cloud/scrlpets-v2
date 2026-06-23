import { useTranslations } from "next-intl";
import type { FeedItem } from "@/lib/feed/types";
import { PostTile } from "./tiles/PostTile";
import { ReelTile } from "./tiles/ReelTile";
import { LongVideoTile } from "./tiles/LongVideoTile";
import { ListingTile } from "./tiles/ListingTile";
import { PromoTile } from "./tiles/PromoTile";
import { FeedTabs } from "./FeedTabs";

const MAP = {
  post: PostTile,
  reel: ReelTile,
  long_video: LongVideoTile,
  listing: ListingTile,
  promo: PromoTile,
} as const;

export function FeedList({ items }: { items: FeedItem[] }) {
  const t = useTranslations("feed");
  if (items.length === 0)
    return (
      <section className="px-3 py-4" data-testid="feed-stream">
        <div className="mb-3 px-1">
          <FeedTabs />
        </div>
        <div
          className="mt-20 rounded-2xl border border-border/70 bg-card/70 p-8 text-center shadow-[0_16px_40px_rgba(0,0,0,.22)]"
          data-testid="feed-empty"
        >
          <p className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary/15 text-2xl text-brand-link">
            +
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{t("empty")}</h2>
        </div>
      </section>
    );
  return (
    <section className="px-3 py-4" data-testid="feed-stream">
      <div className="mb-3 px-1">
        <FeedTabs />
      </div>
      <div className="flex flex-col gap-4" data-testid="feed-list">
        {items.map((item) => {
          const Tile = MAP[item.type];
          return <Tile key={item.id} item={item} />;
        })}
      </div>
    </section>
  );
}

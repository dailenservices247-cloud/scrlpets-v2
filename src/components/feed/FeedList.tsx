import { getTranslations } from "next-intl/server";
import type { FeedItem } from "@/lib/feed/types";
import { getManageableBrandIds } from "@/lib/brands/queries";
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

export async function FeedList({
  items,
  showTabs = true,
  viewerId,
}: {
  items: FeedItem[];
  showTabs?: boolean;
  viewerId?: string | null;
}) {
  const t = await getTranslations("feed");
  const manageableBrandIds = new Set(
    viewerId ? await getManageableBrandIds(viewerId) : [],
  );
  if (items.length === 0)
    return (
      <section className="px-3 py-4" data-testid="feed-stream">
        {showTabs && (
          <div className="mb-3 px-1">
            <FeedTabs />
          </div>
        )}
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
      {showTabs && (
        <div className="mb-3 px-1">
          <FeedTabs />
        </div>
      )}
      <div className="flex flex-col gap-4" data-testid="feed-list">
        {items.map((item) => {
          const Tile = MAP[item.type];
          const canManage =
            viewerId === item.author.id ||
            Boolean(item.brand && manageableBrandIds.has(item.brand.id));
          return <Tile key={item.id} item={item} canManage={canManage} />;
        })}
      </div>
    </section>
  );
}

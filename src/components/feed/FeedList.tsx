import { getTranslations } from "next-intl/server";
import type { FeedItem } from "@/lib/feed/types";
import { getManageableBrandIds } from "@/lib/brands/queries";
import { getFeedSocialContext } from "@/lib/social/reactions";
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
  followingEmpty = false,
}: {
  items: FeedItem[];
  showTabs?: boolean;
  viewerId?: string | null;
  followingEmpty?: boolean;
}) {
  const t = await getTranslations("feed");
  const [manageableBrandIds, socialContext] = await Promise.all([
    (viewerId ? getManageableBrandIds(viewerId) : Promise.resolve([])).then(
      (ids) => new Set(ids),
    ),
    getFeedSocialContext(
      items
        .filter((item) => item.type === "post" || item.type === "reel")
        .map((item) => item.id),
      viewerId,
    ),
  ]);
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
          data-testid={followingEmpty ? "feed-following-empty" : "feed-empty"}
        >
          <p className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary/15 text-2xl text-brand-link">
            +
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            {followingEmpty ? t("followingEmptyTitle") : t("empty")}
          </h2>
          {followingEmpty && (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("followingEmptyBody")}
            </p>
          )}
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
          // matrix rows 6-7: author OR admin/owner of the attributed brand.
          const canManage =
            viewerId === item.author.id ||
            Boolean(item.brand && manageableBrandIds.has(item.brand.id));
          if (item.type === "post") {
            return (
              <PostTile
                key={item.id}
                item={item}
                canManage={canManage}
                social={socialContext.get(item.id) ?? null}
                signedIn={Boolean(viewerId)}
              />
            );
          }
          if (item.type === "reel") {
            return (
              <ReelTile
                key={item.id}
                item={item}
                canManage={canManage}
                social={socialContext.get(item.id) ?? null}
                signedIn={Boolean(viewerId)}
              />
            );
          }
          return <Tile key={item.id} item={item} canManage={canManage} />;
        })}
      </div>
    </section>
  );
}

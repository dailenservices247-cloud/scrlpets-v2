import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { FeedItem, FeedItemType } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";
import { AttributionStack } from "./AttributionStack";
import { ContentTypeBadge } from "./ContentTypeBadge";
import { FeedTileAction } from "./FeedTileAction";
import { TileMedia } from "./TileMedia";

type DetailCopy = {
  titleKey: "postDetail" | "reelDetail" | "videoDetail" | "listingDetail" | "productDetail";
  bodyKey: "postDetailBody" | "reelDetailBody" | "videoDetailBody" | "listingDetailBody" | "productDetailBody";
};

const copyByType: Record<FeedItemType, DetailCopy> = {
  post: { titleKey: "postDetail", bodyKey: "postDetailBody" },
  reel: { titleKey: "reelDetail", bodyKey: "reelDetailBody" },
  long_video: { titleKey: "videoDetail", bodyKey: "videoDetailBody" },
  listing: { titleKey: "listingDetail", bodyKey: "listingDetailBody" },
  promo: { titleKey: "productDetail", bodyKey: "productDetailBody" },
};

export async function FeedDestinationShell({ item }: { item: FeedItem }) {
  const t = await getTranslations("detail");
  const copy = copyByType[item.type];
  const isListing = item.type === "listing";
  const isProduct = item.type === "promo";

  return (
    <main className="min-h-dvh pb-10" data-testid={`destination-${item.type}`}>
      <div className="sticky top-0 z-10 border-b bg-background/85 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-sm text-brand-link underline">
          {t("backToFeed")}
        </Link>
      </div>

      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
        <div>
          <p className="eyebrow">{t("surfaceLabel")}</p>
          <h1 className="text-2xl font-bold" data-testid="destination-heading">
            {t(copy.titleKey)}
          </h1>
          <p className="mt-2 text-muted-foreground">{t(copy.bodyKey)}</p>
        </div>

        <Card
          className={
            isListing ? "border-primary/60 p-4" : isProduct ? "border-accent/45 p-4" : "p-4"
          }
        >
          <header className="flex items-start justify-between gap-3">
            <AttributionStack item={item} />
            <ContentTypeBadge type={item.type} />
          </header>

          {(isListing || isProduct) && (
            <div
              className={`mt-4 rounded-lg border p-3 ${
                isListing ? "border-primary/30 bg-primary/10" : "border-accent/30 bg-accent/10"
              }`}
              data-testid={isListing ? "listing-detail-summary" : "product-detail-summary"}
            >
              <p className="eyebrow">
                {isListing ? t("listingSummaryLabel") : t("productSummaryLabel")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isListing ? t("listingSummaryBody") : t("productSummaryBody")}
              </p>
            </div>
          )}

          <h2 className="mt-4 text-lg font-semibold">{item.title ?? t("untitled")}</h2>
          <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{t("nextAction")}</p>
            <FeedTileAction item={item} />
          </div>
        </Card>
      </section>
    </main>
  );
}

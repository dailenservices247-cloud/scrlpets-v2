import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { FeedItem, FeedItemType } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";
import { AttributionStack } from "./AttributionStack";
import { ContentTypeBadge } from "./ContentTypeBadge";
import { FeedTileAction } from "./FeedTileAction";
import { TileMedia } from "./TileMedia";
import { ContentOwnerActions } from "@/components/content/ContentOwnerActions";
import { getManageableBrandIds } from "@/lib/brands/queries";

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

export async function FeedDestinationShell({
  item,
  viewerId,
  children,
}: {
  item: FeedItem;
  viewerId?: string | null;
  children?: ReactNode;
}) {
  const t = await getTranslations("detail");
  const tc = await getTranslations("content");
  const copy = copyByType[item.type];
  const isListing = item.type === "listing";
  const isProduct = item.type === "promo";
  const edited =
    new Date(item.updatedAt).getTime() > new Date(item.createdAt).getTime();
  const manageableBrandIds = new Set(
    viewerId ? await getManageableBrandIds(viewerId) : [],
  );
  const canManage =
    viewerId === item.author.id ||
    Boolean(item.brand && manageableBrandIds.has(item.brand.id));

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
            <div className="flex flex-col items-end gap-2">
              <ContentTypeBadge type={item.type} />
              {edited && (
                <span
                  className="rounded-full border border-border/70 bg-muted/45 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  data-testid="edited-chip"
                >
                  {tc("edited")}
                </span>
              )}
            </div>
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
          {canManage && (
            <div className="mt-4 border-t border-border/70 pt-4">
              <ContentOwnerActions item={item} />
            </div>
          )}
        </Card>
        {children}
      </section>
    </main>
  );
}

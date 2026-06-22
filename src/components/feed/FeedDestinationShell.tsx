import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { FeedItem, FeedItemType } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";
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

        <Card className="p-4">
          <header className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/u/${item.author.username}`} className="text-brand-link underline">
              @{item.author.username}
            </Link>
            {item.creature && (
              <>
                <span aria-hidden>·</span>
                <Link href={`/c/${item.creature.slug}`} className="text-brand-link underline">
                  {item.creature.name}
                </Link>
              </>
            )}
          </header>
          <h2 className="mt-2 text-lg font-semibold">{item.title ?? t("untitled")}</h2>
          <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
        </Card>
      </section>
    </main>
  );
}

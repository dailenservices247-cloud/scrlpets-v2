import Link from "next/link";
import type { FeedItem } from "@/lib/feed/types";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { FeedTileAction } from "../FeedTileAction";
import { TileMedia } from "../TileMedia";

export function ListingTile({ item }: { item: FeedItem }) {
  const t = useTranslations("feed");
  return (
    <Card className="p-4 border-primary/60" data-testid="tile-listing">
      <header className="flex items-center justify-between text-xs text-muted-foreground">
        {item.creature ? (
          <Link href={`/c/${item.creature.slug}`} className="hover:underline" data-testid="creature-name">🐾 {item.creature.name}</Link>
        ) : (
          <Link href={`/u/${item.author.username}`} className="hover:underline">{item.author.username}</Link>
        )}
        <span className="rounded-md bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          {t("forSale")}
        </span>
      </header>
      <p className="mt-1 font-medium">{item.title}</p>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
      <FeedTileAction item={item} />
    </Card>
  );
}

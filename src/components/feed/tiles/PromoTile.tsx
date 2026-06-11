import Link from "next/link";
import type { FeedItem } from "@/lib/feed/types";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { TileMedia } from "../TileMedia";

export function PromoTile({ item }: { item: FeedItem }) {
  const t = useTranslations("feed");
  return (
    <Card className="p-4" data-testid="tile-promo">
      <header className="flex items-center justify-between text-xs text-muted-foreground">
        <Link href={`/u/${item.author.username}`} className="hover:underline">{item.author.username}</Link>
        <span className="rounded-md border border-accent px-2 py-0.5 text-xs text-accent">
          {t("promo")}
        </span>
      </header>
      <p className="mt-1">{item.title}</p>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
    </Card>
  );
}

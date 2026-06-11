import type { FeedItem } from "@/lib/feed/types";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { TileMedia } from "../TileMedia";

export function ReelTile({ item }: { item: FeedItem }) {
  const t = useTranslations("feed");
  return (
    <Card className="p-4" data-testid="tile-reel">
      <header className="flex items-center justify-between text-xs text-muted-foreground">
        {item.creature ? (
          <span data-testid="creature-name">🐾 {item.creature.name}</span>
        ) : (
          <span>{item.author.username}</span>
        )}
        <span className="eyebrow">{t("reel")}</span>
      </header>
      <p className="mt-1">{item.title}</p>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
    </Card>
  );
}

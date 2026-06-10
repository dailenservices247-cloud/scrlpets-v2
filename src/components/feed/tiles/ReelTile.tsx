import type { FeedItem } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";

export function ReelTile({ item }: { item: FeedItem }) {
  return (
    <Card className="p-4" data-testid="tile-reel">
      <header className="flex items-center justify-between text-xs text-muted-foreground">
        {item.creature ? (
          <span data-testid="creature-name">🐾 {item.creature.name}</span>
        ) : (
          <span>{item.author.username}</span>
        )}
        <span className="eyebrow">Reel</span>
      </header>
      <p className="mt-1">{item.title}</p>
    </Card>
  );
}

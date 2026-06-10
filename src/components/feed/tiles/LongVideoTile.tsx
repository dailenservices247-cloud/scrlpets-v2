import type { FeedItem } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";

export function LongVideoTile({ item }: { item: FeedItem }) {
  return (
    <Card className="p-4" data-testid="tile-long_video">
      <header className="flex items-center justify-between text-xs text-muted-foreground">
        {item.creature ? (
          <span data-testid="creature-name">🐾 {item.creature.name}</span>
        ) : (
          <span>{item.author.username}</span>
        )}
        <span className="eyebrow">Video</span>
      </header>
      <p className="mt-1">{item.title}</p>
    </Card>
  );
}

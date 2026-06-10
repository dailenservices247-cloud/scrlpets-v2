import type { FeedItem } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";

export function PostTile({ item }: { item: FeedItem }) {
  return (
    <Card className="p-4" data-testid="tile-post">
      <header className="text-xs text-muted-foreground">
        {item.creature ? (
          <span data-testid="creature-name">🐾 {item.creature.name}</span>
        ) : (
          item.author.username
        )}
      </header>
      <p className="mt-1">{item.title}</p>
    </Card>
  );
}

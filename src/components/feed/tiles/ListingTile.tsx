import type { FeedItem } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";

export function ListingTile({ item }: { item: FeedItem }) {
  return (
    <Card className="p-4 border-primary/60" data-testid="tile-listing">
      <header className="flex items-center justify-between text-xs text-muted-foreground">
        {item.creature ? (
          <span data-testid="creature-name">🐾 {item.creature.name}</span>
        ) : (
          <span>{item.author.username}</span>
        )}
        <span className="rounded-md bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          For sale
        </span>
      </header>
      <p className="mt-1 font-medium">{item.title}</p>
    </Card>
  );
}

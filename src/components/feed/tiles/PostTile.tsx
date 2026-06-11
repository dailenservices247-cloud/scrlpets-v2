import Link from "next/link";
import type { FeedItem } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";
import { TileMedia } from "../TileMedia";

export function PostTile({ item }: { item: FeedItem }) {
  return (
    <Card className="p-4" data-testid="tile-post">
      <header className="text-xs text-muted-foreground">
        {item.creature ? (
          <Link href={`/c/${item.creature.slug}`} className="hover:underline" data-testid="creature-name">🐾 {item.creature.name}</Link>
        ) : (
          <Link href={`/u/${item.author.username}`} className="hover:underline">{item.author.username}</Link>
        )}
      </header>
      <p className="mt-1">{item.title}</p>
      <TileMedia src={item.mediaUrl} alt={item.title ?? ""} />
    </Card>
  );
}

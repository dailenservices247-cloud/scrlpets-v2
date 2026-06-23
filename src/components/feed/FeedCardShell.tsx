import type { ReactNode } from "react";
import type { FeedItem } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AttributionStack } from "./AttributionStack";
import { ContentTypeBadge } from "./ContentTypeBadge";

const shellStyles: Record<FeedItem["type"], string> = {
  post: "",
  reel: "border-[color:var(--brand-wine-bright)]",
  long_video: "border-secondary/45",
  listing: "border-primary/60",
  promo: "border-accent/45",
};

export function FeedCardShell({
  item,
  children,
  className,
}: {
  item: FeedItem;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn("gap-3 p-4", shellStyles[item.type], className)}
      data-testid={`tile-${item.type}`}
    >
      <header className="flex items-start justify-between gap-3">
        <AttributionStack item={item} className="flex-1" />
        <ContentTypeBadge type={item.type} />
      </header>
      {children}
    </Card>
  );
}

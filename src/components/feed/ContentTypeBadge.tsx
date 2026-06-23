import { useTranslations } from "next-intl";
import type { FeedItemType } from "@/lib/feed/types";
import { cn } from "@/lib/utils";

const badgeStyles: Record<FeedItemType, string> = {
  post: "border-border bg-muted/40 text-muted-foreground",
  reel: "border-[color:var(--brand-wine-bright)] bg-primary/15 text-brand-link",
  long_video: "border-[color:var(--brand-spine-bright)] bg-secondary/20 text-secondary-foreground",
  listing: "border-primary/70 bg-primary text-primary-foreground",
  promo: "border-accent/70 bg-accent/15 text-[color:var(--brand-gold-bright)]",
};

const labelKeys: Record<FeedItemType, "post" | "reel" | "video" | "forSale" | "promo"> = {
  post: "post",
  reel: "reel",
  long_video: "video",
  listing: "forSale",
  promo: "promo",
};

export function ContentTypeBadge({
  type,
  className,
}: {
  type: FeedItemType;
  className?: string;
}) {
  const t = useTranslations("feed");

  return (
    <span
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        badgeStyles[type],
        className,
      )}
      data-testid={`content-type-${type}`}
    >
      {t(labelKeys[type])}
    </span>
  );
}

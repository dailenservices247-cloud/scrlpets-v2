import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { FeedItem } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";
import { ContentOwnerActions } from "@/components/content/ContentOwnerActions";
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
  canManage = false,
}: {
  item: FeedItem;
  children: ReactNode;
  className?: string;
  canManage?: boolean;
}) {
  const t = useTranslations("content");
  const edited =
    new Date(item.updatedAt).getTime() > new Date(item.createdAt).getTime();

  return (
    <Card
      className={cn("premium-panel gap-3 rounded-2xl p-4", shellStyles[item.type], className)}
      data-testid={`tile-${item.type}`}
    >
      <header className="flex items-start justify-between gap-3">
        <AttributionStack item={item} className="flex-1" />
        <div className="flex items-center gap-1.5">
          {edited && (
            <span
              className="rounded-full border border-border/70 bg-muted/45 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              data-testid="edited-chip"
            >
              {t("edited")}
            </span>
          )}
          {/* Plain posts read FB-style — no type badge (punch list A2). */}
          {item.type !== "post" && <ContentTypeBadge type={item.type} />}
          {canManage && <ContentOwnerActions item={item} />}
        </div>
      </header>
      {children}
    </Card>
  );
}

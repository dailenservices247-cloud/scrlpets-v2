import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { FeedItem } from "@/lib/feed/types";
import { Card } from "@/components/ui/card";
import { ContentOwnerActions } from "@/components/content/ContentOwnerActions";
import { cn } from "@/lib/utils";
import { AttributionStack } from "./AttributionStack";
import { ContentTypeBadge } from "./ContentTypeBadge";

const accentByType: Record<FeedItem["type"], string> = {
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
  register = "panel",
}: {
  item: FeedItem;
  children: ReactNode;
  className?: string;
  canManage?: boolean;
  /**
   * editorial = something a person said; panel = something carrying price,
   * state or verification. The register is the tile's own claim about what kind
   * of thing it is, made before anyone reads a word of it.
   */
  register?: "editorial" | "panel";
}) {
  const t = useTranslations("content");
  const edited =
    new Date(item.updatedAt).getTime() > new Date(item.createdAt).getTime();

  const header = (
    <header className="flex items-start justify-between gap-3">
      <AttributionStack item={item} className="flex-1" />
      <div className="flex items-center gap-1.5">
        {/* Groups are public, so a group post is in everyone's feed — this
            chip is the only thing that says where it came from. Every tile
            renders through this shell, so labelling it here covers the home
            feed, the profile feed and the creature feed at once. */}
        {item.group && (
          <Link
            href={`/groups/${item.group.slug}`}
            aria-label={t("inGroup", { group: item.group.name })}
            data-testid="group-chip"
            className="max-w-40 truncate rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground hover:bg-secondary/20"
          >
            {item.group.name}
          </Link>
        )}
        {/* Says WHERE it is pinned, because the same post shows up on
            surfaces the pin has no bearing on. */}
        {item.pinnedAt && (
          <span
            className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-link"
            data-testid="pinned-chip"
          >
            {t("pinnedToProfile")}
          </span>
        )}
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
  );

  // Editorial items are not objects sitting on a surface — they are entries in
  // a column. No border, no fill, no shadow; the rhythm between them does the
  // separating that a box used to do.
  if (register === "editorial") {
    return (
      <article
        className={cn(
          // The hairline is what the border used to be: separation without
          // enclosure. The last entry drops it so the column ends on content
          // rather than on a rule pointing at nothing.
          "flex flex-col gap-3 border-b border-border/45 px-1 pb-5 last:border-b-0 last:pb-0",
          className,
        )}
        data-testid={`tile-${item.type}`}
      >
        {header}
        {children}
      </article>
    );
  }

  // overflow-hidden so media pulled to the panel's edge is clipped by the
  // panel's own radius instead of poking square corners past it.
  return (
    <Card
      className={cn(
        "premium-panel gap-3 overflow-hidden rounded-2xl p-4",
        accentByType[item.type],
        className,
      )}
      data-testid={`tile-${item.type}`}
    >
      {header}
      {children}
    </Card>
  );
}

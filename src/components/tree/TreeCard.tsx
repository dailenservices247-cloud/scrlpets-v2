"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import type { TreeCreature } from "@/lib/tree/queries";
import { LinkParentsSheet } from "./LinkParentsSheet";

export function TreeCard({
  creature,
  canManage,
  allCreatures,
  registerRef,
}: {
  creature: TreeCreature;
  canManage: boolean;
  allCreatures: TreeCreature[];
  registerRef: (id: string, el: HTMLAnchorElement | null) => void;
}) {
  const t = useTranslations("tree");
  const deceased = !!creature.deceasedAt;
  const subtitle = creature.breed || creature.species || t(`role.${creature.creatureRole}`);

  return (
    <div className="relative min-w-32 shrink-0" data-testid="tree-card">
      <Link
        ref={(el) => registerRef(creature.id, el)}
        href={`/c/${creature.slug}`}
        className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-ring"
        data-testid={`tree-card-link-${creature.id}`}
      >
        <Card className={`premium-panel h-full gap-2 rounded-2xl p-2 ${deceased ? "opacity-70" : ""}`}>
          <div className="relative">
            {creature.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={creature.avatarUrl}
                alt=""
                width={128}
                height={104}
                className={`aspect-[6/5] w-full rounded-xl object-cover ${deceased ? "ring-2 ring-amber-500/60" : ""}`}
              />
            ) : (
              <span
                className={`grid aspect-[6/5] w-full place-items-center rounded-xl bg-secondary text-2xl text-secondary-foreground ${deceased ? "ring-2 ring-amber-500/60" : ""}`}
                aria-hidden
              >
                {creature.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            {creature.isFounder && (
              <span
                className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border border-accent/50 bg-accent text-accent-foreground"
                data-testid="tree-founder-badge"
                title={t("founderBadge")}
              >
                <Crown className="size-3.5" aria-hidden />
              </span>
            )}
          </div>
          <div className="min-w-0 px-1 pb-1">
            <span className="block truncate text-sm font-semibold">{creature.name}</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
            {deceased && (
              <span className="mt-1 block truncate text-xs font-medium text-amber-400" data-testid="tree-memorial-label">
                {t("memorialLabel")}
              </span>
            )}
          </div>
        </Card>
      </Link>
      {canManage && (
        <div className="absolute -right-2 -top-2 z-10">
          <LinkParentsSheet creature={creature} allCreatures={allCreatures} />
        </div>
      )}
    </div>
  );
}

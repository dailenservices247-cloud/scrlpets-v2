"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import type { TreeCreature } from "@/lib/tree/queries";
import { LinkParentsSheet } from "./LinkParentsSheet";
import { RosterToggle } from "./RosterToggle";

export function TreeCard({
  creature,
  canManage,
  allCreatures,
  registerRef,
  isDimmed = false,
}: {
  creature: TreeCreature;
  canManage: boolean;
  allCreatures: TreeCreature[];
  registerRef: (id: string, el: HTMLAnchorElement | null) => void;
  isDimmed?: boolean;
}) {
  const t = useTranslations("tree");
  const deceased = !!creature.deceasedAt;
  const subtitle = creature.breed || creature.species || t(`role.${creature.creatureRole}`);

  return (
    <div
      className={`relative min-w-36 sm:min-w-40 shrink-0 transition-all duration-200 ${
        isDimmed ? "opacity-25 grayscale pointer-events-none" : ""
      }`}
      data-testid="tree-card"
    >
      <Link
        ref={(el) => registerRef(creature.id, el)}
        href={`/c/${creature.slug}`}
        className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-ring"
        data-testid={`tree-card-link-${creature.id}`}
      >
        <Card className={`premium-panel h-full gap-2.5 rounded-2xl p-2.5 sm:p-3 transition hover:border-primary/50 ${deceased ? "opacity-70" : ""}`}>
          <div className="relative">
            {creature.gender && (
              <span
                className={`absolute left-1 top-1 z-10 grid size-5 place-items-center rounded-full text-micro font-bold shadow-sm ${
                  creature.gender === "male"
                    ? "bg-blue-600/90 text-white"
                    : creature.gender === "female"
                    ? "bg-pink-600/90 text-white"
                    : "bg-muted/90 text-muted-foreground"
                }`}
                title={creature.gender}
              >
                {creature.gender === "male" ? "♂" : creature.gender === "female" ? "♀" : "•"}
              </span>
            )}
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
            {/* Visitors get the label, not the control: a card for an animal
                this operator does not own should say so on their tree too, not
                only be absent from their profile. */}
            <div className="mt-1 flex flex-wrap gap-1">
              {!creature.inRoster && !canManage && (
                <span
                  className="inline-block rounded-full border border-secondary/50 bg-secondary px-2 text-micro font-medium text-secondary-foreground"
                  data-testid="tree-recorded-badge"
                >
                  {t("recordedBadge")}
                </span>
              )}
              {creature.creatureRole === "breeding" && (
                <span className="inline-block rounded-full border border-emerald-500/40 bg-emerald-500/15 px-1.5 text-micro font-semibold text-emerald-600 dark:text-emerald-400">
                  Breeding
                </span>
              )}
            </div>
          </div>
        </Card>
      </Link>
      {canManage && (
        <>
          <div className="absolute -right-2 -top-2 z-10">
            <LinkParentsSheet creature={creature} allCreatures={allCreatures} />
          </div>
          <div className="absolute -left-2 -top-2 z-10">
            <RosterToggle creature={creature} />
          </div>
        </>
      )}
    </div>
  );
}

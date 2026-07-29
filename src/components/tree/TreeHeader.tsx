import { PawPrint } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { SpeciesIdentity } from "@/lib/species/identity";
import type { TreePrivacy } from "@/lib/tree/queries";
import { TreePrivacySelect } from "./TreePrivacySelect";
import { AddAnimalSheet } from "./AddAnimalSheet";

export async function TreeHeader({
  identity,
  stats,
  initialPrivacy,
}: {
  identity: SpeciesIdentity;
  stats: { animals: number; memorials: number; packSize: number };
  initialPrivacy: TreePrivacy;
}) {
  const t = await getTranslations("tree");

  return (
    <section className="px-3 pb-3 pt-4" data-testid="tree-header">
      <div className="premium-panel rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-accent/35 bg-accent/15 text-accent">
            <PawPrint className="size-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t("eyebrow")}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold leading-tight" data-testid="tree-group-name">
                {identity.groupName}
              </h1>
              <span
                className="rounded-full border border-secondary/40 bg-secondary/20 px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                data-testid="tree-role-badge"
              >
                {identity.roleBadge}
              </span>
            </div>
          </div>
          <AddAnimalSheet />
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2" data-testid="tree-stats">
          <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{t("statAnimals")}</dt>
            <dd className="mt-1 text-lg font-semibold" data-testid="tree-stat-animals">
              {stats.animals}
            </dd>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{t("statMemorials")}</dt>
            <dd className="mt-1 text-lg font-semibold" data-testid="tree-stat-memorials">
              {stats.memorials}
            </dd>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{t("statPackSize")}</dt>
            <dd className="mt-1 text-lg font-semibold" data-testid="tree-stat-pack-size">
              {stats.packSize}
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <TreePrivacySelect initialValue={initialPrivacy} />
        </div>
      </div>
    </section>
  );
}

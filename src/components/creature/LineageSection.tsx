import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { LineageCreature } from "@/lib/creatures/queries";

function LineageCard({ creature, roleLabel }: { creature: LineageCreature; roleLabel: string }) {
  return (
    <Link
      href={`/c/${creature.slug}`}
      className="flex min-w-36 shrink-0 flex-col gap-2 rounded-xl border border-border/70 bg-card/60 p-2 focus:outline-none focus:ring-2 focus:ring-ring"
      data-testid="lineage-card"
    >
      {creature.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creature.avatarUrl}
          alt=""
          width={136}
          height={100}
          className="aspect-[4/3] w-full rounded-lg object-cover"
        />
      ) : (
        <span
          className="grid aspect-[4/3] w-full place-items-center rounded-lg bg-secondary text-xl text-secondary-foreground"
          aria-hidden
        >
          {creature.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 px-1 pb-1">
        <span className="block truncate text-sm font-semibold">{creature.name}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{roleLabel}</span>
      </div>
    </Link>
  );
}

/** Read-only — only rows the viewer's RLS session can see ever reach this
 * component (queries.ts filters at the source), so no extra gating here. */
export async function LineageSection({
  parents,
  offspring,
  isDeceased,
}: {
  parents: LineageCreature[];
  offspring: LineageCreature[];
  isDeceased: boolean;
}) {
  if (parents.length === 0 && offspring.length === 0) return null;
  const t = await getTranslations("creature");

  return (
    <section className="mx-auto max-w-2xl px-4 pt-4" data-testid="lineage-section">
      <div className={`rounded-2xl border p-4 ${isDeceased ? "border-border/50 bg-muted/10" : "premium-panel"}`}>
        <h2 className="eyebrow">{t("lineage.title")}</h2>

        {parents.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t("lineage.parentsTitle")}</p>
            <div className="flex gap-3 overflow-x-auto pb-1" data-testid="lineage-parents">
              {parents.map((p) => (
                <LineageCard key={p.id} creature={p} roleLabel={t(`lineage.${p.parentType}`)} />
              ))}
            </div>
          </div>
        )}

        {offspring.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t("lineage.offspringTitle")}</p>
            <div className="flex gap-3 overflow-x-auto pb-1" data-testid="lineage-offspring">
              {offspring.map((o) => (
                <LineageCard key={o.id} creature={o} roleLabel={t(`lineage.${o.parentType}`)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

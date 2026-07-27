import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { BreederStats } from "@/lib/breeder-os/queries";

/**
 * R16 analytics, honest version: counts of the operator's OWN records only.
 * Legacy's dashboard mixed real counts with a purchasable trust score; nothing
 * here is modelled, projected, or improvable by paying.
 */
export async function BreederStatsPanel({ stats }: { stats: BreederStats }) {
  const t = await getTranslations("breederOs");
  const tiles = [
    { key: "animals", value: stats.animals },
    { key: "animalsAttested", value: stats.animalsAttested },
    { key: "animalsWithRecords", value: stats.animalsWithRecords },
    { key: "listings", value: stats.listings },
    { key: "listingsSold", value: stats.listingsSold },
    { key: "openApplications", value: stats.openApplications },
  ];

  return (
    <div className="premium-panel rounded-2xl p-4" data-testid="breeder-stats-panel">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">{t("statsEyebrow")}</p>
          <h2 className="mt-1 text-lg font-semibold">{t("statsTitle")}</h2>
        </div>
        {stats.openApplications > 0 && (
          <Link href="/applications" className="text-xs text-brand-link underline">
            {t("reviewApplications")}
          </Link>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-xl border border-border/70 bg-muted/30 p-3">
            <dt className="text-xs leading-tight text-muted-foreground">{t(`stat.${tile.key}`)}</dt>
            <dd className="mt-1 text-2xl font-semibold" data-testid={`stat-${tile.key}`}>
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

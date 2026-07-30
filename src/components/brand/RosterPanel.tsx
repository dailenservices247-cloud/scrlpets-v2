import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { RosterAnimal } from "@/lib/breeder-os/queries";

/**
 * R16: the operator's animals in one place, each showing what is actually
 * true about it — records provided, attested as listable, currently listed.
 * No score, no grade; the states link straight to the surface that changes them.
 *
 * R3 (dedup): read-only. /tree is the single animal management home; this
 * panel only shows state and links out to it.
 */
export async function RosterPanel({ animals }: { animals: RosterAnimal[] }) {
  const t = await getTranslations("breederOs");
  const tHub = await getTranslations("hub");

  return (
    <div className="premium-panel rounded-2xl p-4" data-testid="roster-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{t("rosterEyebrow")}</p>
          <h2 className="mt-1 text-lg font-semibold">{t("rosterTitle")}</h2>
        </div>
        <Link
          href="/tree"
          data-testid="roster-manage-link"
          className="shrink-0 text-xs text-brand-link underline"
        >
          {tHub("manageInTree")}
        </Link>
      </div>

      {animals.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="roster-empty">
          {t("rosterEmpty")}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {animals.map((a) => (
            <li key={a.id} className="flex items-center gap-3" data-testid="roster-row">
              {a.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.avatarUrl} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
              ) : (
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary/20 text-secondary-foreground"
                  aria-hidden
                >
                  {a.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/c/${a.slug}`} className="truncate text-sm font-semibold hover:underline">
                  {a.name}
                </Link>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span>{a.hasRecords ? t("hasRecords") : t("noRecords")}</span>
                  <span aria-hidden>·</span>
                  <span>{a.attested ? t("attested") : t("notAttested")}</span>
                  {a.listingAvailability && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{t(`availability.${a.listingAvailability}`)}</span>
                    </>
                  )}
                </p>
              </div>
              {!a.attested && (
                <Link
                  href="/settings/verification"
                  className="shrink-0 text-xs text-brand-link underline"
                  data-testid={`roster-attest-${a.id}`}
                >
                  {t("attestCta")}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

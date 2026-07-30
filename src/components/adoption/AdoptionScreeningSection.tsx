import { getTranslations } from "next-intl/server";
import type { AdoptionScreeningFields } from "@/lib/adoption/queries";

export type AdoptionScreeningRow = AdoptionScreeningFields & {
  id: string;
  listingTitle: string | null;
  buyerUsername: string | null;
  message: string | null;
};

/**
 * V2-03 owner review: the seller's structured screening answers, shown
 * alongside the buyer's message, for every OPEN adoption application they
 * can still decide on. Added to /applications rather than folded into
 * ApplicationList.tsx (owned elsewhere, not in this lane's granted paths) —
 * accept/decline stays exactly where it already lives, below this section.
 */
export async function AdoptionScreeningSection({ rows }: { rows: AdoptionScreeningRow[] }) {
  if (rows.length === 0) return null;
  const t = await getTranslations("applications");

  return (
    <section className="px-3 pb-2" data-testid="adoption-screening-section">
      <h2 className="pb-2 text-sm font-semibold">{t("adoptionScreeningTitle")}</h2>
      <div className="flex flex-col gap-2">
        {rows.map((a) => (
          <div
            key={a.id}
            className="premium-panel rounded-2xl p-4"
            data-testid={`adoption-screening-${a.id}`}
          >
            <p className="text-sm font-semibold">{a.listingTitle ?? t("generalInterest")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("fromBuyer")} @{a.buyerUsername ?? "—"}
            </p>
            {a.message && <p className="mt-2 text-sm">{a.message}</p>}
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">{t("adoptionScreeningLivingSituation")}</dt>
                <dd data-testid={`adoption-screening-living-${a.id}`}>
                  {t(`livingSituation.${a.livingSituation}`)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("adoptionScreeningYard")}</dt>
                <dd data-testid={`adoption-screening-yard-${a.id}`}>
                  {a.hasYard ? t("adoptionScreeningYardYes") : t("adoptionScreeningYardNo")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("adoptionScreeningExperience")}</dt>
                <dd data-testid={`adoption-screening-experience-${a.id}`}>
                  {t(`experienceLevel.${a.experienceLevel}`)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("adoptionScreeningOtherPets")}</dt>
                <dd data-testid={`adoption-screening-pets-${a.id}`}>
                  {a.otherPets || t("adoptionScreeningOtherPetsNone")}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

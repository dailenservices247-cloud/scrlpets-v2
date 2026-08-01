import { getTranslations } from "next-intl/server";
import { BadgeCheck, ShieldAlert } from "lucide-react";

/**
 * V2-02: the honest replacement for legacy's hardcoded "Verified Breeder" /
 * "Health Guaranteed" badges (rendered on every listing with nothing behind
 * them). Renders the seller's REAL identity-verification state in exactly
 * the /services pattern, plus — for animal listings — whether THIS animal is
 * attested. An unverified seller gets an explicit "not verified" state, never
 * an absence, and the animal section always carries the plain not-inspected
 * sentence rather than implying Scrlpets vetted the animal.
 */
export async function ListingVerificationPanel({
  sellerVerified,
  hasAnimal,
  animalAttested,
}: {
  sellerVerified: boolean;
  hasAnimal: boolean;
  animalAttested: boolean;
}) {
  const t = await getTranslations("detail");
  const tServices = await getTranslations("services");

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="listing-verification-panel">
      <p className="eyebrow">{t("verificationTitle")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {sellerVerified ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-xs text-secondary-foreground"
            data-testid="listing-seller-verified"
          >
            <BadgeCheck className="size-3.5" aria-hidden />
            {tServices("providerVerified")}
          </span>
        ) : (
          <span
            className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground"
            data-testid="listing-seller-unverified"
          >
            {tServices("providerUnverified")}
          </span>
        )}
        {hasAnimal &&
          (animalAttested ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-xs text-secondary-foreground"
              data-testid="listing-animal-attested"
            >
              <BadgeCheck className="size-3.5" aria-hidden />
              {t("animalAttestedLabel")}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground"
              data-testid="listing-animal-not-attested"
            >
              <ShieldAlert className="size-3.5" aria-hidden />
              {t("animalNotAttestedLabel")}
            </span>
          ))}
      </div>
      {hasAnimal && (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="listing-not-inspected-notice">
          {t("notInspectedNotice")}
        </p>
      )}
    </section>
  );
}

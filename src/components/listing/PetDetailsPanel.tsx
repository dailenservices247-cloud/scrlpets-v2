import { getTranslations } from "next-intl/server";
import type { ListingAnimalDetails } from "@/lib/listings/queries";
import { computeAnimalAge } from "@/lib/listings/age";
import { AssuranceBadge } from "@/components/anchor/AssuranceBadge";

// Matches the .toLocaleDateString("en-US", {...}) convention already used for
// dates elsewhere (e.g. src/components/litters/LittersPanel.tsx).
function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * V2-01: structured pet details, rendered only when the listing has an
 * attached creature. Reuses the creature page's own field/gender labels
 * (src/lib/creatures/queries.ts's shape, messages "creature.about.*") so the
 * same animal is described identically everywhere. Empty rows are omitted
 * entirely rather than rendered blank.
 *
 * Also carries the identity-anchor assurance level, in the same panel as the
 * animal's own facts and directly above ListingVerificationPanel's seller
 * state — the two answer different questions ("which animal is this?" vs "who
 * is selling it?") and neither should be read as the other.
 */
export async function PetDetailsPanel({ creature }: { creature: ListingAnimalDetails }) {
  const t = await getTranslations("detail");
  const tCreature = await getTranslations("creature");

  const rows: { key: string; label: string; value: string }[] = [];
  if (creature.breed) {
    rows.push({ key: "breed", label: tCreature("about.field.breed"), value: creature.breed });
  }
  if (creature.gender) {
    rows.push({
      key: "gender",
      label: tCreature("about.field.gender"),
      value: tCreature(`about.gender.${creature.gender}`),
    });
  }
  if (creature.color) {
    rows.push({ key: "color", label: tCreature("about.field.color"), value: creature.color });
  }
  if (creature.markings) {
    rows.push({ key: "markings", label: tCreature("about.field.markings"), value: creature.markings });
  }
  if (creature.registrationNumber) {
    rows.push({
      key: "registration",
      label: tCreature("about.field.registrationNumber"),
      value: creature.registrationNumber,
    });
  }
  if (creature.birthDate) {
    rows.push({ key: "born", label: t("bornLabel"), value: formatDate(creature.birthDate) });
  }
  if (creature.weanedDate) {
    rows.push({ key: "weaned", label: t("weanedLabel"), value: formatDate(creature.weanedDate) });
  }

  const age = creature.birthDate ? computeAnimalAge(creature.birthDate) : null;
  // The panel no longer bails when every field is empty: an animal with nothing
  // filled in is exactly the case a buyer most needs the assurance level for.
  const hasDetails = rows.length > 0 || !!age;

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="pet-details-panel">
      {hasDetails && (
        <>
          <p className="eyebrow">{t("petDetailsTitle")}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {rows.map((row) => (
              <div key={row.key} data-testid={`pet-detail-${row.key}`}>
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
          {age && (
            <p className="mt-2 text-sm text-muted-foreground" data-testid="pet-detail-age">
              {t(`age${age.unit.charAt(0).toUpperCase()}${age.unit.slice(1)}`, { count: age.count })}
            </p>
          )}
        </>
      )}
      <div className={hasDetails ? "mt-3 border-t border-border/70 pt-3" : ""}>
        <p className="eyebrow">{tCreature("assurance.title")}</p>
        <div className="mt-2">
          <AssuranceBadge level={creature.assurance} anchorType={creature.anchorType} />
        </div>
      </div>
    </section>
  );
}

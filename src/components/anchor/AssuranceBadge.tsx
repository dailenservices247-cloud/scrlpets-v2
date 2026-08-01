import { getTranslations } from "next-intl/server";
import { FileText, MessageSquare, ShieldCheck } from "lucide-react";
import type { AnchorType, AssuranceLevel } from "@/lib/creatures/types";

/**
 * The public answer to "how sure can I be this is the animal in the photos?" —
 * rendered identically on the listing and on the animal's own page so the same
 * animal never reads as two different levels of assurance.
 *
 * Tone follows ListingVerificationPanel: exactly ONE state gets the affirmative
 * treatment. `anchored` is the only thing here backed by a unique physical
 * marker, so it is the only one that gets the badge colour. `documented` and
 * `declared` share the plain muted style on purpose — promoting provenance to a
 * green badge is precisely the fabricated-trust move this panel exists to
 * replace, and neither of them is a verification.
 */
const TONE: Record<AssuranceLevel, string> = {
  anchored: "border-secondary/40 bg-secondary/15 text-secondary-foreground",
  documented: "border-input text-muted-foreground",
  declared: "border-input text-muted-foreground",
};

const ICON: Record<AssuranceLevel, typeof ShieldCheck> = {
  anchored: ShieldCheck,
  documented: FileText,
  declared: MessageSquare,
};

export async function AssuranceBadge({
  level,
  anchorType,
}: {
  level: AssuranceLevel;
  anchorType: AnchorType | null;
}) {
  // The whole "creature" namespace, not "creature.assurance", so the marker-type
  // labels stay in one place and the badge and the owner's form can never drift
  // into calling the same marker two different things.
  const t = await getTranslations("creature");
  const Icon = ICON[level];

  return (
    <div data-testid="assurance" data-assurance={level}>
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${TONE[level]}`}
      >
        <Icon className="size-3.5" aria-hidden />
        {t(`assurance.level.${level}`)}
      </span>
      <p className="mt-2 text-xs text-muted-foreground">{t(`assurance.body.${level}`)}</p>
      {/* The marker TYPE is public — it is what makes the level legible across
          species (a leg band is not a chip). The VALUE never renders here. */}
      {level === "anchored" && anchorType && (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="assurance-marker">
          {t("assurance.marker", { type: t(`anchor.type.${anchorType}`) })}
        </p>
      )}
    </div>
  );
}

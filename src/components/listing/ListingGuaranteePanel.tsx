import { getTranslations } from "next-intl/server";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/**
 * The seller's published guarantee, as the buyer reads it.
 *
 * Rendered from `listing_guarantee_text` — the same database function the
 * compose preview calls. That is not a tidiness preference: the dispute policy
 * resolves ambiguous terms against the seller, which is only fair because they
 * were shown exactly this text before publishing. Two renderers would eventually
 * disagree, and the day they did, contra proferentem would be punishing a seller
 * for words they never saw.
 *
 * A listing with no guarantee gets the explicit no-guarantee state, never
 * silence — same rule as ListingVerificationPanel, and the dispute policy leans
 * on it directly ("the listing said so plainly and the buyer accepted that").
 */
export async function ListingGuaranteePanel({ listingId }: { listingId: string }) {
  const t = await getTranslations("detail");
  const supabase = await createClient();
  const { data } = await supabase.rpc("listing_guarantee_text", { target_listing: listingId });
  const g = (data as
    | {
        kind: "none" | "template" | "custom";
        headline: string;
        body: string;
        remedy_sentence: string | null;
        duration_days: number | null;
        conditions: string[] | null;
      }[]
    | null)?.[0];
  if (!g) return null;

  const offered = g.kind !== "none";

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="listing-guarantee-panel">
      <p className="eyebrow">{t("guaranteeTitle")}</p>
      <div className="mt-2 flex items-start gap-2">
        {offered ? (
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
        ) : (
          <ShieldOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div>
          <p className="text-sm font-medium" data-testid="listing-guarantee-headline">
            {g.headline}
          </p>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="listing-guarantee-body">
            {g.body}
          </p>
          {g.remedy_sentence && (
            <p className="mt-1 text-sm" data-testid="listing-guarantee-remedy">
              {g.remedy_sentence}
            </p>
          )}
          {g.duration_days !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("guaranteeDurationDays", { days: g.duration_days })}
            </p>
          )}
          {(g.conditions ?? []).length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
              {(g.conditions ?? []).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          {/* Scrlpets does not assess the animal. It compares a vet's finding
              against this promise, and saying so here stops the panel reading as
              a platform endorsement of the seller's claim. */}
          <p className="mt-2 text-xs text-muted-foreground">{t("guaranteeDisclaimer")}</p>
        </div>
      </div>
    </section>
  );
}

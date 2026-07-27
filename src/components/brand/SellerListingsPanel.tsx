"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setListingAvailability } from "@/lib/breeder-os/actions";
import { formatPrice } from "@/lib/shop/format";
import type { SellerListing } from "@/lib/breeder-os/queries";

const STATES = ["available", "pending", "sold"] as const;

/**
 * R16: the seller's listings with working availability control. Phase 4 added
 * the availability column but no way to set it — this closes that gap.
 */
export function SellerListingsPanel({ listings }: { listings: SellerListing[] }) {
  const t = useTranslations("breederOs");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(id: string, availability: (typeof STATES)[number]) {
    setBusy(id);
    setError(null);
    const result = await setListingAvailability(id, availability);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="premium-panel rounded-2xl p-4" data-testid="seller-listings-panel">
      <p className="eyebrow">{t("listingsEyebrow")}</p>
      <h2 className="mt-1 text-lg font-semibold">{t("listingsTitle")}</h2>

      {listings.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="seller-listings-empty">
          {t("listingsEmpty")}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {listings.map((l) => (
            <li key={l.id} data-testid="seller-listing-row">
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/listing/${l.id}`} className="truncate text-sm font-semibold hover:underline">
                  {l.title}
                </Link>
                <span className="shrink-0 text-sm">{formatPrice(l.priceCents, l.currency)}</span>
              </div>
              <div className="mt-2 flex gap-2" role="group" aria-label={t("availabilityLabel")}>
                {STATES.map((state) => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => change(l.id, state)}
                    disabled={busy === l.id || l.availability === state}
                    aria-pressed={l.availability === state}
                    data-testid={`availability-${state}-${l.id}`}
                    className={
                      l.availability === state
                        ? "min-h-9 flex-1 rounded-lg border border-primary/60 bg-primary/15 px-2 text-xs font-semibold text-brand-link"
                        : "min-h-9 flex-1 rounded-lg border border-input px-2 text-xs text-muted-foreground disabled:opacity-50"
                    }
                  >
                    {t(`availability.${state}`)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-3 text-xs text-destructive" data-testid="seller-listings-error">
          {error}
        </p>
      )}
    </div>
  );
}

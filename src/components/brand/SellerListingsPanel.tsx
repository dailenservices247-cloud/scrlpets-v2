"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setListingAvailability, updateListingStock } from "@/lib/breeder-os/actions";
import { formatPrice } from "@/lib/shop/format";
import type { SellerListing } from "@/lib/breeder-os/queries";
import { Edit2, Minus, Plus } from "lucide-react";

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

  async function adjustStock(id: string, currentStock: number | null, delta: number) {
    setBusy(id);
    setError(null);
    const current = currentStock ?? 0;
    const next = Math.max(0, current + delta);
    const result = await updateListingStock(id, next);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="premium-panel rounded-2xl p-4" data-testid="seller-listings-panel">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{t("listingsEyebrow")}</p>
          <h2 className="mt-1 text-lg font-semibold">{t("listingsTitle")}</h2>
        </div>
        <Link
          href="/compose?kind=listing"
          className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-link hover:bg-primary/20"
        >
          + New Listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="seller-listings-empty">
          {t("listingsEmpty")}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {listings.map((l) => (
            <li key={l.id} className="rounded-xl border border-border/70 bg-card/40 p-3" data-testid="seller-listing-row">
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/listing/${l.id}`} className="truncate text-sm font-semibold hover:underline">
                  {l.title}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-sm font-semibold">{formatPrice(l.priceCents, l.currency)}</span>
                  <Link
                    href={`/listing/${l.id}/edit`}
                    className="grid size-7 place-items-center rounded-lg border border-border/80 bg-background text-muted-foreground hover:text-foreground"
                    title="Edit listing details"
                  >
                    <Edit2 className="size-3" aria-hidden />
                  </Link>
                </div>
              </div>

              {/* Stock Quantity Controls for tracked supplies/merch */}
              {l.stockQuantity !== null && (
                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground">
                    Stock Inventory: <strong className="font-mono text-foreground">{l.stockQuantity}</strong>
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busy === l.id || l.stockQuantity <= 0}
                      onClick={() => adjustStock(l.id, l.stockQuantity, -1)}
                      className="grid size-6 place-items-center rounded border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40"
                      title="Decrease stock by 1"
                    >
                      <Minus className="size-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={busy === l.id}
                      onClick={() => adjustStock(l.id, l.stockQuantity, 1)}
                      className="grid size-6 place-items-center rounded border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40"
                      title="Increase stock by 1"
                    >
                      <Plus className="size-3" aria-hidden />
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-2.5 flex gap-2" role="group" aria-label={t("availabilityLabel")}>
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

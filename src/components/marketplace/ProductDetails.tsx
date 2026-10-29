import { getTranslations } from "next-intl/server";
import { CheckCircle2, Clock, AlertCircle, Truck, Store } from "lucide-react";
import { formatPrice } from "@/lib/shop/format";
import type { ListingMarketplaceDetail } from "@/lib/marketplace/queries";

/** D9: the seller's own description and category, shown as written with live inventory & fulfillment signals. */
export async function ProductDetails({ listing }: { listing: ListingMarketplaceDetail }) {
  const t = await getTranslations("shop");

  return (
    <section className="w-full rounded-2xl border bg-card p-4" data-testid="product-details">
      <div className="flex flex-wrap items-center gap-2">
        {listing.category && <span className="eyebrow">{listing.category}</span>}
        {listing.availability !== "available" && (
          <span
            className="rounded-md border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-xs text-secondary-foreground"
            data-testid="product-availability"
          >
            {t(`availability.${listing.availability}`)}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xl font-bold tracking-tight text-foreground">
          {formatPrice(listing.priceCents, listing.currency)}
        </p>
      </div>

      {/* Commercial inventory & fulfillment badges for non-animal supply listings */}
      {!listing.hasAnimal && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40">
          {listing.stockQuantity === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-micro font-medium text-destructive">
              <AlertCircle className="size-3" aria-hidden />
              Out of stock
            </span>
          ) : listing.stockQuantity !== null && listing.stockQuantity <= 3 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-micro font-medium text-amber-400">
              <Clock className="size-3" aria-hidden />
              Only {listing.stockQuantity} left
            </span>
          ) : listing.stockQuantity !== null && listing.stockQuantity > 3 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-micro font-medium text-emerald-400">
              <CheckCircle2 className="size-3" aria-hidden />
              In stock ({listing.stockQuantity} available)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-micro font-medium text-muted-foreground">
              <Clock className="size-3" aria-hidden />
              Made to order / Handcrafted
            </span>
          )}

          {listing.shippingFeeCents === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-micro font-medium text-emerald-400">
              <Truck className="size-3" aria-hidden />
              Free standard shipping
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/20 px-2.5 py-0.5 text-micro font-medium text-muted-foreground">
              <Truck className="size-3" aria-hidden />
              +{formatPrice(listing.shippingFeeCents, listing.currency)} shipping
            </span>
          )}

          {listing.fulfillmentOptions?.includes("local_pickup") && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/20 px-2.5 py-0.5 text-micro font-medium text-muted-foreground">
              <Store className="size-3" aria-hidden />
              Local pickup available
            </span>
          )}
        </div>
      )}

      {listing.description && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{listing.description}</p>
      )}
    </section>
  );
}

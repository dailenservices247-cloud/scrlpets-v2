import { getTranslations } from "next-intl/server";
import { formatPrice } from "@/lib/shop/queries";
import type { ListingMarketplaceDetail } from "@/lib/marketplace/queries";

/** D9: the seller's own description and category, shown as written. */
export async function ProductDetails({ listing }: { listing: ListingMarketplaceDetail }) {
  const t = await getTranslations("shop");
  if (!listing.description && !listing.category && listing.availability === "available") {
    return null;
  }
  return (
    <section className="rounded-2xl border bg-card p-4" data-testid="product-details">
      <div className="flex flex-wrap items-center gap-2">
        {listing.category && <span className="eyebrow">{listing.category}</span>}
        {listing.availability !== "available" && (
          <span
            className="rounded-md border border-secondary/40 bg-secondary/15 px-2 py-1 text-xs text-secondary-foreground"
            data-testid="product-availability"
          >
            {t(`availability.${listing.availability}`)}
          </span>
        )}
      </div>
      <p className="mt-2 text-lg font-semibold">
        {formatPrice(listing.priceCents, listing.currency)}
      </p>
      {listing.description && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{listing.description}</p>
      )}
    </section>
  );
}

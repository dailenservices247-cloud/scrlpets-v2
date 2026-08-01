import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AnimalListing } from "@/lib/adoption/queries";
import { formatPrice } from "@/lib/shop/format";

/**
 * One card for both intents. The intent chip is the only thing that separates
 * them, which is the whole argument for the merge — /shop and /adopt were two
 * filters on one table, not two concepts.
 */
export function AnimalCard({ listing }: { listing: AnimalListing }) {
  const t = useTranslations("market");
  const adoption = listing.listingKind === "adoption";
  return (
    <Link
      href={`/listing/${listing.id}`}
      className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition hover:border-primary/40"
      data-testid="animal-card"
    >
      {listing.mediaUrl || listing.creature?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.mediaUrl ?? listing.creature!.avatarUrl!}
          alt=""
          className="aspect-video w-full object-cover"
          loading="lazy"
        />
      ) : null}
      <div className="flex flex-1 flex-col p-4">
        <span
          className="eyebrow"
          data-testid={adoption ? "animal-intent-adoption" : "animal-intent-sale"}
        >
          {t(adoption ? "intentAdoption" : "intentSale")}
        </span>
        <p className="mt-1 font-semibold">{listing.creature?.name ?? listing.title}</p>
        {listing.creature?.species && (
          <p className="mt-0.5 text-xs text-muted-foreground">{listing.creature.species}</p>
        )}
        {listing.description && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{listing.description}</p>
        )}
        <p className="mt-auto pt-3 text-sm font-semibold">
          {listing.priceCents > 0
            ? adoption
              ? t("feeAmount", { amount: formatPrice(listing.priceCents, listing.currency) })
              : formatPrice(listing.priceCents, listing.currency)
            : t("noFee")}
        </p>
        <p className="truncate text-xs text-muted-foreground">@{listing.sellerUsername ?? "—"}</p>
      </div>
    </Link>
  );
}

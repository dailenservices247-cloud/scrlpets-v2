import Link from "next/link";
import { Sparkles, Store, UserCheck } from "lucide-react";
import { formatPrice } from "@/lib/shop/format";
import type { ShopProduct } from "@/lib/shop/queries";

export function ProductCard({ product }: { product: ShopProduct }) {
  const sellerDisplayName =
    product.merchantName ?? (product.brand ? product.brand.name : `@${product.sellerUsername ?? "seller"}`);

  return (
    <Link
      href={`/listing/${product.id}`}
      className="flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:border-primary/40"
      data-testid="product-card"
    >
      <div className="relative aspect-square w-full bg-muted/40">
        {product.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.mediaUrl}
            alt=""
            className="aspect-square w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid aspect-square w-full place-items-center text-3xl font-semibold text-muted-foreground" aria-hidden>
            {product.title.slice(0, 1).toUpperCase()}
          </div>
        )}

        {/* 3-Tier Badge System */}
        {product.recommender ? (
          <span
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background/90 px-2 py-0.5 text-micro font-medium text-brand-link backdrop-blur"
            data-testid="badge-recommendation"
          >
            <Sparkles className="size-3" aria-hidden />
            Rec by @{product.recommender.username}
          </span>
        ) : product.sellerSource === "merchant" ? (
          <span
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-background/90 px-2 py-0.5 text-micro font-medium text-foreground backdrop-blur"
            data-testid="badge-merchant"
          >
            <Store className="size-3 text-brand-link" aria-hidden />
            Verified Store
          </span>
        ) : (
          <span
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/85 px-2 py-0.5 text-micro font-medium text-muted-foreground backdrop-blur"
            data-testid="badge-distributor"
          >
            <UserCheck className="size-3" aria-hidden />
            Independent
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        {product.category && <p className="eyebrow">{product.category}</p>}
        <p className="mt-1 line-clamp-2 text-sm font-semibold">{product.title}</p>

        {product.recommender?.note && (
          <p className="mt-1 line-clamp-1 text-xs italic text-muted-foreground">
            &ldquo;{product.recommender.note}&rdquo;
          </p>
        )}

        <div className="mt-auto pt-2">
          <div className="flex items-baseline justify-between gap-1">
            <p className="text-sm font-semibold">
              {formatPrice(product.priceCents, product.currency)}
            </p>
            {product.stockQuantity !== null ? (
              product.stockQuantity === 0 ? (
                <span className="text-micro font-medium text-destructive">Out of stock</span>
              ) : product.stockQuantity <= 3 ? (
                <span className="text-micro font-medium text-amber-400">Only {product.stockQuantity} left</span>
              ) : (
                <span className="text-micro text-emerald-400">{product.stockQuantity} in stock</span>
              )
            ) : (
              <span className="text-micro text-muted-foreground">Made to order</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-1 text-xs text-muted-foreground">
            <p className="truncate">
              {product.recommender ? `Sold by ${sellerDisplayName}` : sellerDisplayName}
            </p>
            <span className="shrink-0 text-micro">
              {product.shippingFeeCents > 0 ? `+${formatPrice(product.shippingFeeCents, product.currency)} ship` : "Free ship"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

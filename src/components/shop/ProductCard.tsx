import Link from "next/link";
import { formatPrice, type ShopProduct } from "@/lib/shop/queries";

export function ProductCard({ product }: { product: ShopProduct }) {
  return (
    <Link
      href={`/listing/${product.id}`}
      className="flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:border-primary/40"
      data-testid="product-card"
    >
      {product.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.mediaUrl}
          alt=""
          className="aspect-square w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid aspect-square w-full place-items-center bg-muted/40 text-3xl" aria-hidden>
          {product.title.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="flex flex-1 flex-col p-3">
        {product.category && <p className="eyebrow">{product.category}</p>}
        <p className="mt-1 line-clamp-2 text-sm font-semibold">{product.title}</p>
        <p className="mt-auto pt-2 text-sm font-semibold">
          {formatPrice(product.priceCents, product.currency)}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {product.brand ? product.brand.name : `@${product.sellerUsername ?? "seller"}`}
        </p>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { ProductCard } from "@/components/shop/ProductCard";
import { listShopCategories, listShopProducts } from "@/lib/shop/queries";
import { isPaymentsEnabled } from "@/lib/orders/queries";

// D9: real products, not a placeholder. A product is a listing with no animal
// attached, so animals never appear here and the listing gate is not forked.
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const t = await getTranslations("shop");
  const [products, categories, paymentsOn] = await Promise.all([
    listShopProducts(category),
    listShopCategories(),
    isPaymentsEnabled(),
  ]);

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        {!paymentsOn && (
          <p
            className="mt-2 text-sm leading-6 text-muted-foreground"
            data-testid="shop-checkout-notice"
          >
            {t("checkoutOffNotice")}
          </p>
        )}
      </section>

      {categories.length > 0 && (
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4" aria-label={t("categories")}>
          <Link
            href="/shop"
            className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm ${!category ? "border-primary bg-primary/10" : "border-input"}`}
          >
            {t("allCategories")}
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/shop?category=${encodeURIComponent(c)}`}
              className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm ${category === c ? "border-primary bg-primary/10" : "border-input"}`}
            >
              {c}
            </Link>
          ))}
        </nav>
      )}

      <div className="px-4 pb-8">
        {products.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="shop-empty">
            {t("empty")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="shop-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </AppPage>
  );
}

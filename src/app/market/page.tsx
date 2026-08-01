import Link from "next/link";
import { Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { AnimalCard } from "@/components/market/AnimalCard";
import { ServiceCard } from "@/components/market/ServiceCard";
import { MarketTabs, type MarketTab } from "@/components/market/MarketTabs";
import { ProductCard } from "@/components/shop/ProductCard";
import { getSessionUser } from "@/lib/auth/session";
import { parsePriceCents } from "@/lib/compose/validation";
import { listAnimalListings } from "@/lib/adoption/queries";
import { listListedSpecies } from "@/lib/search/queries";
import { listServiceCategories, listServices } from "@/lib/services/queries";
import { listShopCategories, listShopProducts } from "@/lib/shop/queries";
import { isPaymentsEnabled } from "@/lib/orders/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Market",
  description: "Animals, supplies and services on Scrlpets.",
};

type SearchParams = {
  tab?: string;
  intent?: string;
  species?: string;
  minPrice?: string;
  maxPrice?: string;
  category?: string;
};

function parseTab(raw?: string): MarketTab {
  // Animals is the default because it is the product. /shop and /adopt each
  // land here with an explicit tab, so an unrecognised value falling back to
  // Animals is the only behaviour a shared link can be surprised by.
  return raw === "supplies" || raw === "services" ? raw : "animals";
}

function parseIntent(raw?: string): "sale" | "adoption" | undefined {
  return raw === "sale" || raw === "adoption" ? raw : undefined;
}

/**
 * The merged marketplace. `/shop` filtered `sale AND creature_id IS NULL` and
 * `/adopt` filtered `adoption`, which left a sale listing WITH an animal —
 * the default output of "list my animal" — browsable on no surface at all.
 * One page, three tabs, every filter in the URL exactly as /search does it, so
 * results stay shareable and the back button behaves.
 */
export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tab: rawTab, intent: rawIntent, species, minPrice, maxPrice, category } =
    await searchParams;
  const tab = parseTab(rawTab);
  const t = await getTranslations("market");

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        {/* Unconditional on purpose: /brand-os was the only Service-creation
            surface and the menu hid it behind an operator check, so a groomer
            with no animals and no brand could never find it. */}
        <Link
          href="/market/offer"
          data-testid="market-offer-entry"
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-input px-4 text-sm font-medium text-brand-link"
        >
          <Store className="size-4" aria-hidden />
          {t("offerEntry")}
        </Link>
      </section>

      <MarketTabs tab={tab} label={t("tabsLabel")} />

      {tab === "animals" && (
        <AnimalsTab
          intent={parseIntent(rawIntent)}
          species={species}
          minPrice={minPrice}
          maxPrice={maxPrice}
        />
      )}
      {tab === "supplies" && <SuppliesTab category={category} />}
      {tab === "services" && <ServicesTab category={category} />}
    </AppPage>
  );
}

async function AnimalsTab({
  intent,
  species,
  minPrice,
  maxPrice,
}: {
  intent?: "sale" | "adoption";
  species?: string;
  minPrice?: string;
  maxPrice?: string;
}) {
  const [t, tAdopt] = await Promise.all([
    getTranslations("market"),
    getTranslations("adopt"),
  ]);
  const [listings, speciesOptions] = await Promise.all([
    listAnimalListings({
      intent,
      species: species?.trim() || undefined,
      minPriceCents: minPrice ? (parsePriceCents(minPrice) ?? undefined) : undefined,
      maxPriceCents: maxPrice ? (parsePriceCents(maxPrice) ?? undefined) : undefined,
    }),
    // Species is free text with no DB constraint — real data carries gecko,
    // parakeet and parrot — so the options come from what is actually listed,
    // never a hardcoded vocabulary.
    listListedSpecies(),
  ]);

  return (
    <>
      <div className="px-4">
        <form action="/market" className="flex flex-wrap gap-2">
          <input type="hidden" name="tab" value="animals" />
          <input
            type="text"
            name="species"
            defaultValue={species ?? ""}
            placeholder={t("filters.species")}
            aria-label={t("filters.species")}
            list="market-species-options"
            data-testid="market-filter-species"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <datalist id="market-species-options">
            {speciesOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <select
            name="intent"
            defaultValue={intent ?? ""}
            aria-label={t("filters.intent")}
            data-testid="market-filter-intent"
            className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("filters.intentAny")}</option>
            <option value="sale">{t("filters.intentSale")}</option>
            <option value="adoption">{t("filters.intentAdoption")}</option>
          </select>
          <input
            type="text"
            inputMode="decimal"
            name="minPrice"
            defaultValue={minPrice ?? ""}
            placeholder={t("filters.minPrice")}
            aria-label={t("filters.minPrice")}
            data-testid="market-filter-min-price"
            className="min-h-11 w-24 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <input
            type="text"
            inputMode="decimal"
            name="maxPrice"
            defaultValue={maxPrice ?? ""}
            placeholder={t("filters.maxPrice")}
            aria-label={t("filters.maxPrice")}
            data-testid="market-filter-max-price"
            className="min-h-11 w-24 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link"
            data-testid="market-filter-submit"
          >
            {t("filters.submit")}
          </button>
        </form>
        {/* Same gate, same wording as the old /adopt page: rehoming is held to
            the checks a sale is, and this tab now carries both. */}
        <p className="mt-3 text-sm leading-6 text-muted-foreground" data-testid="adopt-gate-notice">
          {tAdopt("gateNotice")}
        </p>
      </div>

      <div className="px-4 pb-8 pt-4">
        {listings.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="market-animals-empty">
            {t("animalsEmpty")}
          </p>
        ) : (
          <ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="market-animals-grid"
          >
            {listings.map((l) => (
              <li key={l.id}>
                <AnimalCard listing={l} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

async function SuppliesTab({ category }: { category?: string }) {
  const t = await getTranslations("shop");
  const [products, categories, paymentsOn] = await Promise.all([
    listShopProducts(category),
    listShopCategories(),
    isPaymentsEnabled(),
  ]);

  return (
    <>
      {!paymentsOn && (
        <p className="px-4 text-sm leading-6 text-muted-foreground" data-testid="shop-checkout-notice">
          {t("checkoutOffNotice")}
        </p>
      )}

      {categories.length > 0 && (
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 pt-4" aria-label={t("categories")}>
          <Link
            href="/market?tab=supplies"
            aria-current={!category ? "page" : undefined}
            className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm ${!category ? "border-primary bg-primary/10" : "border-input"}`}
          >
            {t("allCategories")}
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/market?tab=supplies&category=${encodeURIComponent(c)}`}
              aria-current={category === c ? "page" : undefined}
              className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm ${category === c ? "border-primary bg-primary/10" : "border-input"}`}
            >
              {c}
            </Link>
          ))}
        </nav>
      )}

      <div className="px-4 pb-8 pt-4">
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
    </>
  );
}

async function ServicesTab({ category }: { category?: string }) {
  const t = await getTranslations("services");
  const [services, categories, viewer] = await Promise.all([
    listServices(category),
    listServiceCategories(),
    getSessionUser(),
  ]);
  const returnPath = `/market?tab=services${category ? `&category=${encodeURIComponent(category)}` : ""}`;

  return (
    <>
      <p className="px-4 text-sm leading-6 text-muted-foreground" data-testid="services-notice">
        {t("vettingNotice")}
      </p>

      {categories.length > 0 && (
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 pt-4" aria-label={t("categories")}>
          <Link
            href="/market?tab=services"
            aria-current={!category ? "page" : undefined}
            className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm ${!category ? "border-primary bg-primary/10" : "border-input"}`}
          >
            {t("allCategories")}
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/market?tab=services&category=${encodeURIComponent(c)}`}
              aria-current={category === c ? "page" : undefined}
              className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm ${category === c ? "border-primary bg-primary/10" : "border-input"}`}
            >
              {t(`category.${c}`)}
            </Link>
          ))}
        </nav>
      )}

      <div className="px-4 pb-8 pt-4">
        {services.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="services-empty">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="services-list">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} viewerId={viewer?.id} returnPath={returnPath} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

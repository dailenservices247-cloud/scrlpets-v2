import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { SavedSearchPanel } from "@/components/search/SavedSearchPanel";
import { getSessionUser } from "@/lib/auth/session";
import { parsePriceCents } from "@/lib/compose/validation";
import {
  hasActiveFilters,
  listListedSpecies,
  listSavedSearches,
  search,
} from "@/lib/search/queries";

type ListingKind = "sale" | "adoption";

function parseKind(raw?: string): ListingKind | undefined {
  return raw === "sale" || raw === "adoption" ? raw : undefined;
}

// R11: public search across people, brands, animals, listings (guest-allowed
// per G1-A: discovery is open). V7-04 adds server-side listing filters that
// live in the URL; V2-04 adds the saved-search panel below the form.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; species?: string; kind?: string; minPrice?: string; maxPrice?: string }>;
}) {
  const t = await getTranslations("search");
  const { q, species, kind, minPrice, maxPrice } = await searchParams;
  const query = q ?? "";
  const listingKind = parseKind(kind);
  const minPriceCents = minPrice ? (parsePriceCents(minPrice) ?? undefined) : undefined;
  const maxPriceCents = maxPrice ? (parsePriceCents(maxPrice) ?? undefined) : undefined;
  const filters = { species: species?.trim() || undefined, listingKind, minPriceCents, maxPriceCents };
  const filtersActive = hasActiveFilters(filters);

  const [results, viewer, speciesOptions] = await Promise.all([
    search(query, filters),
    getSessionUser(),
    listListedSpecies(),
  ]);
  const savedSearches = viewer ? await listSavedSearches(viewer.id) : [];
  const total =
    results.people.length + results.brands.length + results.animals.length + results.listings.length;

  const returnParams = new URLSearchParams();
  if (query) returnParams.set("q", query);
  if (filters.species) returnParams.set("species", filters.species);
  if (listingKind) returnParams.set("kind", listingKind);
  if (minPrice) returnParams.set("minPrice", minPrice);
  if (maxPrice) returnParams.set("maxPrice", maxPrice);
  const returnPath = `/search${returnParams.toString() ? `?${returnParams.toString()}` : ""}`;

  return (
    <AppPage>
      <div className="px-3 pt-4">
        <form action="/search" className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            data-testid="search-input"
            className="min-h-11 flex-1 basis-full rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <input
            type="text"
            name="species"
            defaultValue={species ?? ""}
            placeholder={t("filters.species")}
            aria-label={t("filters.species")}
            list="species-options"
            data-testid="search-filter-species"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <datalist id="species-options">
            {speciesOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <select
            name="kind"
            defaultValue={listingKind ?? ""}
            aria-label={t("filters.kind")}
            data-testid="search-filter-kind"
            className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("filters.kindAny")}</option>
            <option value="sale">{t("filters.kindSale")}</option>
            <option value="adoption">{t("filters.kindAdoption")}</option>
          </select>
          <input
            type="text"
            inputMode="decimal"
            name="minPrice"
            defaultValue={minPrice ?? ""}
            placeholder={t("filters.minPrice")}
            aria-label={t("filters.minPrice")}
            data-testid="search-filter-min-price"
            className="min-h-11 w-24 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <input
            type="text"
            inputMode="decimal"
            name="maxPrice"
            defaultValue={maxPrice ?? ""}
            placeholder={t("filters.maxPrice")}
            aria-label={t("filters.maxPrice")}
            data-testid="search-filter-max-price"
            className="min-h-11 w-24 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link"
            data-testid="search-submit"
          >
            {t("submit")}
          </button>
        </form>
      </div>

      <SavedSearchPanel
        viewerSignedIn={Boolean(viewer)}
        returnPath={returnPath}
        currentQuery={query}
        currentFilters={{
          species: filters.species ?? null,
          listingKind: listingKind ?? null,
          minPriceCents: minPriceCents ?? null,
          maxPriceCents: maxPriceCents ?? null,
        }}
        savedSearches={savedSearches}
      />

      {total === 0 && (query.trim().length >= 2 || filtersActive) && (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground" data-testid="search-empty">
          {query.trim().length >= 2 ? t("noResults", { query }) : t("noFilterResults")}
        </p>
      )}

      <div className="flex flex-col gap-4 p-3" data-testid="search-results">
        {results.people.length > 0 && (
          <section>
            <p className="eyebrow mb-2">{t("people")}</p>
            <ul className="flex flex-col gap-2">
              {results.people.map((p) => (
                <li key={p.username}>
                  <Link
                    href={`/u/${p.username}`}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
                    data-testid="search-person"
                  >
                    <span className="grid size-9 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-brand-link">
                      {(p.displayName ?? p.username).charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{p.displayName ?? p.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {results.brands.length > 0 && (
          <section>
            <p className="eyebrow mb-2">{t("brands")}</p>
            <ul className="flex flex-col gap-2">
              {results.brands.map((b) => (
                <li key={b.slug}>
                  <Link href={`/b/${b.slug}`} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3" data-testid="search-brand">
                    <span className="text-sm font-medium">{b.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {results.animals.length > 0 && (
          <section>
            <p className="eyebrow mb-2">{t("animals")}</p>
            <ul className="flex flex-col gap-2">
              {results.animals.map((a) => (
                <li key={a.slug}>
                  <Link href={`/c/${a.slug}`} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-3" data-testid="search-animal">
                    <span className="text-sm font-medium">{a.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {results.listings.length > 0 && (
          <section>
            <p className="eyebrow mb-2">{t("listings")}</p>
            <ul className="flex flex-col gap-2">
              {results.listings.map((l) => (
                <li key={l.id}>
                  <Link href={`/listing/${l.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-3" data-testid="search-listing">
                    <span className="text-sm font-medium">{l.title}</span>
                    {l.priceCents !== null && (
                      <span className="text-sm text-muted-foreground">
                        ${(l.priceCents / 100).toFixed(2)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppPage>
  );
}

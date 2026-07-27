import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { search } from "@/lib/search/queries";

// R11: public search across people, brands, animals, listings (guest-allowed
// per G1-A: discovery is open).
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const t = await getTranslations("search");
  const { q } = await searchParams;
  const query = q ?? "";
  const results = await search(query);
  const total =
    results.people.length + results.brands.length + results.animals.length + results.listings.length;

  return (
    <AppPage>
      <div className="px-3 pt-4">
        <form action="/search" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            data-testid="search-input"
            className="min-h-11 flex-1 rounded-xl border border-input bg-transparent px-3 text-sm"
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

      {query.trim().length >= 2 && total === 0 && (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground" data-testid="search-empty">
          {t("noResults", { query })}
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

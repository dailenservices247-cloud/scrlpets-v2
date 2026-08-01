import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { BookmarkButton } from "@/components/guides/BookmarkButton";
import { getSessionUser } from "@/lib/auth/session";
import {
  getMyBookmarkedGuideIds,
  listGuideFacets,
  listGuides,
} from "@/lib/guides/queries";

export const metadata = {
  title: "Guides",
  description: "Care, breeding and buying guides on Scrlpets.",
};

// D5: public education surface. Empty until Dailen approves and publishes.
// E adds free-text search, category and species filters, and a private reading
// list — all in the URL, matching how /search does it, so a filtered view is
// shareable and the back button behaves.
export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; species?: string; saved?: string }>;
}) {
  const t = await getTranslations("guides");
  const { q, category, species, saved } = await searchParams;
  const viewer = await getSessionUser();
  // A guest asking for `?saved=1` has no reading list to show, so the flag is
  // dropped rather than rendering an empty state that implies one exists.
  const savedOnly = saved === "1" && Boolean(viewer);
  const bookmarked = viewer ? await getMyBookmarkedGuideIds() : new Set<string>();

  const [guides, facets] = await Promise.all([
    listGuides({
      q,
      category: category?.trim() || undefined,
      species: species?.trim() || undefined,
      onlyIds: savedOnly ? [...bookmarked] : undefined,
    }),
    listGuideFacets(),
  ]);
  const filtered = Boolean(q?.trim() || category || species || savedOnly);

  return (
    <AppPage>
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

        <form action="/guides" className="mt-4 flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            data-testid="guides-search-input"
            className="min-h-11 flex-1 basis-full rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          {/* Facets render only when guides actually carry those values — an
              empty dropdown is a promise the content does not keep. */}
          {facets.categories.length > 0 && (
            <select
              name="category"
              defaultValue={category ?? ""}
              aria-label={t("filterCategory")}
              data-testid="guides-filter-category"
              className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("anyCategory")}</option>
              {facets.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {facets.species.length > 0 && (
            <select
              name="species"
              defaultValue={species ?? ""}
              aria-label={t("filterSpecies")}
              data-testid="guides-filter-species"
              className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("anySpecies")}</option>
              {facets.species.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {viewer && (
            <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-input px-3 text-sm">
              <input
                type="checkbox"
                name="saved"
                value="1"
                defaultChecked={savedOnly}
                data-testid="guides-filter-saved"
                className="size-4"
              />
              {t("onlySaved")}
            </label>
          )}
          <button
            type="submit"
            data-testid="guides-search-submit"
            className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link"
          >
            {t("searchSubmit")}
          </button>
        </form>

        {guides.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground" data-testid="guides-empty">
            {filtered ? t("noMatches") : t("empty")}
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3" data-testid="guides-list">
            {guides.map((g) => (
              <li
                key={g.slug}
                className="rounded-2xl border bg-card p-4"
                data-testid="guides-list-item"
              >
                <Link href={`/guides/${g.slug}`} className="block">
                  <p className="eyebrow">{t(`audience.${g.audience}`)}</p>
                  <p className="mt-1 font-semibold">{g.title}</p>
                  {g.summary && <p className="mt-1 text-sm text-muted-foreground">{g.summary}</p>}
                </Link>
                {/* Omitted entirely for a guest reading an uncategorised list,
                    rather than left as an empty gap under every card. */}
                {(viewer || g.category || g.species) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {g.category && (
                      <span className="rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                        {g.category}
                      </span>
                    )}
                    {g.species && (
                      <span className="rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                        {g.species}
                      </span>
                    )}
                    {viewer && (
                      <span className="ml-auto">
                        <BookmarkButton
                          guideId={g.id}
                          bookmarked={bookmarked.has(g.id)}
                          label={g.title}
                        />
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppPage>
  );
}

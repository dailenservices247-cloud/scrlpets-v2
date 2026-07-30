"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/shop/format";
import { deleteSavedSearch, saveSearch, setSavedSearchAlerts } from "@/lib/search/actions";
import type { SavedSearch } from "@/lib/search/queries";

const SAVED_SEARCH_CAP = 20;

type CurrentFilters = {
  species: string | null;
  listingKind: "sale" | "adoption" | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
};

function errorKey(error: string): string {
  const keys = ["cap_reached", "auth_required", "name"];
  return keys.find((key) => key === error) ?? "failed";
}

function summarize(
  s: Pick<SavedSearch, "query" | "species" | "listingKind" | "minPriceCents" | "maxPriceCents">,
  t: ReturnType<typeof useTranslations>,
): string {
  const parts: string[] = [];
  if (s.query) parts.push(`"${s.query}"`);
  if (s.species) parts.push(s.species);
  if (s.listingKind) parts.push(t(s.listingKind === "sale" ? "filters.kindSale" : "filters.kindAdoption"));
  if (s.minPriceCents != null || s.maxPriceCents != null) {
    const min = s.minPriceCents != null ? formatPrice(s.minPriceCents, "usd") : null;
    const max = s.maxPriceCents != null ? formatPrice(s.maxPriceCents, "usd") : null;
    parts.push(min && max ? `${min}–${max}` : min ? `${t("filters.minPrice")} ${min}` : `${t("filters.maxPrice")} ${max}`);
  }
  return parts.length > 0 ? parts.join(" · ") : t("saved.anyListing");
}

export function SavedSearchPanel({
  viewerSignedIn,
  returnPath,
  currentQuery,
  currentFilters,
  savedSearches,
}: {
  viewerSignedIn: boolean;
  returnPath: string;
  currentQuery: string;
  currentFilters: CurrentFilters;
  savedSearches: SavedSearch[];
}) {
  const t = useTranslations("search");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!viewerSignedIn) {
    return (
      <div className="px-3 pb-2">
        <Link
          href={`/login?next=${encodeURIComponent(returnPath)}`}
          className="text-sm text-brand-link underline"
          data-testid="save-search-signin"
        >
          {t("saved.signInPrompt")}
        </Link>
      </div>
    );
  }

  const atCap = savedSearches.length >= SAVED_SEARCH_CAP;

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await saveSearch({
      name,
      query: currentQuery,
      species: currentFilters.species,
      listingKind: currentFilters.listingKind,
      minPriceCents: currentFilters.minPriceCents,
      maxPriceCents: currentFilters.maxPriceCents,
      notifyEnabled,
    });
    setBusy(false);
    if (!result.ok) {
      setError(errorKey(result.error));
      return;
    }
    setOpen(false);
    setName("");
    setNotifyEnabled(true);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await deleteSavedSearch(id);
    setBusy(false);
    router.refresh();
  }

  async function toggleAlerts(id: string, next: boolean) {
    setBusy(true);
    await setSavedSearchAlerts(id, next);
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="premium-panel mx-3 mb-3 rounded-2xl p-4" data-testid="saved-search-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{t("saved.eyebrow")}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("saved.explanation")}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground" data-testid="saved-search-count">
          {t("saved.countHint", { count: savedSearches.length, cap: SAVED_SEARCH_CAP })}
        </span>
      </div>

      {savedSearches.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" data-testid="saved-search-list">
          {savedSearches.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-border/70 bg-muted/25 p-3"
              data-testid="saved-search-row"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{summarize(s, t)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    data-testid={s.notifyEnabled ? "saved-search-alerts-on" : "saved-search-alerts-off"}
                    onClick={() => toggleAlerts(s.id, !s.notifyEnabled)}
                  >
                    {s.notifyEnabled ? t("saved.alertsOn") : t("saved.alertsOff")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    data-testid="saved-search-delete"
                    onClick={() => remove(s.id)}
                  >
                    {t("saved.delete")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {savedSearches.length === 0 && !open && (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="saved-search-empty">
          {t("saved.empty")}
        </p>
      )}

      {open ? (
        <div className="mt-3 rounded-xl border border-border/70 bg-muted/25 p-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("saved.nameLabel")}
            <input
              value={name}
              maxLength={80}
              placeholder={t("saved.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
              data-testid="save-search-name"
              className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={notifyEnabled}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
              data-testid="save-search-notify"
            />
            {t("saved.notifyLabel")}
          </label>
          <div className="mt-3 flex gap-2">
            <Button
              className="min-h-11"
              disabled={busy || !name.trim()}
              data-testid="save-search-submit"
              onClick={submit}
            >
              {busy ? t("saved.saving") : t("saved.submit")}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              data-testid="save-search-cancel"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              {t("saved.cancel")}
            </Button>
          </div>
        </div>
      ) : atCap ? (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="saved-search-cap-reached">
          {t("saved.capReached")}
        </p>
      ) : (
        <Button
          variant="secondary"
          className="mt-3 min-h-11"
          data-testid="save-search-trigger"
          onClick={() => setOpen(true)}
        >
          {t("saved.action")}
        </Button>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert" data-testid="save-search-error">
          {t(`saved.errors.${error}`)}
        </p>
      )}
    </section>
  );
}

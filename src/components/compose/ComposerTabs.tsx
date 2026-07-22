"use client";
import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Building2,
  ChevronDown,
  Handshake,
  Megaphone,
  PenSquare,
  Scissors,
  Sparkles,
  Store,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PostForm } from "./PostForm";
import { ListingForm } from "./ListingForm";
import type { BrandAccess } from "@/lib/brands/queries";
import { cn } from "@/lib/utils";

export type ComposeAttribution = {
  postingAsType: "person" | "brand";
  brandId: string | null;
  aboutType: string;
};

type Mode = "post" | "listing" | "product" | "service" | "promotion" | "recommendation" | "collaboration";
type PostingAs = "person" | "brand";
type About = "none" | "animal" | "litter" | "product" | "service" | "brand" | "collaboration";

const modeOptions: {
  value: Mode;
  label: string;
  icon: typeof PenSquare;
  live: boolean;
}[] = [
  { value: "post", label: "Post", icon: PenSquare, live: true },
  { value: "listing", label: "Listing", icon: BadgeDollarSign, live: true },
  { value: "product", label: "Product", icon: Store, live: false },
  { value: "service", label: "Service", icon: Scissors, live: false },
  { value: "promotion", label: "Promotion", icon: Megaphone, live: false },
  { value: "recommendation", label: "Recommendation", icon: Sparkles, live: false },
  { value: "collaboration", label: "Collaboration", icon: Handshake, live: false },
];

const aboutOptions: { value: About; label: string }[] = [
  { value: "none", label: "No object" },
  { value: "animal", label: "Animal" },
  { value: "litter", label: "Litter" },
  { value: "product", label: "Product" },
  { value: "service", label: "Service" },
  { value: "brand", label: "Brand" },
  { value: "collaboration", label: "Collaboration" },
];

const modeLabels: Record<Mode, string> = Object.fromEntries(modeOptions.map((mode) => [mode.value, mode.label])) as Record<Mode, string>;

function normalizeMode(raw: string | null): Mode {
  return modeOptions.some((mode) => mode.value === raw) ? (raw as Mode) : "post";
}

// punch list A9: FB/IG-style quick post — type, photo, Post. The entity
// hierarchy (posting-as, subject, planned modes) stays REAL underneath but
// collapses to smart defaults behind "More options".
export function ComposerTabs({
  userId,
  actorName,
  creatures,
  brands,
}: {
  userId: string;
  actorName: string;
  creatures: { id: string; name: string }[];
  brands: BrandAccess[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = normalizeMode(searchParams.get("mode"));
  // ?brand= (set by createBrand's redirect) preselects that brand and flips identity to Brand.
  const requestedBrandId = searchParams.get("brand");
  const requestedBrand = brands.find((b) => b.id === requestedBrandId) ?? null;
  const [postingAs, setPostingAs] = useState<PostingAs>(requestedBrand ? "brand" : "person");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(
    requestedBrand?.id ?? brands[0]?.id ?? null,
  );
  const [about, setAbout] = useState<About>(() => (searchParams.get("mode") === "listing" ? "animal" : "none"));
  // Arriving from brand creation expands the options so the preselected
  // identity is visible; everyone else gets the quick-post surface.
  const [showOptions, setShowOptions] = useState<boolean>(!!requestedBrand);
  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? null;
  const postingLabel = postingAs === "brand" ? (selectedBrand?.name ?? "Select a brand") : actorName;
  const attribution = {
    postingAsType: postingAs,
    brandId: postingAs === "brand" ? selectedBrandId : null,
    aboutType: about,
  };
  // matrix row 3: a contributor cannot post as a restricted brand.
  const brandReady =
    postingAs === "person" ||
    (postingAs === "brand" && !!selectedBrandId && (selectedBrand?.canPostAs ?? false));
  const subjectLabel = useMemo(() => {
    const firstAnimal = creatures[0]?.name ?? "Animal";
    const map: Record<About, string> = {
      none: "General update",
      animal: firstAnimal,
      litter: "Litter context",
      product: "Product",
      service: "Service",
      brand: postingLabel,
      collaboration: "Partner brand",
    };
    return map[about];
  }, [about, creatures, postingLabel]);

  function selectMode(next: string) {
    const mode = normalizeMode(next);
    if (mode === "listing") setAbout("animal");
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", mode);
    router.replace(`/compose?${params.toString()}`, { scroll: false });
  }

  const liveModes = modeOptions.filter((mode) => mode.live);

  return (
    <div className="space-y-3 px-3 pb-24" data-testid="composer-alignment">
      {/* Identity chip + the two live creation types, always visible. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowOptions((v) => !v)}
          className="flex min-h-11 items-center gap-2 rounded-full bg-muted/45 px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted"
          data-testid="posting-summary"
          aria-expanded={showOptions}
        >
          {postingAs === "brand" ? (
            <Building2 className="size-4 text-brand-link" aria-hidden />
          ) : (
            <UserRound className="size-4 text-brand-link" aria-hidden />
          )}
          <span className="max-w-40 truncate">{postingLabel}</span>
          <ChevronDown className={cn("size-4 transition", showOptions && "rotate-180")} aria-hidden />
        </button>
        <div className="flex gap-1 rounded-full bg-muted/45 p-1" role="group" aria-label="Create">
          {liveModes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => selectMode(mode.value)}
              aria-pressed={tab === mode.value}
              className={cn(
                "min-h-9 rounded-full px-4 text-sm font-medium transition",
                tab === mode.value ? "bg-primary/15 text-brand-link" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* The quick-post surface: form first. */}
      <section className="premium-panel rounded-2xl p-4">
        {!brandReady && (tab === "post" || tab === "listing") && (
          <p className="mb-3 text-sm text-destructive" data-testid="brand-not-ready">
            Choose a brand in options before publishing as a brand.
          </p>
        )}
        {tab === "post" && <PostForm userId={userId} creatures={creatures} attribution={attribution} disabled={!brandReady} />}
        {tab === "listing" && <ListingForm userId={userId} creatures={creatures} attribution={attribution} disabled={!brandReady} />}
        {tab !== "post" && tab !== "listing" && (
          <PlannedModePanel mode={modeLabels[tab]} postingLabel={postingLabel} subjectLabel={subjectLabel} />
        )}
      </section>

      <button
        type="button"
        onClick={() => setShowOptions((v) => !v)}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-muted-foreground transition hover:bg-muted/40"
        data-testid="composer-more-options"
        aria-expanded={showOptions}
      >
        {showOptions ? "Hide options" : "More options"}
        <ChevronDown className={cn("size-4 transition", showOptions && "rotate-180")} aria-hidden />
      </button>

      {showOptions && (
        <div className="space-y-3">
          <section className="premium-panel rounded-2xl p-4" data-testid="posting-as-selector">
            <p className="eyebrow mb-2">Posting as</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPostingAs("person")}
                aria-pressed={postingAs === "person"}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  postingAs === "person" ? "border-primary/70 bg-primary/15" : "border-border/70 bg-muted/30",
                )}
              >
                <span className="block text-sm font-semibold">Person</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{actorName}</span>
              </button>
              <button
                type="button"
                onClick={() => setPostingAs("brand")}
                aria-pressed={postingAs === "brand"}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  postingAs === "brand" ? "border-primary/70 bg-primary/15" : "border-border/70 bg-muted/30",
                )}
              >
                <span className="block text-sm font-semibold">Brand</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {brands.length ? (selectedBrand?.name ?? "Choose a brand") : "No brands yet"}
                </span>
              </button>
            </div>
            {postingAs === "brand" && (
              <div className="mt-3" data-testid="brand-picker">
                {brands.length > 0 ? (
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs text-muted-foreground">Post as which brand</span>
                    <select
                      value={selectedBrandId ?? ""}
                      onChange={(e) => setSelectedBrandId(e.target.value || null)}
                      aria-label="Post as which brand"
                      data-testid="brand-select"
                      className="w-full rounded-xl border border-input bg-transparent p-2"
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id} disabled={!b.canPostAs}>
                          {b.name}
                          {b.canPostAs ? "" : " — admins only"}
                        </option>
                      ))}
                    </select>
                    {selectedBrand && !selectedBrand.canPostAs && (
                      <p
                        className="mt-2 text-xs text-muted-foreground"
                        role="note"
                        data-testid="brand-restricted-note"
                      >
                        Only admins and owners can post as this brand.
                      </p>
                    )}
                  </label>
                ) : (
                  <Link
                    href="/brands/new"
                    data-testid="create-brand-cta"
                    className="block rounded-xl border border-dashed border-input p-3 text-sm text-brand-link"
                  >
                    Create a brand to post as one →
                  </Link>
                )}
              </div>
            )}
          </section>

          <section className="premium-panel rounded-2xl p-4" data-testid="mode-selector">
            <p className="eyebrow mb-2">What are you creating?</p>
            <div className="flex flex-wrap gap-2">
              {modeOptions.map((mode) => {
                const Icon = mode.icon;
                const active = tab === mode.value;
                return (
                  <button
                    type="button"
                    key={mode.value}
                    onClick={() => selectMode(mode.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition",
                      active ? "border-primary/70 bg-primary/15 text-brand-link" : "border-border/70 bg-muted/30 text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {mode.label}
                    {!mode.live && (
                      <span className="rounded-md border border-border/70 px-1 py-0.5 text-[10px]">Planned</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="premium-panel rounded-2xl p-4" data-testid="about-selector">
            <p className="eyebrow mb-2">About</p>
            <div className="flex flex-wrap gap-2">
              {aboutOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAbout(option.value)}
                  aria-pressed={about === option.value}
                  className={cn(
                    "min-h-11 rounded-full border px-3 text-sm font-medium transition",
                    about === option.value ? "border-accent/70 bg-accent/15" : "border-border/70 bg-muted/30 text-muted-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <p
            className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground"
            data-testid="attribution-preview"
          >
            <span className="font-semibold text-foreground">{postingLabel}</span>
            {" · "}
            {subjectLabel}
            {" · "}
            {modeLabels[tab]}
          </p>
        </div>
      )}
    </div>
  );
}

function PlannedModePanel({
  mode,
  postingLabel,
  subjectLabel,
}: {
  mode: string;
  postingLabel: string;
  subjectLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-4" data-testid="planned-mode-panel">
      <p className="eyebrow">Prepared mode</p>
      <h2 className="mt-1 text-xl font-semibold">{mode}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        This mode is mapped for Brand OS, feed, profile, and marketplace behavior. The current slice shows how it should be
        attributed before adding schema and publishing.
      </p>
      <div className="mt-4 rounded-xl border border-border/70 bg-background/20 p-3 text-sm">
        <span className="text-muted-foreground">Preview: </span>
        <span className="font-semibold">{postingLabel}</span>
        <span className="text-muted-foreground"> / </span>
        <span className="font-semibold">{subjectLabel}</span>
        <span className="text-muted-foreground"> / </span>
        <span className="font-semibold">{mode}</span>
      </div>
    </div>
  );
}

"use client";
import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Building2,
  Megaphone,
  PenSquare,
  Store,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PostForm } from "./PostForm";
import { ListingForm } from "./ListingForm";
import type { BrandAccess } from "@/lib/brands/queries";
import type { MyGroup } from "@/lib/groups/queries";
import { cn } from "@/lib/utils";

export type ComposeAttribution = {
  postingAsType: "person" | "brand";
  brandId: string | null;
  aboutType: string;
  aboutId: string | null;
};

export type SubjectOption = { id: string; name: string; brandId?: string | null };
export type ComposerSubjects = {
  litters: SubjectOption[];
  services: SubjectOption[];
  products: SubjectOption[];
};

type Mode = "post" | "listing";
type PostingAs = "person" | "brand";
type About = "none" | "product" | "brand" | "litter" | "service";

const modeOptions: {
  value: Mode;
  label: string;
  icon: typeof PenSquare;
}[] = [
  { value: "post", label: "Post", icon: PenSquare },
  { value: "listing", label: "Animal Listing", icon: BadgeDollarSign },
];

function normalizeMode(raw: string | null): Mode {
  if (raw === "listing") return "listing";
  return "post";
}

// punch list A9: FB/IG-style quick post — type, photo, Post. The entity
// hierarchy (posting-as, subject, planned modes) stays REAL underneath but
// collapses to smart defaults behind "More options".
export function ComposerTabs({
  userId,
  actorName,
  creatures,
  brands,
  subjects,
  groups = [],
  activeBrandId = null,
}: {
  userId: string;
  actorName: string;
  creatures: { id: string; name: string }[];
  brands: BrandAccess[];
  subjects: ComposerSubjects;
  groups?: MyGroup[];
  activeBrandId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = normalizeMode(searchParams.get("mode") ?? searchParams.get("type"));
  // ?brand= (set by createBrand's redirect) preselects that brand and flips identity to Brand;
  // otherwise, inherits the user's active persona if they switched in the Menu.
  const requestedBrandId = searchParams.get("brand") ?? activeBrandId;
  const requestedBrand = brands.find((b) => b.id === requestedBrandId) ?? null;
  const [postingAs, setPostingAs] = useState<PostingAs>(requestedBrand ? "brand" : "person");
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(
    requestedBrand?.id ?? brands[0]?.id ?? null,
  );
  const [about, setAbout] = useState<About>("none");
  const [aboutId, setAboutId] = useState<string | null>(null);
  const selectedBrand = brands.find((b) => b.id === selectedBrandId) ?? null;
  const postingLabel = postingAs === "brand" ? (selectedBrand?.name ?? "Select a brand") : actorName;
  // A non-none subject must carry its entity id (the DB trigger enforces it too).
  const attribution = {
    postingAsType: postingAs,
    brandId: postingAs === "brand" ? selectedBrandId : null,
    aboutType: about !== "none" && !aboutId ? "none" : about,
    aboutId: about !== "none" ? aboutId : null,
  };
  // matrix row 3: a contributor cannot post as a restricted brand.
  const brandReady =
    postingAs === "person" ||
    (postingAs === "brand" && !!selectedBrandId && (selectedBrand?.canPostAs ?? false));
  const subjectPools: Record<Exclude<About, "none">, SubjectOption[]> = useMemo(
    () => ({
      product: subjects.products,
      brand: brands.map((b) => ({ id: b.id, name: b.name })),
      litter: subjects.litters,
      service: subjects.services,
    }),
    [subjects, brands],
  );
  const subjectLabel = useMemo(() => {
    if (about === "none") return "General update";
    const pool = subjectPools[about];
    return pool.find((e) => e.id === aboutId)?.name ?? "Pick one";
  }, [about, aboutId, subjectPools]);

  function selectMode(next: string) {
    const mode = normalizeMode(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", mode);
    router.replace(`/compose?${params.toString()}`, { scroll: false });
  }

  function handleSetPostingAs(next: PostingAs) {
    setPostingAs(next);
  }

  const liveModes = modeOptions;

  return (
    <div className="space-y-4 px-3 pb-24" data-testid="composer-alignment">
      {/* Top Bar: Persona Switcher & Creation Modes */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {brands.length > 0 ? (
          <div
            className="flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 p-1"
            data-testid="posting-as-selector"
          >
            <button
              type="button"
              onClick={() => handleSetPostingAs("person")}
              aria-pressed={postingAs === "person"}
              className={cn(
                "flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
                postingAs === "person"
                  ? "bg-primary/20 text-brand-link shadow-xs"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <UserRound className="size-3.5" />
              <span>{actorName}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetPostingAs("brand")}
              aria-pressed={postingAs === "brand"}
              className={cn(
                "flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition",
                postingAs === "brand"
                  ? "bg-primary/20 text-brand-link shadow-xs"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Building2 className="size-3.5" />
              <span>{selectedBrand?.name ?? "Brand"}</span>
            </button>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-1"
            data-testid="posting-as-selector"
          >
            <UserRound className="size-4 text-brand-link" />
            <span>Posting as {actorName}</span>
          </div>
        )}

        {/* Primary Social Creation Modes: Post vs Animal Listing */}
        <div
          className="flex gap-1 rounded-full bg-muted/45 p-1"
          role="group"
          aria-label="Create"
          data-testid="mode-selector"
        >
          {liveModes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => selectMode(mode.value)}
              aria-pressed={tab === mode.value}
              className={cn(
                "min-h-9 rounded-full px-4 text-sm font-semibold transition",
                tab === mode.value
                  ? "bg-primary/20 text-brand-link shadow-xs"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Brand picker if brand mode is active */}
      {postingAs === "brand" && (
        <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5" data-testid="brand-picker">
          {brands.length > 0 ? (
            <label className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-muted-foreground">Post as which brand:</span>
              <select
                value={selectedBrandId ?? ""}
                onChange={(e) => setSelectedBrandId(e.target.value || null)}
                aria-label="Post as which brand"
                data-testid="brand-select"
                className="rounded-lg border border-input bg-card py-1 px-2.5 text-xs font-semibold text-foreground"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id} disabled={!b.canPostAs}>
                    {b.name}
                    {b.canPostAs ? "" : " — admins only"}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <Link
              href="/brands/new"
              data-testid="create-brand-cta"
              className="block text-center text-xs text-brand-link hover:underline"
            >
              Create a brand to post as one →
            </Link>
          )}
        </div>
      )}

      {/* Optional Subject Tagging (Outside More Options) */}
      {(subjects.litters.length > 0 || subjects.services.length > 0) && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs"
          data-testid="about-selector"
        >
          <span className="font-medium text-muted-foreground">Attach topic:</span>
          <button
            type="button"
            onClick={() => {
              setAbout("none");
              setAboutId(null);
            }}
            aria-pressed={about === "none"}
            className={cn(
              "rounded-lg px-2.5 py-1 font-medium transition",
              about === "none"
                ? "bg-primary/20 text-brand-link font-semibold"
                : "bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            None
          </button>
          {subjects.litters.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setAbout("litter");
                setAboutId(subjects.litters[0]?.id || null);
              }}
              aria-pressed={about === "litter"}
              data-testid="about-litter"
              className={cn(
                "rounded-lg px-2.5 py-1 font-medium transition",
                about === "litter"
                  ? "bg-accent/20 text-accent font-semibold"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted",
              )}
            >
              🐾 Litter
            </button>
          )}
          {about !== "none" && (
            <select
              value={aboutId ?? ""}
              onChange={(e) => setAboutId(e.target.value || null)}
              aria-label="Which one"
              data-testid="subject-select"
              className="rounded-lg border border-input bg-card py-1 px-2 text-xs font-semibold text-foreground"
            >
              <option value="">Select subject</option>
              {subjectPools[about].map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          )}
          <span className="ml-auto text-micro text-muted-foreground" data-testid="attribution-preview">
            {postingLabel} · {subjectLabel}
          </span>
        </div>
      )}

      {/* The quick-post surface: form first. */}
      <section className="premium-panel rounded-2xl p-4">
        {!brandReady && (tab === "post" || tab === "listing") && (
          <p className="mb-3 text-sm text-destructive" data-testid="brand-not-ready">
            Choose a brand before publishing as a brand.
          </p>
        )}
        {tab === "post" && (
          <PostForm
            userId={userId}
            creatures={creatures}
            attribution={attribution}
            groups={groups}
            disabled={!brandReady}
          />
        )}
        {tab === "listing" && (
          <ListingForm
            userId={userId}
            creatures={creatures}
            attribution={attribution}
            disabled={!brandReady}
          />
        )}
      </section>

      {/* Helpful context footer linking to Brand OS, Market & Ad Studio */}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-center sm:text-left sm:flex sm:items-center sm:justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-foreground">
            Selling pet supplies, offering a service, or launching sponsored promo?
          </p>
          <p className="text-micro text-muted-foreground">
            Manage your commercial catalog, booking rates, and sponsored campaigns in Brand OS.
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-center gap-2 pt-2 sm:pt-0">
          <Link
            href="/brand-os?tab=promotions"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-input px-3 text-xs font-medium text-foreground transition hover:bg-muted/60"
          >
            <Megaphone className="size-3.5 text-accent" />
            Ad Studio
          </Link>
          <Link
            href="/brand-os"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-input px-3 text-xs font-medium text-foreground transition hover:bg-muted/60"
          >
            <Building2 className="size-3.5 text-muted-foreground" />
            Brand OS
          </Link>
          <Link
            href="/market/offer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary/15 px-3 text-xs font-semibold text-brand-link transition hover:bg-primary/25"
          >
            <Store className="size-3.5" />
            Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}

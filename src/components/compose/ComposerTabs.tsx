"use client";
import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Boxes,
  Building2,
  Handshake,
  Megaphone,
  PawPrint,
  PenSquare,
  Scissors,
  Sparkles,
  Store,
  UserRound,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PostForm } from "./PostForm";
import { ListingForm } from "./ListingForm";
import { cn } from "@/lib/utils";

type Mode = "post" | "listing" | "product" | "service" | "promotion" | "recommendation" | "collaboration";
type PostingAs = "person" | "brand";
type About = "none" | "animal" | "litter" | "product" | "service" | "brand" | "collaboration";

const modeOptions: {
  value: Mode;
  label: string;
  description: string;
  icon: typeof PenSquare;
  live: boolean;
}[] = [
  { value: "post", label: "Post", description: "Social update, story, education", icon: PenSquare, live: true },
  { value: "listing", label: "Listing", description: "Animal or offer with intent", icon: BadgeDollarSign, live: true },
  { value: "product", label: "Product", description: "Shop item or care product", icon: Store, live: false },
  { value: "service", label: "Service", description: "Training, grooming, consult", icon: Scissors, live: false },
  { value: "promotion", label: "Promotion", description: "Boosted object or campaign", icon: Megaphone, live: false },
  { value: "recommendation", label: "Recommendation", description: "Suggested care item or fit", icon: Sparkles, live: false },
  { value: "collaboration", label: "Collaboration", description: "Two brands, one shared context", icon: Handshake, live: false },
];

const aboutOptions: { value: About; label: string; description: string }[] = [
  { value: "none", label: "No object", description: "General brand/person update" },
  { value: "animal", label: "Animal", description: "Anchor around one animal" },
  { value: "litter", label: "Litter", description: "Breeding or group context" },
  { value: "product", label: "Product", description: "Shop or care item" },
  { value: "service", label: "Service", description: "Offer or appointment path" },
  { value: "brand", label: "Brand", description: "Company/kennel/shop context" },
  { value: "collaboration", label: "Collaboration", description: "Partner brand context" },
];

const modeLabels: Record<Mode, string> = Object.fromEntries(modeOptions.map((mode) => [mode.value, mode.label])) as Record<Mode, string>;

function normalizeMode(raw: string | null): Mode {
  return modeOptions.some((mode) => mode.value === raw) ? (raw as Mode) : "post";
}

export function ComposerTabs({
  userId,
  actorName,
  creatures,
}: {
  userId: string;
  actorName: string;
  creatures: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = normalizeMode(searchParams.get("mode"));
  const [postingAs, setPostingAs] = useState<PostingAs>("brand");
  const [about, setAbout] = useState<About>(() => (searchParams.get("mode") === "listing" ? "animal" : "none"));
  const postingLabel = postingAs === "brand" ? "Blue River Kennels" : actorName;
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

  return (
    <div className="space-y-4 px-3 pb-24" data-testid="composer-alignment">
        <section className="premium-panel rounded-2xl p-4" data-testid="posting-as-selector">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-primary/35 bg-primary/15 text-brand-link">
              <UserRound className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Posting as</p>
              <h2 className="text-lg font-semibold">Choose the identity</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPostingAs("person")}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                postingAs === "person" ? "border-primary/70 bg-primary/15" : "border-border/70 bg-muted/30",
              )}
            >
              <UserRound className="mb-3 size-5 text-brand-link" aria-hidden />
              <span className="block text-sm font-semibold">Person</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{actorName}</span>
            </button>
            <button
              type="button"
              onClick={() => setPostingAs("brand")}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                postingAs === "brand" ? "border-primary/70 bg-primary/15" : "border-border/70 bg-muted/30",
              )}
            >
              <Building2 className="mb-3 size-5 text-brand-link" aria-hidden />
              <span className="block text-sm font-semibold">Brand</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">Blue River Kennels</span>
            </button>
          </div>
        </section>

        <section className="premium-panel rounded-2xl p-4" data-testid="mode-selector">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-secondary/35 bg-secondary/20 text-secondary-foreground">
              <Boxes className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Mode</p>
              <h2 className="text-lg font-semibold">What are you creating?</h2>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
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
                    "min-h-28 rounded-xl border p-3 text-left transition",
                    active ? "border-primary/70 bg-primary/15" : "border-border/70 bg-muted/30",
                  )}
                >
                  <span className="flex w-full flex-col items-start">
                    <span className="flex w-full items-center justify-between gap-2">
                      <Icon className="size-4 text-brand-link" aria-hidden />
                      {!mode.live && <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">Planned</span>}
                    </span>
                    <span className="mt-2 text-sm font-semibold">{mode.label}</span>
                    <span className="mt-1 text-xs font-normal leading-5 text-muted-foreground">{mode.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="premium-panel rounded-2xl p-4" data-testid="about-selector">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-accent/35 bg-accent/15 text-accent">
              <PawPrint className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">About</p>
              <h2 className="text-lg font-semibold">Choose the subject</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {aboutOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAbout(option.value)}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  about === option.value ? "border-accent/70 bg-accent/15" : "border-border/70 bg-muted/30",
                )}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </section>

        <AttributionPreview actorName={actorName} postingLabel={postingLabel} subjectLabel={subjectLabel} modeLabel={modeLabels[tab]} />

        <section className="premium-panel rounded-2xl p-4">
          {tab === "post" && <PostForm userId={userId} creatures={creatures} />}
          {tab === "listing" && <ListingForm userId={userId} creatures={creatures} />}
          {tab !== "post" && tab !== "listing" && (
            <PlannedModePanel mode={modeLabels[tab]} postingLabel={postingLabel} subjectLabel={subjectLabel} />
          )}
        </section>
      </div>
  );
}

function AttributionPreview({
  actorName,
  postingLabel,
  subjectLabel,
  modeLabel,
}: {
  actorName: string;
  postingLabel: string;
  subjectLabel: string;
  modeLabel: string;
}) {
  const steps = [
    { label: "Actor", value: actorName },
    { label: "Posting as", value: postingLabel },
    { label: "About", value: subjectLabel },
    { label: "Intent", value: modeLabel },
  ];

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="attribution-preview">
      <p className="eyebrow">Public preview</p>
      <h2 className="mt-1 text-lg font-semibold">How this will read</h2>
      <div className="mt-3 grid gap-2">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background/35 text-sm font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground">{step.label}</span>
              <span className="block truncate text-sm font-semibold">{step.value}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
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

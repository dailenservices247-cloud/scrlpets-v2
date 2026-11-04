"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Globe,
  Megaphone,
  Plus,
  Rocket,
  Sparkles,
  Tag,
} from "lucide-react";
import type { MyPromoCampaign } from "@/lib/promotions/queries";
import { createSponsoredCampaignAction } from "@/lib/promotions/actions";
import { cn } from "@/lib/utils";

type BrandOption = { id: string; name: string };

const OBJECTIVE_PRESETS = [
  {
    id: "app",
    label: "App / Game Launch",
    category: "APP STORE",
    cta: "Sign up",
    actionLink: "Sign up",
    sampleHeadline: "📱 Play MHO on Mobile 🎮",
    sampleCaption: "🎉 MHO Is Officially Live! ⚔️ Hunt & explore. A new adventure awaits on your phone.",
  },
  {
    id: "supplies",
    label: "Pet Supplies & Products",
    category: "PET SUPPLIES",
    cta: "Shop now",
    actionLink: "Shop now",
    sampleHeadline: "🥩 100% Organic Raw Feeding & Toppers",
    sampleCaption: "Give your pack the nutrition they crave. Nutrient-dense, single-source raw meals shipped direct to your door.",
  },
  {
    id: "services",
    label: "Professional Pet Services",
    category: "PET SERVICES",
    cta: "Book now",
    actionLink: "Book now",
    sampleHeadline: "✂️ Mobile Grooming & Spa Direct to You",
    sampleCaption: "Stress-free, certified grooming right in your driveway. Book your pet's appointment online in seconds.",
  },
  {
    id: "announcement",
    label: "Breeder & Kennel Announcement",
    category: "DANU'S ARK",
    cta: "Learn more",
    actionLink: "View litter",
    sampleHeadline: "🏆 AKC Champion Line Puppies Reserved Now",
    sampleCaption: "Announcing our upcoming winter litter. OFA certified genetics, full health testing, and 2-year guarantee.",
  },
];

const BUDGET_TIERS = [
  { id: "starter", label: "Starter Boost", price: "$10", days: "3 Days", reach: "~1,000 Reach" },
  { id: "growth", label: "Growth Boost", price: "$25", days: "7 Days", reach: "~3,500 Reach" },
  { id: "pro", label: "Pro Sponsor", price: "$50", days: "14 Days", reach: "~8,000 Reach" },
  { id: "elite", label: "Elite Sponsor", price: "$100", days: "30 Days", reach: "~20,000 Reach" },
] as const;

export function PromotionsManagerPanel({
  promos,
  brands,
}: {
  promos: MyPromoCampaign[];
  brands: BrandOption[];
  userId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string>(brands[0]?.id || "");
  const [category, setCategory] = useState("APP STORE");
  const [headline, setHeadline] = useState("📱 Play MHO on Mobile 🎮");
  const [caption, setCaption] = useState(
    "🎉 MHO Is Officially Live! ⚔️ Hunt & explore. A new adventure awaits on your phone."
  );
  const [actionLinkText, setActionLinkText] = useState("Sign up");
  const [ctaText, setCtaText] = useState("Sign up");
  const [destinationUrl, setDestinationUrl] = useState("https://apps.apple.com");
  const [mediaUrl, setMediaUrl] = useState(
    "https://images.unsplash.com/photo-1544568100-847a948585b9?auto=format&fit=crop&w=1200&q=80"
  );
  const [tier, setTier] = useState<"starter" | "growth" | "pro" | "elite">("growth");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const applyPreset = (presetId: string) => {
    const p = OBJECTIVE_PRESETS.find((item) => item.id === presetId);
    if (!p) return;
    setCategory(p.category);
    setHeadline(p.sampleHeadline);
    setCaption(p.sampleCaption);
    setActionLinkText(p.actionLink);
    setCtaText(p.cta);
  };

  const handleLaunch = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const res = await createSponsoredCampaignAction({
        brandId: selectedBrandId || null,
        caption,
        headline,
        category,
        ctaText,
        destinationUrl,
        mediaUrl,
        actionLinkText,
        tier,
      });
      if (!res.ok) {
        setErrorMsg(res.error || "Failed to launch campaign.");
      } else {
        setSuccessMsg("Campaign funded & live in feed!");
        setTimeout(() => {
          setIsOpen(false);
          setSuccessMsg(null);
        }, 1500);
      }
    });
  };

  return (
    <div className="space-y-4" data-testid="promotions-manager-panel">
      {/* Header Banner */}
      <div className="premium-panel flex flex-col justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent">
              <Megaphone className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Meta-Style Ad Studio</p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Sponsored Campaigns & Paid Promos
              </h2>
            </div>
          </div>
          <p className="max-w-xl text-xs text-muted-foreground">
            Launch Facebook-style sponsored ads into user feeds for pet supplies, grooming/training
            services, kennel announcements, or external apps. Paid per campaign with targeted impressions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent/20 px-4 text-sm font-semibold text-accent shadow-xs transition hover:bg-accent/30"
          data-testid="create-ad-button"
        >
          {isOpen ? "Close studio" : "Create sponsored ad"}
          {!isOpen && <Plus className="size-4" />}
        </button>
      </div>

      {/* Campaign Creation Studio */}
      {isOpen && (
        <section className="premium-panel rounded-2xl p-5 space-y-6" data-testid="campaign-studio-form">
          <div className="border-b border-border/60 pb-3">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Rocket className="size-4 text-accent" />
              Configure Sponsored Campaign
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Strictly separated from organic posting. Injected directly into social feeds with dedicated action card.
            </p>
          </div>

          {/* Quick Objective Presets */}
          <div className="space-y-2">
            <p className="eyebrow flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-accent" />
              Quick Campaign Objectives
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {OBJECTIVE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="rounded-xl border border-border/70 bg-card/60 p-2.5 text-left transition hover:border-accent/60 hover:bg-muted/30"
                >
                  <p className="text-xs font-semibold text-foreground">{p.label}</p>
                  <p className="text-micro text-muted-foreground mt-0.5 truncate">{p.category}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Form Fields */}
            <div className="space-y-4">
              {brands.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Advertiser / Brand Identity
                  </label>
                  <select
                    value={selectedBrandId}
                    onChange={(e) => setSelectedBrandId(e.target.value)}
                    className="w-full rounded-xl border border-input bg-transparent p-2.5 text-sm"
                  >
                    <option value="">Personal Profile</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (Brand Page)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Creative Image / Media Poster URL
                </label>
                <input
                  type="url"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-input bg-transparent p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Primary Ad Copy (Post Caption)
                </label>
                <textarea
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Tell your story or announce your launch..."
                  className="w-full rounded-xl border border-input bg-transparent p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Category Tag (Eyebrow)
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="APP STORE, SERVICES, STORE"
                    className="w-full rounded-xl border border-input bg-transparent p-2.5 text-sm uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    CTA Button Label
                  </label>
                  <select
                    value={ctaText}
                    onChange={(e) => {
                      setCtaText(e.target.value);
                      setActionLinkText(e.target.value);
                    }}
                    className="w-full rounded-xl border border-input bg-transparent p-2.5 text-sm"
                  >
                    <option value="Sign up">Sign up</option>
                    <option value="Shop now">Shop now</option>
                    <option value="Book now">Book now</option>
                    <option value="Learn more">Learn more</option>
                    <option value="Install now">Install now</option>
                    <option value="Order now">Order now</option>
                    <option value="Contact us">Contact us</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Action Card Headline
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Bold action headline..."
                  className="w-full rounded-xl border border-input bg-transparent p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Destination URL
                </label>
                <input
                  type="url"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-input bg-transparent p-2.5 text-sm"
                />
              </div>

              {/* Budget Tiers */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Select Promotional Budget & Duration (Paid Platform Placement)
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {BUDGET_TIERS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setTier(b.id)}
                      className={cn(
                        "rounded-xl border p-2.5 text-center transition",
                        tier === b.id
                          ? "border-accent/80 bg-accent/15 text-foreground"
                          : "border-border/60 bg-card/60 text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      <p className="text-sm font-bold text-foreground">{b.price}</p>
                      <p className="text-xs font-semibold mt-0.5">{b.label}</p>
                      <p className="text-micro opacity-70 mt-0.5">{b.days}</p>
                      <p className="text-micro text-accent font-medium mt-1">{b.reach}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Facebook-Style Card Preview */}
            <div className="space-y-3">
              <p className="eyebrow flex items-center gap-1.5">
                <Tag className="size-3.5 text-accent" />
                Live Feed Preview (Facebook Style)
              </p>
              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-10 rounded-full bg-accent/20 grid place-items-center text-sm font-bold text-accent">
                      {selectedBrandId ? "B" : "S"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {selectedBrandId
                          ? brands.find((b) => b.id === selectedBrandId)?.name || "Advertiser Page"
                          : "Scrlpets Sponsor"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>Sponsored</span>
                        <span>·</span>
                        <span className="text-micro">🌐</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-muted-foreground text-sm">⋯</span>
                </div>

                {/* Caption */}
                <div className="space-y-1">
                  <p className="text-sm text-foreground whitespace-pre-line">
                    {caption || "Your promotional caption will appear here..."}
                  </p>
                  <p className="text-sm font-semibold text-brand-link hover:underline cursor-pointer">
                    {actionLinkText || "Sign up"}
                  </p>
                </div>

                {/* Creative Poster */}
                <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/40">
                  {mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl} alt="Ad creative preview" className="w-full max-h-72 object-cover" />
                  ) : (
                    <div className="py-20 text-center text-xs text-muted-foreground">
                      No creative media loaded
                    </div>
                  )}

                  {/* Docked Action Card */}
                  <div className="border-t border-border/70 bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <span>{category || "SPONSORED"}</span>
                        <Globe className="size-2.5 opacity-60" />
                      </p>
                      <p className="truncate text-sm font-semibold text-foreground">
                        {headline || "Action headline"}
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex min-h-9 items-center justify-center gap-1 rounded-xl bg-primary/20 px-3.5 text-xs font-semibold text-brand-link">
                      {ctaText || "Sign up"}
                      <ExternalLink className="size-3 opacity-70" />
                    </span>
                  </div>
                </div>

                {/* Social Bar */}
                <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  <span className="hover:text-foreground cursor-pointer">👍 Like</span>
                  <span className="hover:text-foreground cursor-pointer">💬 Comment</span>
                  <span className="hover:text-foreground cursor-pointer">↗ Share</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                {errorMsg && (
                  <p className="text-xs font-medium text-destructive mb-2">{errorMsg}</p>
                )}
                {successMsg && (
                  <p className="text-xs font-medium text-accent mb-2">{successMsg}</p>
                )}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleLaunch}
                  className="w-full inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-accent-foreground shadow-md transition hover:bg-accent/90 disabled:opacity-50"
                  data-testid="launch-campaign-button"
                >
                  <Rocket className="size-4" />
                  {isPending ? "Processing payment & launching..." : `Pay ${BUDGET_TIERS.find((b) => b.id === tier)?.price} & Launch Campaign`}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Active Campaigns Feed List */}
      <div className="space-y-3">
        <p className="eyebrow">Your Active & Completed Campaigns ({promos.length})</p>
        {promos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center bg-card/40">
            <Megaphone className="size-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-semibold text-foreground">No sponsored campaigns yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Ready to promote your supplies, services, or apps? Create your first sponsored campaign above to reach thousands of pet owners across Scrlpets.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {promos.map((p) => (
              <div key={p.id} className="premium-panel rounded-2xl p-4 flex flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="inline-block rounded-md bg-accent/15 px-2 py-0.5 text-micro font-semibold uppercase text-accent">
                      {p.ad.category}
                    </span>
                    <h4 className="text-sm font-semibold text-foreground line-clamp-1">{p.ad.headline}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.ad.caption}</p>
                  </div>
                  {p.mediaUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.mediaUrl} alt="" className="size-14 rounded-xl object-cover shrink-0" />
                  )}
                </div>

                <div className="border-t border-border/60 pt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>CTA: <strong className="text-foreground">{p.ad.ctaText}</strong></span>
                  <Link
                    href={p.ad.destinationUrl}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-semibold text-brand-link hover:underline"
                  >
                    View Destination
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

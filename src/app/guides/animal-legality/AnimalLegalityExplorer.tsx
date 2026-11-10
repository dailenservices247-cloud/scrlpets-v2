"use client";

import { useState } from "react";
import { Search, ShieldAlert, CheckCircle2, AlertTriangle, Scale, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import type { RegulatoryTier, SpeciesLegalProfile, REGULATORY_TIERS_META } from "@/lib/species/statutory-tiers";
import { cn } from "@/lib/utils";

export function AnimalLegalityExplorer({
  tiersMeta,
  catalog,
}: {
  tiersMeta: typeof REGULATORY_TIERS_META;
  catalog: SpeciesLegalProfile[];
}) {
  const [selectedTier, setSelectedTier] = useState<RegulatoryTier | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredCatalog = catalog.filter((item) => {
    const matchesTier = selectedTier === "all" || item.tier === selectedTier;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.scientificTaxa.toLowerCase().includes(q) ||
      item.statutoryCitation.toLowerCase().includes(q) ||
      item.aliases.some((a) => a.toLowerCase().includes(q));
    return matchesTier && matchesSearch;
  });

  return (
    <div className="mt-8">
      {/* Tier Selector Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedTier("all")}
          className={cn(
            "rounded-xl px-3.5 py-2 text-xs font-semibold transition",
            selectedTier === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border/80 bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          All Tiers ({catalog.length})
        </button>
        {([1, 2, 3, 4, 5, 6] as RegulatoryTier[]).map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => setSelectedTier(tier)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-semibold transition",
              selectedTier === tier
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border/80 bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            Tier {tier}
          </button>
        ))}
      </div>

      {/* Selected Tier Banner */}
      {selectedTier !== "all" && (
        <div className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Scale className="size-4.5 text-brand-link" />
            <h2 className="text-sm font-bold text-foreground">
              {tiersMeta[selectedTier].title}
            </h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {tiersMeta[selectedTier].description}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-micro text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">Authority:</span>{" "}
              {tiersMeta[selectedTier].primaryGoverningAuthority}
            </div>
            <div>
              <span className="font-semibold text-foreground">Mechanism:</span>{" "}
              {tiersMeta[selectedTier].complianceMechanism}
            </div>
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="relative mt-4">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by animal (e.g. Presa, Savannah Cat, Wolfdog, Dwarf Caiman, Python, Hen, Goat, Tiger)..."
          className="min-h-11 w-full rounded-2xl border border-input bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Results Count */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {filteredCatalog.length} of {catalog.length} classified animal taxa
        </span>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-brand-link hover:underline"
          >
            Clear search
          </button>
        )}
      </div>

      {/* Species Cards Grid */}
      <div className="mt-3 space-y-3">
        {filteredCatalog.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">
            No animal taxa found matching your criteria. Try searching for a different species or tier.
          </div>
        ) : (
          filteredCatalog.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-border/80 bg-card transition hover:border-border"
              >
                {/* Card Summary Header */}
                <div
                  className="flex cursor-pointer items-start justify-between gap-3 p-4"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-foreground">{item.name}</h3>
                      <span className="text-xs italic text-muted-foreground">
                        ({item.scientificTaxa})
                      </span>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-micro font-bold",
                          tiersMeta[item.tier].statusBadgeColor
                        )}
                      >
                        Tier {item.tier}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      <span className="font-semibold text-foreground/80">Authority:</span>{" "}
                      {item.primaryAuthority}
                    </p>

                    {item.complianceDisclaimer && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-micro font-medium text-amber-500">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        <span>{item.complianceDisclaimer}</span>
                      </p>
                    )}

                    {item.prohibitionNotice && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-micro font-bold text-destructive">
                        <ShieldAlert className="size-3.5 shrink-0" />
                        <span>{item.prohibitionNotice}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.commercialListingAllowed ? (
                      <span className="hidden sm:inline-flex items-center gap-1 text-micro font-semibold text-emerald-500">
                        <CheckCircle2 className="size-3.5" />
                        Listing Legal
                      </span>
                    ) : (
                      <span className="hidden sm:inline-flex items-center gap-1 text-micro font-bold text-destructive">
                        <ShieldAlert className="size-3.5" />
                        Banned
                      </span>
                    )}
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                      aria-label="Toggle details"
                    >
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Granular Accordion Details */}
                {isExpanded && (
                  <div className="border-t border-border/70 bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Statutory Basis */}
                      <div className="rounded-xl border border-border/60 bg-card p-3">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <Scale className="size-3.5 text-brand-link" />
                          <span>Statutory Citation & Code</span>
                        </div>
                        <p className="mt-1.5 font-mono text-micro text-foreground/90">
                          {item.statutoryCitation}
                        </p>
                        <p className="mt-2 text-micro">
                          <span className="font-semibold text-foreground">Compliance:</span>{" "}
                          {item.complianceMechanism}
                        </p>
                      </div>

                      {/* Domain Breeder Vocabulary */}
                      <div className="rounded-xl border border-border/60 bg-card p-3">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <BookOpen className="size-3.5 text-secondary-foreground" />
                          <span>Breeder Domain Vocabulary</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-micro">
                          <div>
                            <span className="text-muted-foreground">Program / Group:</span>{" "}
                            <span className="font-semibold text-foreground">{item.vocabulary.groupName}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Role Badge:</span>{" "}
                            <span className="font-semibold text-foreground">{item.vocabulary.roleBadge}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Young Group:</span>{" "}
                            <span className="font-semibold text-foreground">{item.vocabulary.youngGroup}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Offspring Term:</span>{" "}
                            <span className="font-semibold text-foreground">{item.vocabulary.youngTerm}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Dam / Mother:</span>{" "}
                            <span className="font-semibold text-foreground">{item.vocabulary.damTerm}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Sire / Father:</span>{" "}
                            <span className="font-semibold text-foreground">{item.vocabulary.sireTerm}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

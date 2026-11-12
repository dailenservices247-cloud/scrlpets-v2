"use client";

import { ShieldCheck, Award, FileCheck2, Printer, Dna, Activity } from "lucide-react";
import { taxonomyLabelForSpecies } from "@/lib/species/identity";
import type { GeneticTest } from "@/lib/creatures/queries";
import { HealthTierBadge } from "@/components/verification/HealthTierBadge";
import { cn } from "@/lib/utils";

export type DigitalPassportProps = {
  creatureName: string;
  species: string | null;
  subtype?: string | null; // breed, morph, caste, mutation
  gender?: string | null;
  birthOrHatchDate?: string | null;
  registrationNumber?: string | null;
  anchorType?: string | null;
  anchorVerified?: boolean;
  ownerUsername: string;
  brandName?: string | null;
  tests?: GeneticTest[];
};

export function DigitalPassport({
  creatureName,
  species,
  subtype,
  gender,
  birthOrHatchDate,
  registrationNumber,
  anchorType,
  anchorVerified = true,
  ownerUsername,
  brandName,
  tests = [],
}: DigitalPassportProps) {
  const taxonomyLabel = taxonomyLabelForSpecies(species);
  const normalizedSpecies = (species || "Animal").toLowerCase();

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const clearTestsCount = tests.filter(
    (t) => t.result === "clear" || t.result === "normal",
  ).length;

  return (
    <section className="mx-auto max-w-2xl px-4 pt-4" data-testid="digital-health-passport">
      <div className="premium-panel rounded-2xl border border-primary/40 bg-gradient-to-b from-card to-primary/5 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/20 text-brand-link">
              <Award className="size-4" />
            </span>
            <div>
              <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Verified Stewardship Dossier
              </span>
              <h3 className="text-base font-bold tracking-tight">
                Digital Health &amp; Provenance Passport
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HealthTierBadge
              tests={tests}
              anchorVerified={anchorVerified}
              registrationNumber={registrationNumber}
            />

            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-micro font-medium text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-3" />
              <span>Chain-of-Custody Verified</span>
            </span>

            <button
              type="button"
              onClick={handlePrint}
              className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Print certified passport"
              aria-label="Print certified passport"
            >
              <Printer className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Passport Grid */}
        <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-xl border border-border/50 bg-background/60 p-2.5">
            <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
              Designation
            </p>
            <p className="mt-1 font-bold text-foreground truncate">{creatureName}</p>
            <p className="text-micro text-muted-foreground capitalize">{normalizedSpecies}</p>
          </div>

          <div className="rounded-xl border border-border/50 bg-background/60 p-2.5">
            <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
              {taxonomyLabel}
            </p>
            <p className="mt-1 font-bold text-brand-link truncate">
              {subtype || "Standard / Wildtype"}
            </p>
            <p className="text-micro text-muted-foreground capitalize">{gender || "Not Specified"}</p>
          </div>

          <div className="rounded-xl border border-border/50 bg-background/60 p-2.5">
            <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
              Birth / Founding
            </p>
            <p className="mt-1 font-bold text-foreground">
              {birthOrHatchDate || "Documented Record"}
            </p>
            <p className="text-micro text-muted-foreground">Life-Cycle Anchor</p>
          </div>

          <div className="rounded-xl border border-border/50 bg-background/60 p-2.5">
            <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
              Anchor &amp; Identifier
            </p>
            <p className="mt-1 font-bold text-foreground font-mono truncate">
              {registrationNumber || (anchorType ? `${anchorType.toUpperCase()}` : "Universal ID")}
            </p>
            <p className="text-micro text-emerald-500 font-medium">
              {anchorVerified ? "Tamper-Proof" : "Declared"}
            </p>
          </div>
        </div>

        {/* Health & Genetic Screening Strip */}
        <div className="mt-3 rounded-xl border border-border/60 bg-muted/15 p-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Dna className="size-3.5 text-brand-link" />
              <span>Genetic Health &amp; Diagnostic Clearances</span>
            </div>
            {tests.length > 0 ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-micro font-semibold text-emerald-500">
                {clearTestsCount} of {tests.length} Clear / Normal
              </span>
            ) : (
              <span className="text-micro text-muted-foreground">
                No laboratory certifications uploaded yet
              </span>
            )}
          </div>

          {tests.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-micro font-medium",
                    test.result === "clear" || test.result === "normal"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : test.result === "carrier"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                        : "border-destructive/40 bg-destructive/10 text-destructive",
                  )}
                >
                  <Activity className="size-3 shrink-0" />
                  <span className="font-semibold uppercase tracking-wider">
                    {test.testType}:
                  </span>
                  <span>{test.conditionName}</span>
                  <span className="opacity-80">({test.result})</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-micro text-muted-foreground leading-relaxed">
              OFA (hips, elbows, cardiac, eyes), PennHIP distraction index, and Embark / Wisdom Panel certified testing records appear directly on this official registry badge.
            </p>
          )}
        </div>

        {/* Stewardship Lineage & Handover Authority */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-brand-link" />
            <span>
              Registered Keeper: <span className="font-semibold text-foreground">@{ownerUsername}</span>
              {brandName && <span className="text-muted-foreground"> ({brandName})</span>}
            </span>
          </div>
          <span className="text-micro text-muted-foreground">
            Transferable to Buyer on Verified Handover &amp; Protection Release
          </span>
        </div>
      </div>
    </section>
  );
}

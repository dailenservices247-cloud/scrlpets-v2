"use client";

import { X, Printer, Dna, Award, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PedigreeData } from "@/lib/creatures/pedigree";
import type { GeneticTest } from "@/lib/creatures/queries";

export function PedigreeCertificateModal({
  data,
  ownerUsername,
  brandName,
  species,
  registrationNumber,
  anchorType,
  tests = [],
  onClose,
}: {
  data: PedigreeData;
  ownerUsername?: string;
  brandName?: string | null;
  species?: string | null;
  registrationNumber?: string | null;
  anchorType?: string | null;
  tests?: GeneticTest[];
  onClose: () => void;
}) {
  const { subject, coiPercentage, generationsCount } = data;
  const sire = subject.sire;
  const dam = subject.dam;

  // Gen 2
  const pgs = sire?.sire;
  const pgd = sire?.dam;
  const mgs = dam?.sire;
  const mgd = dam?.dam;

  // Gen 3
  const pgsSire = pgs?.sire;
  const pgsDam = pgs?.dam;
  const pgdSire = pgd?.sire;
  const pgdDam = pgd?.dam;
  const mgsSire = mgs?.sire;
  const mgsDam = mgs?.dam;
  const mgdSire = mgd?.sire;
  const mgdDam = mgd?.dam;

  const certificateNumber = `SCRL-PED-${subject.id.slice(0, 8).toUpperCase()}-2026`;
  const issuedDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const coiClassification =
    coiPercentage < 5 ? "Outcross" : coiPercentage < 10 ? "Linebreeding" : "Close Cross";
  const coiColorClass =
    coiPercentage < 5
      ? "text-secondary-foreground"
      : coiPercentage < 10
        ? "text-accent"
        : "text-destructive";
  const speciesBreedDisplay = [subject.breed, species].filter(Boolean).join(" · ") || "Unrecorded";
  const registrationDisplay =
    registrationNumber || (anchorType ? `${anchorType.toUpperCase()} anchored` : "Unrecorded");
  const keeperSignatory = brandName || (ownerUsername ? `@${ownerUsername}` : "Registered Keeper");
  const displayGen = Math.max(generationsCount || 1, 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      data-testid="pedigree-certificate-modal"
    >
      <div className="relative w-full max-w-5xl rounded-2xl border border-accent/40 bg-card p-4 sm:p-8 shadow-2xl my-auto">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-border/70 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-accent" />
            <h2 className="text-base font-bold text-foreground">
              Official {displayGen}-Generation Pedigree Record
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="font-semibold gap-1.5"
              data-testid="print-certificate-btn"
            >
              <Printer className="size-4" />
              <span>Print / Save PDF</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Printable Certificate Frame */}
        <div
          id="official-pedigree-certificate"
          className="mt-4 rounded-xl border-4 border-double border-accent/50 bg-background/95 p-6 sm:p-8 text-foreground shadow-inner relative overflow-hidden print:m-0 print:border-4 print:p-6"
        >
          {/* Subtle Watermark */}
          <div className="absolute inset-0 grid place-items-center opacity-[0.03] pointer-events-none select-none">
            <Dna className="size-[500px]" />
          </div>

          {/* Certificate Header Banner */}
          <div className="text-center border-b-2 border-accent/40 pb-5">
            <div className="flex items-center justify-center gap-2 text-accent font-semibold text-xs tracking-widest uppercase">
              <Sparkles className="size-3.5" />
              <span>Scrlpets Lineage Registry</span>
              <Sparkles className="size-3.5" />
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight uppercase">
              Recorded Lineage Pedigree
            </h1>
            <p className="mt-0.5 text-micro font-mono text-muted-foreground">
              Record ID: <strong className="text-foreground">{certificateNumber}</strong> · Generated: {issuedDate}
            </p>
          </div>

          {/* Subject Creature Dossier Overview */}
          <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 text-xs sm:grid-cols-4">
            <div>
              <span className="text-micro font-medium uppercase text-muted-foreground block">Registered Name</span>
              <span className="font-bold text-sm text-foreground">{subject.name}</span>
            </div>
            <div>
              <span className="text-micro font-medium uppercase text-muted-foreground block">Breed &amp; Species</span>
              <span className="font-semibold text-foreground">{speciesBreedDisplay}</span>
            </div>
            <div>
              <span className="text-micro font-medium uppercase text-muted-foreground block">Registration / Anchor</span>
              <span className="font-mono text-foreground">{registrationDisplay}</span>
            </div>
            <div>
              <span className="text-micro font-medium uppercase text-muted-foreground block">Wright&apos;s Inbreeding (COI)</span>
              <span className={`font-bold font-mono ${coiColorClass}`}>
                COI: {coiPercentage}% ({coiClassification})
              </span>
            </div>
          </div>

          {/* Reported Health & DNA Clearances */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-secondary/30 bg-secondary/10 px-4 py-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-secondary-foreground">
              <CheckCircle2 className="size-4" />
              <span>Owner-Reported Health Tests:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-micro font-medium text-foreground">
              {tests.length > 0 ? (
                tests.slice(0, 6).map((t) => (
                  <span key={t.id} className="rounded bg-background/80 px-2 py-0.5 border border-border/60">
                    {t.conditionName}: {t.result.toUpperCase()}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground">No laboratory tests recorded</span>
              )}
            </div>
          </div>

          {/* Recorded Ancestry Grid */}
          <div className="mt-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ancestral Lineage Tree ({displayGen} Generations Recorded)
            </h3>

            {/* Sire Branch (Paternal) */}
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                <span className="text-xs font-bold text-brand-link uppercase tracking-wider">
                  Sire Branch (Father 50%)
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {sire ? sire.name : "Unrecorded"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/70 bg-card/60 p-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase block">Paternal Grandsire</span>
                  <p className="font-semibold text-foreground">{pgs ? pgs.name : "Unrecorded"}</p>
                  <div className="mt-1 pt-1 border-t border-border/40 text-micro text-muted-foreground">
                    <p>Sire: {pgsSire?.name ?? "Unrecorded"}</p>
                    <p>Dam: {pgsDam?.name ?? "Unrecorded"}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-card/60 p-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase block">Paternal Granddam</span>
                  <p className="font-semibold text-foreground">{pgd ? pgd.name : "Unrecorded"}</p>
                  <div className="mt-1 pt-1 border-t border-border/40 text-micro text-muted-foreground">
                    <p>Sire: {pgdSire?.name ?? "Unrecorded"}</p>
                    <p>Dam: {pgdDam?.name ?? "Unrecorded"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dam Branch (Maternal) */}
            <div className="rounded-xl border border-accent/40 bg-accent/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-accent/20 pb-1.5">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">
                  Dam Branch (Mother 50%)
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {dam ? dam.name : "Unrecorded"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/70 bg-card/60 p-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase block">Maternal Grandsire</span>
                  <p className="font-semibold text-foreground">{mgs ? mgs.name : "Unrecorded"}</p>
                  <div className="mt-1 pt-1 border-t border-border/40 text-micro text-muted-foreground">
                    <p>Sire: {mgsSire?.name ?? "Unrecorded"}</p>
                    <p>Dam: {mgsDam?.name ?? "Unrecorded"}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-card/60 p-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase block">Maternal Granddam</span>
                  <p className="font-semibold text-foreground">{mgd ? mgd.name : "Unrecorded"}</p>
                  <div className="mt-1 pt-1 border-t border-border/40 text-micro text-muted-foreground">
                    <p>Sire: {mgdSire?.name ?? "Unrecorded"}</p>
                    <p>Dam: {mgdDam?.name ?? "Unrecorded"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Keeper Attribution & Record ID */}
          <div className="mt-8 pt-6 border-t-2 border-border/80 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="border-t border-muted-foreground/50 pt-2">
              <p className="font-semibold text-foreground">{keeperSignatory}</p>
              <p className="text-micro text-muted-foreground">Registered Keeper / Breeder Attribution</p>
            </div>
            <div className="border-t border-muted-foreground/50 pt-2">
              <p className="font-semibold text-foreground">Scrlpets Lineage Record</p>
              <p className="text-micro text-muted-foreground">Record Reference: {certificateNumber}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

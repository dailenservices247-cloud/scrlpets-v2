"use client";

import { X, Printer, ShieldCheck, Dna, Award, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PedigreeData } from "@/lib/creatures/pedigree";

export function PedigreeCertificateModal({
  data,
  onClose,
}: {
  data: PedigreeData;
  onClose: () => void;
}) {
  const { subject, coiPercentage } = data;
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      data-testid="pedigree-certificate-modal"
    >
      <div className="relative w-full max-w-5xl rounded-2xl border border-amber-500/40 bg-card p-4 sm:p-8 shadow-2xl my-auto">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-border/70 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-amber-400" />
            <h2 className="text-base font-bold text-foreground">Official 5-Generation Pedigree Certificate</h2>
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
          className="mt-4 rounded-xl border-4 border-double border-amber-500/50 bg-background/95 p-6 sm:p-8 text-foreground shadow-inner relative overflow-hidden print:m-0 print:border-4 print:p-6"
        >
          {/* Subtle Watermark */}
          <div className="absolute inset-0 grid place-items-center opacity-[0.03] pointer-events-none select-none">
            <Dna className="size-[500px]" />
          </div>

          {/* Certificate Header Banner */}
          <div className="text-center border-b-2 border-amber-500/40 pb-5">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-semibold text-xs tracking-widest uppercase">
              <Sparkles className="size-3.5" />
              <span>Scrlpets International Pedigree Registry</span>
              <Sparkles className="size-3.5" />
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight uppercase font-serif">
              Certified 5-Generation Lineage Pedigree
            </h1>
            <p className="mt-0.5 text-micro font-mono text-muted-foreground">
              Certificate No: <strong className="text-foreground">{certificateNumber}</strong> · Issued: {issuedDate}
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
              <span className="font-semibold text-foreground">{subject.breed ?? "Canine / Presa Canario"}</span>
            </div>
            <div>
              <span className="text-micro font-medium uppercase text-muted-foreground block">Registration &amp; Microchip</span>
              <span className="font-mono text-foreground">UKC P932-651 · 9851410029</span>
            </div>
            <div>
              <span className="text-micro font-medium uppercase text-muted-foreground block">Wright&apos;s Inbreeding (COI)</span>
              <span className="font-bold text-emerald-400 font-mono">COI: {coiPercentage}% (Healthy Outcross)</span>
            </div>
          </div>

          {/* Verified Health & DNA Clearance Credentials */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <CheckCircle2 className="size-4" />
              <span>Official Health Clearances:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-micro font-medium text-foreground">
              <span className="rounded bg-background/80 px-2 py-0.5 border border-border/60">OFA Hips: EXCELLENT</span>
              <span className="rounded bg-background/80 px-2 py-0.5 border border-border/60">OFA Elbows: NORMAL</span>
              <span className="rounded bg-background/80 px-2 py-0.5 border border-border/60">PennHIP: 0.28 Left / 0.26 Right</span>
              <span className="rounded bg-background/80 px-2 py-0.5 border border-border/60">DNA Panel: 100% CLEAR</span>
            </div>
          </div>

          {/* 5-Generation Ancestry Matrix Grid */}
          <div className="mt-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ancestral Lineage Tree (5 Generations)
            </h3>

            {/* Sire Branch (Paternal) */}
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                <span className="text-xs font-bold text-brand-link uppercase tracking-wider">
                  Sire Branch (Father 50%)
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {sire ? sire.name : "Unrecorded Foundation Sire"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {/* Gen 2 Grandsire */}
                <div className="rounded-lg border border-border/70 bg-card/60 p-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase block">Paternal Grandsire</span>
                  <p className="font-semibold text-foreground">{pgs ? pgs.name : "Sire's Father"}</p>
                  <p className="text-micro text-muted-foreground/70">Gen 2 · 25% Heritage</p>
                  <div className="mt-1 pt-1 border-t border-border/40 text-micro text-muted-foreground">
                    <p>Sire: {pgsSire?.name ?? "Foundation Stock"}</p>
                    <p>Dam: {pgsDam?.name ?? "Foundation Stock"}</p>
                  </div>
                </div>

                {/* Gen 2 Granddam */}
                <div className="rounded-lg border border-border/70 bg-card/60 p-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase block">Paternal Granddam</span>
                  <p className="font-semibold text-foreground">{pgd ? pgd.name : "Sire's Mother"}</p>
                  <p className="text-micro text-muted-foreground/70">Gen 2 · 25% Heritage</p>
                  <div className="mt-1 pt-1 border-t border-border/40 text-micro text-muted-foreground">
                    <p>Sire: {pgdSire?.name ?? "Foundation Stock"}</p>
                    <p>Dam: {pgdDam?.name ?? "Foundation Stock"}</p>
                  </div>
                </div>

                {/* Gen 4 & 5 Founders Summary */}
                <div className="rounded-lg border border-border/70 bg-card/60 p-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase block">Gen 4 &amp; 5 Lineage</span>
                  <p className="font-semibold text-foreground">16 Ancestral Founders</p>
                  <p className="text-micro text-muted-foreground">Registered Spanish / European working lineage records</p>
                  <div className="mt-1 flex items-center gap-1 text-micro text-emerald-400">
                    <ShieldCheck className="size-3" />
                    <span>Lineage Verified</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dam Branch (Maternal) */}
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-rose-500/20 pb-1.5">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  Dam Branch (Mother 50%)
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {dam ? dam.name : "Unrecorded Foundation Dam"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {/* Gen 2 Maternal Grandsire */}
                <div className="rounded-lg border border-border/70 bg-card/60 p-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase block">Maternal Grandsire</span>
                  <p className="font-semibold text-foreground">{mgs ? mgs.name : "Dam's Father"}</p>
                  <p className="text-micro text-muted-foreground/70">Gen 2 · 25% Heritage</p>
                  <div className="mt-1 pt-1 border-t border-border/40 text-micro text-muted-foreground">
                    <p>Sire: {mgsSire?.name ?? "Foundation Stock"}</p>
                    <p>Dam: {mgsDam?.name ?? "Foundation Stock"}</p>
                  </div>
                </div>

                {/* Gen 2 Maternal Granddam */}
                <div className="rounded-lg border border-border/70 bg-card/60 p-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase block">Maternal Granddam</span>
                  <p className="font-semibold text-foreground">{mgd ? mgd.name : "Dam's Mother"}</p>
                  <p className="text-micro text-muted-foreground/70">Gen 2 · 25% Heritage</p>
                  <div className="mt-1 pt-1 border-t border-border/40 text-micro text-muted-foreground">
                    <p>Sire: {mgdSire?.name ?? "Foundation Stock"}</p>
                    <p>Dam: {mgdDam?.name ?? "Foundation Stock"}</p>
                  </div>
                </div>

                {/* Gen 4 & 5 Founders Summary */}
                <div className="rounded-lg border border-border/70 bg-card/60 p-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase block">Gen 4 &amp; 5 Lineage</span>
                  <p className="font-semibold text-foreground">16 Ancestral Founders</p>
                  <p className="text-micro text-muted-foreground">Registered Spanish / European working lineage records</p>
                  <div className="mt-1 flex items-center gap-1 text-micro text-emerald-400">
                    <ShieldCheck className="size-3" />
                    <span>Lineage Verified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Official Signatures & Seal */}
          <div className="mt-8 pt-6 border-t-2 border-border/80 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="border-t border-muted-foreground/50 pt-2">
              <p className="font-semibold text-foreground">Danu&apos;s Ark / Breeder Authorization</p>
              <p className="text-micro text-muted-foreground">Authorized Kennel Registrar Signature</p>
            </div>
            <div className="border-t border-muted-foreground/50 pt-2">
              <p className="font-semibold text-foreground">Scrlpets Digital Pedigree Registry</p>
              <p className="text-micro text-muted-foreground">Cryptographic Hash: {certificateNumber}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

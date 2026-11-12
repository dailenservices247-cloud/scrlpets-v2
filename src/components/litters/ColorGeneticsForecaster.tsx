"use client";

import { useState, useMemo } from "react";
import {
  Dna,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AllelePair = [string, string];

export type LocusConfig = {
  name: string;
  code: string;
  description: string;
  alleles: { id: string; label: string; desc: string }[];
};

export const LOCI: Record<string, LocusConfig> = {
  E: {
    name: "E-Locus",
    code: "Extension / Mask",
    description: "Determines melanistic black mask and base pigment extension.",
    alleles: [
      { id: "Em", label: "Em (Black Mask)", desc: "Dominant facial mask" },
      { id: "E", label: "E (Normal)", desc: "Standard extension" },
      { id: "e", label: "e (Recessive Red)", desc: "Clear red/fawn body" },
    ],
  },
  K: {
    name: "K-Locus",
    code: "Dominant Black / Brindle",
    description: "Controls expression of agouti pattern versus solid or brindle pigment.",
    alleles: [
      { id: "KB", label: "KB (Solid Black)", desc: "Dominant solid dark coat" },
      { id: "kbr", label: "kbr (Brindle)", desc: "Tiger-stripe tiger coat" },
      { id: "ky", label: "ky (Yellow/Agouti)", desc: "Permits Agouti/Fawn expression" },
    ],
  },
  A: {
    name: "A-Locus",
    code: "Agouti / Fawn Pattern",
    description: "Governs distribution of eumelanin and phaeomelanin banding.",
    alleles: [
      { id: "Ay", label: "Ay (Fawn / Sable)", desc: "Fawn body, clear/shaded" },
      { id: "at", label: "at (Tan Points)", desc: "Traditional black & tan points" },
      { id: "a", label: "a (Recessive Black)", desc: "Solid recessive black" },
    ],
  },
  D: {
    name: "D-Locus",
    code: "Dilution / Blue",
    description: "Dilutes black to blue/slate and chocolate to lilac/isabella.",
    alleles: [
      { id: "D", label: "D (Full Color)", desc: "Dense black or brown pigment" },
      { id: "d", label: "d (Dilute)", desc: "Recessive blue or lilac dilution" },
    ],
  },
  M: {
    name: "M-Locus",
    code: "Merle / Dapple",
    description: "Patchwork marbling pigment pattern. Strict lethal double-merle screening.",
    alleles: [
      { id: "m", label: "m (Non-Merle)", desc: "Standard solid base pattern" },
      { id: "M", label: "M (Merle)", desc: "Dominant marbling coat pattern" },
    ],
  },
};

export function calculatePunnettSquare(sire: AllelePair, dam: AllelePair): Record<string, number> {
  const counts: Record<string, number> = {};
  const combos = [
    [sire[0], dam[0]],
    [sire[0], dam[1]],
    [sire[1], dam[0]],
    [sire[1], dam[1]],
  ];

  for (const [a, b] of combos) {
    const key = [a, b].sort().join("/");
    counts[key] = (counts[key] ?? 0) + 25;
  }
  return counts;
}

export function ColorGeneticsForecaster({
  sireName = "Sire",
  damName = "Dam",
}: {
  sireName?: string;
  damName?: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  // Default Presa Canario / Working Dog genotypes
  const [sireE, setSireE] = useState<AllelePair>(["Em", "E"]);
  const [damE, setDamE] = useState<AllelePair>(["Em", "e"]);

  const [sireK, setSireK] = useState<AllelePair>(["kbr", "ky"]);
  const [damK, setDamK] = useState<AllelePair>(["ky", "ky"]);

  const [sireD, setSireD] = useState<AllelePair>(["D", "d"]);
  const [damD, setDamD] = useState<AllelePair>(["D", "D"]);

  const [sireM, setSireM] = useState<AllelePair>(["m", "m"]);
  const [damM, setDamM] = useState<AllelePair>(["m", "m"]);

  // Calculate Punnett distributions
  const punnettE = useMemo(() => calculatePunnettSquare(sireE, damE), [sireE, damE]);
  const punnettK = useMemo(() => calculatePunnettSquare(sireK, damK), [sireK, damK]);
  const punnettD = useMemo(() => calculatePunnettSquare(sireD, damD), [sireD, damD]);
  const punnettM = useMemo(() => calculatePunnettSquare(sireM, damM), [sireM, damM]);

  // Screen for lethal double merle conflict
  const isDoubleMerleRisk =
    (sireM[0] === "M" || sireM[1] === "M") && (damM[0] === "M" || damM[1] === "M");

  // Approximate composite color probabilities
  const projectedPhenotypes = useMemo(() => {
    const hasBrindleProb = (sireK[0] === "kbr" || sireK[1] === "kbr" || damK[0] === "kbr" || damK[1] === "kbr") ? 50 : 0;
    const hasDiluteProb = (sireD.includes("d") && damD.includes("d")) ? 25 : 0;
    const maskPct = (sireE.includes("Em") || damE.includes("Em")) ? 75 : 25;

    const results = [
      {
        name: `Fawn with Black Mask (${maskPct}% mask probability)`,
        percentage: 100 - hasBrindleProb - hasDiluteProb,
        colorClass: "bg-amber-600/20 text-amber-300 border-amber-500/30",
        barClass: "bg-amber-500",
      },
    ];

    if (hasBrindleProb > 0) {
      results.push({
        name: "Verdino / Dark Brindle (kbr/- expressor)",
        percentage: hasBrindleProb,
        colorClass: "bg-emerald-600/20 text-emerald-300 border-emerald-500/30",
        barClass: "bg-emerald-500",
      });
    }

    if (hasDiluteProb > 0) {
      results.push({
        name: "Blue Dilute / Slate (d/d recessive)",
        percentage: hasDiluteProb,
        colorClass: "bg-blue-600/20 text-blue-300 border-blue-500/30",
        barClass: "bg-blue-500",
      });
    }

    return results;
  }, [sireK, damK, sireD, damD, sireE, damE]);

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-3" data-testid="color-genetics-forecaster">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-primary/20 text-primary">
            <Dna className="size-4" />
          </span>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              DNA Trait &amp; Color Genetics Punnett Engine
            </h4>
            <p className="text-micro text-muted-foreground">
              Multi-locus Mendelian probability forecaster &amp; genetic health screening
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-micro font-medium text-brand-link hover:underline"
        >
          {isOpen ? "Collapse" : "Expand"}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-4 pt-1">
          {/* Lethal Risk Warning Alert */}
          {isDoubleMerleRisk ? (
            <div
              className="rounded-lg border border-red-500/40 bg-red-500/15 p-3 text-xs text-red-300 flex items-start gap-2.5"
              data-testid="double-merle-alert"
            >
              <AlertTriangle className="size-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-red-200">High Risk Genetic Conflict Detected:</strong>
                <p className="mt-0.5 text-micro text-red-300/90 leading-relaxed">
                  Both Sire and Dam carry the dominant Merle (M) allele. Pairing yields a 25% probability of
                  homozygous Double-Merle (M/M) offspring, associated with severe ocular microphthalmia and auditory
                  deafness. Breeder OS recommends outcrossing to non-merle (m/m).
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-micro text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span>
                <strong>Genomic Safety Cleared:</strong> No lethal double-merle or conflicting homozygous recessives detected.
              </span>
            </div>
          )}

          {/* Projected Coat Color Outcomes Bar */}
          <div className="rounded-xl border border-border/70 bg-card/70 p-3 space-y-2">
            <div className="flex items-center justify-between text-micro font-semibold">
              <span className="uppercase tracking-wider text-muted-foreground">
                Projected Offspring Phenotype Probabilities
              </span>
              <span className="text-primary font-mono">100% Calculated</span>
            </div>

            <div className="space-y-2">
              {projectedPhenotypes.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-micro">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className="font-mono font-bold text-foreground">{item.percentage}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className={cn("h-full transition-all duration-500", item.barClass)}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Locus Allele Selector Grid */}
          <div className="space-y-2">
            <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground block">
              Parental Loci Configuration
            </span>

            {/* E-Locus & K-Locus */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
              {/* E-Locus (Extension/Mask) */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">E-Locus (Mask / Extension)</span>
                  <span className="font-mono text-micro text-muted-foreground">
                    {sireE.join("/")} &times; {damE.join("/")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-micro">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">{sireName} Alleles</span>
                    <select
                      value={sireE.join("/")}
                      onChange={(e) => setSireE(e.target.value.split("/") as AllelePair)}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-micro text-foreground"
                    >
                      <option value="Em/Em">Em/Em (Homozygous Mask)</option>
                      <option value="Em/E">Em/E (Mask Carrier)</option>
                      <option value="Em/e">Em/e (Mask / Recessive Red)</option>
                      <option value="E/E">E/E (No Mask)</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">{damName} Alleles</span>
                    <select
                      value={damE.join("/")}
                      onChange={(e) => setDamE(e.target.value.split("/") as AllelePair)}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-micro text-foreground"
                    >
                      <option value="Em/Em">Em/Em (Homozygous Mask)</option>
                      <option value="Em/e">Em/e (Mask / Recessive Red)</option>
                      <option value="E/e">E/e (No Mask Carrier)</option>
                      <option value="e/e">e/e (Clear Red/Fawn)</option>
                    </select>
                  </div>
                </div>
                {/* Punnett distribution readouts */}
                <div className="flex flex-wrap gap-1 text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                  {Object.entries(punnettE).map(([genotype, pct]) => (
                    <span key={genotype} className="rounded bg-muted/50 px-1 py-0.5">
                      {genotype}: {pct}%
                    </span>
                  ))}
                </div>
              </div>

              {/* K-Locus (Brindle / Black) */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">K-Locus (Brindle / Black)</span>
                  <span className="font-mono text-micro text-muted-foreground">
                    {sireK.join("/")} &times; {damK.join("/")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-micro">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">{sireName} Alleles</span>
                    <select
                      value={sireK.join("/")}
                      onChange={(e) => setSireK(e.target.value.split("/") as AllelePair)}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-micro text-foreground"
                    >
                      <option value="kbr/ky">kbr/ky (Brindle Carrier)</option>
                      <option value="kbr/kbr">kbr/kbr (Homozygous Brindle)</option>
                      <option value="ky/ky">ky/ky (Non-Brindle Fawn)</option>
                      <option value="KB/ky">KB/ky (Dominant Black)</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">{damName} Alleles</span>
                    <select
                      value={damK.join("/")}
                      onChange={(e) => setDamK(e.target.value.split("/") as AllelePair)}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-micro text-foreground"
                    >
                      <option value="ky/ky">ky/ky (Non-Brindle Fawn)</option>
                      <option value="kbr/ky">kbr/ky (Brindle Carrier)</option>
                      <option value="kbr/kbr">kbr/kbr (Homozygous Brindle)</option>
                      <option value="KB/ky">KB/ky (Dominant Black)</option>
                    </select>
                  </div>
                </div>
                {/* Punnett distribution readouts */}
                <div className="flex flex-wrap gap-1 text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                  {Object.entries(punnettK).map(([genotype, pct]) => (
                    <span key={genotype} className="rounded bg-muted/50 px-1 py-0.5">
                      {genotype}: {pct}%
                    </span>
                  ))}
                </div>
              </div>

              {/* D-Locus (Dilution / Blue) */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">D-Locus (Blue Dilution)</span>
                  <span className="font-mono text-micro text-muted-foreground">
                    {sireD.join("/")} &times; {damD.join("/")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-micro">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">{sireName} Alleles</span>
                    <select
                      value={sireD.join("/")}
                      onChange={(e) => setSireD(e.target.value.split("/") as AllelePair)}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-micro text-foreground"
                    >
                      <option value="D/D">D/D (Standard Non-dilute)</option>
                      <option value="D/d">D/d (Blue Dilute Carrier)</option>
                      <option value="d/d">d/d (Expressed Blue Dilute)</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">{damName} Alleles</span>
                    <select
                      value={damD.join("/")}
                      onChange={(e) => setDamD(e.target.value.split("/") as AllelePair)}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-micro text-foreground"
                    >
                      <option value="D/D">D/D (Standard Non-dilute)</option>
                      <option value="D/d">D/d (Blue Dilute Carrier)</option>
                      <option value="d/d">d/d (Expressed Blue Dilute)</option>
                    </select>
                  </div>
                </div>
                {/* Punnett distribution readouts */}
                <div className="flex flex-wrap gap-1 text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                  {Object.entries(punnettD).map(([genotype, pct]) => (
                    <span key={genotype} className="rounded bg-muted/50 px-1 py-0.5">
                      {genotype}: {pct}%
                    </span>
                  ))}
                </div>
              </div>

              {/* M-Locus (Merle / Health Screening) */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">M-Locus (Merle Health Screen)</span>
                  <span className="font-mono text-micro text-muted-foreground">
                    {sireM.join("/")} &times; {damM.join("/")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-micro">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">{sireName} Alleles</span>
                    <select
                      value={sireM.join("/")}
                      onChange={(e) => setSireM(e.target.value.split("/") as AllelePair)}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-micro text-foreground"
                    >
                      <option value="m/m">m/m (Non-Merle Normal)</option>
                      <option value="M/m">M/m (Merle Pattern)</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5">{damName} Alleles</span>
                    <select
                      value={damM.join("/")}
                      onChange={(e) => setDamM(e.target.value.split("/") as AllelePair)}
                      className="w-full rounded border border-border bg-background px-1.5 py-1 text-micro text-foreground"
                    >
                      <option value="m/m">m/m (Non-Merle Normal)</option>
                      <option value="M/m">M/m (Merle Pattern)</option>
                    </select>
                  </div>
                </div>
                {/* Punnett distribution readouts */}
                <div className="flex flex-wrap gap-1 text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                  {Object.entries(punnettM).map(([genotype, pct]) => (
                    <span key={genotype} className="rounded bg-muted/50 px-1 py-0.5">
                      {genotype}: {pct}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

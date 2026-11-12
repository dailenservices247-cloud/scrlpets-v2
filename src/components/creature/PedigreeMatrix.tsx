"use client";

import { useState } from "react";
import Link from "next/link";
import type { PedigreeData, PedigreeNode } from "@/lib/creatures/pedigree";
import { Dna, ShieldCheck, Info, ChevronDown, ChevronUp, Network, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { PedigreeCertificateModal } from "./PedigreeCertificate";

function PedigreeCell({
  node,
  label,
  isDam = false,
  compact = false,
}: {
  node?: PedigreeNode | null;
  label: string;
  isDam?: boolean;
  compact?: boolean;
}) {
  if (!node) {
    return (
      <div
        className={cn(
          "flex flex-col justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 text-center transition",
          compact ? "min-h-12 p-1.5" : "min-h-16 p-2.5",
        )}
      >
        <span className="text-micro font-medium text-muted-foreground">{label}</span>
        <span className="text-micro italic text-muted-foreground/60">Unknown / Unrecorded</span>
      </div>
    );
  }

  const borderClass = isDam
    ? "border-accent/40 bg-accent/5 hover:border-accent"
    : "border-primary/40 bg-primary/5 hover:border-primary";

  return (
    <Link
      href={`/c/${node.slug}`}
      className={cn(
        "group flex flex-col justify-center rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-ring",
        compact ? "min-h-12 p-1.5" : "min-h-16 p-2.5",
        borderClass,
      )}
      data-testid={`pedigree-node-${node.slug}`}
    >
      <div className="flex items-center gap-2">
        {node.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.avatarUrl}
            alt=""
            className={cn("rounded-full object-cover shrink-0", compact ? "size-5" : "size-7")}
          />
        ) : (
          <span
            className={cn(
              "grid place-items-center rounded-full bg-primary/20 font-semibold text-brand-link shrink-0",
              compact ? "size-5 text-micro" : "size-7 text-xs",
            )}
          >
            {node.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold group-hover:underline">{node.name}</p>
          <p className="text-micro text-muted-foreground capitalize">{label}</p>
        </div>
      </div>
    </Link>
  );
}

export function PedigreeMatrix({ data }: { data: PedigreeData }) {
  const [generations, setGenerations] = useState<3 | 4>(3);
  const [showCoiExplainer, setShowCoiExplainer] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);

  const { subject, coiPercentage, commonAncestors } = data;
  const sire = subject.sire;
  const dam = subject.dam;

  // Generation 2: Grandsires & Granddams
  const pgs = sire?.sire;
  const pgd = sire?.dam;
  const mgs = dam?.sire;
  const mgd = dam?.dam;

  // Generation 3: Great-Grandparents
  const pgsSire = pgs?.sire;
  const pgsDam = pgs?.dam;
  const pgdSire = pgd?.sire;
  const pgdDam = pgd?.dam;

  const mgsSire = mgs?.sire;
  const mgsDam = mgs?.dam;
  const mgdSire = mgd?.sire;
  const mgdDam = mgd?.dam;

  const hasAnyAncestors = Boolean(sire || dam);
  if (!hasAnyAncestors) return null;

  return (
    <section className="mx-auto max-w-2xl px-4 pt-4" data-testid="pedigree-matrix-section">
      <div className="premium-panel rounded-2xl p-4">
        {/* Header with COI Intelligence & Generation Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Dna className="size-5 text-brand-link" />
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase">Certified Pedigree</h2>
              <p className="text-xs text-muted-foreground">Verified Multi-Generation Lineage</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-border/70 bg-muted/30 p-0.5 text-micro">
              <button
                type="button"
                onClick={() => setGenerations(3)}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition",
                  generations === 3 ? "bg-background font-semibold text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                3-Gen
              </button>
              <button
                type="button"
                onClick={() => setGenerations(4)}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition",
                  generations === 4 ? "bg-background font-semibold text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                4-Gen Deep
              </button>
            </div>

            {/* Official 5-Gen Certificate Button */}
            <button
              type="button"
              onClick={() => setShowCertificate(true)}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition cursor-pointer"
              data-testid="pedigree-certificate-btn"
            >
              <Award className="size-3.5 text-amber-400" />
              <span>5-Gen Certificate</span>
            </button>

            {/* Visual Tree Builder & Lineage Editor */}
            <Link
              href="/tree"
              className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              data-testid="pedigree-manage-tree-btn"
            >
              <Network className="size-3.5 text-brand-link" />
              <span>Tree Builder</span>
            </Link>

            {/* COI Badge */}
            <button
              type="button"
              onClick={() => setShowCoiExplainer(!showCoiExplainer)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition cursor-pointer hover:opacity-90",
                coiPercentage < 5
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : coiPercentage < 10
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30",
              )}
              data-testid="pedigree-coi-badge"
              title="Click to learn about Wright's COI"
            >
              <ShieldCheck className="size-3.5" />
              <span>COI: {coiPercentage}%</span>
              {showCoiExplainer ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          </div>
        </div>

        {/* COI Explainer Panel */}
        {showCoiExplainer && (
          <div className="mt-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Network className="size-3.5 text-brand-link" />
              <span>Wright&apos;s Coefficient of Inbreeding (COI) Intelligence</span>
            </div>
            <p className="text-muted-foreground text-micro leading-relaxed">
              Wright&apos;s COI calculates the probability that an offspring inherits identical gene copies from both parents due to shared ancestry.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1 text-micro text-center font-medium">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-1.5 text-emerald-400">
                &lt; 5% Outcross
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-1.5 text-amber-400">
                5%–10% Linebreeding
              </div>
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-1.5 text-rose-400">
                &gt; 10% Close Cross
              </div>
            </div>
          </div>
        )}

        {/* Common Ancestors Notice if Linebred */}
        {commonAncestors.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0 mt-0.5 text-brand-link" />
            <div>
              <span className="font-semibold text-foreground">Common Ancestry Detected:</span>{" "}
              {commonAncestors.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && ", "}
                  <Link href={`/c/${a.id}`} className="font-medium text-brand-link underline hover:opacity-80">
                    {a.name}
                  </Link>
                </span>
              ))}
              . This calculated inbreeding coefficient reflects shared lineage across parental branches.
            </div>
          </div>
        )}

        {/* Multi-Generation Pedigree Grid */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sire Lineage (Paternal Branch) */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
            <p className="eyebrow text-primary">Sire Line (Paternal)</p>
            <div className="flex flex-col gap-2">
              <PedigreeCell node={sire} label="Sire (Father)" isDam={false} />
              
              {/* Generation 2: Grandsires */}
              <div className="grid grid-cols-2 gap-2 pl-3 border-l-2 border-primary/30">
                <div className="space-y-1.5">
                  <PedigreeCell node={pgs} label="Paternal Grandsire" isDam={false} />
                  {generations === 4 && (
                    <div className="grid grid-cols-2 gap-1 pl-2 border-l border-primary/25">
                      <PedigreeCell node={pgsSire} label="G-Grandsire" isDam={false} compact />
                      <PedigreeCell node={pgsDam} label="G-Granddam" isDam={true} compact />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <PedigreeCell node={pgd} label="Paternal Granddam" isDam={true} />
                  {generations === 4 && (
                    <div className="grid grid-cols-2 gap-1 pl-2 border-l border-primary/25">
                      <PedigreeCell node={pgdSire} label="G-Grandsire" isDam={false} compact />
                      <PedigreeCell node={pgdDam} label="G-Granddam" isDam={true} compact />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Dam Lineage (Maternal Branch) */}
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 space-y-3">
            <p className="eyebrow text-accent">Dam Line (Maternal)</p>
            <div className="flex flex-col gap-2">
              <PedigreeCell node={dam} label="Dam (Mother)" isDam={true} />

              {/* Generation 2: Granddams */}
              <div className="grid grid-cols-2 gap-2 pl-3 border-l-2 border-accent/30">
                <div className="space-y-1.5">
                  <PedigreeCell node={mgs} label="Maternal Grandsire" isDam={false} />
                  {generations === 4 && (
                    <div className="grid grid-cols-2 gap-1 pl-2 border-l border-accent/25">
                      <PedigreeCell node={mgsSire} label="G-Grandsire" isDam={false} compact />
                      <PedigreeCell node={mgsDam} label="G-Granddam" isDam={true} compact />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <PedigreeCell node={mgd} label="Maternal Granddam" isDam={true} />
                  {generations === 4 && (
                    <div className="grid grid-cols-2 gap-1 pl-2 border-l border-accent/25">
                      <PedigreeCell node={mgdSire} label="G-Grandsire" isDam={false} compact />
                      <PedigreeCell node={mgdDam} label="G-Granddam" isDam={true} compact />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCertificate && (
        <PedigreeCertificateModal
          data={data}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </section>
  );
}

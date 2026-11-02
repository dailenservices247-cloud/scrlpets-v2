import Link from "next/link";
import type { PedigreeData, PedigreeNode } from "@/lib/creatures/pedigree";
import { Dna, ShieldCheck, Info } from "lucide-react";

function PedigreeCell({
  node,
  label,
  isDam = false,
}: {
  node?: PedigreeNode | null;
  label: string;
  isDam?: boolean;
}) {
  if (!node) {
    return (
      <div className="flex min-h-16 flex-col justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 p-2.5 text-center">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs italic text-muted-foreground/60">Unknown / Unrecorded</span>
      </div>
    );
  }

  const borderClass = isDam
    ? "border-accent/40 bg-accent/5 hover:border-accent"
    : "border-primary/40 bg-primary/5 hover:border-primary";

  return (
    <Link
      href={`/c/${node.slug}`}
      className={`group flex min-h-16 flex-col justify-center rounded-xl border p-2.5 transition focus:outline-none focus:ring-2 focus:ring-ring ${borderClass}`}
      data-testid={`pedigree-node-${node.slug}`}
    >
      <div className="flex items-center gap-2">
        {node.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.avatarUrl}
            alt=""
            className="size-7 rounded-full object-cover shrink-0"
          />
        ) : (
          <span className="grid size-7 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-brand-link shrink-0">
            {node.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold group-hover:underline">{node.name}</p>
          <p className="text-[11px] text-muted-foreground capitalize">{label}</p>
        </div>
      </div>
    </Link>
  );
}

export function PedigreeMatrix({ data }: { data: PedigreeData }) {
  const { subject, coiPercentage, commonAncestors } = data;
  const sire = subject.sire;
  const dam = subject.dam;

  // Grandsires & Granddams
  const pgs = sire?.sire;
  const pgd = sire?.dam;
  const mgs = dam?.sire;
  const mgd = dam?.dam;

  const hasAnyAncestors = Boolean(sire || dam);
  if (!hasAnyAncestors) return null;

  return (
    <section className="mx-auto max-w-2xl px-4 pt-4" data-testid="pedigree-matrix-section">
      <div className="premium-panel rounded-2xl p-4">
        {/* Header with COI Intelligence */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Dna className="size-5 text-brand-link" />
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase">Certified Pedigree</h2>
              <p className="text-xs text-muted-foreground">3-Generation Verified Lineage Tree</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                coiPercentage < 5
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : coiPercentage < 10
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              }`}
              data-testid="pedigree-coi-badge"
            >
              <ShieldCheck className="size-3.5" />
              COI: {coiPercentage}%
            </span>
          </div>
        </div>

        {/* Common Ancestors Notice if Linebred */}
        {commonAncestors.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0 mt-0.5 text-brand-link" />
            <div>
              <span className="font-semibold text-foreground">Common Ancestry Detected:</span>{" "}
              {commonAncestors.map((a) => a.name).join(", ")}. This calculated inbreeding coefficient reflects shared lineage across parental branches.
            </div>
          </div>
        )}

        {/* 3-Generation Pedigree Grid */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sire Lineage (Paternal Branch) */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="eyebrow mb-2 text-primary">Sire Line (Paternal)</p>
            <div className="flex flex-col gap-2">
              <PedigreeCell node={sire} label="Sire (Father)" isDam={false} />
              <div className="grid grid-cols-2 gap-2 pl-3 border-l-2 border-primary/30">
                <PedigreeCell node={pgs} label="Paternal Grandsire" isDam={false} />
                <PedigreeCell node={pgd} label="Paternal Granddam" isDam={true} />
              </div>
            </div>
          </div>

          {/* Dam Lineage (Maternal Branch) */}
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
            <p className="eyebrow mb-2 text-accent">Dam Line (Maternal)</p>
            <div className="flex flex-col gap-2">
              <PedigreeCell node={dam} label="Dam (Mother)" isDam={true} />
              <div className="grid grid-cols-2 gap-2 pl-3 border-l-2 border-accent/30">
                <PedigreeCell node={mgs} label="Maternal Grandsire" isDam={false} />
                <PedigreeCell node={mgd} label="Maternal Granddam" isDam={true} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

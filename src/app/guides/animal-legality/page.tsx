import { Metadata } from "next";
import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { AnimalLegalityExplorer } from "./AnimalLegalityExplorer";
import { REGULATORY_TIERS_META, SPECIES_CATALOG } from "@/lib/species/statutory-tiers";

export const metadata: Metadata = {
  title: "Companion & Exotic Animal Statutory Guide | Scrlpets",
  description:
    "Comprehensive statutory and taxonomic analysis of companion animal, domestic livestock, and exotic pet legality in the United States.",
};

export default function AnimalLegalityPage() {
  return (
    <AppPage>
      <div className="px-4 py-6">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/guides" className="hover:text-foreground hover:underline">
            Guides
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">Animal Legality & Taxonomy</span>
        </div>

        {/* Header Hero */}
        <header className="mt-4 border-b border-border/70 pb-5">
          <p className="eyebrow">Statutory Compliance & Legal Taxonomy</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Companion & Exotic Animal Legality Guide
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A comprehensive mapping of domestic, agricultural, native furbearer, and exotic pet ownership against
            the three-tiered American regulatory hierarchy: the Federal baseline, sovereign State police powers
            (Dangerous Wild Animal statutes & propagation licensing), and Municipal sanitary and zoning codes.
          </p>
        </header>

        {/* Jurisdictional Sieve Overview */}
        <section className="my-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-primary/20 text-xs font-bold text-brand-link">
                1
              </span>
              <h3 className="text-sm font-semibold text-foreground">Federal Baseline</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Governs interstate commerce, import/export quarantine (Lacey Act 18 U.S.C. § 42), biosecurity (Bsal salamander ban), and nationwide prohibition of apex felids (Big Cat Public Safety Act of 2022).
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-secondary/20 text-xs font-bold text-secondary-foreground">
                2
              </span>
              <h3 className="text-sm font-semibold text-foreground">State Police Power</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Exercises sovereign authority over possession and breeding via enumerated black-list statutes (e.g. Ohio ORC Chapter 935), captive propagation licenses (ORC § 1533.71), and PIT transponder tags.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-accent/20 text-xs font-bold text-accent-foreground">
                3
              </span>
              <h3 className="text-sm font-semibold text-foreground">Municipal & Health Code</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Enforces hyper-local public health rules, breed restrictions (e.g. Toledo TMC § 505.03 pit bull legality), 6-hen backyard flock limits (TMC § 1705.11), and urban livestock permits (TMC § 1705.05).
            </p>
          </div>
        </section>

        {/* Interactive Species & Tier Explorer Component */}
        <AnimalLegalityExplorer tiersMeta={REGULATORY_TIERS_META} catalog={SPECIES_CATALOG} />
      </div>
    </AppPage>
  );
}

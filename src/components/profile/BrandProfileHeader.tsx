import Link from "next/link";
import { Building2, Handshake, ShieldCheck, UsersRound } from "lucide-react";
import type { BrandSurface } from "@/lib/profile-identity";
import type { Profile } from "@/lib/profiles/queries";

export function BrandProfileHeader({
  brand,
  owner,
  metrics,
}: {
  brand: BrandSurface;
  owner: Profile;
  metrics: { label: string; value: string | number; testId: string }[];
}) {
  return (
    <section className="px-3 pt-4" data-testid="brand-profile-header">
      <div className="premium-panel rounded-2xl p-4">
        <header className="flex items-start gap-3">
          <div className="grid size-18 shrink-0 place-items-center rounded-2xl border border-accent/35 bg-accent/15 text-accent">
            <Building2 className="size-8" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{brand.kind}</p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight">{brand.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{brand.handle}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/brand-os"
              className="rounded-md border border-primary/35 bg-primary/15 px-3 py-2 text-center text-sm font-medium text-brand-link"
            >
              OS
            </Link>
            <Link
              href={`/u/${owner.username}`}
              className="rounded-md border border-input px-3 py-2 text-center text-sm font-medium text-brand-link"
            >
              Person
            </Link>
          </div>
        </header>

        <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{brand.description}</p>

        <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Primary operator</p>
          <Link href={`/u/${owner.username}`} className="mt-1 inline-flex min-w-0 text-sm font-semibold text-brand-link hover:underline">
            {owner.displayName ?? brand.ownerLabel} @{owner.username}
          </Link>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2" data-testid="brand-profile-metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2" data-testid={metric.testId}>
              <dt className="text-xs text-muted-foreground">{metric.label}</dt>
              <dd className="mt-1 text-lg font-semibold">{metric.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function BrandRelationshipPanel({ brand }: { brand: BrandSurface }) {
  return (
    <section className="px-3 pt-4" data-testid="brand-relationship-panel">
      <div className="grid gap-3">
        <div className="premium-panel rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-primary/35 bg-primary/15 text-brand-link">
              <UsersRound className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Operators</p>
              <h2 className="text-base font-semibold">People who can represent this brand</h2>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {brand.members.map((member) => (
              <Link
                key={`${member.name}-${member.role}`}
                href={member.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 transition hover:border-primary/50 hover:bg-muted/45"
              >
                <span className="min-w-0 truncate text-sm font-semibold">{member.name}</span>
                <span className="shrink-0 rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground">{member.role}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="premium-panel rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-secondary/35 bg-secondary/20 text-secondary-foreground">
              <Handshake className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Pack</p>
              <h2 className="text-base font-semibold">Relationships connected to this brand</h2>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {brand.packRelationships.map((relationship) => (
              <div key={relationship.label} className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold">{relationship.label}</span>
                  <span className="text-lg font-semibold text-secondary-foreground">{relationship.value}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{relationship.context}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="premium-panel rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-accent/35 bg-accent/15 text-accent">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Collaborations</p>
              <h2 className="text-base font-semibold">Partner brands for shared context</h2>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {brand.collaborations.map((collaboration) => (
              <Link
                key={collaboration.brand}
                href={collaboration.href}
                className="rounded-xl border border-border/70 bg-muted/30 p-3 transition hover:border-accent/60 hover:bg-muted/45"
              >
                <span className="block text-sm font-semibold">{collaboration.brand}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{collaboration.context}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

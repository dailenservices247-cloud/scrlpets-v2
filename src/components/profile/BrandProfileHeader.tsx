import Link from "next/link";
import { Building2 } from "lucide-react";
import type { PublicBrand } from "@/lib/brands/queries";
import type { Profile } from "@/lib/profiles/queries";

export function BrandProfileHeader({
  brand,
  typeLabel,
  owner,
  canOperate,
  metrics,
}: {
  brand: PublicBrand;
  typeLabel: string;
  owner: Profile;
  canOperate: boolean;
  metrics: { label: string; value: string | number; testId: string }[];
}) {
  return (
    <section className="px-3 pt-4" data-testid="brand-profile-header">
      <div className="premium-panel overflow-hidden rounded-2xl">
        {/* F3 / punch list A12: brand banner. */}
        {brand.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.bannerUrl}
            alt=""
            className="h-32 w-full object-cover"
            data-testid="brand-banner"
          />
        )}
        <div className="p-4">
        <header className="flex items-start gap-3">
          <div className="grid size-18 shrink-0 place-items-center overflow-hidden rounded-2xl border border-accent/35 bg-accent/15 text-accent">
            {brand.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.avatarUrl} alt={brand.name} width={72} height={72} className="size-full object-cover" />
            ) : (
              <Building2 className="size-8" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{typeLabel}</p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight">{brand.name}</h1>
            <p className="truncate text-sm text-muted-foreground">/b/{brand.slug}</p>
          </div>
          {canOperate && (
            <Link
              href={`/brand-os?brand=${brand.id}`}
              className="shrink-0 rounded-md border border-primary/35 bg-primary/15 px-3 py-2 text-center text-sm font-medium text-brand-link"
            >
              OS
            </Link>
          )}
        </header>

        <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Operated by</p>
          <Link
            href={`/u/${owner.username}`}
            className="mt-1 inline-flex min-w-0 text-sm font-semibold text-brand-link hover:underline"
          >
            {owner.displayName ?? owner.username} @{owner.username}
          </Link>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2" data-testid="brand-profile-metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2" data-testid={metric.testId}>
              <dt className="text-xs text-muted-foreground">{metric.label}</dt>
              <dd className="mt-1 text-lg font-semibold">{metric.value}</dd>
            </div>
          ))}
        </dl>
        </div>
      </div>
    </section>
  );
}

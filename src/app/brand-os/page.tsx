import Link from "next/link";
import { BadgeDollarSign, Building2, MessageCircle, PawPrint, PenSquare, UsersRound } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { BrandIdentityPanel } from "@/components/brand/BrandIdentityPanel";
import { BrandMembersPanel } from "@/components/brand/BrandMembersPanel";
import { BrandPostingSetting } from "@/components/brand/BrandPostingSetting";
import { getSessionUser } from "@/lib/auth/session";
import {
  getMyBrands,
  getBrandContentCounts,
  getBrandMembers,
} from "@/lib/brands/queries";
import { BRAND_TYPE_OPTIONS } from "@/lib/brands/types";

const quickActions = [
  { label: "Post update", icon: PenSquare, href: "/compose" },
  { label: "New listing", icon: BadgeDollarSign, href: "/compose?mode=listing" },
  { label: "Messages", icon: MessageCircle, href: "/messages" },
  { label: "New brand", icon: UsersRound, href: "/brands/new" },
];

function typeLabel(value: string): string {
  return BRAND_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? "Brand";
}

export default async function BrandOSPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const user = (await getSessionUser())!; // middleware guarantees auth on /brand-os
  const brands = await getMyBrands(user.id);
  const { brand: requestedBrandId } = await searchParams;

  if (brands.length === 0) {
    return (
      <AppPage>
        <section className="px-3 pb-3 pt-4" data-testid="brand-os-empty">
          <div className="premium-panel rounded-2xl p-6 text-center">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-accent/35 bg-accent/15 text-accent">
              <Building2 className="size-7" aria-hidden />
            </div>
            <p className="eyebrow">Brand OS</p>
            <h1 className="mt-1 text-2xl font-semibold">No brands yet</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Create a brand to post and list as a kennel, shop, rescue, or business you own.
            </p>
            <Link
              href="/brands/new"
              data-testid="brand-os-create-cta"
              className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-secondary px-5 font-semibold text-secondary-foreground"
            >
              Create a brand
            </Link>
          </div>
        </section>
      </AppPage>
    );
  }

  const brand =
    brands.find((candidate) => candidate.id === requestedBrandId) ?? brands[0];
  const [counts, members] = await Promise.all([
    getBrandContentCounts(brand.id),
    getBrandMembers(brand.id),
  ]);
  const overview = [
    { label: "Brand posts", value: counts.posts },
    { label: "Brand listings", value: counts.listings },
  ];

  return (
    <AppPage>
      <section className="px-3 pb-3 pt-4" data-testid="brand-os-header">
        <div className="premium-panel rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-accent/35 bg-accent/15 text-accent">
              <Building2 className="size-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Brand OS</p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight">{brand.name}</h1>
              <p className="mt-1 truncate text-sm text-muted-foreground">{typeLabel(brand.brandType)}</p>
              <p className="mt-1 text-xs text-secondary-foreground capitalize">
                {brand.role}
              </p>
            </div>
            <Link
              href={`/b/${brand.slug}`}
              data-testid="brand-os-public-link"
              className="shrink-0 rounded-md border border-input px-3 py-2 text-sm font-medium text-brand-link"
            >
              Public
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2" data-testid="brand-os-overview">
            {overview.map((item) => (
              <div key={item.label} className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>

          {brands.length > 1 && (
            <div className="mt-4" data-testid="brand-os-switcher">
              <p className="mb-2 text-xs text-muted-foreground">
                You can access {brands.length} brands.
              </p>
              <div className="flex flex-wrap gap-2">
                {brands.map((candidate) => (
                  <Link
                    key={candidate.id}
                    href={`/brand-os?brand=${candidate.id}`}
                    aria-current={candidate.id === brand.id ? "page" : undefined}
                    className={
                      candidate.id === brand.id
                        ? "rounded-lg border border-primary/60 bg-primary/15 px-3 py-2 text-xs font-semibold text-brand-link"
                        : "rounded-lg border border-input px-3 py-2 text-xs text-muted-foreground"
                    }
                  >
                    {candidate.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="px-3 py-3" data-testid="brand-os-quick-actions">
        <p className="eyebrow mb-3">Quick actions</p>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} href={action.href} className="premium-panel rounded-2xl p-3 transition hover:border-primary/40">
                <span className="mb-4 grid size-9 place-items-center rounded-full bg-background/65 text-brand-link">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-base font-semibold">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="px-3 py-3">
        <BrandIdentityPanel
          brandId={brand.id}
          viewerId={user.id}
          viewerRole={brand.role}
          bannerUrl={brand.bannerUrl}
          avatarUrl={brand.avatarUrl}
        />
      </section>

      <section className="px-3 py-3">
        <BrandPostingSetting
          brandId={brand.id}
          viewerRole={brand.role}
          initialRestrict={brand.restrictPostingToManagers}
        />
      </section>

      <section className="px-3 py-3">
        <BrandMembersPanel
          brandId={brand.id}
          viewerId={user.id}
          viewerRole={brand.role}
          members={members}
        />
      </section>

      <section className="px-3 py-3">
        <div className="premium-panel rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-secondary/35 bg-secondary/20 text-secondary-foreground">
              <PawPrint className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Post as this brand</p>
              <h2 className="text-lg font-semibold">Composer is wired</h2>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            In the composer, choose <span className="font-semibold text-foreground">Posting as → Brand</span> and pick{" "}
            <span className="font-semibold text-foreground">{brand.name}</span>. Brand posts and listings are attributed to
            the brand publicly, with you as the operator behind it.
          </p>
          <Link
            href={`/compose?brand=${brand.id}`}
            className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-secondary px-4 font-semibold text-secondary-foreground"
          >
            Open composer
          </Link>
        </div>
      </section>
    </AppPage>
  );
}

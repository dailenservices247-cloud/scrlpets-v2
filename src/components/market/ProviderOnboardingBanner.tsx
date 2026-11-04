"use client";

import Link from "next/link";
import {
  CalendarCheck,
  Dna,
  ShieldCheck,
  Truck,
  ArrowRight,
  Sparkles,
  Plus,
  Building2,
} from "lucide-react";

interface ProviderOnboardingBannerProps {
  viewerId?: string | null;
  compact?: boolean;
}

export function ProviderOnboardingBanner({
  viewerId,
  compact = false,
}: ProviderOnboardingBannerProps) {
  const composeHref = viewerId
    ? "/brand-os?tab=services"
    : "/login?next=/brand-os%3Ftab%3Dservices";
  const brandHref = viewerId
    ? "/brands/new"
    : "/login?next=/brands%2Fnew";

  if (compact) {
    return (
      <div
        className="premium-panel flex flex-col items-start justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center"
        data-testid="provider-onboarding-compact"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Offer Your Professional Pet Services
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Stud service, boarding, grooming, training, or pet transport. Manage bookings and deposits with zero friction.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={composeHref}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="size-3.5" aria-hidden />
            List a Service
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="premium-panel relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-5"
      data-testid="provider-onboarding-banner"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-brand-link">
            <Sparkles className="size-3.5" aria-hidden />
            Verified Marketplace Providers
          </div>
          <h2 className="mt-2.5 text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Offer Your Services to the Scrlpets Community
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Whether you stand working stud dogs, coordinate licensed pet transit, or offer training, grooming, and boarding—manage availability, client inquiries, and protected escrow deposits in one hub.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Dna className="size-4 shrink-0 text-brand-link" aria-hidden />
              <span>Stud Services</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Truck className="size-4 shrink-0 text-brand-link" aria-hidden />
              <span>Pet Transport</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarCheck className="size-4 shrink-0 text-brand-link" aria-hidden />
              <span>Calendar Sync</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-brand-link" aria-hidden />
              <span>Escrow Deposits</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col lg:items-end">
          <Link
            href={composeHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="size-4" aria-hidden />
            List Your Service
          </Link>
          <Link
            href={brandHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-input bg-background/80 px-4 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <Building2 className="size-4 text-muted-foreground" aria-hidden />
            Register Kennel or Business
            <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

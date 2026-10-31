"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Building2, Calendar, ChevronLeft, MapPin, Sparkles, UserCheck } from "lucide-react";
import { formatPrice } from "@/lib/shop/format";
import type { ProviderService } from "@/lib/services/queries";
import { ServiceContactButton } from "@/components/services/ServiceContactButton";
import { BookingRequestModal } from "@/components/services/BookingRequestModal";
import { Button } from "@/components/ui/button";

export function ServiceDetailView({
  service: s,
  viewerId,
}: {
  service: ProviderService;
  viewerId?: string | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const tierPrices = s.serviceTierRates.map((tr) => tr.priceCents).filter((p) => p > 0);
  const minPrice =
    tierPrices.length > 0
      ? Math.min(...tierPrices)
      : s.priceCents !== null && s.priceCents > 0
        ? s.priceCents
        : null;

  const returnPath = `/services/${s.id}`;
  const loginHref = `/login?next=${encodeURIComponent(returnPath)}`;

  return (
    <article className="mx-auto max-w-4xl px-4 py-6" data-testid="service-detail-view">
      {/* Breadcrumb Navigation */}
      <nav className="mb-4 flex items-center gap-2 text-meta text-muted-foreground">
        <Link
          href="/market?tab=services"
          className="inline-flex items-center gap-1 transition hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back to Services
        </Link>
        {s.brand && (
          <>
            <span>/</span>
            <Link href={`/b/${s.brand.slug}`} className="transition hover:text-foreground">
              {s.brand.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-6 md:grid-cols-5">
        {/* Left Column: Media & Details (3 cols) */}
        <div className="space-y-6 md:col-span-3">
          {s.mediaUrl && (
            <div className="overflow-hidden rounded-2xl border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.mediaUrl}
                alt={s.name}
                className="aspect-video w-full object-cover"
                data-testid="service-detail-image"
              />
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {s.category && (
              <span className="eyebrow rounded-md bg-muted/60 px-2.5 py-1 text-meta uppercase">
                {s.category}
              </span>
            )}
            {s.brand ? (
              <Link
                href={`/b/${s.brand.slug}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-meta font-medium text-brand-link hover:underline"
              >
                <Building2 className="size-3.5" aria-hidden />
                {s.brand.name}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2.5 py-1 text-meta font-medium text-muted-foreground">
                <UserCheck className="size-3.5" aria-hidden />
                Independent Specialist
              </span>
            )}
            {s.ownerVerified && (
              <span className="inline-flex items-center gap-1 rounded-md border border-secondary/40 bg-secondary/15 px-2.5 py-1 text-meta font-medium text-secondary-foreground">
                <BadgeCheck className="size-3.5" aria-hidden />
                Verified Provider
              </span>
            )}
          </div>

          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {s.name}
            </h1>
            {s.area && (
              <p className="mt-2 flex items-center gap-1.5 text-meta text-muted-foreground">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
                <span>Service Coverage: {s.area}</span>
              </p>
            )}
          </div>

          {/* Description */}
          {s.description && (
            <div className="rounded-2xl border bg-card/60 p-5 backdrop-blur-sm">
              <h2 className="eyebrow text-muted-foreground">About This Service</h2>
              <p className="mt-2 text-ui text-foreground/90 whitespace-pre-line leading-relaxed">
                {s.description}
              </p>
            </div>
          )}

          {/* Service Tier Packages */}
          {s.serviceTierRates.length > 0 && (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-serif text-title font-semibold text-foreground">
                Available Service Packages & Options
              </h2>
              <p className="mt-1 text-meta text-muted-foreground">
                Select your preferred option when requesting a booking.
              </p>
              <div className="mt-4 space-y-3">
                {s.serviceTierRates.map((tier) => (
                  <div
                    key={tier.id}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 p-4 transition hover:border-primary/40 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-semibold text-ui text-foreground">{tier.name}</p>
                      {tier.description && (
                        <p className="mt-0.5 text-meta text-muted-foreground">{tier.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-base font-bold text-foreground">
                      {formatPrice(tier.priceCents, s.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Booking Notice & Policies */}
          {(s.bookingNotice || s.depositRequired) && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <h3 className="flex items-center gap-1.5 text-ui font-semibold text-foreground">
                <Sparkles className="size-4 text-primary" aria-hidden />
                Booking Requirements & Policies
              </h3>
              {s.depositRequired && (
                <p className="mt-2 text-meta font-medium text-amber-500">
                  {s.depositAmountCents
                    ? `Deposit Required: ${formatPrice(s.depositAmountCents, s.currency)} holding deposit upon date confirmation.`
                    : "Deposit Required: Advance holding deposit applies to confirm your reservation."}
                </p>
              )}
              {s.bookingNotice && (
                <p className="mt-2 text-meta text-muted-foreground whitespace-pre-line leading-relaxed">
                  {s.bookingNotice}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Pricing & Booking Action Card (2 cols) */}
        <div className="md:col-span-2">
          <div className="sticky top-20 space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div>
              <p className="eyebrow text-muted-foreground">Pricing</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-foreground">
                  {minPrice !== null ? formatPrice(minPrice, s.currency) : "Custom Quote"}
                </span>
                {minPrice !== null && tierPrices.length > 1 && (
                  <span className="text-meta text-muted-foreground">starting price</span>
                )}
              </div>
            </div>

            {/* Provider Attribution Card */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
              <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
                Provider Information
              </p>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ui text-foreground">
                    {s.brand ? s.brand.name : `@${s.ownerUsername ?? "provider"}`}
                  </p>
                  <p className="text-meta text-muted-foreground">
                    {s.brand ? "Verified Facility" : "Direct Specialist"}
                  </p>
                </div>
                {s.brand ? (
                  <Link
                    href={`/b/${s.brand.slug}`}
                    className="rounded-lg border border-input px-3 py-1.5 text-micro font-semibold text-brand-link hover:bg-muted/60"
                  >
                    View Brand
                  </Link>
                ) : s.ownerUsername ? (
                  <Link
                    href={`/u/${s.ownerUsername}`}
                    className="rounded-lg border border-input px-3 py-1.5 text-micro font-semibold text-brand-link hover:bg-muted/60"
                  >
                    View Profile
                  </Link>
                ) : null}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              {s.bookingEnabled && (
                <Button
                  onClick={() => setModalOpen(true)}
                  className="w-full min-h-11 font-semibold"
                  data-testid="service-book-button"
                >
                  <Calendar className="mr-2 size-4" aria-hidden />
                  Request Booking
                </Button>
              )}

              <div className="flex justify-center">
                <ServiceContactButton
                  serviceId={s.id}
                  ownerId={s.ownerId}
                  viewerId={viewerId}
                  returnPath={returnPath}
                />
              </div>
            </div>

            <p className="text-center text-micro text-muted-foreground">
              Direct Deal Room coordination & escrow protection. Zero off-platform wire risks.
            </p>
          </div>
        </div>
      </div>

      {modalOpen && (
        <BookingRequestModal
          service={s}
          onClose={() => setModalOpen(false)}
          signedIn={Boolean(viewerId)}
          loginHref={loginHref}
        />
      )}
    </article>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Building2, Calendar, ShieldAlert, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { ServiceContactButton } from "@/components/services/ServiceContactButton";
import { BookingRequestModal } from "@/components/services/BookingRequestModal";
import { formatPrice } from "@/lib/shop/format";
import type { ProviderService } from "@/lib/services/queries";

/**
 * ServiceCard: Presents services offered by both independent providers (@username)
 * and commercial facilities (/b/[slug]), with support for multi-tier packages
 * and booking requests.
 */
export function ServiceCard({
  service: s,
  viewerId,
  returnPath,
}: {
  service: ProviderService;
  viewerId?: string | null;
  returnPath: string;
}) {
  const t = useTranslations("services");
  const [modalOpen, setModalOpen] = useState(false);

  // Determine starting price across tiers or base price
  const tierPrices = s.serviceTierRates.map((tr) => tr.priceCents).filter((p) => p > 0);
  const minPrice =
    tierPrices.length > 0
      ? Math.min(...tierPrices)
      : s.priceCents !== null && s.priceCents > 0
        ? s.priceCents
        : null;

  return (
    <li className="rounded-2xl border bg-card p-4 transition hover:border-primary/40" data-testid="service-card">
      {s.mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={s.mediaUrl}
          alt=""
          className="mb-3 h-44 w-full rounded-xl object-cover"
          data-testid={`service-photo-${s.id}`}
        />
      )}

      {/* Badges row: Category, Organization Type, Verification */}
      <div className="flex flex-wrap items-center gap-1.5">
        {s.category && <span className="eyebrow">{t(`category.${s.category}`)}</span>}

        {s.brand ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-micro font-medium text-brand-link"
            data-testid="badge-commercial-facility"
          >
            <Building2 className="size-3" aria-hidden />
            Commercial Facility
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-micro font-medium text-muted-foreground"
            data-testid="badge-independent-provider"
          >
            <UserCheck className="size-3" aria-hidden />
            Independent Specialist
          </span>
        )}

        {s.ownerVerified ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-micro text-secondary-foreground"
            data-testid={`service-verified-${s.id}`}
          >
            <BadgeCheck className="size-3" aria-hidden />
            {t("providerVerified")}
          </span>
        ) : (
          <span
            className="rounded-md border border-input px-2 py-0.5 text-micro text-muted-foreground"
            data-testid={`service-unverified-${s.id}`}
          >
            {t("providerUnverified")}
          </span>
        )}

        {s.depositRequired && (
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-micro font-medium text-amber-400">
            Deposit Required
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-2">
        <p className="font-semibold text-base text-foreground leading-snug">{s.name}</p>
        <span className="shrink-0 font-mono text-sm font-bold text-foreground">
          {minPrice !== null ? (
            tierPrices.length > 0 ? (
              <span>From {formatPrice(minPrice, s.currency)}</span>
            ) : (
              formatPrice(minPrice, s.currency)
            )
          ) : (
            t("contactForQuote")
          )}
        </span>
      </div>

      {s.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {s.description}
        </p>
      )}

      {/* Tiers preview */}
      {s.serviceTierRates.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {s.serviceTierRates.map((tier) => (
            <span
              key={tier.id}
              className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/20 px-2 py-0.5 text-micro text-muted-foreground"
            >
              <span className="font-medium text-foreground">{tier.name}</span>
              <span className="font-mono text-brand-link font-semibold">
                {formatPrice(tier.priceCents, s.currency)}
              </span>
            </span>
          ))}
        </div>
      )}

      {s.bookingNotice && (
        <p className="mt-2 flex items-center gap-1.5 text-micro text-amber-400/90">
          <ShieldAlert className="size-3 shrink-0" />
          <span className="truncate">{s.bookingNotice}</span>
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {s.area && <span>📍 {s.area}</span>}
        {s.brand ? (
          <Link href={`/b/${s.brand.slug}`} className="text-brand-link underline font-medium">
            {s.brand.name}
          </Link>
        ) : (
          <Link href={`/u/${s.ownerUsername}`} className="text-brand-link underline font-medium">
            @{s.ownerUsername}
          </Link>
        )}
      </div>

      {/* Action buttons: Request Booking (primary) & Message / Contact */}
      <div className="mt-4 flex items-center gap-2.5">
        {s.bookingEnabled ? (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99]"
            data-testid={`service-request-booking-${s.id}`}
          >
            <Calendar className="size-4" aria-hidden />
            Request Booking
          </button>
        ) : null}

        <ServiceContactButton
          serviceId={s.id}
          ownerId={s.ownerId}
          viewerId={viewerId}
          returnPath={returnPath}
        />
      </div>

      {modalOpen && (
        <BookingRequestModal
          service={s}
          onClose={() => setModalOpen(false)}
          signedIn={Boolean(viewerId)}
          loginHref={`/login?next=${encodeURIComponent(returnPath)}`}
        />
      )}
    </li>
  );
}

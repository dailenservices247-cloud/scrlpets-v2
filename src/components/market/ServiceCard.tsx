import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { ServiceContactButton } from "@/components/services/ServiceContactButton";
import { formatPrice } from "@/lib/shop/format";
import type { ProviderService } from "@/lib/services/queries";

/**
 * Lifted verbatim out of the old /services page when it merged into /market —
 * same testids, same R17 honesty about what "verified" does and does not mean.
 */
export function ServiceCard({
  service: s,
  viewerId,
  returnPath,
}: {
  service: ProviderService;
  viewerId?: string;
  returnPath: string;
}) {
  const t = useTranslations("services");
  return (
    <li className="rounded-2xl border bg-card p-4" data-testid="service-card">
      {s.mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={s.mediaUrl}
          alt=""
          className="mb-3 h-40 w-full rounded-xl object-cover"
          data-testid={`service-photo-${s.id}`}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {s.category && <span className="eyebrow">{t(`category.${s.category}`)}</span>}
        {s.ownerVerified ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-secondary/40 bg-secondary/15 px-2 py-0.5 text-xs text-secondary-foreground"
            data-testid={`service-verified-${s.id}`}
          >
            <BadgeCheck className="size-3.5" aria-hidden />
            {t("providerVerified")}
          </span>
        ) : (
          <span
            className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground"
            data-testid={`service-unverified-${s.id}`}
          >
            {t("providerUnverified")}
          </span>
        )}
      </div>
      <p className="mt-2 font-semibold">{s.name}</p>
      {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {s.area && <span>{s.area}</span>}
        <span>
          {s.priceCents !== null && s.priceCents > 0
            ? formatPrice(s.priceCents, s.currency)
            : t("contactForQuote")}
        </span>
        {s.brand ? (
          <Link href={`/b/${s.brand.slug}`} className="text-brand-link underline">
            {s.brand.name}
          </Link>
        ) : (
          <Link href={`/u/${s.ownerUsername}`} className="text-brand-link underline">
            @{s.ownerUsername}
          </Link>
        )}
      </div>
      <div className="mt-3">
        <ServiceContactButton
          serviceId={s.id}
          ownerId={s.ownerId}
          viewerId={viewerId}
          returnPath={returnPath}
        />
      </div>
    </li>
  );
}

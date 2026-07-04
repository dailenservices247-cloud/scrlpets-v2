"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { capture } from "@/lib/analytics";
import { startListingInquiry } from "@/lib/marketplace/actions";

function errorKey(error: string): string {
  const keys = [
    "listing_unavailable",
    "self_inquiry",
    "auth_required",
  ];
  return keys.find((key) => error.includes(key)) ?? "inquiry_failed";
}

export function ListingInquiryPanel({
  listingId,
  sellerId,
  priceCents,
  viewerId,
  viewerIsOperator,
}: {
  listingId: string;
  sellerId: string;
  priceCents: number;
  viewerId?: string | null;
  viewerIsOperator: boolean;
}) {
  const t = useTranslations("marketplace");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSeller = viewerId === sellerId || viewerIsOperator;
  const price = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  }).format(priceCents / 100);
  const returnPath = `/listing/${listingId}`;

  async function start() {
    setBusy(true);
    setError(null);
    const result = await startListingInquiry(listingId);
    setBusy(false);
    if (!result.ok) {
      const key = errorKey(result.error);
      setError(key);
      capture("listing_inquiry_started", { outcome: key });
      return;
    }
    capture("listing_inquiry_started", {
      outcome: result.created ? "created" : "existing",
    });
    router.push(`/messages/${result.conversationId}`);
  }

  return (
    <section
      className="premium-panel rounded-2xl p-4"
      data-testid="listing-inquiry-panel"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{t("label")}</p>
          <h2 className="mt-1 text-2xl font-semibold" data-testid="listing-price">
            {price}
          </h2>
        </div>
        <span className="rounded-full border border-secondary/40 bg-secondary/10 px-2.5 py-1 text-xs text-secondary-foreground">
          {t("inquiryOnly")}
        </span>
      </div>

      <div className="mt-4 flex gap-3 rounded-xl border border-secondary/30 bg-secondary/10 p-3">
        <ShieldCheck
          className="mt-0.5 size-5 shrink-0 text-secondary-foreground"
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold">{t("evidenceTitle")}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("evidenceBody")}
          </p>
        </div>
      </div>

      {isSeller ? (
        <p
          className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground"
          data-testid="listing-owner-state"
        >
          {t("operatorState")}
        </p>
      ) : viewerId ? (
        <button
          type="button"
          disabled={busy}
          onClick={start}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
          data-testid="start-listing-inquiry"
        >
          <MessageCircle className="size-4" aria-hidden />
          {busy ? t("starting") : t("ask")}
        </button>
      ) : (
        <Link
          href={`/login?next=${encodeURIComponent(returnPath)}`}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
          data-testid="listing-inquiry-signin"
        >
          <MessageCircle className="size-4" aria-hidden />
          {t("signIn")}
        </Link>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-200" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
    </section>
  );
}

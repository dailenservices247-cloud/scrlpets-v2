"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { submitApplication } from "@/lib/applications/actions";

/**
 * D13 buyer application / waitlist. D10: where a Buy button would go, this
 * says plainly that checkout is not switched on rather than rendering a
 * control that cannot work.
 */
export function ApplyPanel({
  sellerId,
  listingId,
  viewerId,
  viewerIsSeller,
  hasOpenApplication,
  paymentsEnabled,
  isAnimal = true,
  stockQuantity = null,
}: {
  sellerId: string;
  listingId: string | null;
  viewerId: string | undefined;
  viewerIsSeller: boolean;
  hasOpenApplication: boolean;
  paymentsEnabled: boolean;
  isAnimal?: boolean;
  stockQuantity?: number | null;
}) {
  const t = useTranslations("applications");
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (viewerIsSeller) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await submitApplication(sellerId, listingId, message);
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "already_applied" ? t("alreadyApplied") : result.error);
      return;
    }
    setDone(true);
    router.refresh();
  }

  const isOutOfStock = !isAnimal && stockQuantity === 0;

  return (
    <section className="rounded-2xl border bg-card p-4" data-testid="apply-panel">
      <h2 className="text-sm font-semibold">
        {!isAnimal
          ? isOutOfStock
            ? "Out of Stock — Inquire or Backorder"
            : "Product Inquiry & Direct Message"
          : listingId
            ? t("applyTitle")
            : t("waitlistTitle")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {!isAnimal
          ? isOutOfStock
            ? "This item is currently sold out. Message the seller to reserve from the next restock."
            : "Ask questions about specifications, sizing, custom crafts, or shipping options."
          : listingId
            ? t("applyHelp")
            : t("waitlistHelp")}
      </p>

      {/* Only a listing can be checked out. On a waitlist there is nothing to
          buy, so "checkout is switched off" would answer a question nobody
          asked. */}
      {!paymentsEnabled && listingId && (
        <p className="mt-3 text-xs text-muted-foreground" data-testid="checkout-off">
          {t("checkoutOff")}
        </p>
      )}

      {/* The buy route only appears when it can actually be walked. Offering a
          button that leads to "buying is not switched on" is a worse answer than
          the sentence already above. */}
      {paymentsEnabled && listingId && viewerId && !viewerIsSeller && !isOutOfStock && (
        <Link
          href={`/checkout/${listingId}`}
          className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
          data-testid="apply-buy"
        >
          {t("buyNow")}
        </Link>
      )}

      {!viewerId ? (
        <Link
          href="/login"
          className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          {t("signInToApply")}
        </Link>
      ) : done || hasOpenApplication ? (
        <p className="mt-4 text-sm font-medium" data-testid="application-open">
          {t("applicationOpen")}{" "}
          <Link href="/applications" className="text-brand-link underline">
            {t("viewApplications")}
          </Link>
        </p>
      ) : (
        <>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              !isAnimal
                ? "Send a message or question to the seller..."
                : t("messagePlaceholder")
            }
            aria-label={
              !isAnimal
                ? "Send a message or question to the seller..."
                : t("messagePlaceholder")
            }
            data-testid="application-message"
            className="mt-3 min-h-24 w-full rounded-xl border border-input bg-transparent p-3 text-sm"
          />
          {error && (
            <p className="mt-2 text-xs text-destructive" data-testid="application-error">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            data-testid="application-submit"
            className="mt-2 min-h-11 w-full rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/35 disabled:opacity-50"
          >
            {!isAnimal
              ? isOutOfStock
                ? "Join Restock Waitlist"
                : "Send Inquiry"
              : listingId
                ? t("submitApplication")
                : t("joinWaitlist")}
          </button>
        </>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createOrder } from "@/lib/orders/actions";
import { findTransporters } from "@/lib/checkout/actions";
import { formatPrice } from "@/lib/shop/format";
import type { CheckoutListing, CheckoutTransporter } from "@/lib/checkout/queries";

type Fulfilment = "in_person" | "transported" | "shipped";

/**
 * How the animal gets to the buyer decides what else is asked, and what releases
 * the money later:
 *
 *   in_person    they collect it; code + anchor at the meeting
 *   transported  a booked driver; code + anchor at the door
 *   shipped      a carrier; tracking plus a live-arrival window
 *
 * The choice is made here rather than assumed, because a shipped tarantula and a
 * collected puppy cannot share a release rule.
 */
export function CheckoutFlow({
  listing,
  paymentsEnabled,
}: {
  listing: CheckoutListing;
  paymentsEnabled: boolean;
}) {
  const t = useTranslations("checkout");
  // The app's own formatter, not a local one. A checkout that renders $1200.00
  // beside a listing page showing $1,200.00 reads as two different prices.
  const price = (cents: number) => formatPrice(cents, listing.currency);
  const router = useRouter();

  const [fulfilment, setFulfilment] = useState<Fulfilment>("in_person");
  const [fromRegion, setFromRegion] = useState("");
  const [toRegion, setToRegion] = useState("");
  const [transporters, setTransporters] = useState<CheckoutTransporter[] | null>(null);
  const [chosenTransporter, setChosenTransporter] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = Math.round((listing.priceCents * listing.depositBps) / 10000);
  const transportCost =
    transporters?.find((x) => x.serviceId === chosenTransporter)?.priceCents ?? 0;

  async function lookUpRoute() {
    setSearching(true);
    setChosenTransporter(null);
    const found = await findTransporters(
      fromRegion.trim().toUpperCase(),
      toRegion.trim().toUpperCase(),
      listing.recommendedTransportServiceId,
    );
    setTransporters(found);
    setSearching(false);
  }

  async function place() {
    setBusy(true);
    setError(null);
    const result = await createOrder(
      listing.id,
      fulfilment === "transported" && chosenTransporter
        ? {
            serviceId: chosenTransporter,
            pickupRegion: fromRegion.trim().toUpperCase(),
            deliveryRegion: toRegion.trim().toUpperCase(),
          }
        : undefined,
    );
    setBusy(false);
    if (!result.ok) {
      // Each refusal names itself. These are real gates a buyer can act on —
      // "something went wrong" would send them nowhere.
      const named: Record<string, string> = {
        payments_disabled: t("errorPaymentsOff"),
        buyer_verification_required: t("errorVerifyFirst"),
        seller_cannot_receive_payouts: t("errorSellerNotPayable"),
        transporter_not_bookable: t("errorTransporterUnavailable"),
        route_not_covered: t("errorRouteNotCovered"),
        listing_unavailable: t("errorUnavailable"),
        cannot_buy_own_listing: t("errorOwnListing"),
      };
      const key = Object.keys(named).find((k) => result.error.includes(k));
      setError(key ? named[key] : t("errorGeneric"));
      return;
    }
    router.push("/applications");
  }

  const needsRoute = fulfilment === "transported";
  const routeReady = !needsRoute || Boolean(chosenTransporter);

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------------------------------------------------- fulfilment */}
      <section className="premium-panel rounded-2xl p-4" data-testid="checkout-fulfilment">
        <p className="eyebrow">{t("fulfilmentTitle")}</p>
        <div className="mt-2 flex flex-col gap-2">
          {(["in_person", "transported", "shipped"] as Fulfilment[]).map((mode) => (
            <label key={mode} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="fulfilment"
                checked={fulfilment === mode}
                onChange={() => {
                  setFulfilment(mode);
                  setChosenTransporter(null);
                }}
                data-testid={`fulfilment-${mode}`}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{t(`fulfilment.${mode}`)}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(`fulfilmentHelp.${mode}`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- transport */}
      {needsRoute && (
        <section className="premium-panel rounded-2xl p-4" data-testid="checkout-transport">
          <p className="eyebrow">{t("transportTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("transportHelp")}</p>
          <div className="mt-2 flex gap-2">
            <input
              className="min-h-11 w-24 rounded-xl border border-input bg-transparent px-3 text-sm uppercase"
              placeholder={t("fromRegion")}
              aria-label={t("fromRegion")}
              maxLength={2}
              value={fromRegion}
              onChange={(e) => setFromRegion(e.target.value)}
              data-testid="checkout-from-region"
            />
            <input
              className="min-h-11 w-24 rounded-xl border border-input bg-transparent px-3 text-sm uppercase"
              placeholder={t("toRegion")}
              aria-label={t("toRegion")}
              maxLength={2}
              value={toRegion}
              onChange={(e) => setToRegion(e.target.value)}
              data-testid="checkout-to-region"
            />
            <Button
              type="button"
              variant="outline"
              onClick={lookUpRoute}
              disabled={searching || fromRegion.length !== 2 || toRegion.length !== 2}
              data-testid="checkout-find-transport"
            >
              {searching ? t("searching") : t("findTransport")}
            </Button>
          </div>

          {transporters?.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground" data-testid="checkout-no-transport">
              {t("noTransport")}
            </p>
          )}

          {transporters && transporters.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2" data-testid="checkout-transport-options">
              {transporters.map((option) => (
                <li key={option.serviceId}>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      name="transporter"
                      checked={chosenTransporter === option.serviceId}
                      onChange={() => setChosenTransporter(option.serviceId)}
                      data-testid={`transporter-${option.serviceId}`}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">{option.serviceName}</span>
                      {option.priceCents !== null && ` · ${price(option.priceCents)}`}
                      {/* Labelled as the SELLER's suggestion, never pre-selected:
                          a seller may recommend, never require. */}
                      {option.recommended && (
                        <span className="ml-2 rounded-full border px-2 py-0.5 text-xs" data-testid="transporter-recommended">
                          {t("sellerRecommends")}
                        </span>
                      )}
                      {option.contactNote && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {option.contactNote}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* --------------------------------------------------------------- summary */}
      <section className="premium-panel rounded-2xl p-4" data-testid="checkout-summary">
        <p className="eyebrow">{t("summaryTitle")}</p>
        <dl className="mt-2 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt>{t("linePrice")}</dt>
            <dd>{price(listing.priceCents)}</dd>
          </div>
          {transportCost > 0 && (
            <div className="flex justify-between" data-testid="line-transport">
              <dt>{t("lineTransport")}</dt>
              <dd>{price(transportCost)}</dd>
            </div>
          )}
          {deposit > 0 && (
            <div className="flex justify-between text-muted-foreground" data-testid="line-deposit">
              <dt>{t("lineDeposit")}</dt>
              <dd>{price(deposit)}</dd>
            </div>
          )}
        </dl>
        {/* The platform fee is NOT shown as a number here. create_order derives it
            from the seller's tier and freezes it; printing a guess would be a
            second figure that could disagree with the charge. */}
        <p className="mt-2 text-xs text-muted-foreground">{t("feeNote")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("holdNote", { hours: listing.inspectionHours })}
        </p>
        {listing.guaranteeHeadline && (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="checkout-guarantee">
            {listing.guaranteeHeadline}
          </p>
        )}
      </section>

      {!paymentsEnabled && (
        <p className="text-sm text-muted-foreground" data-testid="checkout-payments-off">
          {t("errorPaymentsOff")}
        </p>
      )}

      <Button
        type="button"
        onClick={place}
        disabled={busy || !paymentsEnabled || !routeReady}
        data-testid="checkout-place-order"
      >
        {busy ? t("placing") : t("placeOrder")}
      </Button>

      {error && (
        <p className="text-sm text-destructive" data-testid="checkout-error">
          {error}
        </p>
      )}
    </div>
  );
}

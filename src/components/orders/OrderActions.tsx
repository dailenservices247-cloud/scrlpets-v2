"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { availableActions, type OrderView } from "@/lib/orders/available-actions";
import {
  acceptDelivery,
  advanceOrder,
  confirmAnimalReturned,
  confirmHandover,
  confirmPickup,
  disputeOrder,
  getHandoverCode,
  markDispatched,
  recordShipment,
  setOrderAddresses,
  type OrderResult,
} from "@/lib/orders/actions";

/**
 * The order's controls.
 *
 * Which controls exist is decided by `availableActions`, which mirrors the
 * database's own guards. This component decides nothing about permission — it
 * renders what that function returns, calls the definer, and shows the
 * definer's refusal verbatim when the two disagree. A hidden button and a
 * refused call must agree; when they do not, the database is right and the page
 * revalidates on the refusal.
 */
export function OrderActions({
  order,
  viewerId,
}: {
  order: OrderView & { id: string };
  viewerId: string;
}) {
  const t = useTranslations("orderActions");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [anchor, setAnchor] = useState("");
  const [handoverCode, setHandoverCode] = useState("");
  const [reason, setReason] = useState("");

  const kinds = availableActions(order, viewerId);

  /** The database's refusal reasons, said plainly. Anything unmapped falls through. */
  function explain(raw: string): string {
    const map: Record<string, string> = {
      payments_disabled: "errorPaymentsOff",
      not_the_seller: "errorNotTheSeller",
      not_the_buyer: "errorNotTheBuyer",
      not_a_party: "errorNotAParty",
      code_mismatch: "errorCodeMismatch",
      anchor_mismatch: "errorAnchorMismatch",
      tracking_required: "errorTrackingRequired",
      reason_required: "errorReasonRequired",
      order_closed: "errorOrderClosed",
      invalid_transition: "errorInvalidTransition",
    };
    const hit = Object.keys(map).find((k) => raw.includes(k));
    return t(hit ? map[hit] : "errorGeneric");
  }

  async function run(fn: () => Promise<OrderResult>) {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (!result.ok) {
      setError(explain(result.error));
      // Refresh even on refusal: the most likely cause is that this page's idea
      // of the order is stale.
      router.refresh();
      return;
    }
    router.refresh();
  }

  if (kinds.length === 0) {
    return (
      <section className="premium-panel rounded-2xl p-4" data-testid="order-actions-none">
        <h2 className="text-sm font-semibold">{t("noneTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("noneBody")}</p>
      </section>
    );
  }

  const wantsPickupAddress = kinds.includes("set_pickup_address");

  return (
    <section
      className="premium-panel flex flex-col gap-3 rounded-2xl p-4"
      data-testid="order-actions"
    >
      <h2 className="text-sm font-semibold">{t("title")}</h2>

      {(wantsPickupAddress || kinds.includes("set_delivery_address")) && (
        <div className="flex flex-col gap-2" data-testid="order-action-address">
          <label className="text-xs text-muted-foreground" htmlFor="oa-address">
            {wantsPickupAddress ? t("setPickupAddress") : t("setDeliveryAddress")}
          </label>
          <input
            id="oa-address"
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("addressLine")}
            aria-label={t("addressLine")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            data-testid="order-address-line"
          />
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("addressPhone")}
            aria-label={t("addressPhone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-testid="order-address-phone"
          />
          <Button
            type="button"
            disabled={busy || address.trim() === ""}
            data-testid="order-address-save"
            onClick={() =>
              run(() =>
                setOrderAddresses(
                  order.id,
                  wantsPickupAddress
                    ? { pickup: address, pickupPhone: phone }
                    : { delivery: address, deliveryPhone: phone },
                ),
              )
            }
          >
            {busy ? t("working") : t("addressSave")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("addressSaved")}</p>
        </div>
      )}

      {kinds.includes("mark_dispatched") && (
        <Button
          type="button"
          disabled={busy}
          data-testid="order-mark-dispatched"
          onClick={() => run(() => markDispatched(order.id))}
        >
          {busy ? t("working") : t("markDispatched")}
        </Button>
      )}

      {kinds.includes("record_shipment") && (
        <div className="flex flex-col gap-2" data-testid="order-action-shipment">
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("carrier")}
            aria-label={t("carrier")}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            data-testid="order-carrier"
          />
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("tracking")}
            aria-label={t("tracking")}
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            data-testid="order-tracking"
          />
          <Button
            type="button"
            disabled={busy || tracking.trim() === ""}
            data-testid="order-record-shipment"
            onClick={() => run(() => recordShipment(order.id, carrier, tracking))}
          >
            {busy ? t("working") : t("recordShipment")}
          </Button>
        </div>
      )}

      {kinds.includes("confirm_pickup") && (
        <div className="flex flex-col gap-2" data-testid="order-action-pickup">
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("anchorPrompt")}
            aria-label={t("anchorPrompt")}
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            data-testid="order-anchor"
          />
          <Button
            type="button"
            disabled={busy || anchor.trim() === ""}
            data-testid="order-confirm-pickup"
            onClick={() => run(() => confirmPickup(order.id, anchor.trim()))}
          >
            {busy ? t("working") : t("confirmPickup")}
          </Button>
        </div>
      )}

      {kinds.includes("confirm_handover") && (
        <div className="flex flex-col gap-2" data-testid="order-action-handover">
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("codePrompt")}
            aria-label={t("codePrompt")}
            value={handoverCode}
            onChange={(e) => setHandoverCode(e.target.value)}
            data-testid="order-handover-code-input"
          />
          <input
            className="rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("anchorPrompt")}
            aria-label={t("anchorPrompt")}
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            data-testid="order-handover-anchor"
          />
          <Button
            type="button"
            disabled={busy || handoverCode.trim() === "" || anchor.trim() === ""}
            data-testid="order-confirm-handover"
            onClick={() => run(() => confirmHandover(order.id, handoverCode.trim(), anchor.trim()))}
          >
            {busy ? t("working") : t("confirmHandover")}
          </Button>
        </div>
      )}

      {kinds.includes("show_handover_code") && (
        <div className="flex flex-col gap-2" data-testid="order-action-code">
          {code === null ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              data-testid="order-show-code"
              onClick={async () => {
                setBusy(true);
                setCode((await getHandoverCode(order.id)) ?? "");
                setBusy(false);
              }}
            >
              {busy ? t("working") : t("showHandoverCode")}
            </Button>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t("yourCode")}</p>
              <p className="font-mono text-lg" data-testid="order-handover-code">
                {code}
              </p>
              <p className="text-xs text-muted-foreground">{t("codeHelp")}</p>
            </>
          )}
        </div>
      )}

      {kinds.includes("accept_delivery") && (
        <div className="flex flex-col gap-2" data-testid="order-action-accept">
          <Button
            type="button"
            disabled={busy}
            data-testid="order-accept-delivery"
            onClick={() => run(() => acceptDelivery(order.id))}
          >
            {busy ? t("working") : t("acceptDelivery")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("acceptHelp")}</p>
        </div>
      )}

      {kinds.includes("confirm_animal_returned") && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          data-testid="order-confirm-returned"
          onClick={() => run(() => confirmAnimalReturned(order.id))}
        >
          {busy ? t("working") : t("confirmAnimalReturned")}
        </Button>
      )}

      {kinds.includes("dispute") && (
        <div className="flex flex-col gap-2" data-testid="order-action-dispute">
          <textarea
            className="min-h-16 rounded-xl border border-input bg-transparent p-2 text-sm"
            placeholder={t("disputeReason")}
            aria-label={t("disputeReason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            data-testid="order-dispute-reason"
          />
          <Button
            type="button"
            variant="destructive"
            disabled={busy || reason.trim() === ""}
            data-testid="order-dispute"
            onClick={() => run(() => disputeOrder(order.id, reason.trim()))}
          >
            {busy ? t("working") : t("disputeSubmit")}
          </Button>
        </div>
      )}

      {kinds.includes("cancel") && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          data-testid="order-cancel"
          onClick={() => run(() => advanceOrder(order.id, "cancelled"))}
        >
          {busy ? t("working") : t("cancel")}
        </Button>
      )}

      {error && (
        <p className="text-sm text-destructive" data-testid="order-actions-error">
          {error}
        </p>
      )}
    </section>
  );
}

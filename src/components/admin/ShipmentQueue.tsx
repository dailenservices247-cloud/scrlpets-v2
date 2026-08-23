"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { confirmShipmentDelivered } from "@/lib/admin/shipments";
import type { OverdueShipment } from "@/lib/admin/shipments";

/**
 * Shipped orders that stopped.
 *
 * A shipped order reaches `dispatched` when the seller records tracking, and
 * only a carrier's word moves it on — `confirm_shipment_delivered` is revoked
 * from every client role precisely so a seller cannot declare their own
 * delivery. With no carrier integration, this queue is that word: a human
 * reading a tracking page.
 *
 * Sits beside the dispute queue because both are how a stuck order gets
 * unstuck, and both hold someone's money while they wait.
 */
export function ShipmentQueue({ rows }: { rows: OverdueShipment[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});

  /** The definer's refusals, said plainly. Anything unmapped falls through. */
  function explain(raw: string): string {
    if (raw.includes("not_admin")) return t("shipmentErrorNotAdmin");
    if (raw.includes("not_dispatched")) return t("shipmentErrorNotDispatched");
    if (raw.includes("not_a_shipped_order")) return t("shipmentErrorNotShipped");
    return t("shipmentErrorGeneric");
  }

  async function confirm(orderId: string) {
    setBusy(orderId);
    setError((e) => ({ ...e, [orderId]: "" }));
    const result = await confirmShipmentDelivered(orderId);
    setBusy(null);
    if (!result.ok) {
      setError((e) => ({ ...e, [orderId]: explain(result.error) }));
      return;
    }
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <p
        className="py-6 text-center text-sm text-muted-foreground"
        data-testid="shipment-queue-empty"
      >
        {t("shipmentsEmpty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="shipment-queue">
      {rows.map((r) => (
        <li
          key={r.order_id}
          className="premium-panel rounded-2xl p-4"
          data-testid="admin-shipment-row"
        >
          <p className="text-sm font-semibold">
            {t("shipmentCarrier")}: {r.carrier ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("shipmentTracking")}: {r.tracking_number ?? "—"} · {t("shipmentShipped")}:{" "}
            {r.shipped_at?.slice(0, 10) ?? "—"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{t("shipmentHelp")}</p>
          <button
            type="button"
            onClick={() => confirm(r.order_id)}
            disabled={busy === r.order_id}
            data-testid={`shipment-confirm-${r.order_id}`}
            className="mt-3 min-h-11 w-full rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
          >
            {busy === r.order_id ? t("shipmentConfirming") : t("shipmentConfirmDelivered")}
          </button>
          {error[r.order_id] && (
            <p
              className="mt-2 text-sm text-destructive"
              data-testid={`shipment-error-${r.order_id}`}
            >
              {error[r.order_id]}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

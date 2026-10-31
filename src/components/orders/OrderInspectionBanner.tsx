"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptDelivery } from "@/lib/orders/actions";

export type OrderInspectionBannerProps = {
  orderId: string;
  status: string;
  isBuyer: boolean;
  isSeller: boolean;
  isTransporter: boolean;
  inspectionEndsAt: string | null;
  inspectionHours: number;
  handoverAt: string | null;
};

export function OrderInspectionBanner({
  orderId,
  status,
  isBuyer,
  isSeller,
  isTransporter,
  inspectionEndsAt,
  inspectionHours,
  handoverAt,
}: OrderInspectionBannerProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute target end timestamp
  const targetEnd = inspectionEndsAt
    ? new Date(inspectionEndsAt).getTime()
    : handoverAt
      ? new Date(handoverAt).getTime() + inspectionHours * 3600 * 1000
      : null;

  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(() =>
    targetEnd !== null ? Math.max(0, targetEnd - Date.now()) : null,
  );

  useEffect(() => {
    if (!targetEnd) return;
    const update = () => {
      setTimeLeftMs(Math.max(0, targetEnd - Date.now()));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetEnd]);

  if (status !== "inspection") return null;

  function formatTime(ms: number) {
    const totalSecs = Math.floor(ms / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    parts.push(`${hours.toString().padStart(2, "0")}h`);
    parts.push(`${minutes.toString().padStart(2, "0")}m`);
    parts.push(`${seconds.toString().padStart(2, "0")}s`);
    return parts.join(" ");
  }

  async function handleAccept() {
    setBusy(true);
    setError(null);
    const res = await acceptDelivery(orderId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const isExpired = timeLeftMs !== null && timeLeftMs <= 0;
  const formattedEndDate = targetEnd
    ? new Date(targetEnd).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div
      className="premium-panel flex flex-col gap-3.5 rounded-2xl border-2 border-primary/40 bg-primary/10 p-4 shadow-sm"
      data-testid="order-inspection-banner"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-primary/20 text-brand-link">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {isBuyer
                ? "Buyer Inspection & Health Verification Period"
                : isSeller
                  ? "Buyer Inspection Window Active"
                  : isTransporter
                    ? "Handover Verified — In Buyer Inspection"
                    : "Inspection Window Active"}
            </h2>
            <p className="text-micro text-muted-foreground">
              Standard {inspectionHours}-Hour Escrow Protection Window
            </p>
          </div>
        </div>

        {targetEnd && (
          <div
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 font-mono text-xs font-bold ${
              isExpired
                ? "border-muted bg-muted/60 text-muted-foreground"
                : "border-primary/50 bg-primary/20 text-brand-link"
            }`}
            data-testid="inspection-countdown-timer"
          >
            <Clock className="size-3.5" aria-hidden />
            <span>
              {isExpired ? "Window Concluded" : timeLeftMs !== null ? formatTime(timeLeftMs) : "—"}
            </span>
          </div>
        )}
      </div>

      <div className="text-xs leading-relaxed text-muted-foreground">
        {isBuyer ? (
          <>
            You have until{" "}
            <strong className="text-foreground">{formattedEndDate ?? "the window ends"}</strong> to
            conduct your initial veterinary health examination, microchip check, and verify
            temperament and condition against the agreed contract. If satisfied, you can release
            funds to the seller immediately. If an undisclosed defect or illness is detected, file a
            dispute before the timer concludes.
          </>
        ) : isSeller ? (
          <>
            The animal was successfully handed over with security code and microchip verification.
            The buyer has until{" "}
            <strong className="text-foreground">{formattedEndDate ?? "the window ends"}</strong> to
            complete their standard inspection. Escrow funds will automatically release to your
            payout balance when the countdown finishes, unless the buyer confirms early or opens a
            dispute.
          </>
        ) : (
          <>
            Delivery was completed. The buyer is within their {inspectionHours}-hour inspection
            window. Payout will settle per your transporter agreement.
          </>
        )}
      </div>

      {isBuyer && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            type="button"
            disabled={busy}
            onClick={handleAccept}
            className="rounded-xl font-semibold shadow-sm"
            data-testid="accept-delivery-from-banner"
          >
            {busy ? (
              "Releasing..."
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 size-4" aria-hidden />
                Accept Delivery & Release Funds
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const disputeBox = document.querySelector('[data-testid="order-action-dispute"]');
              if (disputeBox) {
                disputeBox.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
            data-testid="jump-to-dispute-btn"
          >
            <AlertTriangle className="mr-1.5 size-3.5" aria-hidden />
            Report Issue / Dispute
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs font-medium text-destructive" data-testid="inspection-banner-error">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, PawPrint, ShieldAlert, Sparkles, X } from "lucide-react";
import type { ProviderService, ServiceTierRate } from "@/lib/services/queries";
import { requestServiceBooking } from "@/lib/services/actions";
import { formatPrice } from "@/lib/shop/format";

export function BookingRequestModal({
  service,
  onClose,
  signedIn,
  loginHref,
}: {
  service: ProviderService;
  onClose: () => void;
  signedIn: boolean;
  loginHref: string;
}) {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<ServiceTierRate | null>(
    service.serviceTierRates.length > 0 ? service.serviceTierRates[0] : null,
  );
  const [preferredDate, setPreferredDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("Afternoon (12pm - 5pm)");
  const [creatureName, setCreatureName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!preferredDate) {
      setError("Please choose a preferred date.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await requestServiceBooking(service.id, {
        tierName: selectedTier ? selectedTier.name : null,
        tierPriceCents: selectedTier ? selectedTier.priceCents : service.priceCents,
        preferredDate,
        preferredTimeWindow: timeWindow,
        creatureName: creatureName.trim() || null,
        clientNotes: notes.trim() || null,
      });

      if (res.ok) {
        onClose();
        router.push(`/messages/${res.conversationId}`);
      } else {
        setError(res.error || "Unable to send booking request.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      data-testid="booking-request-modal"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2 text-xs font-medium text-brand-link">
          <Calendar className="size-4" />
          <span>Request Appointment</span>
        </div>
        <h2 className="mt-1 text-lg font-semibold text-foreground">{service.name}</h2>
        <p className="text-xs text-muted-foreground">
          {service.brand ? service.brand.name : `@${service.ownerUsername}`}
        </p>

        {!signedIn ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">Please sign in to request an appointment with this provider.</p>
            <Link
              href={loginHref}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Sign In to Book
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {service.bookingNotice && (
              <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>{service.bookingNotice}</span>
              </div>
            )}

            {/* Service Tiers / Packages */}
            {service.serviceTierRates.length > 0 && (
              <div>
                <label className="eyebrow mb-2 block">Choose Package</label>
                <div className="grid gap-2">
                  {service.serviceTierRates.map((tier) => {
                    const active = selectedTier?.id === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedTier(tier)}
                        className={`flex items-start justify-between rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                            : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                            <span>{tier.name}</span>
                            {active && <Sparkles className="size-3.5 text-brand-link" />}
                          </div>
                          {tier.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{tier.description}</p>
                          )}
                        </div>
                        <span className="font-mono text-sm font-bold text-brand-link shrink-0">
                          {formatPrice(tier.priceCents, service.currency)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Preferred Date</label>
                <input
                  type="date"
                  min={today}
                  required
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-xs text-foreground"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Time Window</label>
                <select
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground"
                >
                  <option value="Morning (8am - 12pm)">Morning (8am - 12pm)</option>
                  <option value="Afternoon (12pm - 5pm)">Afternoon (12pm - 5pm)</option>
                  <option value="Evening (5pm - 8pm)">Evening (5pm - 8pm)</option>
                  <option value="Flexible / Any time">Flexible / Any time</option>
                </select>
              </div>
            </div>

            {/* Pet / Animal Name */}
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <PawPrint className="size-3.5" />
                <span>Pet / Animal (Optional)</span>
              </label>
              <input
                placeholder="e.g. Meech (Presa Canario, 18 months)"
                value={creatureName}
                onChange={(e) => setCreatureName(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm text-foreground"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Special Requests or Notes
              </label>
              <textarea
                rows={2}
                placeholder="Specific requirements, pickup instructions, temperament notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-input bg-transparent p-3 text-xs text-foreground"
              />
            </div>

            {service.depositRequired && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
                <span className="font-semibold text-brand-link">Booking Deposit: </span>
                {service.depositAmountCents
                  ? formatPrice(service.depositAmountCents, service.currency)
                  : "Stated upon confirmation"}{" "}
                (held securely in escrow upon acceptance).
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-xl border border-input px-4 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="min-h-11 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                data-testid="submit-booking-request-btn"
              >
                {isPending ? "Sending Request..." : "Send Booking Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

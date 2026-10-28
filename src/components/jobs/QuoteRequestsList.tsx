"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { formatPrice } from "@/lib/shop/format";
import { respondTransportQuote } from "@/lib/contracts/actions";
import type { InboundTransportQuote } from "@/lib/jobs/queries";
import { Button } from "@/components/ui/button";

export function QuoteRequestsList({ quotes }: { quotes: InboundTransportQuote[] }) {
  if (quotes.length === 0) {
    return (
      <div className="premium-panel flex flex-col items-center justify-center rounded-2xl p-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted/40 text-muted-foreground">
          <Truck className="size-6" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">No Pending Quote Requests</p>
        <p className="mt-1 max-w-sm text-micro text-muted-foreground">
          When buyers or sellers request carrier transport for an animal deal, route quote requests will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {quotes.map((q) => (
        <QuoteCard key={q.id} quote={q} />
      ))}
    </ul>
  );
}

function QuoteCard({ quote }: { quote: InboundTransportQuote }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [priceInput, setPriceInput] = useState(
    quote.quotedCents ? (quote.quotedCents / 100).toString() : "250",
  );
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(parseFloat(priceInput) * 100);
    if (isNaN(cents) || cents <= 0) {
      setError("Please enter a valid price");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await respondTransportQuote(quote.id, cents, notes);
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(res.error ?? "Failed to update quote");
    }
  }

  return (
    <li className="premium-panel flex flex-col gap-2 rounded-2xl border p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Route: {quote.pickupRegion} → {quote.deliveryRegion}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-micro font-medium uppercase ${
            quote.status === "accepted"
              ? "bg-secondary/25 text-secondary-foreground"
              : quote.status === "quoted"
                ? "bg-primary/20 text-brand-link"
                : "bg-muted/40 text-muted-foreground"
          }`}
        >
          {quote.status}
        </span>
      </div>

      <p className="text-sm">
        Client: <span className="font-semibold">@{quote.requesterUsername}</span>
      </p>

      {quote.targetPickupDate && (
        <p className="text-xs text-muted-foreground">Target Date: {quote.targetPickupDate}</p>
      )}

      {quote.quotedCents !== null && (
        <p className="text-sm font-semibold">
          Quoted: {formatPrice(quote.quotedCents, "USD")}
        </p>
      )}

      {quote.notes && (
        <p className="text-xs text-muted-foreground italic">&ldquo;{quote.notes}&rdquo;</p>
      )}

      {quote.status !== "accepted" && (
        <div className="pt-2">
          {editing ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 pt-1">
              <div>
                <label className="mb-1 block text-micro text-muted-foreground">Quote Price ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background p-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-micro text-muted-foreground">Carrier Notes / ETA</label>
                <input
                  type="text"
                  placeholder="e.g. Temperature-controlled van, arrival in 48h"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background p-2 text-xs"
                />
              </div>
              {error && <p className="text-micro text-destructive">{error}</p>}
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? "Sending..." : "Submit Quote"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="text-xs"
            >
              {quote.status === "quoted" ? "Update Quote" : "Send Quote"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

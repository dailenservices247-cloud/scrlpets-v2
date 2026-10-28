"use client";

import { useState } from "react";
import { ArrowRight, Clock, Search, ShieldCheck, User } from "lucide-react";
import { getOrderAuditEvents, type OrderAuditEvent } from "@/lib/admin/actions";

export function OrderInspector({ recentOrderIds = [] }: { recentOrderIds?: string[] }) {
  const [orderId, setOrderId] = useState(recentOrderIds[0] ?? "");
  const [events, setEvents] = useState<OrderAuditEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [searchedId, setSearchedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInspect(idToInspect: string) {
    const clean = idToInspect.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    setSearchedId(clean);

    try {
      const res = await getOrderAuditEvents(clean);
      setEvents(res);
    } catch {
      setError("Failed to fetch order audit events. Verify the order UUID.");
      setEvents([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/40 p-4" data-testid="order-inspector">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-brand-link">
          <ShieldCheck className="size-4" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Order Audit Event Inspector</h3>
          <p className="text-micro text-muted-foreground">
            Cryptographically sealed status transitions and dispute audit trail from Postgres
          </p>
        </div>
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleInspect(orderId);
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Enter full Order UUID (e.g. 00000000-0000-0000-0000-000000000000)…"
            className="w-full rounded-xl border border-border/80 bg-background/80 py-2 pl-9 pr-3 font-mono text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !orderId.trim()}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Tracing…" : "Inspect Events"}
        </button>
      </form>

      {/* Recent quick picks */}
      {recentOrderIds.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-micro">
          <span className="text-muted-foreground">Recent:</span>
          {recentOrderIds.slice(0, 4).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setOrderId(id);
                handleInspect(id);
              }}
              className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-micro text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            >
              {id.slice(0, 8)}…
            </button>
          ))}
        </div>
      )}

      {/* Results timeline */}
      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {events && !error && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>
              Timeline for order <span className="font-mono text-foreground">{searchedId}</span>
            </p>
            <p>{events.length} transition(s) recorded</p>
          </div>

          {events.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 py-8 text-center text-xs text-muted-foreground">
              No audit events found for this order ID.
            </div>
          ) : (
            <div className="relative pl-6 before:absolute before:bottom-2 before:left-2.5 before:top-2 before:w-0.5 before:bg-border/80">
              {events.map((ev, idx) => (
                <div key={idx} className="relative mb-4 last:mb-0">
                  <span className="absolute -left-6 top-1 grid size-5 place-items-center rounded-full border border-primary/40 bg-background text-brand-link">
                    <Clock className="size-2.5" aria-hidden />
                  </span>
                  <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
                          {ev.fromStatus ?? "INITIAL"}
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-brand-link">
                          {ev.toStatus ?? "UNKNOWN"}
                        </span>
                      </div>
                      <span className="font-mono text-micro text-muted-foreground">
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {ev.note && (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        &ldquo;{ev.note}&rdquo;
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-1 text-micro text-muted-foreground">
                      <User className="size-3" aria-hidden />
                      <span>Triggered by: @{ev.actor ?? "system"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

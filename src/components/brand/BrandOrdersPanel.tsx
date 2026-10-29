"use client";

import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/shop/format";
import type { Order } from "@/lib/orders/queries";

export function BrandOrdersPanel({
  orders,
  sellerId,
}: {
  orders: Order[];
  sellerId: string;
}) {
  const sellerOrders = orders.filter((o) => o.sellerId === sellerId);

  return (
    <div className="premium-panel rounded-2xl p-4" data-testid="brand-orders-panel">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Commerce & Fulfillment</p>
          <h2 className="mt-1 text-lg font-semibold">Incoming Orders</h2>
        </div>
        <Link
          href="/orders"
          className="text-xs font-semibold text-brand-link hover:underline"
        >
          View all orders &rarr;
        </Link>
      </div>

      {sellerOrders.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
          <Package className="mx-auto size-6 text-muted-foreground/60" aria-hidden />
          <p className="mt-2 font-medium">No sales or orders received yet.</p>
          <p className="mt-1">
            When buyers purchase your products, puppies, or book services, orders appear here for fulfillment.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {sellerOrders.map((o) => (
            <li
              key={o.id}
              className="rounded-xl border border-border/70 bg-card/40 p-3 text-xs"
              data-testid="brand-order-row"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-micro font-semibold uppercase ${
                        o.status === "completed"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : o.status === "disputed"
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                          : "bg-primary/15 text-brand-link border border-primary/30"
                      }`}
                    >
                      {o.status.replace("_", " ")}
                    </span>
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-semibold text-foreground hover:underline"
                    >
                      {o.titleSnapshot ?? "Order"}
                    </Link>
                  </div>
                  <p className="mt-1 font-mono text-micro text-muted-foreground">
                    Order #{o.id.slice(0, 8)} &bull; {new Date(o.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {formatPrice(o.amountCents, o.currency)}
                  </span>
                  <Link
                    href={`/orders/${o.id}`}
                    className="grid size-7 place-items-center rounded-lg border border-border/80 bg-background text-muted-foreground hover:text-foreground"
                    title="View and fulfill order"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

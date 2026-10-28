import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Package } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getMyOrders } from "@/lib/orders/queries";
import { formatPrice } from "@/lib/shop/format";

export const metadata = {
  title: "Orders & Deals",
  description: "Your active purchases, contract sales, and escrow protection on Scrlpets.",
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted/40 text-muted-foreground border-border/60" },
  awaiting_payment: { label: "Awaiting Payment", cls: "bg-primary/15 text-brand-link border-primary/30" },
  deposit_held: { label: "Deposit Held in Escrow", cls: "bg-primary/20 text-brand-link border-primary/40 font-semibold" },
  funds_held: { label: "Funds Held in Escrow", cls: "bg-primary/20 text-brand-link border-primary/40 font-semibold" },
  dispatched: { label: "On the Way / Dispatched", cls: "bg-secondary/25 text-secondary-foreground border-secondary/40" },
  inspection: { label: "Inspection Window Open", cls: "bg-secondary/25 text-secondary-foreground border-secondary/40 font-semibold" },
  disputed: { label: "In Dispute Review", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  released: { label: "Completed & Released", cls: "bg-secondary/25 text-secondary-foreground border-secondary/40" },
  refunded: { label: "Refunded", cls: "bg-muted/40 text-muted-foreground border-border/60" },
  cancelled: { label: "Cancelled", cls: "bg-muted/40 text-muted-foreground border-border/60" },
};

export default async function OrdersHubPage() {
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor("/orders"));

  const orders = await getMyOrders();

  return (
    <AppPage>
      <header className="px-4 pb-4 pt-6">
        <p className="eyebrow">Commerce & Escrow</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Orders & Deals</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Track signed agreements, held deposits, live transit anchors, and verified releases.
        </p>
      </header>

      <section className="px-4 pb-12">
        {orders.length === 0 ? (
          <div className="premium-panel flex flex-col items-center justify-center rounded-2xl p-12 text-center" data-testid="orders-empty">
            <span className="grid size-12 place-items-center rounded-full bg-muted/40 text-muted-foreground">
              <Package className="size-6" aria-hidden />
            </span>
            <p className="mt-3 text-base font-semibold">No active orders yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              When you agree on a contract in Deal Room or check out a product from the market, it will appear here.
            </p>
            <Link
              href="/market"
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="orders-list">
            {orders.map((o) => {
              const statusCfg = STATUS_MAP[o.status] ?? {
                label: o.status,
                cls: "bg-muted/40 text-muted-foreground border-border/60",
              };
              const isBuyer = o.buyerId === user.id;

              return (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="premium-panel flex flex-col gap-3 rounded-2xl p-4 transition hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
                    data-testid={`order-row-${o.id}`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-micro ${statusCfg.cls}`}
                          data-testid="order-status-badge"
                        >
                          {statusCfg.label}
                        </span>
                        <span className="text-micro text-muted-foreground">
                          {isBuyer ? "Purchase" : "Sale"} · Order #{o.id.slice(0, 8)}
                        </span>
                      </div>
                      <h2 className="truncate text-base font-semibold">
                        {o.titleSnapshot || "Pet / Listing Order"}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Placed on {new Date(o.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t pt-3 sm:border-0 sm:pt-0">
                      <div className="text-right sm:text-right">
                        <p className="text-sm font-bold text-foreground">
                          {formatPrice(o.amountCents, o.currency)}
                        </p>
                        <p className="text-micro text-muted-foreground">
                          {isBuyer ? "Total amount" : "Deal value"}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppPage>
  );
}

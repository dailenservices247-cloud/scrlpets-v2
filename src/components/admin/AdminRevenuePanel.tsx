"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Lock,
  Search,
  TrendingUp,
} from "lucide-react";
import { formatPrice } from "@/lib/shop/format";
import type { AdminFinancialStats } from "@/lib/admin/queries";

export function AdminRevenuePanel({ stats }: { stats: AdminFinancialStats }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredTransactions = stats.recentTransactions.filter((tx) => {
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = tx.titleSnapshot?.toLowerCase().includes(q);
      const matchBuyer = tx.buyerUsername?.toLowerCase().includes(q);
      const matchSeller = tx.sellerUsername?.toLowerCase().includes(q);
      const matchId = tx.id.toLowerCase().includes(q);
      if (!matchTitle && !matchBuyer && !matchSeller && !matchId) return false;
    }
    return true;
  });

  function exportCsv() {
    if (filteredTransactions.length === 0) return;
    const headers = [
      "Order ID",
      "Listing Title",
      "Buyer Username",
      "Seller Username",
      "Gross Amount (USD)",
      "Deposit (USD)",
      "Platform Fee (USD)",
      "Status",
      "Created At",
    ];

    const rows = filteredTransactions.map((tx) => [
      tx.id,
      `"${(tx.titleSnapshot || "").replace(/"/g, '""')}"`,
      tx.buyerUsername || "unknown",
      tx.sellerUsername || "unknown",
      (tx.amountCents / 100).toFixed(2),
      (tx.depositCents / 100).toFixed(2),
      (tx.feeCents / 100).toFixed(2),
      tx.status,
      tx.createdAt,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `scrlpets-financial-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6" data-testid="admin-revenue-panel">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Gross Volume */}
        <div className="premium-panel flex flex-col justify-between rounded-2xl p-4">
          <span className="text-xs font-medium text-muted-foreground">Gross Platform Volume</span>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-foreground">{formatPrice(stats.gmvCents, "USD")}</p>
            <p className="mt-0.5 text-micro text-muted-foreground">Across all valid orders</p>
          </div>
        </div>

        {/* Escrow Custody */}
        <div className="premium-panel flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Escrow in Custody</span>
            <Lock className="size-4 text-amber-500" aria-hidden />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {formatPrice(stats.heldEscrowCents, "USD")}
            </p>
            <p className="mt-0.5 text-micro text-muted-foreground">Locked in 2-stage escrow</p>
          </div>
        </div>

        {/* Platform Fees */}
        <div className="premium-panel flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Platform Fee Revenue</span>
            <TrendingUp className="size-4 text-emerald-500" aria-hidden />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatPrice(stats.platformFeesCents, "USD")}
            </p>
            <p className="mt-0.5 text-micro text-muted-foreground">Total platform take</p>
          </div>
        </div>

        {/* Completed Orders */}
        <div className="premium-panel flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Completed Releases</span>
            <CheckCircle2 className="size-4 text-brand-link" aria-hidden />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight">{stats.completedOrdersCount}</p>
            <p className="mt-0.5 text-micro text-muted-foreground">
              of {stats.totalOrdersCount} total orders
            </p>
          </div>
        </div>
      </div>

      {/* Transaction Ledger Header & Controls */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Financial Ledger & Orders</h2>
            <p className="text-micro text-muted-foreground">
              Real-time transaction history, buyer/seller splits, and fees
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={filteredTransactions.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted/60 disabled:opacity-50"
            >
              <Download className="size-3.5" aria-hidden />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order ID, title, buyer, or seller…"
              className="w-full rounded-xl border border-border/80 bg-background/80 py-2 pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="inline-flex rounded-xl border border-border/70 bg-card/60 p-0.5 text-xs">
            {["all", "funds_held", "released", "disputed", "refunded"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-2.5 py-1 text-micro font-medium uppercase transition ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/40">
        <div className="hidden border-b border-border/60 bg-muted/30 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-12 sm:gap-2">
          <div className="sm:col-span-4">ORDER & LISTING</div>
          <div className="sm:col-span-3">PARTIES</div>
          <div className="sm:col-span-2">AMOUNTS</div>
          <div className="sm:col-span-3 text-right">STATUS & DATE</div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No transactions match the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-col gap-2 p-4 transition sm:grid sm:grid-cols-12 sm:items-center sm:gap-2 hover:bg-muted/30"
              >
                <div className="sm:col-span-4">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/orders/${tx.id}`}
                      target="_blank"
                      className="font-mono text-xs font-semibold text-brand-link hover:underline"
                    >
                      {tx.id.slice(0, 13)}…
                    </Link>
                    <ExternalLink className="size-3 text-muted-foreground" aria-hidden />
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-foreground">
                    {tx.titleSnapshot || "Direct Commerce Purchase"}
                  </p>
                </div>

                <div className="sm:col-span-3 text-xs">
                  <p className="text-muted-foreground">
                    Buyer: <strong className="text-foreground">@{tx.buyerUsername ?? "unknown"}</strong>
                  </p>
                  <p className="text-muted-foreground">
                    Seller: <strong className="text-foreground">@{tx.sellerUsername ?? "unknown"}</strong>
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <p className="font-mono text-xs font-bold text-foreground">
                    {formatPrice(tx.amountCents, "USD")}
                  </p>
                  <p className="font-mono text-micro text-muted-foreground">
                    Fee: {formatPrice(tx.feeCents, "USD")}
                  </p>
                </div>

                <div className="sm:col-span-3 sm:text-right">
                  <span className="inline-flex rounded-full border border-border/80 bg-background/80 px-2 py-0.5 font-mono text-[10px] font-medium uppercase text-muted-foreground">
                    {tx.status}
                  </span>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

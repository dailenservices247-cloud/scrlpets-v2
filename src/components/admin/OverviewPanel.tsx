import Link from "next/link";
import {
  AlertTriangle,
  Award,
  Cpu,
  DollarSign,
  HeartPulse,
  LifeBuoy,
  Lock,
  Package,
  Shield,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatPrice } from "@/lib/shop/format";
import type { AdminOverviewStats } from "@/lib/admin/queries";

export function OverviewPanel({ stats }: { stats: AdminOverviewStats }) {
  return (
    <div className="space-y-6" data-testid="admin-overview-panel">
      {/* System Telemetry Pulse */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/40 p-3">
          <Cpu className="size-4 text-emerald-500" aria-hidden />
          <div>
            <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">ENGINE</p>
            <p className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">NEXTJS_ACTIVE</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/40 p-3">
          <Shield className="size-4 text-emerald-500" aria-hidden />
          <div>
            <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">DATABASE</p>
            <p className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {stats.systemStatus.dbOk ? "PG_CONNECTED" : "DB_DEGRADED"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/40 p-3">
          <Lock className="size-4 text-brand-link" aria-hidden />
          <div>
            <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">AUTH & RLS</p>
            <p className="font-mono text-xs font-semibold text-foreground">ENFORCED</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/40 p-3">
          <HeartPulse className="size-4 text-emerald-500" aria-hidden />
          <div>
            <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">ESCROW RAILS</p>
            <p className="font-mono text-xs font-semibold text-foreground">2-STAGE_SECURE</p>
          </div>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {/* Total Users */}
        <div className="premium-panel flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Users</span>
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-brand-link">
              <Users className="size-4" aria-hidden />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight">{stats.totalUsers.toLocaleString()}</p>
            <p className="mt-0.5 text-micro text-muted-foreground">
              +{stats.newUsersToday} new in last 24h
            </p>
          </div>
        </div>

        {/* Escrow in Vault */}
        <div className="premium-panel flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Escrow in Custody</span>
            <span className="grid size-7 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Lock className="size-4" aria-hidden />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {formatPrice(stats.heldEscrowCents, "USD")}
            </p>
            <p className="mt-0.5 text-micro text-muted-foreground">
              Locked in 2-stage holding
            </p>
          </div>
        </div>

        {/* Platform Revenue */}
        <div className="premium-panel flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Platform Fee Revenue</span>
            <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-4" aria-hidden />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatPrice(stats.totalRevenueCents, "USD")}
            </p>
            <p className="mt-0.5 text-micro text-muted-foreground">
              Buyer & seller fees captured
            </p>
          </div>
        </div>

        {/* Active Listings */}
        <div className="premium-panel flex flex-col justify-between rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Listings</span>
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-brand-link">
              <Store className="size-4" aria-hidden />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight">{stats.activeListings.toLocaleString()}</p>
            <p className="mt-0.5 text-micro text-muted-foreground">
              Animals & supplies live
            </p>
          </div>
        </div>
      </div>

      {/* Operational Queues Status */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Disputes */}
        <Link
          href="/admin?tab=disputes"
          className="premium-panel flex flex-col justify-between rounded-2xl p-4 transition hover:border-primary/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Open Disputes</span>
            <AlertTriangle
              className={`size-4 ${stats.openDisputes > 0 ? "text-destructive" : "text-muted-foreground"}`}
              aria-hidden
            />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold">{stats.openDisputes}</span>
            <p className="mt-0.5 text-micro text-muted-foreground">Awaiting adjudication</p>
          </div>
        </Link>

        {/* Overdue Shipments */}
        <Link
          href="/admin?tab=disputes"
          className="premium-panel flex flex-col justify-between rounded-2xl p-4 transition hover:border-primary/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Overdue Shipments</span>
            <Package
              className={`size-4 ${stats.overdueShipments > 0 ? "text-amber-500" : "text-muted-foreground"}`}
              aria-hidden
            />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold">{stats.overdueShipments}</span>
            <p className="mt-0.5 text-micro text-muted-foreground">Need manual confirmation</p>
          </div>
        </Link>

        {/* Pending Programs */}
        <Link
          href="/admin?tab=verifications"
          className="premium-panel flex flex-col justify-between rounded-2xl p-4 transition hover:border-primary/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Pending Programs</span>
            <Award className="size-4 text-brand-link" aria-hidden />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold">{stats.pendingPrograms}</span>
            <p className="mt-0.5 text-micro text-muted-foreground">Kennels, USDA, Transporters</p>
          </div>
        </Link>

        {/* Support Tickets */}
        <Link
          href="/admin?tab=support"
          className="premium-panel flex flex-col justify-between rounded-2xl p-4 transition hover:border-primary/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Support Tickets</span>
            <LifeBuoy className="size-4 text-brand-link" aria-hidden />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold">{stats.openTickets}</span>
            <p className="mt-0.5 text-micro text-muted-foreground">Inquiries in queue</p>
          </div>
        </Link>
      </div>

      {/* Quick Access Actions */}
      <div className="rounded-2xl border border-border/80 bg-card/40 p-4">
        <h2 className="text-sm font-semibold tracking-tight">Quick Operations</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link
            href="/admin?tab=users"
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 p-3 text-xs font-medium text-foreground transition hover:bg-muted/60"
          >
            <Users className="size-4 text-brand-link" aria-hidden />
            <span>Search & Manage Users</span>
          </Link>
          <Link
            href="/admin?tab=revenue"
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 p-3 text-xs font-medium text-foreground transition hover:bg-muted/60"
          >
            <DollarSign className="size-4 text-emerald-500" aria-hidden />
            <span>Financial Ledger & CSV</span>
          </Link>
          <Link
            href="/admin?tab=disputes"
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 p-3 text-xs font-medium text-foreground transition hover:bg-muted/60"
          >
            <Shield className="size-4 text-amber-500" aria-hidden />
            <span>Order Event Inspector</span>
          </Link>
          <Link
            href="/admin?tab=system"
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 p-3 text-xs font-medium text-foreground transition hover:bg-muted/60"
          >
            <Cpu className="size-4 text-purple-500" aria-hidden />
            <span>Database Table Health</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

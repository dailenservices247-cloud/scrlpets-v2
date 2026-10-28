"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  Cpu,
  DollarSign,
  Gift,
  LifeBuoy,
  RefreshCw,
  ShieldAlert,
  Terminal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminTabId =
  | "overview"
  | "users"
  | "disputes"
  | "revenue"
  | "moderation"
  | "verifications"
  | "support"
  | "rewards"
  | "system";

export type AdminNavBadgeCounts = {
  disputes?: number;
  reports?: number;
  programs?: number;
  tickets?: number;
  redemptions?: number;
  shipments?: number;
};

const TABS: { id: AdminTabId; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "users", label: "Users & Access", icon: Users },
  { id: "disputes", label: "Disputes & Orders", icon: AlertTriangle },
  { id: "revenue", label: "Revenue & Finance", icon: DollarSign },
  { id: "moderation", label: "Moderation", icon: ShieldAlert },
  { id: "verifications", label: "Verifications", icon: Award },
  { id: "support", label: "Support", icon: LifeBuoy },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "system", label: "System Health", icon: Cpu },
];

export function AdminNav({
  activeTab,
  badges = {},
}: {
  activeTab: AdminTabId;
  badges?: AdminNavBadgeCounts;
}) {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  function getBadgeCount(id: AdminTabId): number {
    switch (id) {
      case "disputes":
        return (badges.disputes ?? 0) + (badges.shipments ?? 0);
      case "moderation":
        return badges.reports ?? 0;
      case "verifications":
        return badges.programs ?? 0;
      case "support":
        return badges.tickets ?? 0;
      case "rewards":
        return badges.redemptions ?? 0;
      default:
        return 0;
    }
  }

  return (
    <header className="mb-6 rounded-2xl border border-border/80 bg-card/60 p-4 backdrop-blur">
      {/* Top Status & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/20 text-brand-link">
            <Terminal className="size-5" aria-hidden />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">SCRLPETS COMMAND CENTER</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-micro font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                SYS_ONLINE
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Enterprise administration, commerce escrow governance, and platform telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentTime && (
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline-block">
              {currentTime} UTC
            </span>
          )}
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <nav className="mt-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Admin Sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = getBadgeCount(tab.id);

          return (
            <Link
              key={tab.id}
              href={`/admin?tab=${tab.id}`}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span>{tab.label}</span>
              {badge > 0 && (
                <span
                  className={cn(
                    "ml-0.5 inline-flex size-4.5 items-center justify-center rounded-full text-micro font-bold leading-none",
                    isActive
                      ? "bg-background text-foreground"
                      : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

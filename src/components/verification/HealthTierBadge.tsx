"use client";

import { Award, ShieldCheck, HeartPulse, HelpCircle } from "lucide-react";
import { calculateHealthTier } from "@/lib/verification/health-tiers";
import type { GeneticTest } from "@/lib/creatures/queries";

export function HealthTierBadge({
  tests = [],
  anchorVerified = false,
  registrationNumber,
  showSummary = false,
}: {
  tests?: GeneticTest[];
  anchorVerified?: boolean;
  registrationNumber?: string | null;
  showSummary?: boolean;
}) {
  const tierInfo = calculateHealthTier({ tests, anchorVerified, registrationNumber });

  const IconComponent =
    tierInfo.tier === "elite"
      ? Award
      : tierInfo.tier === "comprehensive"
        ? ShieldCheck
        : tierInfo.tier === "baseline"
          ? HeartPulse
          : HelpCircle;

  return (
    <div className="inline-flex flex-col gap-1" data-testid="health-tier-badge-container">
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tierInfo.badgeClass}`}
        data-testid={`health-tier-${tierInfo.tier}`}
      >
        <IconComponent className="size-3.5 shrink-0" aria-hidden />
        <span>{tierInfo.label}</span>
      </div>
      {showSummary && (
        <p className="text-micro text-muted-foreground leading-normal mt-0.5">
          {tierInfo.summary}
        </p>
      )}
    </div>
  );
}

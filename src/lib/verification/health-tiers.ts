import type { GeneticTest } from "@/lib/creatures/queries";

export type HealthTierLevel = "elite" | "comprehensive" | "baseline" | "pending";

export type HealthTierInfo = {
  tier: HealthTierLevel;
  label: string;
  badgeClass: string;
  borderClass: string;
  iconName: "award" | "shield-check" | "heart-pulse" | "help-circle";
  summary: string;
  criteriaMet: string[];
};

/**
 * Calculates Good Dog-style consumer-friendly health testing tier from
 * verified genetic tests, phenotypic certifications (OFA/PennHIP), and microchip anchors.
 */
export function calculateHealthTier({
  tests = [],
  anchorVerified = false,
  registrationNumber,
}: {
  tests?: GeneticTest[];
  anchorVerified?: boolean;
  registrationNumber?: string | null;
}): HealthTierInfo {
  const clearCount = tests.filter(
    (t) => t.result === "clear" || t.result === "normal",
  ).length;

  const hasPhenotypic = tests.some((t) => {
    const name = `${t.conditionName} ${t.testType} ${t.provider ?? ""}`.toLowerCase();
    return (
      name.includes("ofa") ||
      name.includes("pennhip") ||
      name.includes("cardiac") ||
      name.includes("eyes") ||
      name.includes("elbow") ||
      name.includes("hip") ||
      name.includes("radiograph")
    );
  });

  const hasDnaPanel = tests.some((t) => {
    const name = `${t.conditionName} ${t.testType} ${t.provider ?? ""}`.toLowerCase();
    return (
      name.includes("dna") ||
      name.includes("embark") ||
      name.includes("wisdom") ||
      name.includes("pawprint") ||
      name.includes("panel") ||
      name.includes("genetics")
    );
  });

  const criteria: string[] = [];
  if (anchorVerified || registrationNumber) {
    criteria.push("Registry anchor / microchip verified");
  }
  if (hasPhenotypic) {
    criteria.push("Phenotypic screening (OFA / PennHIP / Radiographs)");
  }
  if (hasDnaPanel || clearCount >= 3) {
    criteria.push("Multi-locus genomic health panel");
  }

  // Tier assignment
  if ((hasPhenotypic && (hasDnaPanel || clearCount >= 2)) || clearCount >= 4) {
    return {
      tier: "elite",
      label: "Elite Health Clearance",
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/40",
      borderClass: "border-amber-500/50",
      iconName: "award",
      summary: "Significantly exceeds breed baseline with comprehensive phenotypic and genomic clearances.",
      criteriaMet: criteria.length > 0 ? criteria : ["Exceeds all standard clearances"],
    };
  }

  if (hasPhenotypic || hasDnaPanel || clearCount >= 1) {
    return {
      tier: "comprehensive",
      label: "Comprehensive Clearance",
      badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
      borderClass: "border-emerald-500/50",
      iconName: "shield-check",
      summary: "Meets and exceeds baseline health testing for known hereditary conditions.",
      criteriaMet: criteria.length > 0 ? criteria : ["Core hereditary disease screening verified"],
    };
  }

  if (anchorVerified || registrationNumber) {
    return {
      tier: "baseline",
      label: "Baseline Clearance",
      badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/40",
      borderClass: "border-blue-500/50",
      iconName: "heart-pulse",
      summary: "Verified registry identity and baseline physical health checks.",
      criteriaMet: criteria.length > 0 ? criteria : ["Baseline registration verified"],
    };
  }

  return {
    tier: "pending",
    label: "Testing Pending",
    badgeClass: "bg-muted/40 text-muted-foreground border-border/80",
    borderClass: "border-border/60",
    iconName: "help-circle",
    summary: "No diagnostic health screenings uploaded yet for this animal.",
    criteriaMet: ["Awaiting laboratory submission"],
  };
}

"use client";

import { useState } from "react";
import {
  Thermometer,
  Droplets,
  Utensils,
  Sun,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  type CreatureCareDossier,
  calculateFeedingStatus,
  evaluateHabitatMetrics,
  getRecommendedCareDefaults,
} from "@/lib/care/husbandry";

export type UniversalCareHabitatCardProps = {
  creatureId: string;
  species?: string | null;
  creatureName: string;
  initialDossier?: Partial<CreatureCareDossier>;
};

export function UniversalCareHabitatCard({
  creatureId,
  species,
  creatureName,
  initialDossier,
}: UniversalCareHabitatCardProps) {
  const normalizedSpecies = (species?.trim().toLowerCase()) || "animal";
  const [activeTab, setActiveTab] = useState<"environment" | "feeding" | "milestones">("environment");
  const defaults = getRecommendedCareDefaults(normalizedSpecies);

  const [habitat] = useState(initialDossier?.habitat ?? defaults.habitat);
  const [feeding, setFeeding] = useState(initialDossier?.feeding ?? defaults.feeding);
  const [milestones] = useState(initialDossier?.milestones ?? defaults.milestones);
  const [feedLoggedNotice, setFeedLoggedNotice] = useState<string | null>(null);

  const feedingStatus = calculateFeedingStatus(feeding.lastFedAt, feeding.frequency);
  const envEvaluation = evaluateHabitatMetrics(habitat);

  function handleLogFeeding() {
    const nowIso = new Date().toISOString();
    setFeeding((prev) => ({
      ...prev,
      lastFedAt: nowIso,
    }));
    setFeedLoggedNotice("Feeding logged successfully!");
    setTimeout(() => setFeedLoggedNotice(null), 3000);
  }

  return (
    <div
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      data-testid="universal-care-card"
      data-creature-id={creatureId}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">
              Husbandry & Care Center
            </h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
              {normalizedSpecies} Care
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active climate parameters, scheduled nutrition, and physiological milestones for {creatureName}.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-muted/60 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("environment")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
              activeTab === "environment"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Thermometer className="size-3.5" />
            Environment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("feeding")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
              activeTab === "feeding"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Utensils className="size-3.5" />
            Nutrition
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("milestones")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
              activeTab === "milestones"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="size-3.5" />
            Milestones
          </button>
        </div>
      </div>

      {/* Alerts Banner if out of nominal range */}
      {envEvaluation.alerts.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4 shrink-0 text-amber-400" />
            <span>Environmental Attention Recommended</span>
          </div>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-amber-200/90 pl-1">
            {envEvaluation.alerts.map((alert, i) => (
              <li key={i}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tab 1: Environment & Climate */}
      {activeTab === "environment" && (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Thermometer className="size-4 text-rose-400" />
                Temperature
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-semibold text-micro ${
                  envEvaluation.tempStatus === "optimal"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {envEvaluation.tempStatus}
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {habitat.temperature.current}°{habitat.temperature.unit}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {habitat.temperature.warmZone
                ? `Warm: ${habitat.temperature.warmZone}° · Cool: ${habitat.temperature.coolZone}°`
                : `Target: ${habitat.temperature.ambient}°${habitat.temperature.unit}`}
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Droplets className="size-4 text-cyan-400" />
                Relative Humidity
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-semibold text-micro ${
                  envEvaluation.humidityStatus === "optimal"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {envEvaluation.humidityStatus}
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {habitat.humidity.current}%
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Target range: {habitat.humidity.targetMin}% – {habitat.humidity.targetMax}%
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Sun className="size-4 text-amber-400" />
              Living Space & Light
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">
              {habitat.enclosureType}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {habitat.lighting
                ? `${habitat.lighting.photoperiodHours}h Light · UVB: ${habitat.lighting.uvbRating ?? "None"}`
                : `Substrate: ${habitat.substrate ?? "Standard bedding"}`}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Nutrition & Feeding */}
      {activeTab === "feeding" && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/20 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Diet: {feeding.dietType}
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                  {feeding.frequency.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                <span>
                  Last fed:{" "}
                  {new Date(feeding.lastFedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span>•</span>
                <span
                  className={
                    feedingStatus.status === "overdue"
                      ? "font-semibold text-rose-400"
                      : feedingStatus.status === "due_soon"
                      ? "font-semibold text-amber-400"
                      : "text-emerald-400 font-medium"
                  }
                >
                  {feedingStatus.status === "overdue"
                    ? `Overdue by ${Math.abs(feedingStatus.hoursRemaining)}h`
                    : feedingStatus.status === "due_soon"
                    ? `Due in ${feedingStatus.hoursRemaining}h`
                    : "Up to date"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogFeeding}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 active:scale-95"
            >
              <Utensils className="size-3.5" />
              Log Feeding Now
            </button>
          </div>

          {feedLoggedNotice && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{feedLoggedNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/70 p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Feed Items & Diet Components
              </span>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                {feeding.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border/70 p-3.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Supplements & Vitamins
              </span>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                {feeding.supplements && feeding.supplements.length > 0 ? (
                  feeding.supplements.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Sparkles className="size-3 text-amber-400" />
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground italic">None specified</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Milestones & Physiological Growth */}
      {activeTab === "milestones" && (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Colony metrics if insects/ants */}
          {milestones.colonyMetrics && (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Colony Population</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-micro font-medium text-primary capitalize">
                  {milestones.colonyMetrics.queenStatus.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {milestones.colonyMetrics.workerCount}{" "}
                <span className="text-xs font-normal text-muted-foreground">Workers</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Brood:</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-micro font-medium ${
                    milestones.colonyMetrics.brood.eggs
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  Eggs
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-micro font-medium ${
                    milestones.colonyMetrics.brood.larvae
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  Larvae
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-micro font-medium ${
                    milestones.colonyMetrics.brood.pupae
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  Pupae
                </span>
              </div>
            </div>
          )}

          {/* Shed or Molt cycle */}
          {milestones.shedOrMolt && (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Shed / Molt Status</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-micro font-semibold text-emerald-400 capitalize">
                  {milestones.shedOrMolt.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Last recorded: {new Date(milestones.shedOrMolt.lastDate).toLocaleDateString()}
              </p>
              {milestones.shedOrMolt.notes && (
                <p className="mt-1 text-xs text-foreground/90 font-medium">
                  {milestones.shedOrMolt.notes}
                </p>
              )}
            </div>
          )}

          {/* Weight */}
          {milestones.weight && (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Current Weight</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-micro font-medium text-muted-foreground capitalize">
                  {milestones.weight.trend}
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {milestones.weight.current}{" "}
                <span className="text-sm font-normal text-muted-foreground">{milestones.weight.unit}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Logged on {new Date(milestones.weight.lastWeighedAt).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Dormancy / Brumation / Diapause */}
          {milestones.dormancy && (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground capitalize">
                  Seasonal {milestones.dormancy.type !== "none" ? milestones.dormancy.type : "Cycle"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-micro font-semibold ${
                    milestones.dormancy.active
                      ? "bg-sky-500/20 text-sky-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {milestones.dormancy.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Target temp: {milestones.dormancy.targetTempF ?? 65}°F
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Scale,
  Sparkles,
} from "lucide-react";
import {
  calculateGrowthSummary,
  calculateBenchmarkCurve,
  gramsToOunces,
  type PuppyGrowthProfile,
  type PuppyWeightRecord,
} from "@/lib/litters/growth";

const DEFAULT_SAMPLE_PUPPIES: PuppyGrowthProfile[] = [
  {
    id: "pup-1",
    name: "Titan",
    collarColor: "#3b82f6", // Blue
    birthWeightGrams: 480,
    gender: "male",
    records: [
      { day: 0, weightGrams: 480 },
      { day: 2, weightGrams: 540 },
      { day: 4, weightGrams: 620 },
      { day: 7, weightGrams: 760 },
      { day: 10, weightGrams: 980 },
      { day: 14, weightGrams: 1280 },
    ],
  },
  {
    id: "pup-2",
    name: "Athena",
    collarColor: "#ec4899", // Pink
    birthWeightGrams: 450,
    gender: "female",
    records: [
      { day: 0, weightGrams: 450 },
      { day: 2, weightGrams: 510 },
      { day: 4, weightGrams: 590 },
      { day: 7, weightGrams: 720 },
      { day: 10, weightGrams: 910 },
      { day: 14, weightGrams: 1210 },
    ],
  },
  {
    id: "pup-3",
    name: "Onyx",
    collarColor: "#10b981", // Emerald
    birthWeightGrams: 460,
    gender: "male",
    records: [
      { day: 0, weightGrams: 460 },
      { day: 2, weightGrams: 490 },
      { day: 4, weightGrams: 530 },
      { day: 7, weightGrams: 640 },
      { day: 10, weightGrams: 810 },
      { day: 14, weightGrams: 1050 },
    ],
  },
];

export function LitterGrowthTracker({
  initialPuppies = DEFAULT_SAMPLE_PUPPIES,
  isBreeder = false,
}: {
  initialPuppies?: PuppyGrowthProfile[];
  isBreeder?: boolean;
}) {
  const [puppies, setPuppies] = useState<PuppyGrowthProfile[]>(initialPuppies);
  const [selectedPuppyId, setSelectedPuppyId] = useState<string>(
    puppies[0]?.id || "pup-1",
  );
  const [unit, setUnit] = useState<"g" | "oz">("g");
  const [showLogModal, setShowLogModal] = useState(false);
  const [newDay, setNewDay] = useState(15);
  const [newWeight, setNewWeight] = useState(1350);

  const selectedPuppy =
    puppies.find((p) => p.id === selectedPuppyId) || puppies[0];
  if (!selectedPuppy) return null;

  const summary = calculateGrowthSummary(
    selectedPuppy.birthWeightGrams,
    selectedPuppy.records,
  );

  const maxDay = Math.max(
    14,
    ...puppies.flatMap((p) => p.records.map((r) => r.day)),
  );
  const benchmarkCurve = calculateBenchmarkCurve(
    selectedPuppy.birthWeightGrams,
    maxDay,
  );

  // SVG dimensions
  const svgWidth = 500;
  const svgHeight = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 50 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  const maxWeight = Math.max(
    1400,
    ...puppies.flatMap((p) => p.records.map((r) => r.weightGrams)),
    ...benchmarkCurve.map((b) => b.weightGrams),
  );
  const minWeight = Math.min(
    300,
    ...puppies.map((p) => p.birthWeightGrams),
  );

  const getX = (day: number) => padding.left + (day / maxDay) * chartWidth;
  const getY = (weight: number) =>
    padding.top +
    chartHeight -
    ((weight - minWeight) / (maxWeight - minWeight)) * chartHeight;

  // Build SVG path
  const makePath = (points: { day: number; weightGrams: number }[]) => {
    return points
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(pt.day)} ${getY(pt.weightGrams)}`)
      .join(" ");
  };

  const handleAddWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPuppies = puppies.map((p) => {
      if (p.id !== selectedPuppyId) return p;
      const filtered = p.records.filter((r) => r.day !== newDay);
      const newRecords: PuppyWeightRecord[] = [
        ...filtered,
        { day: newDay, weightGrams: newWeight },
      ].sort((a, b) => a.day - b.day);
      return { ...p, records: newRecords };
    });
    setPuppies(updatedPuppies);
    setShowLogModal(false);
  };

  const displayWeight = (grams: number) => {
    return unit === "g" ? `${grams}g` : `${gramsToOunces(grams)}oz`;
  };

  return (
    <div
      className="premium-panel rounded-2xl p-4 sm:p-5"
      data-testid="litter-growth-tracker"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-brand-link" />
            <h3 className="text-base font-semibold tracking-tight">
              Litter Growth & Daily Velocity
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Whelping health surveillance & standard developmental trajectory
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Unit Toggle */}
          <div className="inline-flex rounded-lg border border-input p-0.5 text-micro font-medium">
            <button
              type="button"
              onClick={() => setUnit("g")}
              className={`rounded-md px-2 py-0.5 transition ${
                unit === "g"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Grams
            </button>
            <button
              type="button"
              onClick={() => setUnit("oz")}
              className={`rounded-md px-2 py-0.5 transition ${
                unit === "oz"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ounces
            </button>
          </div>

          {isBreeder && (
            <button
              type="button"
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-semibold text-brand-link transition hover:bg-primary/25"
              data-testid="add-weighin-btn"
            >
              <Plus className="size-3.5" />
              <span>Log Weight</span>
            </button>
          )}
        </div>
      </div>

      {/* Puppy Selection Pills */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {puppies.map((p) => {
          const isSelected = p.id === selectedPuppyId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPuppyId(p.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                isSelected
                  ? "border-primary bg-primary/10 font-semibold text-foreground shadow-sm"
                  : "border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:bg-card"
              }`}
              data-testid={`pup-selector-${p.id}`}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: p.collarColor }}
              />
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-card/50 p-2.5">
          <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
            Current Weight
          </p>
          <p className="mt-1 text-sm font-bold text-foreground">
            {displayWeight(summary.currentWeightGrams)}
          </p>
          <p className="text-micro text-muted-foreground">
            Birth: {displayWeight(selectedPuppy.birthWeightGrams)}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/50 p-2.5">
          <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
            Average Daily Gain
          </p>
          <p className="mt-1 text-sm font-bold text-brand-link">
            +{displayWeight(Math.round(summary.averageDailyGainGrams))}/day
          </p>
          <p className="text-micro text-muted-foreground">
            +{summary.percentageGain.toFixed(0)}% total
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/50 p-2.5">
          <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
            Last 24h Change
          </p>
          <p
            className={`mt-1 text-sm font-bold ${
              summary.last24hChangeGrams >= 0 ? "text-emerald-500" : "text-destructive"
            }`}
          >
            {summary.last24hChangeGrams >= 0 ? "+" : ""}
            {displayWeight(summary.last24hChangeGrams)}
          </p>
          <p className="text-micro text-muted-foreground">Recent trend</p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/50 p-2.5">
          <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
            Growth Velocity
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            {summary.status === "healthy" ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-500">
                  Optimal
                </span>
              </>
            ) : summary.status === "accelerated" ? (
              <>
                <Sparkles className="size-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-500">
                  Accelerated
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="size-3.5 text-destructive" />
                <span className="text-xs font-semibold text-destructive">
                  Needs Check
                </span>
              </>
            )}
          </div>
          <p className="text-micro text-muted-foreground">Day {maxDay} status</p>
        </div>
      </div>

      {/* SVG Growth Chart */}
      <div className="mt-4 rounded-xl border border-border/60 bg-background/50 p-2 sm:p-3">
        <div className="mb-2 flex items-center justify-between text-micro text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="h-1 w-4 rounded-full"
                style={{ backgroundColor: selectedPuppy.collarColor }}
              />
              <span>{selectedPuppy.name} (Actual)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-b border-dashed border-muted-foreground" />
              <span>Standard Doubling Curve</span>
            </div>
          </div>
          <span>Max: {displayWeight(maxWeight)}</span>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full min-w-[320px] overflow-visible"
            aria-label="Growth curve chart"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + chartHeight * ratio;
              return (
                <line
                  key={ratio}
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                  strokeDasharray="3 3"
                />
              );
            })}

            {/* Benchmark Curve */}
            <path
              d={makePath(benchmarkCurve)}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />

            {/* Active Puppy Curve */}
            <path
              d={makePath(selectedPuppy.records)}
              fill="none"
              stroke={selectedPuppy.collarColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {selectedPuppy.records.map((pt) => (
              <g key={pt.day}>
                <circle
                  cx={getX(pt.day)}
                  cy={getY(pt.weightGrams)}
                  r={4}
                  fill={selectedPuppy.collarColor}
                  className="transition hover:scale-125"
                />
              </g>
            ))}

            {/* X-axis days labels */}
            {[0, Math.round(maxDay / 2), maxDay].map((day) => (
              <text
                key={day}
                x={getX(day)}
                y={svgHeight - 10}
                textAnchor="middle"
                fill="currentColor"
                className="text-micro font-medium opacity-60"
              >
                Day {day}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* Log Weigh-In Modal */}
      {showLogModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowLogModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold">Log Weigh-In for {selectedPuppy.name}</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Record daily weight to update velocity calculations
            </p>

            <form onSubmit={handleAddWeight} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">Day #</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={newDay}
                  onChange={(e) => setNewDay(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">
                  Weight (Grams)
                </label>
                <input
                  type="number"
                  min={50}
                  max={10000}
                  value={newWeight}
                  onChange={(e) => setNewWeight(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
                  required
                />
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="rounded-xl border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  Save Weigh-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

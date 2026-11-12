"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Plus,
  Scale,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  calculateGrowthSummary,
  calculateBenchmarkCurve,
  gramsToOunces,
  type PuppyGrowthProfile,
  type PuppyWeightRecord,
} from "@/lib/litters/growth";

const PRESET_COLLAR_COLORS = [
  { name: "Blue", hex: "#3b82f6" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Red", hex: "#ef4444" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Silver", hex: "#94a3b8" },
];

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
  litterId,
  initialPuppies = DEFAULT_SAMPLE_PUPPIES,
  isBreeder = false,
}: {
  litterId?: string;
  initialPuppies?: PuppyGrowthProfile[];
  isBreeder?: boolean;
}) {
  const storageKey = `scrlpets_litter_weights_${litterId || "default"}`;
  const [puppies, setPuppies] = useState<PuppyGrowthProfile[]>(initialPuppies);
  const [hydrated, setHydrated] = useState(false);
  const [selectedPuppyId, setSelectedPuppyId] = useState<string>(
    puppies[0]?.id || "pup-1",
  );
  const [unit, setUnit] = useState<"g" | "oz">("g");
  const [showLogModal, setShowLogModal] = useState(false);
  const [showAddPupModal, setShowAddPupModal] = useState(false);
  const [showHistoryTable, setShowHistoryTable] = useState(false);

  // New weigh-in state
  const [newDay, setNewDay] = useState(15);
  const [newWeight, setNewWeight] = useState(1350);

  // New puppy state
  const [newPupName, setNewPupName] = useState("");
  const [newPupColor, setNewPupColor] = useState(PRESET_COLLAR_COLORS[3].hex);
  const [newPupGender, setNewPupGender] = useState<"male" | "female">("male");
  const [newPupBirthWeight, setNewPupBirthWeight] = useState(480);

  // Load from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTimeout(() => {
            setPuppies(parsed);
            setSelectedPuppyId(parsed[0].id);
          }, 0);
        }
      }
    } catch {
      // Ignore parse error
    } finally {
      setTimeout(() => setHydrated(true), 0);
    }
  }, [storageKey]);

  // Persist to localStorage on change
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(puppies));
    } catch {
      // Storage quota or private mode
    }
  }, [puppies, storageKey, hydrated]);

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
        { day: newDay, weightGrams: newWeight, recordedAt: new Date().toISOString() },
      ].sort((a, b) => a.day - b.day);
      return { ...p, records: newRecords };
    });
    setPuppies(updatedPuppies);
    setShowLogModal(false);
  };

  const handleDeleteRecord = (dayToDelete: number) => {
    const updated = puppies.map((p) => {
      if (p.id !== selectedPuppyId) return p;
      return {
        ...p,
        records: p.records.filter((r) => r.day !== dayToDelete),
      };
    });
    setPuppies(updated);
  };

  const handleCreatePuppy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPupName.trim()) return;
    const newId = `pup-${Date.now()}`;
    const created: PuppyGrowthProfile = {
      id: newId,
      name: newPupName.trim(),
      collarColor: newPupColor,
      birthWeightGrams: newPupBirthWeight,
      gender: newPupGender,
      records: [{ day: 0, weightGrams: newPupBirthWeight, recordedAt: new Date().toISOString() }],
    };
    setPuppies((prev) => [...prev, created]);
    setSelectedPuppyId(newId);
    setNewPupName("");
    setShowAddPupModal(false);
  };

  const displayWeight = (grams: number) => {
    return unit === "g" ? `${grams}g` : `${gramsToOunces(grams)}oz`;
  };

  const exportCSV = () => {
    const headers = ["Puppy ID", "Puppy Name", "Gender", "Birth Weight (g)", "Day", "Weight (g)", "Weight (oz)"];
    const rows: string[] = [headers.join(",")];
    for (const pup of puppies) {
      for (const rec of pup.records) {
        rows.push([
          pup.id,
          `"${pup.name}"`,
          pup.gender,
          pup.birthWeightGrams,
          rec.day,
          rec.weightGrams,
          gramsToOunces(rec.weightGrams).toFixed(1),
        ].join(","));
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `litter-weights-${litterId || "records"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        <div className="flex flex-wrap items-center gap-2">
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

          {/* Export CSV */}
          <button
            type="button"
            onClick={exportCSV}
            title="Export weight records to CSV"
            className="flex items-center gap-1 rounded-lg border border-input px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition"
            data-testid="export-weights-btn"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {isBreeder && (
            <>
              <button
                type="button"
                onClick={() => setShowAddPupModal(true)}
                className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-link transition hover:bg-primary/20"
                data-testid="add-puppy-btn"
              >
                <Plus className="size-3.5" />
                <span>Add Puppy</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewDay(maxDay + 1);
                  setNewWeight(summary.currentWeightGrams + Math.round(summary.averageDailyGainGrams || 50));
                  setShowLogModal(true);
                }}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                data-testid="add-weighin-btn"
              >
                <Plus className="size-3.5" />
                <span>Log Weight</span>
              </button>
            </>
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

      {/* Collapsible Weigh-in History Table */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowHistoryTable((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40 transition"
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-3.5 text-brand-link" />
            <span>Weigh-in History Ledger ({selectedPuppy.records.length} records)</span>
          </div>
          {showHistoryTable ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {showHistoryTable && (
          <div className="mt-2 overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-micro uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Weight</th>
                  <th className="px-3 py-2">Total Gain</th>
                  {isBreeder && <th className="px-3 py-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {selectedPuppy.records.map((rec, idx) => {
                  const gainFromBirth = rec.weightGrams - selectedPuppy.birthWeightGrams;
                  return (
                    <tr key={rec.day} className="hover:bg-muted/20 transition">
                      <td className="px-3 py-2 font-medium">Day {rec.day}</td>
                      <td className="px-3 py-2 font-semibold text-foreground">
                        {displayWeight(rec.weightGrams)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {gainFromBirth >= 0 ? `+${displayWeight(gainFromBirth)}` : displayWeight(gainFromBirth)}
                      </td>
                      {isBreeder && (
                        <td className="px-3 py-2 text-right">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(rec.day)}
                              title="Delete record"
                              className="text-muted-foreground hover:text-destructive transition"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
                  max={90}
                  value={newDay}
                  onChange={(e) => setNewDay(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">
                  Weight ({unit === "g" ? "Grams" : "Ounces"})
                </label>
                <input
                  type="number"
                  min={50}
                  max={25000}
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

      {/* Add Puppy Modal */}
      {showAddPupModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowAddPupModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-semibold">Add Puppy / Offspring</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Register a puppy to track daily weight trajectory
            </p>

            <form onSubmit={handleCreatePuppy} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">Puppy / Kit Name</label>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="e.g. Zeus, Collar Green"
                  value={newPupName}
                  onChange={(e) => setNewPupName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Collar Color</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {PRESET_COLLAR_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewPupColor(c.hex)}
                      className={`size-6 rounded-full border-2 transition ${
                        newPupColor === c.hex ? "scale-110 border-foreground shadow" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-foreground">Gender</label>
                  <select
                    value={newPupGender}
                    onChange={(e) => setNewPupGender(e.target.value as "male" | "female")}
                    className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Birth Weight (g)</label>
                  <input
                    type="number"
                    min={50}
                    max={5000}
                    value={newPupBirthWeight}
                    onChange={(e) => setNewPupBirthWeight(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPupModal(false)}
                  className="rounded-xl border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPupName.trim()}
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Add to Litter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

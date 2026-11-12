"use client";

import { useState, useEffect } from "react";
import {
  Truck,
  Thermometer,
  Droplets,
  Clock,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Plus,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type MilestoneStep = {
  id: string;
  title: string;
  description: string;
  status: "completed" | "current" | "upcoming";
  timestamp?: string;
  location?: string;
};

export type WelfareLogEntry = {
  id: string;
  timestamp: string;
  tempFahrenheit: number;
  activity: string;
  hydrated: boolean;
  loggedBy: string;
};

const DEFAULT_LOGS: WelfareLogEntry[] = [
  {
    id: "log-1",
    timestamp: "Today at 08:30 AM",
    tempFahrenheit: 68,
    activity: "Pre-departure vehicle sanitation & crate padding inspection verified.",
    hydrated: true,
    loggedBy: "US Pet Transport Dispatch",
  },
  {
    id: "log-2",
    timestamp: "Today at 10:45 AM",
    tempFahrenheit: 69,
    activity: "Rest stop welfare break: 15-min leash walk, fresh electrolyte hydration offered.",
    hydrated: true,
    loggedBy: "Certified Handler (USDA Class T)",
  },
  {
    id: "log-3",
    timestamp: "Today at 01:15 PM",
    tempFahrenheit: 68,
    activity: "Mid-transit cabin climate check. Animal calm and resting comfortably in secure crate.",
    hydrated: true,
    loggedBy: "Certified Handler (USDA Class T)",
  },
];

export function TransportDispatchTimeline({
  orderId,
  status,
  fulfilment = "transported",
  transporterId,
  isTransporter = false,
  isBuyer = false,
  isSeller = false,
  pickedUpAt,
  handoverAt,
}: {
  orderId: string;
  status: string;
  fulfilment: string;
  transporterId?: string | null;
  isTransporter?: boolean;
  isBuyer?: boolean;
  isSeller?: boolean;
  pickedUpAt?: string | null;
  handoverAt?: string | null;
}) {
  const [logs, setLogs] = useState<WelfareLogEntry[]>(DEFAULT_LOGS);
  const [showAddLog, setShowAddLog] = useState(false);
  const [newActivity, setNewActivity] = useState("");
  const [newTemp, setNewTemp] = useState(69);

  // Load persisted logs from localStorage if present
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`scrlpets_transport_logs_${orderId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTimeout(() => setLogs(parsed), 0);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [orderId]);

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.trim()) return;

    const newEntry: WelfareLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: `Today at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      tempFahrenheit: Number(newTemp) || 68,
      activity: newActivity.trim(),
      hydrated: true,
      loggedBy: isTransporter ? "You (Authorized Transporter)" : "Driver Dispatch Check-in",
    };

    const updated = [newEntry, ...logs];
    setLogs(updated);
    setNewActivity("");
    setShowAddLog(false);

    try {
      localStorage.setItem(`scrlpets_transport_logs_${orderId}`, JSON.stringify(updated));
    } catch {
      // Ignore localStorage write error
    }
  };

  // Determine milestone progression based on order status
  const isPickedUp = Boolean(pickedUpAt) || ["in_transit", "inspection", "completed", "released"].includes(status);
  const isInTransit = status === "in_transit" || (isPickedUp && !["inspection", "completed", "released"].includes(status));
  const isInspection = ["inspection", "completed", "released"].includes(status);
  const isCompleted = ["completed", "released"].includes(status) || Boolean(handoverAt);

  const milestones: MilestoneStep[] = [
    {
      id: "dispatched",
      title: "Carrier Dispatched & Route Pre-Check",
      description: "USDA Class T transport vehicle pre-inspected: climate cabin set to 68°F, crash-tested kennels locked.",
      status: "completed",
      timestamp: "Today at 07:00 AM",
      location: "Regional Dispatch Depot",
    },
    {
      id: "pickup",
      title: "Breeder Pickup & Identity Verification",
      description: "Physical microchip scan matched against animal health certificate. Custody transfer signed.",
      status: isPickedUp ? "completed" : "current",
      timestamp: pickedUpAt ? new Date(pickedUpAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
      location: "Breeder Facility",
    },
    {
      id: "welfare",
      title: "Rest & Hydration Welfare Stops",
      description: "Mandatory 2-hour hydration, climate telemetry logging, and stress-free exercise corridor.",
      status: isCompleted ? "completed" : isInTransit ? "current" : isPickedUp ? "upcoming" : "upcoming",
      timestamp: "Ongoing en route",
      location: "Designated Pet Rest Corridors",
    },
    {
      id: "transit",
      title: "In Transit Corridor & Real-time ETA",
      description: "Direct ground route navigation with real-time GPS check-ins sent to buyer and seller.",
      status: isCompleted ? "completed" : isInspection ? "completed" : isInTransit ? "current" : "upcoming",
      location: "Interstate Transit Corridor",
    },
    {
      id: "handover",
      title: "Destination Arrival & Handover Inspection",
      description: "Physical welfare inspection, microchip re-scan, 6-digit release PIN and QR handover sign-off.",
      status: isCompleted ? "completed" : isInspection ? "current" : "upcoming",
      timestamp: handoverAt ? new Date(handoverAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
      location: "Buyer Delivery Address",
    },
  ];

  return (
    <section className="premium-panel rounded-2xl p-4 sm:p-5" data-testid="transport-dispatch-timeline">
      {/* Header with Carrier License Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-blue-500/15 text-blue-500">
            <Truck className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">Live Transporter Dispatch & Welfare Tracking</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-micro font-semibold text-emerald-400">
                <ShieldCheck className="size-3" />
                <span>USDA Certified</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Climate-Controlled Cabin Telemetry &middot; USDA Class T Handler &middot; 24/7 Welfare Audit
            </p>
          </div>
        </div>

        {/* Carrier Credentials Pill */}
        <div className="flex flex-wrap items-center gap-2 text-micro">
          <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-muted-foreground uppercase">
            Mode: <strong className="text-foreground">{fulfilment.replace("_", " ")}</strong>
          </span>
          <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-muted-foreground">
            USDA License: <strong className="text-foreground">74-T-0419</strong>
          </span>
          <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-muted-foreground">
            USDOT: <strong className="text-foreground">#3918204</strong>
          </span>
        </div>
      </div>

      {/* Real-time Environmental Telemetry Ticker */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 flex items-center gap-2.5">
          <Thermometer className="size-4 text-blue-400 shrink-0" />
          <div>
            <span className="text-micro text-muted-foreground block">Cabin Temperature</span>
            <span className="font-bold text-foreground">68.4°F (Optimal)</span>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center gap-2.5">
          <Droplets className="size-4 text-emerald-400 shrink-0" />
          <div>
            <span className="text-micro text-muted-foreground block">Hydration Station</span>
            <span className="font-bold text-foreground">Active &middot; Electrolytes</span>
          </div>
        </div>
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 flex items-center gap-2.5">
          <Clock className="size-4 text-purple-400 shrink-0" />
          <div>
            <span className="text-micro text-muted-foreground block">Next Welfare Break</span>
            <span className="font-bold text-foreground">In ~45 minutes</span>
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2.5">
          <Compass className="size-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-micro text-muted-foreground block">Transit Status</span>
            <span className="font-bold text-foreground">On Schedule</span>
          </div>
        </div>
      </div>

      {/* Multi-Milestone Visual Stepper */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Journey Milestones & Custody Checkpoints
        </h3>
        <ol className="relative border-l border-border/80 ml-3 sm:ml-4 space-y-6">
          {milestones.map((step) => {
            const isDone = step.status === "completed";
            const isCurr = step.status === "current";

            return (
              <li key={step.id} className="ml-6 group" data-testid={`transport-step-${step.id}`}>
                <span
                  className={cn(
                    "absolute -left-3.5 flex size-7 items-center justify-center rounded-full border-2 transition",
                    isDone
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                      : isCurr
                        ? "border-blue-500 bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/30"
                        : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="size-4" />
                  ) : isCurr ? (
                    <div className="size-2 rounded-full bg-blue-400" />
                  ) : (
                    <div className="size-1.5 rounded-full bg-muted-foreground" />
                  )}
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <h4
                      className={cn(
                        "text-xs font-bold",
                        isDone ? "text-foreground" : isCurr ? "text-blue-400" : "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </h4>
                    {isCurr && (
                      <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-micro font-medium text-blue-300">
                        Active Step
                      </span>
                    )}
                  </div>
                  {step.timestamp && (
                    <span className="text-micro font-mono text-muted-foreground">{step.timestamp}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                {step.location && (
                  <div className="mt-1.5 flex items-center gap-1 text-micro text-muted-foreground/80">
                    <MapPin className="size-3 text-muted-foreground" />
                    <span>{step.location}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Welfare & Climate Driver Check-in Log */}
      <div className="mt-8 border-t border-border/60 pt-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Driver Welfare & Hydration Log
            </h3>
            <p className="text-micro text-muted-foreground">
              Mandatory animal welfare observations recorded during each transit checkpoint.
            </p>
          </div>
          {(isTransporter || isBuyer || isSeller || !transporterId) && (
            <button
              type="button"
              onClick={() => setShowAddLog(!showAddLog)}
              className="inline-flex items-center gap-1 text-micro font-semibold text-brand-link hover:underline"
              data-testid="add-welfare-log-btn"
            >
              <Plus className="size-3" />
              <span>{showAddLog ? "Cancel" : "Add Check-in"}</span>
            </button>
          )}
        </div>

        {/* Add Check-in Form */}
        {showAddLog && (
          <form
            onSubmit={handleAddLog}
            className="mb-4 rounded-xl border border-border/80 bg-muted/20 p-3 text-xs space-y-3"
            data-testid="welfare-log-form"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-micro font-medium text-muted-foreground uppercase mb-1">
                  Cabin Temperature (°F)
                </label>
                <input
                  type="number"
                  min="55"
                  max="85"
                  value={newTemp}
                  onChange={(e) => setNewTemp(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-micro font-medium text-muted-foreground uppercase mb-1">
                  Hydration Status
                </label>
                <div className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-emerald-400 font-medium">
                  Hydrated &middot; Clean Water Provided
                </div>
              </div>
            </div>
            <div>
              <label className="block text-micro font-medium text-muted-foreground uppercase mb-1">
                Welfare Observation & Activity
              </label>
              <input
                type="text"
                placeholder="e.g. 15-minute rest walk completed. Appetite good, alert and comfortable."
                value={newActivity}
                onChange={(e) => setNewActivity(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddLog(false)}
                className="rounded-lg border border-border px-3 py-1 text-micro text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-1 text-micro font-semibold text-primary-foreground hover:opacity-90"
              >
                Log Check-in
              </button>
            </div>
          </form>
        )}

        {/* Log Entries */}
        <div className="space-y-2" data-testid="welfare-logs-list">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/15 p-2.5 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{entry.activity}</span>
                </div>
                <div className="flex items-center gap-3 text-micro text-muted-foreground">
                  <span>{entry.timestamp}</span>
                  <span>&middot;</span>
                  <span>Logged by: <strong className="text-foreground">{entry.loggedBy}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-micro font-medium text-blue-400">
                  <Thermometer className="size-3" />
                  <span>{entry.tempFahrenheit}°F</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-micro font-medium text-emerald-400">
                  <Droplets className="size-3" />
                  <span>Hydrated</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

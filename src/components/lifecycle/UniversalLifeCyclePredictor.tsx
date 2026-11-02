"use client";

import { useState } from "react";
import {
  Sparkles,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Bug,
  Egg,
  Heart,
  Droplets,
  Thermometer,
} from "lucide-react";
import {
  predictAntNuptialFlight,
  calculateAntFoundingTimeline,
  calculateClutchIncubation,
  calculateMammalReproduction,
  type AnimalSpeciesCategory,
  type IncubationInput,
  type MammalReproInput,
} from "@/lib/lifecycle/predictor";

export function UniversalLifeCyclePredictor() {
  const [activeTab, setActiveTab] = useState<AnimalSpeciesCategory>("insect");

  // Ant / Insect State
  const [antTemp, setAntTemp] = useState(82);
  const [antHumidity, setAntHumidity] = useState(72);
  const [daysSinceRain, setDaysSinceRain] = useState(1);
  const [month, setMonth] = useState(6); // June

  // Reptile / Bird State
  const [reptileSpecies, setReptileSpecies] = useState<
    "bearded_dragon" | "crested_gecko" | "ball_python" | "leopard_gecko" | "cockatiel"
  >("bearded_dragon");
  const [clutchDate, setClutchDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [incubationTemp, setIncubationTemp] = useState(83);
  const [incubationHumidity, setIncubationHumidity] = useState(65);

  // Mammal State
  const [mammalSpecies, setMammalSpecies] = useState<"dog" | "cat" | "rabbit">("dog");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [progesterone, setProgesterone] = useState(5.2);

  // Calculations
  const antResult = predictAntNuptialFlight({
    temperatureF: antTemp,
    humidityPercent: antHumidity,
    daysSinceRain,
    month,
  });
  const antFoundingStages = calculateAntFoundingTimeline();

  const incubationResult = calculateClutchIncubation({
    speciesName: reptileSpecies,
    clutchDate,
    incubationTempF: incubationTemp,
    humidityPercent: incubationHumidity,
  });

  const mammalResult = calculateMammalReproduction({
    species: mammalSpecies,
    eventDate,
    progesteroneLevelNgMl: progesterone,
  });

  return (
    <div
      className="premium-panel rounded-2xl p-4 sm:p-5"
      data-testid="universal-lifecycle-predictor"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-link" />
            <h3 className="text-base font-semibold tracking-tight">
              Universal Life-Cycle & Reproductive Forecaster
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ecological conditions, egg incubation, nuptial flights, and gestation calendars across all species
          </p>
        </div>

        {/* Category Switcher */}
        <div className="flex items-center rounded-xl border border-input p-1 bg-muted/20">
          <button
            type="button"
            onClick={() => setActiveTab("insect")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition ${
              activeTab === "insect"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-insect"
          >
            <Bug className="size-3.5" />
            <span>Insects & Ants</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reptile")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition ${
              activeTab === "reptile"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-reptile"
          >
            <Egg className="size-3.5" />
            <span>Reptiles & Aviary</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mammal")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition ${
              activeTab === "mammal"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-mammal"
          >
            <Heart className="size-3.5" />
            <span>Mammals & Domestic</span>
          </button>
        </div>
      </div>

      {/* TAB 1: INSECTS & ANTS */}
      {activeTab === "insect" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Environmental Weather Conditions
            </h4>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="flex items-center gap-1 text-micro font-medium text-foreground">
                  <Thermometer className="size-3 text-brand-link" />
                  Temperature ({antTemp}°F)
                </label>
                <input
                  type="range"
                  min={55}
                  max={100}
                  value={antTemp}
                  onChange={(e) => setAntTemp(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-micro font-medium text-foreground">
                  <Droplets className="size-3 text-brand-link" />
                  Humidity ({antHumidity}%)
                </label>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={antHumidity}
                  onChange={(e) => setAntHumidity(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <label className="text-micro font-medium text-foreground">
                  Days Since Rain: {daysSinceRain}d
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={daysSinceRain}
                  onChange={(e) => setDaysSinceRain(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <label className="text-micro font-medium text-foreground">
                  Month
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                >
                  <option value={4}>April (Early Flights)</option>
                  <option value={5}>May (Camponotus Peak)</option>
                  <option value={6}>June (Tetramorium / Formica)</option>
                  <option value={7}>July (Lasius / Solenopsis)</option>
                  <option value={8}>August (Pogonomyrmex Peak)</option>
                  <option value={9}>September (Late Flights)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ant Flight Probability Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="size-4 text-brand-link" />
                <span className="text-sm font-semibold">
                  Nuptial Flight Probability: {antResult.score}% (
                  <span className="capitalize">{antResult.condition}</span>)
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{antResult.guidance}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {antResult.recommendedSpecies.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-primary/15 px-2 py-0.5 text-micro font-medium text-brand-link"
                  >
                    Flying: {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Colony Founding Stages */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Queen Ant Founding Stages (Test Tube Claustral Protocol)
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {antFoundingStages.slice(0, 3).map((st) => (
                <div key={st.dayOffset} className="rounded-xl border border-border/60 bg-card p-3 text-xs">
                  <div className="flex items-center justify-between text-micro font-semibold text-brand-link">
                    <span>Day +{st.dayOffset}</span>
                    <span className="capitalize">{st.stage}</span>
                  </div>
                  <p className="mt-1 font-medium text-foreground">{st.title}</p>
                  <p className="mt-1 text-micro text-muted-foreground leading-relaxed">{st.description}</p>
                  <p className="mt-2 text-micro font-medium text-foreground/85 border-t border-border/40 pt-1.5">
                    {st.actionRequired}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REPTILES & AVIARY */}
      {activeTab === "reptile" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-micro font-medium text-foreground">Species & Morph</label>
                <select
                  value={reptileSpecies}
                  onChange={(e) => setReptileSpecies(e.target.value as IncubationInput["speciesName"])}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                >
                  <option value="bearded_dragon">Bearded Dragon (Pogona)</option>
                  <option value="crested_gecko">Crested Gecko (Correlophus)</option>
                  <option value="ball_python">Ball Python (Python regius)</option>
                  <option value="leopard_gecko">Leopard Gecko (Eublepharis)</option>
                  <option value="cockatiel">Cockatiel / Parrot (Aviary)</option>
                </select>
              </div>

              <div>
                <label className="text-micro font-medium text-foreground">Clutch Laid Date</label>
                <input
                  type="date"
                  value={clutchDate}
                  onChange={(e) => setClutchDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                />
              </div>

              <div>
                <label className="text-micro font-medium text-foreground">
                  Incubation Temp ({incubationTemp}°F)
                </label>
                <input
                  type="range"
                  min={65}
                  max={102}
                  value={incubationTemp}
                  onChange={(e) => setIncubationTemp(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <label className="text-micro font-medium text-foreground">
                  Incubation Humidity ({incubationHumidity}%)
                </label>
                <input
                  type="range"
                  min={40}
                  max={100}
                  value={incubationHumidity}
                  onChange={(e) => setIncubationHumidity(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-card p-3.5">
              <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Projected Hatch Date
              </span>
              <p className="mt-1 text-lg font-bold text-brand-link">
                {incubationResult.projectedHatchDate}
              </p>
              <p className="text-xs text-muted-foreground">
                ~{incubationResult.estimatedDays} days total incubation
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3.5">
              <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Incubation Environment
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                {incubationResult.status === "ideal" ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-500">Optimal Parameters</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-4 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-500">Parameter Warning</span>
                  </>
                )}
              </div>
              <p className="mt-1 text-micro text-muted-foreground">{incubationResult.guidance}</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3.5">
              <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Morph & Genetics Note
              </span>
              <p className="mt-1 text-xs font-medium text-foreground">
                {incubationResult.tsdNote || "Genotypic sex determination (non-TSD). Hatchlings inherit codominant and recessive alleles."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MAMMALS & DOMESTIC */}
      {activeTab === "mammal" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-micro font-medium text-foreground">Species</label>
                <select
                  value={mammalSpecies}
                  onChange={(e) => setMammalSpecies(e.target.value as MammalReproInput["species"])}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                >
                  <option value="dog">Canine (Dog)</option>
                  <option value="cat">Feline (Cat)</option>
                  <option value="rabbit">Lagomorph (Rabbit)</option>
                </select>
              </div>

              <div>
                <label className="text-micro font-medium text-foreground">
                  Ovulation / Mating Date
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-1.5 text-xs"
                />
              </div>

              {mammalSpecies === "dog" && (
                <div>
                  <label className="text-micro font-medium text-foreground">
                    Progesterone Level ({progesterone} ng/mL)
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={25}
                    step={0.1}
                    value={progesterone}
                    onChange={(e) => setProgesterone(Number(e.target.value))}
                    className="mt-1 w-full"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-card p-3.5">
              <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Reproductive Stage
              </span>
              <p className="mt-1 text-sm font-bold text-foreground">{mammalResult.stage}</p>
              <p className="text-micro text-muted-foreground mt-0.5">{mammalResult.guidance}</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3.5">
              <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Fertile Window
              </span>
              <p className="mt-1 text-xs font-bold text-brand-link">
                {mammalResult.fertileWindowStart} to {mammalResult.fertileWindowEnd}
              </p>
              <p className="text-micro text-muted-foreground">Peak conception window</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3.5">
              <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Ultrasound Confirmation
              </span>
              <p className="mt-1 text-xs font-semibold text-foreground">
                {mammalResult.ultrasoundWindow}
              </p>
              <p className="text-micro text-muted-foreground">Gestational sac check</p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-3.5">
              <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                Projected Whelping / Due Date
              </span>
              <p className="mt-1 text-base font-bold text-emerald-500">
                {mammalResult.projectedDueDate}
              </p>
              <p className="text-micro text-muted-foreground">Full term delivery</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

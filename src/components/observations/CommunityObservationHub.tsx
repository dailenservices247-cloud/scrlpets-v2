"use client";

import { useState } from "react";
import {
  Compass,
  MapPin,
  Thermometer,
  Droplets,
  CloudRain,
  Plus,
  CheckCircle2,
  Filter,
} from "lucide-react";
import {
  type CommunityObservation,
  type ObservationCategory,
  listCommunityObservations,
  formatObservationCategoryLabel,
} from "@/lib/observations/community";

export function CommunityObservationHub() {
  const [selectedSpecies, setSelectedSpecies] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<ObservationCategory | "all">("all");
  const [observations, setObservations] = useState<CommunityObservation[]>(() =>
    listCommunityObservations(),
  );

  const [showLogModal, setShowLogModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newSpecies, setNewSpecies] = useState("insect");
  const [newCategory, setNewCategory] = useState<ObservationCategory>("flight_sighting");
  const [newContent, setNewContent] = useState("");
  const [newTemp, setNewTemp] = useState("75");
  const [newHumidity, setNewHumidity] = useState("65");
  const [postSuccessNotice, setPostSuccessNotice] = useState<string | null>(null);

  const filtered = observations.filter((obs) => {
    if (selectedSpecies !== "all" && obs.species.toLowerCase() !== selectedSpecies) return false;
    if (selectedCategory !== "all" && obs.category !== selectedCategory) return false;
    return true;
  });

  function handleSubmitObservation(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newObs: CommunityObservation = {
      id: `obs-${Date.now()}`,
      author: {
        username: "currentkeeper",
        displayName: "Animal Steward",
        avatarUrl: null,
      },
      location: newLocation.trim() || "Local Area",
      date: new Date().toISOString(),
      category: newCategory,
      species: newSpecies,
      title: newTitle.trim(),
      content: newContent.trim(),
      metrics: {
        tempF: Number(newTemp) || undefined,
        humidity: Number(newHumidity) || undefined,
        stageOrCondition: "Active Observation",
      },
      verified: false,
    };

    setObservations([newObs, ...observations]);
    setNewTitle("");
    setNewContent("");
    setNewLocation("");
    setShowLogModal(false);
    setPostSuccessNotice("Your field observation has been posted to the community feed!");
    setTimeout(() => setPostSuccessNotice(null), 4000);
  }

  return (
    <div
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      data-testid="community-observation-hub"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="size-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">
              Community Field & Habitat Observations
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time environmental reports, nuptial flight sightings, seasonal transitions, and climate advisories across all pet species.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowLogModal(true)}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 active:scale-95"
        >
          <Plus className="size-4" />
          Log Observation
        </button>
      </div>

      {postSuccessNotice && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/15 p-3 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{postSuccessNotice}</span>
        </div>
      )}

      {/* Filter Rails */}
      <div className="mt-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <Filter className="size-3.5" />
            <span>Species:</span>
          </div>
          {[
            { id: "all", label: "All Animals" },
            { id: "insect", label: "Insects & Colonies" },
            { id: "reptile", label: "Reptiles" },
            { id: "dog", label: "Dogs" },
            { id: "cat", label: "Cats" },
            { id: "rabbit", label: "Rabbits" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedSpecies(tab.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                selectedSpecies === tab.id
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <span>Type:</span>
          </div>
          {[
            { id: "all", label: "All Types" },
            { id: "flight_sighting", label: "Flight Sightings" },
            { id: "seasonal_transition", label: "Seasonal Transitions" },
            { id: "weather_alert", label: "Weather Advisories" },
            { id: "husbandry_tip", label: "Husbandry Insights" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as ObservationCategory | "all")}
              className={`rounded-lg px-2 py-0.5 text-micro font-medium transition ${
                selectedCategory === cat.id
                  ? "bg-foreground/15 text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Observations Grid */}
      <div className="mt-5 space-y-3.5">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
            No observations recorded for this filter. Be the first to log environmental activity!
          </div>
        ) : (
          filtered.map((obs) => (
            <div
              key={obs.id}
              className="rounded-xl border border-border/80 bg-muted/20 p-4 transition hover:border-primary/40"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {obs.author.displayName || obs.author.username}
                  </span>
                  {obs.verified && (
                    <span className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-micro font-semibold text-primary">
                      Verified Keeper
                    </span>
                  )}
                  <span className="text-muted-foreground">•</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3 text-muted-foreground" />
                    {obs.location}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-micro font-medium capitalize">
                    {formatObservationCategoryLabel(obs.category)}
                  </span>
                  <span className="text-micro">
                    {new Date(obs.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <h4 className="mt-2 text-sm font-bold text-foreground">
                {obs.title}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {obs.content}
              </p>

              {obs.metrics && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {obs.metrics.tempF !== undefined && (
                    <span className="flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground border border-border/60">
                      <Thermometer className="size-3 text-rose-400" />
                      {obs.metrics.tempF}°F
                    </span>
                  )}
                  {obs.metrics.humidity !== undefined && (
                    <span className="flex items-center gap-1 rounded-md bg-background px-2 py-1 text-muted-foreground border border-border/60">
                      <Droplets className="size-3 text-cyan-400" />
                      {obs.metrics.humidity}% Humidity
                    </span>
                  )}
                  {obs.metrics.rainRecently && (
                    <span className="flex items-center gap-1 rounded-md bg-background px-2 py-1 text-sky-400 border border-border/60 font-medium">
                      <CloudRain className="size-3 text-sky-400" />
                      Post-Rain Calm
                    </span>
                  )}
                  {obs.metrics.stageOrCondition && (
                    <span className="rounded-md bg-primary/10 px-2 py-1 text-primary font-medium">
                      {obs.metrics.stageOrCondition}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Dialog for Logging Field Observations */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">
                Log Community Field Observation
              </h3>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitObservation} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-foreground">Title / Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nuptial flight spotted on south lawn / Heavy evening rain"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Species Category</label>
                  <select
                    value={newSpecies}
                    onChange={(e) => setNewSpecies(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="insect">Insect & Colonies</option>
                    <option value="reptile">Reptiles & Amphibians</option>
                    <option value="dog">Canine</option>
                    <option value="cat">Feline</option>
                    <option value="rabbit">Lagomorph / Rabbit</option>
                    <option value="bird">Aviary & Birds</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-foreground">Observation Type</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ObservationCategory)}
                    className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="flight_sighting">Flight Sighting</option>
                    <option value="seasonal_transition">Seasonal Transition</option>
                    <option value="weather_alert">Weather Advisory</option>
                    <option value="husbandry_tip">Husbandry Insight</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">Location (City / County / Region)</label>
                <input
                  type="text"
                  placeholder="e.g. Cuyahoga County, OH"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Temperature (°F)</label>
                  <input
                    type="number"
                    value={newTemp}
                    onChange={(e) => setNewTemp(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground">Humidity (%)</label>
                  <input
                    type="number"
                    value={newHumidity}
                    onChange={(e) => setNewHumidity(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">Field Notes & Details</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe your observations, flight behavior, substrate dampness, wind conditions, or care adjustments..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="rounded-xl border border-border px-4 py-2 font-medium text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground hover:opacity-90"
                >
                  Post Observation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

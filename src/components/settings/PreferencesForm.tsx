"use client";

import { useState, useTransition } from "react";
import { Globe, Ruler, Clock, Video, Heart, Check } from "lucide-react";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, type Locale } from "@/lib/i18n/locale";
import { savePreferences } from "@/lib/settings/actions";
import { cn } from "@/lib/utils";

const SPECIES_OPTIONS = [
  { id: "dog", label: "Dogs & Canines" },
  { id: "cat", label: "Cats & Felines" },
  { id: "horse", label: "Horses & Equines" },
  { id: "chicken", label: "Backyard Poultry & Birds" },
  { id: "ferret", label: "Ferrets & Small Exotics" },
  { id: "reptile", label: "Reptiles & Constrictors" },
  { id: "amphibian", label: "Amphibians & Axolotls" },
  { id: "goat", label: "Goats, Sheep & Small Ruminants" },
  { id: "pig", label: "Swine & Potbellied Pigs" },
  { id: "alpaca", label: "Alpacas & Camelids" },
];

export function PreferencesForm({
  currentLocale,
  initialUnits = "imperial",
  initialTimeFormat = "12h",
  initialAutoplay = "always",
  initialSpecies = [],
}: {
  currentLocale: Locale;
  initialUnits?: "imperial" | "metric";
  initialTimeFormat?: "12h" | "24h";
  initialAutoplay?: "always" | "wifi" | "never";
  initialSpecies?: string[];
}) {
  const [locale, setChosenLocale] = useState<Locale>(currentLocale);
  const [units, setUnits] = useState<"imperial" | "metric">(initialUnits);
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">(initialTimeFormat);
  const [autoplay, setAutoplay] = useState<"always" | "wifi" | "never">(initialAutoplay);
  const [species, setSpecies] = useState<string[]>(initialSpecies);
  const [savedNotice, setSavedNotice] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleLocaleChange(newLocale: Locale) {
    setChosenLocale(newLocale);
    startTransition(async () => {
      await setLocale(newLocale);
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    });
  }

  function toggleSpecies(id: string) {
    setSpecies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("units", units);
    fd.set("timeFormat", timeFormat);
    fd.set("autoplayMedia", autoplay);
    for (const s of species) {
      fd.append("speciesInterests", s);
    }
    startTransition(async () => {
      await savePreferences(fd);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" data-testid="preferences-form">
      {savedNotice && (
        <div
          className="flex items-center gap-2 rounded-xl border border-secondary/40 bg-secondary/15 p-3.5 text-xs font-semibold text-secondary-foreground"
          role="status"
        >
          <Check className="size-4 shrink-0" />
          <span>Preferences updated and saved successfully across all sessions.</span>
        </div>
      )}

      {/* 1. Language & Display Language */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Globe className="size-4.5 text-brand-link" />
          <h2 className="text-sm font-bold text-foreground">Language & Regional Translation</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose the language used for all navigation, breeding records, pedigree charts, and community messages.
        </p>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          {LOCALES.map((loc) => {
            const isSelected = locale === loc;
            return (
              <button
                key={loc}
                type="button"
                disabled={pending}
                onClick={() => handleLocaleChange(loc)}
                className={cn(
                  "flex min-h-12 items-center justify-between rounded-xl border p-3 text-left transition",
                  isSelected
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
                data-testid={`pref-locale-${loc}`}
              >
                <div>
                  <div className="text-xs font-bold">{loc === "en" ? "English" : "Español"}</div>
                  <div className="text-micro text-muted-foreground">
                    {loc === "en" ? "United States / International" : "Traducción completa"}
                  </div>
                </div>
                {isSelected && <Check className="size-4 text-brand-link" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Measurement Units */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Ruler className="size-4.5 text-secondary-foreground" />
          <h2 className="text-sm font-bold text-foreground">Measurement Units & Dimensions</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Sets standard units for litter growth weighing, animal height (inches vs cm), and carrier transport distance.
        </p>

        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setUnits("imperial")}
            className={cn(
              "flex min-h-12 items-center justify-between rounded-xl border p-3 text-left transition",
              units === "imperial"
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/60"
            )}
            data-testid="pref-units-imperial"
          >
            <div>
              <div className="text-xs font-bold">Imperial (U.S. Standard)</div>
              <div className="text-micro text-muted-foreground">Pounds (lbs), ounces (oz), miles</div>
            </div>
            {units === "imperial" && <Check className="size-4 text-brand-link" />}
          </button>

          <button
            type="button"
            onClick={() => setUnits("metric")}
            className={cn(
              "flex min-h-12 items-center justify-between rounded-xl border p-3 text-left transition",
              units === "metric"
                ? "border-primary/60 bg-primary/10 text-foreground"
                : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/60"
            )}
            data-testid="pref-units-metric"
          >
            <div>
              <div className="text-xs font-bold">Metric (SI System)</div>
              <div className="text-micro text-muted-foreground">Kilograms (kg), grams (g), kilometers</div>
            </div>
            {units === "metric" && <Check className="size-4 text-brand-link" />}
          </button>
        </div>
      </section>

      {/* 3. Time Display */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Clock className="size-4.5 text-accent-foreground" />
          <h2 className="text-sm font-bold text-foreground">Time Format & Timestamping</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Governs how message timestamps, breeding logs, and appointment times are formatted.
        </p>

        <div className="mt-3.5 flex gap-2.5">
          <button
            type="button"
            onClick={() => setTimeFormat("12h")}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition",
              timeFormat === "12h"
                ? "border-primary/60 bg-primary/10 text-brand-link"
                : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/60"
            )}
          >
            12-Hour (3:45 PM)
          </button>
          <button
            type="button"
            onClick={() => setTimeFormat("24h")}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition",
              timeFormat === "24h"
                ? "border-primary/60 bg-primary/10 text-brand-link"
                : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/60"
            )}
          >
            24-Hour (15:45)
          </button>
        </div>
      </section>

      {/* 4. Media & Video Playback */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Video className="size-4.5 text-brand-link" />
          <h2 className="text-sm font-bold text-foreground">Feed Video Autoplay</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Controls inline video and reel playback behavior while scrolling the main feed.
        </p>

        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {(["always", "wifi", "never"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setAutoplay(opt)}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-xl border px-2 text-xs font-semibold capitalize transition",
                autoplay === opt
                  ? "border-primary/60 bg-primary/10 text-brand-link"
                  : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/60"
              )}
            >
              {opt === "always" ? "Always" : opt === "wifi" ? "Wi-Fi Only" : "Never"}
            </button>
          ))}
        </div>
      </section>

      {/* 5. Species Interests & Program Focus */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Heart className="size-4.5 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Breeding Program & Species Focus</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Select the animals you breed, train, or follow. This personalizes your discovery feed, group suggestions, and terminology.
        </p>

        <div className="mt-3.5 flex flex-wrap gap-2">
          {SPECIES_OPTIONS.map((item) => {
            const isSelected = species.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleSpecies(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  isSelected
                    ? "border-primary/60 bg-primary/20 text-brand-link"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
                data-testid={`species-tag-${item.id}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 disabled:opacity-50"
          data-testid="save-preferences-btn"
        >
          {pending ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </form>
  );
}

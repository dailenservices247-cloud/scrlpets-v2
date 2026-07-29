// Pure data only (no React) — matches the rest of src/lib. Icon components
// live next to the UI that renders them (src/components/calendar).

/** Matches the breeding_events_type_check constraint exactly — the constraint
 * IS the full vocabulary, so this list and the DB can never drift apart. */
export const BREEDING_EVENT_TYPES = [
  "heat_start",
  "heat_end",
  "mating",
  "pregnancy_confirmed",
  "birth",
  "vet_visit",
  "show",
  "training",
] as const;

export type BreedingEventType = (typeof BREEDING_EVENT_TYPES)[number];

/** Dot/tile color per type — plain Tailwind palette classes, not the app's
 * chart tokens (those are intentionally grayscale; dots need to actually
 * read as distinct colors on the month grid). */
export const BREEDING_EVENT_COLOR: Record<BreedingEventType, string> = {
  heat_start: "bg-rose-400",
  heat_end: "bg-rose-600",
  mating: "bg-fuchsia-500",
  pregnancy_confirmed: "bg-violet-500",
  birth: "bg-emerald-500",
  vet_visit: "bg-sky-500",
  show: "bg-amber-500",
  training: "bg-orange-500",
};

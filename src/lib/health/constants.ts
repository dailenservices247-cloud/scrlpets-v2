// Pure data only (no React) — matches the rest of src/lib. Icon components
// live next to the UI that renders them (src/components/health).

/** Matches the health_reminders_type_check constraint exactly. */
export const HEALTH_REMINDER_TYPES = [
  "vaccination",
  "vet_visit",
  "medication",
  "grooming",
  "deworming",
  "other",
] as const;

export type HealthReminderType = (typeof HEALTH_REMINDER_TYPES)[number];

/** Matches the health_reminders_repeat_check constraint exactly. */
export const REPEAT_INTERVALS = ["none", "weekly", "monthly", "yearly"] as const;

export type RepeatInterval = (typeof REPEAT_INTERVALS)[number];

/** Dot/tile color per type — vet_visit intentionally matches the breeding
 * calendar's vet_visit color (same real-world category, same page's dot
 * vocabulary would be confusing if it meant two different colors). */
export const HEALTH_REMINDER_COLOR: Record<HealthReminderType, string> = {
  vaccination: "bg-teal-500",
  vet_visit: "bg-sky-500",
  medication: "bg-cyan-500",
  grooming: "bg-pink-500",
  deworming: "bg-lime-500",
  other: "bg-slate-400",
};

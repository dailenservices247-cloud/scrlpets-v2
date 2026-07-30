// Pure formatting helper (no Supabase import) — mirrors src/lib/shop/format.ts
// so client components can use it without dragging in the server-only client.

export type AnimalAge = { unit: "weeks" | "months" | "years"; count: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const AVG_DAYS_PER_MONTH = 30.4375; // 365.25 / 12

/**
 * Buckets a birth date into weeks / months / years so a young animal reads
 * "12 weeks old" (the 9 CFR 2.130 compliance range V2-06 already enforces at
 * the DB) while an adult doesn't render an absurd four-digit week count.
 * Returns null for an unparseable or future birth date.
 */
export function computeAnimalAge(birthDateIso: string, now: Date = new Date()): AnimalAge | null {
  const birth = new Date(birthDateIso);
  if (Number.isNaN(birth.getTime())) return null;
  const days = Math.floor((now.getTime() - birth.getTime()) / DAY_MS);
  if (days < 0) return null;

  const weeks = Math.floor(days / 7);
  if (weeks < 16) return { unit: "weeks", count: weeks };

  const months = days / AVG_DAYS_PER_MONTH;
  if (months < 24) return { unit: "months", count: Math.round(months) };

  return { unit: "years", count: Math.round(months / 12) };
}

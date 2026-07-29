// Shared date helpers for the breeding calendar and health center month grids.
// Everything here treats dates as plain YYYY-MM-DD calendar days (matching
// Postgres `date` columns) — no client math ever derives a due date, this is
// display/comparison only.

/** Local calendar day (not UTC) — "today" means the viewer's wall-clock day. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

function parseISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole-day difference (toISO - fromISO). Both sides parsed the same way
 * (UTC-pinned) so the result is exact regardless of the viewer's timezone.
 * ponytail: local "today" vs UTC-pinned parsing here are deliberately
 * different — todayISO() answers "what day is it for this viewer", parseISO
 * answers "how many calendar days apart are these two date strings". */
export function dayDiff(fromISO: string, toISO: string): number {
  return Math.round((parseISO(toISO) - parseISO(fromISO)) / 86_400_000);
}

// ponytail: hardcoded en-US, matching src/i18n/request.ts's currently-hardcoded
// locale — add a locale param if/when locale switching actually ships.
export function formatDateLong(iso: string): string {
  return new Date(parseISO(iso)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatWeekdayShort(dayIndex: number): string {
  // 2024-01-07 was a Sunday — a stable, arbitrary reference week.
  return new Date(Date.UTC(2024, 0, 7 + dayIndex)).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

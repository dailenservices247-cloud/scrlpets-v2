"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addMonths,
  formatMonthYear,
  formatWeekdayShort,
  todayISO,
  toISODate,
} from "./date-utils";

export type DotMarker = { key: string; colorClass: string; title: string };

/**
 * Presentational month grid shared by /calendar (breeding events) and
 * /health (reminders) — both need "month grid, prev/today/next, colored dots
 * per day, tap a day" and there's no reason to build that twice. Domain
 * knowledge (which type maps to which color, what a day's events ARE) stays
 * with the caller; this component only knows about dates and dots.
 */
export function MonthGrid({
  year,
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  markersByDate,
  testIdPrefix,
  todayLabel,
  previousMonthLabel,
  nextMonthLabel,
}: {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
  markersByDate: Record<string, DotMarker[]>;
  testIdPrefix: string;
  todayLabel?: string;
  previousMonthLabel?: string;
  nextMonthLabel?: string;
}) {
  const today = todayISO();
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  const cells = Array.from({ length: 42 }, (_, i) =>
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );

  function go(delta: number) {
    const next = addMonths(year, month, delta);
    onMonthChange(next.year, next.month);
  }
  function goToday() {
    const now = new Date();
    onMonthChange(now.getFullYear(), now.getMonth());
    onSelectDate(today);
  }

  return (
    <div data-testid={`${testIdPrefix}-month-grid`}>
      <div className="flex items-center justify-between gap-2 pb-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => go(-1)}
          aria-label={previousMonthLabel ?? "Previous month"}
          data-testid={`${testIdPrefix}-prev`}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <p className="text-sm font-semibold" data-testid={`${testIdPrefix}-month-label`}>
          {formatMonthYear(year, month)}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={goToday}
            data-testid={`${testIdPrefix}-today`}
          >
            {todayLabel ?? "Today"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => go(1)}
            aria-label={nextMonthLabel ?? "Next month"}
            data-testid={`${testIdPrefix}-next`}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>{formatWeekdayShort(i)}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const iso = toISODate(cell);
          const inMonth = cell.getMonth() === month;
          const dots = markersByDate[iso] ?? [];
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              data-testid={`${testIdPrefix}-day-${iso}`}
              className={cn(
                "flex min-h-11 flex-col items-center justify-start gap-0.5 rounded-lg p-1 text-xs transition",
                inMonth ? "text-foreground" : "text-muted-foreground/40",
                iso === today && "ring-1 ring-primary",
                iso === selectedDate && "bg-primary/15",
              )}
            >
              <span>{cell.getDate()}</span>
              {dots.length > 0 && (
                <span className="flex flex-wrap items-center justify-center gap-0.5">
                  {dots.slice(0, 4).map((d) => (
                    <span
                      key={d.key}
                      className={cn("size-1.5 rounded-full", d.colorClass)}
                      title={d.title}
                    />
                  ))}
                  {dots.length > 4 && (
                    <span className="text-[9px] leading-none">+{dots.length - 4}</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

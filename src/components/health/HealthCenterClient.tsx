"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CalendarDays, Clock, Pencil, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthGrid, type DotMarker } from "@/components/calendar/MonthGrid";
import { dayDiff, todayISO } from "@/components/calendar/date-utils";
import { HEALTH_REMINDER_COLOR } from "@/lib/health/constants";
import { REMINDER_TYPE_ICON } from "./reminder-type-meta";
import { completeReminder } from "@/lib/health/actions";
import { ReminderSheet } from "./ReminderSheet";
import type { CreatureOption, HealthReminder } from "@/lib/health/queries";

export function HealthCenterClient({
  reminders,
  creatures,
}: {
  reminders: HealthReminder[];
  creatures: CreatureOption[];
}) {
  const t = useTranslations("health");
  const router = useRouter();
  const today = todayISO();
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [displayYear, setDisplayYear] = useState(() => new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(() => new Date().getMonth());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<HealthReminder | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  function creatureName(id: string | null) {
    if (!id) return null;
    return creatures.find((c) => c.id === id)?.name ?? t("unknownAnimal");
  }

  // Everything on this page derives from `byAnimal` — the legacy bug this
  // spec guards against is a filter that changed the stats/calendar but left
  // the main list showing every animal's reminders.
  const byAnimal = useMemo(
    () => reminders.filter((r) => !selectedAnimalId || r.creatureId === selectedAnimalId),
    [reminders, selectedAnimalId],
  );

  const stats = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let thisWeek = 0;
    for (const r of byAnimal) {
      const diff = dayDiff(today, r.dueDate);
      if (diff < 0) overdue += 1;
      else if (diff === 0) dueToday += 1;
      if (diff >= 0 && diff <= 7) thisWeek += 1;
    }
    return { overdue, dueToday, thisWeek };
  }, [byAnimal, today]);

  const markersByDate = useMemo(() => {
    const map: Record<string, DotMarker[]> = {};
    for (const r of byAnimal) {
      (map[r.dueDate] ??= []).push({
        key: r.id,
        colorClass: HEALTH_REMINDER_COLOR[r.reminderType],
        title: t(`reminderType.${r.reminderType}`),
      });
    }
    return map;
  }, [byAnimal, t]);

  // Date selection is an extra drill-down on top of the animal filter, not a
  // replacement for it — the month grid always shows the whole month's dots.
  const listItems = useMemo(
    () => (selectedDate ? byAnimal.filter((r) => r.dueDate === selectedDate) : byAnimal),
    [byAnimal, selectedDate],
  );

  function dueChip(dueDate: string): string {
    const diff = dayDiff(today, dueDate);
    if (diff < 0) return t("overdueChip", { n: -diff });
    if (diff === 0) return t("todayChip");
    return t("dueInChip", { n: diff });
  }

  function openCreate() {
    setEditingReminder(null);
    setSheetOpen(true);
  }
  function openEdit(reminder: HealthReminder) {
    setEditingReminder(reminder);
    setSheetOpen(true);
  }

  async function toggleComplete(reminder: HealthReminder) {
    setCompletingId(reminder.id);
    await completeReminder(reminder.id);
    setCompletingId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 px-3 pb-6">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t("filterByAnimal")}</span>
        <select
          value={selectedAnimalId ?? ""}
          onChange={(e) => setSelectedAnimalId(e.target.value || null)}
          data-testid="health-animal-filter"
          className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
        >
          <option value="">{t("allAnimals")}</option>
          {creatures.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <div className="premium-panel rounded-2xl p-3 text-center" data-testid="stat-overdue">
          <AlertTriangle className="mx-auto size-4 text-destructive" aria-hidden />
          <p className="mt-1 text-xl font-semibold" data-testid="stat-overdue-count">
            {stats.overdue}
          </p>
          <p className="text-[11px] text-muted-foreground">{t("overdue")}</p>
        </div>
        <div className="premium-panel rounded-2xl p-3 text-center" data-testid="stat-due-today">
          <Clock className="mx-auto size-4 text-brand-link" aria-hidden />
          <p className="mt-1 text-xl font-semibold" data-testid="stat-due-today-count">
            {stats.dueToday}
          </p>
          <p className="text-[11px] text-muted-foreground">{t("dueToday")}</p>
        </div>
        <div className="premium-panel rounded-2xl p-3 text-center" data-testid="stat-this-week">
          <CalendarDays className="mx-auto size-4 text-muted-foreground" aria-hidden />
          <p className="mt-1 text-xl font-semibold" data-testid="stat-this-week-count">
            {stats.thisWeek}
          </p>
          <p className="text-[11px] text-muted-foreground">{t("thisWeek")}</p>
        </div>
      </div>

      <Button type="button" onClick={openCreate} data-testid="add-reminder-cta">
        <Plus className="size-4" aria-hidden />
        {t("addReminder")}
      </Button>

      <div className="premium-panel rounded-2xl p-3">
        <MonthGrid
          year={displayYear}
          month={displayMonth}
          onMonthChange={(y, m) => {
            setDisplayYear(y);
            setDisplayMonth(m);
          }}
          selectedDate={selectedDate}
          onSelectDate={(iso) => setSelectedDate((cur) => (cur === iso ? null : iso))}
          markersByDate={markersByDate}
          testIdPrefix="health"
          todayLabel={t("today")}
          previousMonthLabel={t("previousMonth")}
          nextMonthLabel={t("nextMonth")}
        />
      </div>

      <div>
        <div className="flex items-center justify-between pb-2">
          <h2 className="text-sm font-semibold">{t("remindersHeading")}</h2>
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-xs text-brand-link"
              data-testid="health-clear-date"
            >
              {t("clearDate")}
            </button>
          )}
        </div>
        {listItems.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="reminder-empty">
            {t("remindersEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="reminder-list">
            {listItems.map((r) => {
              const Icon = REMINDER_TYPE_ICON[r.reminderType];
              const animal = creatureName(r.creatureId);
              return (
                <li
                  key={r.id}
                  className="flex items-start gap-2 rounded-xl border border-border/70 p-3"
                  data-testid={`reminder-item-${r.id}`}
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={completingId === r.id}
                    onChange={() => toggleComplete(r)}
                    aria-label={t("markComplete")}
                    data-testid={`reminder-checkbox-${r.id}`}
                    className="mt-1 size-4 shrink-0"
                  />
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{r.title}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span data-testid={`reminder-chip-${r.id}`}>{dueChip(r.dueDate)}</span>
                      {animal && <span>{animal}</span>}
                      {r.repeatInterval !== "none" && (
                        <span className="inline-flex items-center gap-0.5">
                          <Repeat className="size-3" aria-hidden />
                          {t(`repeat.${r.repeatInterval}`)}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(r)}
                    aria-label={t("editReminder")}
                    data-testid={`reminder-edit-${r.id}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ReminderSheet
        key={`${sheetOpen}-${editingReminder?.id ?? "create"}`}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        creatures={creatures}
        defaultDate={selectedDate ?? today}
        editing={editingReminder}
        onSaved={() => router.refresh()}
        onDeleted={() => router.refresh()}
        onCompleted={() => router.refresh()}
      />
    </div>
  );
}

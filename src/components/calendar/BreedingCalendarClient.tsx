"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Baby, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthGrid, type DotMarker } from "./MonthGrid";
import { EventSheet } from "./EventSheet";
import { EVENT_TYPE_ICON } from "./event-type-meta";
import { dayDiff, formatDateLong, todayISO } from "./date-utils";
import { BREEDING_EVENT_COLOR } from "@/lib/breeding/constants";
import type { BreedingEvent, CreatureOption } from "@/lib/breeding/queries";

export function BreedingCalendarClient({
  events,
  creatures,
  gestationDays,
}: {
  events: BreedingEvent[];
  creatures: CreatureOption[];
  gestationDays: Record<string, number>;
}) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const today = todayISO();
  const [displayYear, setDisplayYear] = useState(() => new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BreedingEvent | null>(null);

  function creatureName(id: string) {
    return creatures.find((c) => c.id === id)?.name ?? t("unknownAnimal");
  }

  const markersByDate = useMemo(() => {
    const map: Record<string, DotMarker[]> = {};
    for (const ev of events) {
      (map[ev.eventDate] ??= []).push({
        key: ev.id,
        colorClass: BREEDING_EVENT_COLOR[ev.eventType],
        title: t(`eventType.${ev.eventType}`),
      });
    }
    return map;
  }, [events, t]);

  const upcoming = useMemo(() => events.filter((e) => e.eventDate >= today).slice(0, 10), [events, today]);

  const dueSoon = useMemo(
    () =>
      events.filter((e) => {
        if (!e.expectedDueDate) return false;
        const diff = dayDiff(today, e.expectedDueDate);
        return diff >= 0 && diff <= 14;
      }),
    [events, today],
  );

  const dayEvents = useMemo(
    () => (selectedDate ? events.filter((e) => e.eventDate === selectedDate) : []),
    [events, selectedDate],
  );

  function selectDate(iso: string) {
    setSelectedDate(iso);
    const [y, m] = iso.split("-").map(Number);
    setDisplayYear(y);
    setDisplayMonth(m - 1);
  }

  function openCreate() {
    setEditingEvent(null);
    setSheetOpen(true);
  }
  function openEdit(event: BreedingEvent) {
    setEditingEvent(event);
    setSheetOpen(true);
  }

  return (
    <div className="flex flex-col gap-4 px-3 pb-6">
      {dueSoon.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="birth-alerts">
          {dueSoon.map((e) => {
            const diff = dayDiff(today, e.expectedDueDate!);
            return (
              <div
                key={e.id}
                className="premium-panel flex items-center gap-3 rounded-2xl border border-primary/30 p-3"
                data-testid={`birth-alert-${e.id}`}
              >
                <Baby className="size-5 shrink-0 text-brand-link" aria-hidden />
                <p className="text-sm">
                  {diff === 0
                    ? t("birthExpectedToday", { name: creatureName(e.creatureId) })
                    : t("birthExpectedInDays", { name: creatureName(e.creatureId), days: diff })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="premium-panel rounded-2xl p-3">
        <MonthGrid
          year={displayYear}
          month={displayMonth}
          onMonthChange={(y, m) => {
            setDisplayYear(y);
            setDisplayMonth(m);
          }}
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          markersByDate={markersByDate}
          testIdPrefix="cal"
          todayLabel={t("today")}
          previousMonthLabel={t("previousMonth")}
          nextMonthLabel={t("nextMonth")}
        />
      </div>

      <Button type="button" onClick={openCreate} data-testid="log-event-cta">
        <Plus className="size-4" aria-hidden />
        {t("logEvent")}
      </Button>

      {selectedDate && (
        <div className="premium-panel rounded-2xl p-4" data-testid="day-panel">
          <p className="pb-2 text-sm font-semibold">{formatDateLong(selectedDate)}</p>
          {dayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="day-panel-empty">
              {t("dayPanelEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dayEvents.map((e) => {
                const Icon = EVENT_TYPE_ICON[e.eventType];
                return (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border/70 p-3"
                    data-testid={`day-event-${e.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="text-sm">
                        <p className="font-medium">{t(`eventType.${e.eventType}`)}</p>
                        <p className="text-xs text-muted-foreground">
                          {creatureName(e.creatureId)}
                          {e.partnerCreatureId && ` × ${creatureName(e.partnerCreatureId)}`}
                        </p>
                        {e.expectedDueDate && (
                          <p className="text-xs text-muted-foreground">
                            {t("dueDateLabel")}: {formatDateLong(e.expectedDueDate)}
                          </p>
                        )}
                        {e.notes && <p className="mt-1 text-xs">{e.notes}</p>}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(e)}
                      aria-label={t("editEvent")}
                      data-testid={`day-event-edit-${e.id}`}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div>
        <h2 className="pb-2 text-sm font-semibold">{t("upcomingHeading")}</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="upcoming-empty">
            {t("upcomingEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="upcoming-list">
            {upcoming.map((e) => {
              const Icon = EVENT_TYPE_ICON[e.eventType];
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => selectDate(e.eventDate)}
                    data-testid={`upcoming-item-${e.id}`}
                    className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-left text-sm"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex-1">
                      <span className="font-medium">{t(`eventType.${e.eventType}`)}</span>{" "}
                      <span className="text-muted-foreground">{creatureName(e.creatureId)}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateLong(e.eventDate)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <EventSheet
        key={`${sheetOpen}-${editingEvent?.id ?? "create"}`}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        creatures={creatures}
        gestationDays={gestationDays}
        defaultDate={selectedDate ?? today}
        editing={editingEvent}
        onSaved={() => router.refresh()}
        onDeleted={() => router.refresh()}
      />
    </div>
  );
}

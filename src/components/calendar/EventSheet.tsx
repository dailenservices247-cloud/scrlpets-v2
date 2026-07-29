"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateLong } from "./date-utils";
import { BREEDING_EVENT_TYPES, type BreedingEventType } from "@/lib/breeding/constants";
import { EVENT_TYPE_ICON } from "./event-type-meta";
import {
  createBreedingEvent,
  deleteBreedingEvent,
  updateBreedingEvent,
} from "@/lib/breeding/actions";
import type { BreedingEvent, CreatureOption } from "@/lib/breeding/queries";

export function EventSheet({
  open,
  onClose,
  creatures,
  gestationDays,
  defaultDate,
  editing,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  creatures: CreatureOption[];
  gestationDays: Record<string, number>;
  defaultDate: string;
  editing: BreedingEvent | null;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("calendar");
  // No reset-on-open effect: the caller keys this component on open/editing
  // target (see BreedingCalendarClient), so a fresh sheet session is a fresh
  // mount and these lazy initializers are all the "reset" that's needed.
  const [eventType, setEventType] = useState<BreedingEventType | null>(
    () => editing?.eventType ?? null,
  );
  const [creatureId, setCreatureId] = useState<string | null>(() => editing?.creatureId ?? null);
  const [partnerCreatureId, setPartnerCreatureId] = useState<string | null>(
    () => editing?.partnerCreatureId ?? null,
  );
  const [eventDate, setEventDate] = useState(() => editing?.eventDate ?? defaultDate);
  const [notes, setNotes] = useState(() => editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedEvent, setSavedEvent] = useState<BreedingEvent | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function selectType(type: BreedingEventType) {
    setEventType(type);
    if (type !== "mating") setPartnerCreatureId(null);
  }
  function selectCreature(id: string | null) {
    setCreatureId(id);
    if (id && partnerCreatureId === id) setPartnerCreatureId(null);
  }

  async function save() {
    if (!eventType || !creatureId || !eventDate) {
      setError(t("saveErrorMissing"));
      return;
    }
    setBusy(true);
    setError(null);
    const input = {
      creatureId,
      partnerCreatureId: eventType === "mating" ? partnerCreatureId : null,
      eventType,
      eventDate,
      notes,
    };
    const result = editing
      ? await updateBreedingEvent(editing.id, input)
      : await createBreedingEvent(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "not_your_animal" ? t("errorNotYourAnimal") : t("saveError"));
      return;
    }
    onSaved();
    if (result.event.eventType === "mating" && result.event.expectedDueDate) {
      setSavedEvent(result.event);
    } else {
      onClose();
    }
  }

  async function confirmDelete() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const result = await deleteBreedingEvent(editing.id);
    setBusy(false);
    if (!result.ok) {
      setError(t("saveError"));
      return;
    }
    onDeleted();
    onClose();
  }

  const selectedCreature = creatures.find((c) => c.id === creatureId);
  const gestationHintDays = selectedCreature?.species
    ? gestationDays[selectedCreature.species.toLowerCase()]
    : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup
            className="premium-panel max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl p-4 sm:rounded-2xl"
            data-testid="event-sheet"
          >
            <div className="flex items-center justify-between pb-2">
              <Dialog.Title className="text-lg font-semibold">
                {editing ? t("editEvent") : t("logEvent")}
              </Dialog.Title>
              <Dialog.Close
                aria-label={t("close")}
                data-testid="event-sheet-close"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>

            {savedEvent ? (
              <div className="flex flex-col gap-3 pt-2" data-testid="event-success">
                <p className="text-sm">{t("eventSaved")}</p>
                <p className="text-sm font-semibold" data-testid="event-due-date">
                  {t("dueDateLabel")}: {formatDateLong(savedEvent.expectedDueDate!)}
                </p>
                <Button type="button" onClick={onClose} data-testid="event-success-close">
                  {t("close")}
                </Button>
              </div>
            ) : creatures.length === 0 ? (
              <div className="flex flex-col gap-3 pt-2 text-sm" data-testid="event-no-animals">
                <p className="text-muted-foreground">{t("noAnimalsYet")}</p>
                <Link
                  href="/compose"
                  className="min-h-11 rounded-xl bg-primary/15 px-4 py-2.5 text-center text-sm font-medium text-brand-link"
                  data-testid="event-add-animal-link"
                >
                  {t("addAnimalCta")}
                </Link>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
                className="flex flex-col gap-3 pt-2"
              >
                <div className="grid grid-cols-4 gap-2" data-testid="event-type-grid">
                  {BREEDING_EVENT_TYPES.map((type) => {
                    const Icon = EVENT_TYPE_ICON[type];
                    const active = eventType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => selectType(type)}
                        aria-pressed={active}
                        data-testid={`event-type-${type}`}
                        className={cn(
                          "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-[11px] font-medium leading-tight",
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-input text-muted-foreground",
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                        {t(`eventType.${type}`)}
                      </button>
                    );
                  })}
                </div>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">{t("animalLabel")}</span>
                  <select
                    value={creatureId ?? ""}
                    onChange={(e) => selectCreature(e.target.value || null)}
                    data-testid="event-creature"
                    className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="">{t("selectAnimal")}</option>
                    {creatures.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                {eventType === "mating" && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">{t("partnerLabel")}</span>
                    <select
                      value={partnerCreatureId ?? ""}
                      onChange={(e) => setPartnerCreatureId(e.target.value || null)}
                      data-testid="event-partner"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="">{t("noPartner")}</option>
                      {creatures
                        .filter((c) => c.id !== creatureId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                    {gestationHintDays && (
                      <span className="text-xs text-muted-foreground" data-testid="gestation-hint">
                        {t("gestationHint", { days: gestationHintDays })}
                      </span>
                    )}
                  </label>
                )}

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">{t("dateLabel")}</span>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    data-testid="event-date"
                    className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">{t("notesLabel")}</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t("notesPlaceholder")}
                    data-testid="event-notes"
                    className="min-h-20 rounded-xl border border-input bg-transparent p-3 text-sm"
                  />
                </label>

                {error && (
                  <p className="text-sm text-destructive" data-testid="event-error">
                    {error}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  {editing && !confirmingDelete && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setConfirmingDelete(true)}
                      data-testid="event-delete"
                    >
                      {t("delete")}
                    </Button>
                  )}
                  <Button type="submit" disabled={busy} className="flex-1" data-testid="event-save">
                    {busy ? t("saving") : t("save")}
                  </Button>
                </div>

                {confirmingDelete && (
                  <div
                    className="flex items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm"
                    data-testid="event-delete-confirm"
                  >
                    <span>{t("deleteConfirm")}</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmingDelete(false)}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={confirmDelete}
                        data-testid="event-delete-confirm-yes"
                      >
                        {t("delete")}
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

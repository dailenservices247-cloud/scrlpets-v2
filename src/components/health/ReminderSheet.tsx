"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HEALTH_REMINDER_TYPES,
  REPEAT_INTERVALS,
  type HealthReminderType,
  type RepeatInterval,
} from "@/lib/health/constants";
import { REMINDER_TYPE_ICON } from "./reminder-type-meta";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  updateReminder,
} from "@/lib/health/actions";
import type { CreatureOption, HealthReminder } from "@/lib/health/queries";

export function ReminderSheet({
  open,
  onClose,
  creatures,
  defaultDate,
  editing,
  onSaved,
  onDeleted,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  creatures: CreatureOption[];
  defaultDate: string;
  editing: HealthReminder | null;
  onSaved: () => void;
  onDeleted: () => void;
  onCompleted: () => void;
}) {
  const t = useTranslations("health");
  // No reset-on-open effect: the caller keys this component on open/editing
  // target (see HealthCenterClient), so a fresh sheet session is a fresh
  // mount and these lazy initializers are all the "reset" that's needed.
  const [reminderType, setReminderType] = useState<HealthReminderType | null>(
    () => editing?.reminderType ?? null,
  );
  const [creatureId, setCreatureId] = useState<string | null>(() => editing?.creatureId ?? null);
  const [title, setTitle] = useState(() => editing?.title ?? "");
  const [dueDate, setDueDate] = useState(() => editing?.dueDate ?? defaultDate);
  const [repeatInterval, setRepeatInterval] = useState<RepeatInterval>(
    () => editing?.repeatInterval ?? "none",
  );
  const [notes, setNotes] = useState(() => editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function save() {
    if (!reminderType || !title.trim() || !dueDate) {
      setError(t("saveErrorMissing"));
      return;
    }
    setBusy(true);
    setError(null);
    const input = { creatureId, reminderType, title, dueDate, repeatInterval, notes };
    const result = editing
      ? await updateReminder(editing.id, input)
      : await createReminder(input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "invalid_title" ? t("titleInvalid") : t("saveError"));
      return;
    }
    onSaved();
    onClose();
  }

  async function complete() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const result = await completeReminder(editing.id);
    setBusy(false);
    if (!result.ok) {
      setError(t("saveError"));
      return;
    }
    onCompleted();
    onClose();
  }

  async function confirmDelete() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const result = await deleteReminder(editing.id);
    setBusy(false);
    if (!result.ok) {
      setError(t("saveError"));
      return;
    }
    onDeleted();
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup
            className="premium-panel max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl p-4 sm:rounded-2xl"
            data-testid="reminder-sheet"
          >
            <div className="flex items-center justify-between pb-2">
              <Dialog.Title className="text-lg font-semibold">
                {editing ? t("editReminder") : t("addReminder")}
              </Dialog.Title>
              <Dialog.Close
                aria-label={t("close")}
                data-testid="reminder-sheet-close"
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="flex flex-col gap-3 pt-2"
            >
              <div className="grid grid-cols-3 gap-2" data-testid="reminder-type-grid">
                {HEALTH_REMINDER_TYPES.map((type) => {
                  const Icon = REMINDER_TYPE_ICON[type];
                  const active = reminderType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setReminderType(type)}
                      aria-pressed={active}
                      data-testid={`reminder-type-${type}`}
                      className={cn(
                        "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-[11px] font-medium leading-tight",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-input text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                      {t(`reminderType.${type}`)}
                    </button>
                  );
                })}
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{t("titleLabel")}</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder={t("titlePlaceholder")}
                  data-testid="reminder-title"
                  className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{t("animalLabel")}</span>
                <select
                  value={creatureId ?? ""}
                  onChange={(e) => setCreatureId(e.target.value || null)}
                  data-testid="reminder-creature"
                  className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">{t("noAnimal")}</option>
                  {creatures.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{t("dueDateLabel")}</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  data-testid="reminder-due-date"
                  className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{t("repeatLabel")}</span>
                <select
                  value={repeatInterval}
                  onChange={(e) => setRepeatInterval(e.target.value as RepeatInterval)}
                  data-testid="reminder-repeat"
                  className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                >
                  {REPEAT_INTERVALS.map((interval) => (
                    <option key={interval} value={interval}>
                      {t(`repeat.${interval}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{t("notesLabel")}</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("notesPlaceholder")}
                  data-testid="reminder-notes"
                  className="min-h-20 rounded-xl border border-input bg-transparent p-3 text-sm"
                />
              </label>

              {error && (
                <p className="text-sm text-destructive" data-testid="reminder-error">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                {editing && !confirmingDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmingDelete(true)}
                    data-testid="reminder-delete"
                  >
                    {t("delete")}
                  </Button>
                )}
                {editing && !confirmingDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={complete}
                    disabled={busy}
                    data-testid="reminder-complete"
                  >
                    {t("markComplete")}
                  </Button>
                )}
                <Button type="submit" disabled={busy} className="flex-1" data-testid="reminder-save">
                  {busy ? t("saving") : t("save")}
                </Button>
              </div>

              {confirmingDelete && (
                <div
                  className="flex items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm"
                  data-testid="reminder-delete-confirm"
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
                      data-testid="reminder-delete-confirm-yes"
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

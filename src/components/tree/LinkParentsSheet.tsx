"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { useTranslations } from "next-intl";
import { Link2 } from "lucide-react";
import { linkParent, unlinkParent } from "@/lib/tree/actions";
import type { TreeCreature } from "@/lib/tree/queries";

const SLOTS = ["sire", "dam"] as const;
type Slot = (typeof SLOTS)[number];

export function LinkParentsSheet({
  creature,
  allCreatures,
}: {
  creature: TreeCreature;
  allCreatures: TreeCreature[];
}) {
  const t = useTranslations("tree");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Slot | null>(null);
  const [error, setError] = useState(false);

  // A creature cannot be its own parent; the DB also refuses cycles and
  // cross-owner parents, so this list is a UX narrowing, not the real guard.
  const candidates = allCreatures.filter((c) => c.id !== creature.id);

  async function link(slot: Slot, parentId: string) {
    if (!parentId) return;
    setBusy(slot);
    setError(false);
    const formData = new FormData();
    formData.set("targetCreature", creature.id);
    formData.set("targetParent", parentId);
    formData.set("linkType", slot);
    const result = await linkParent(formData);
    setBusy(null);
    if (!result.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  async function unlink(slot: Slot) {
    setBusy(slot);
    setError(false);
    const formData = new FormData();
    formData.set("targetCreature", creature.id);
    formData.set("linkType", slot);
    const result = await unlinkParent(formData);
    setBusy(null);
    if (!result.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow hover:text-foreground"
        aria-label={t("linkParentsCta")}
        data-testid={`tree-link-parents-trigger-${creature.id}`}
      >
        <Link2 className="size-3.5" aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <Dialog.Popup
            className="premium-panel w-full max-w-md rounded-t-2xl border border-border p-5 shadow-2xl sm:rounded-2xl"
            data-testid={`link-parents-sheet-${creature.id}`}
          >
            <Dialog.Title className="text-lg font-semibold">
              {t("linkParentsTitle", { name: creature.name })}
            </Dialog.Title>

            {SLOTS.map((slot) => {
              const currentId = slot === "sire" ? creature.sireId : creature.damId;
              return (
                <div key={slot} className="mt-4">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-xs text-muted-foreground">{t(`slot.${slot}`)}</span>
                    <select
                      value={currentId ?? ""}
                      disabled={busy !== null}
                      onChange={(event) => link(slot, event.target.value)}
                      className="min-h-11 rounded-lg border border-input bg-background p-2 text-sm"
                      data-testid={`link-parents-${slot}-select-${creature.id}`}
                    >
                      <option value="">{t("slotNone")}</option>
                      {candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {currentId && (
                    <button
                      type="button"
                      onClick={() => unlink(slot)}
                      disabled={busy !== null}
                      className="mt-2 text-xs text-destructive underline disabled:opacity-50"
                      data-testid={`link-parents-${slot}-unlink-${creature.id}`}
                    >
                      {t("unlink")}
                    </button>
                  )}
                </div>
              );
            })}

            {error && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {t("linkParentsError")}
              </p>
            )}

            <div className="mt-5 flex justify-end">
              <Dialog.Close
                className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
                data-testid={`link-parents-close-${creature.id}`}
              >
                {t("done")}
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

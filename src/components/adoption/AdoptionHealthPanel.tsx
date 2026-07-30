"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog } from "@base-ui/react/dialog";
import { updateAdoptionDetails } from "@/lib/adoption/actions";
import type { AdoptionDetail } from "@/lib/adoption/queries";

const HEALTH_FIELDS = ["spayedNeutered", "vaccinated", "microchipped"] as const;
const GOOD_WITH_FIELDS = ["goodWithKids", "goodWithDogs", "goodWithCats"] as const;

type TriState = "true" | "false" | "unknown";

function triState(value: boolean | null): TriState {
  return value === true ? "true" : value === false ? "false" : "unknown";
}

// A false is a real fact, not a warning — only "unknown" gets the muted
// dashed treatment, so it never reads as a quiet "no".
const CHIP_CLASS: Record<TriState, string> = {
  true: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  false: "border-border/70 bg-muted/30 text-foreground",
  unknown: "border-dashed border-border/50 bg-transparent text-muted-foreground",
};

type Details = Pick<
  AdoptionDetail,
  | "spayedNeutered"
  | "vaccinated"
  | "microchipped"
  | "goodWithKids"
  | "goodWithDogs"
  | "goodWithCats"
  | "reason"
  | "specialNeeds"
>;

/**
 * V2-03: honest tri-state chips for Health & care / Good with, plus Reason
 * for rehoming and Special needs when present. A false is always shown
 * plainly ("Not vaccinated") — never hidden — and null reads as unknown,
 * never as no. Doubles as the owner's editor (ListingForm and the listing
 * edit page are outside this lane's granted paths — see build notes).
 */
export function AdoptionHealthPanel({
  listingId,
  isOwner,
  details,
}: {
  listingId: string;
  isOwner: boolean;
  details: Details;
}) {
  const t = useTranslations("adopt");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await updateAdoptionDetails(listingId, formData);
    setBusy(false);
    if (!result.ok) {
      setError(t("edit.error"));
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="adoption-health-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="eyebrow">{t("healthCareTitle")}</h2>
        {isOwner && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid="adoption-edit-open"
            className="min-h-11 rounded-lg border border-input px-3 text-xs font-medium"
          >
            {t("edit.cta")}
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {HEALTH_FIELDS.map((field) => {
          const state = triState(details[field]);
          return (
            <span
              key={field}
              data-testid={`adoption-chip-${field}`}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${CHIP_CLASS[state]}`}
            >
              {t(`chip.${field}.${state}`)}
            </span>
          );
        })}
      </div>

      <h2 className="mt-4 eyebrow">{t("goodWithTitle")}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {GOOD_WITH_FIELDS.map((field) => {
          const state = triState(details[field]);
          return (
            <span
              key={field}
              data-testid={`adoption-chip-${field}`}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${CHIP_CLASS[state]}`}
            >
              {t(`chip.${field}.${state}`)}
            </span>
          );
        })}
      </div>

      {details.reason && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-muted-foreground">{t("reasonTitle")}</h3>
          <p className="mt-1 text-sm" data-testid="adoption-reason">
            {details.reason}
          </p>
        </div>
      )}
      {details.specialNeeds && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-muted-foreground">{t("specialNeedsTitle")}</h3>
          <p className="mt-1 text-sm" data-testid="adoption-special-needs">
            {details.specialNeeds}
          </p>
        </div>
      )}

      {isOwner && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
            <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
              <Dialog.Popup
                className="premium-panel w-full max-w-md rounded-2xl border border-border p-5 shadow-2xl"
                data-testid="adoption-edit-dialog"
              >
                <Dialog.Title className="text-lg font-semibold">{t("edit.title")}</Dialog.Title>
                <form action={submit} className="mt-4 flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
                  {[...HEALTH_FIELDS, ...GOOD_WITH_FIELDS].map((field) => (
                    <label key={field} className="flex flex-col gap-1 text-xs">
                      {/* The field's own "true" chip text ("Spayed/neutered",
                          "Good with kids"...) doubles as a neutral form label. */}
                      <span className="font-medium">{t(`chip.${field}.true`)}</span>
                      <select
                        name={field}
                        defaultValue={triState(details[field])}
                        data-testid={`adoption-edit-input-${field}`}
                        className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                      >
                        <option value="unknown">{t("edit.unknownOption")}</option>
                        <option value="true">{t("edit.yesOption")}</option>
                        <option value="false">{t("edit.noOption")}</option>
                      </select>
                    </label>
                  ))}
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("reasonTitle")}</span>
                    <textarea
                      name="reason"
                      rows={2}
                      defaultValue={details.reason ?? ""}
                      data-testid="adoption-edit-input-reason"
                      className="rounded-xl border border-input bg-transparent p-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("specialNeedsTitle")}</span>
                    <textarea
                      name="specialNeeds"
                      rows={2}
                      defaultValue={details.specialNeeds ?? ""}
                      data-testid="adoption-edit-input-specialNeeds"
                      className="rounded-xl border border-input bg-transparent p-2 text-sm"
                    />
                  </label>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      data-testid="adoption-edit-save"
                      className="min-h-11 flex-1 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
                    >
                      {busy ? t("edit.saving") : t("edit.save")}
                    </button>
                    <Dialog.Close className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium">
                      {t("edit.cancel")}
                    </Dialog.Close>
                  </div>
                </form>
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </section>
  );
}

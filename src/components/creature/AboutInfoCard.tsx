"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog } from "@base-ui/react/dialog";
import { updateCreatureDetails } from "@/lib/creatures/actions";
import { CREATURE_ROLES, GENDERS } from "@/lib/creatures/types";
import type { CreatureDetail } from "@/lib/creatures/queries";

const TODAY = new Date().toISOString().slice(0, 10);
const ABOUT_FIELDS = ["species", "breed", "gender", "color", "markings", "birthDate", "registrationNumber"] as const;

/** Structured About card (species/breed/gender/color/markings/birth
 * date/registration number — empty rows omitted) plus the owner-only "Edit
 * details" sheet covering those fields, role, and page visibility. */
export function AboutInfoCard({
  creatureId,
  slug,
  detail,
  isOwner,
  isDeceased,
}: {
  creatureId: string;
  slug: string;
  detail: CreatureDetail;
  isOwner: boolean;
  isDeceased: boolean;
}) {
  const t = useTranslations("creature");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageVisible, setPageVisible] = useState(detail.pageVisible);

  const values: Record<(typeof ABOUT_FIELDS)[number], string | null> = {
    species: detail.species,
    breed: detail.breed,
    gender: detail.gender ? t(`about.gender.${detail.gender}`) : null,
    color: detail.color,
    markings: detail.markings,
    birthDate: detail.birthDate,
    registrationNumber: detail.registrationNumber,
  };
  const rows = ABOUT_FIELDS.map((key) => ({ key, value: values[key] })).filter((r) => r.value);

  if (rows.length === 0 && !isOwner) return null;

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    formData.set("pageVisible", String(pageVisible));
    const result = await updateCreatureDetails(creatureId, slug, formData);
    setBusy(false);
    if (!result.ok) {
      setError(t("about.error"));
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-2xl px-4 pt-4" data-testid="creature-about">
      <div className={`rounded-2xl border p-4 ${isDeceased ? "border-border/50 bg-muted/10" : "premium-panel"}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="eyebrow">{t("about.title")}</h2>
          {isOwner && (
            <button
              type="button"
              onClick={() => {
                // Re-seed from the true saved value each time — otherwise a
                // toggle-then-cancel would leave a stale checkbox state that
                // resurfaces (and mis-describes itself) on the next reopen.
                setPageVisible(detail.pageVisible);
                setOpen(true);
              }}
              data-testid="about-edit-open"
              className="min-h-11 rounded-lg border border-input px-3 text-xs font-medium"
            >
              {t("about.editCta")}
            </button>
          )}
        </div>

        {rows.length > 0 ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            {rows.map((r) => (
              <div key={r.key}>
                <dt className="text-xs text-muted-foreground">{t(`about.field.${r.key}`)}</dt>
                <dd data-testid={`about-value-${r.key}`}>{r.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground" data-testid="about-empty">
            {t("about.empty")}
          </p>
        )}
      </div>

      {isOwner && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
            <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
              <Dialog.Popup
                className="premium-panel w-full max-w-md rounded-2xl border border-border p-5 shadow-2xl"
                data-testid="about-edit-dialog"
              >
                <Dialog.Title className="text-lg font-semibold">{t("about.editTitle")}</Dialog.Title>
                <form action={submit} className="mt-4 flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("about.field.species")}</span>
                    <input
                      name="species"
                      defaultValue={detail.species ?? ""}
                      data-testid="about-input-species"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("about.field.breed")}</span>
                    <input
                      name="breed"
                      defaultValue={detail.breed ?? ""}
                      data-testid="about-input-breed"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("about.field.gender")}</span>
                    <select
                      name="gender"
                      defaultValue={detail.gender ?? ""}
                      data-testid="about-input-gender"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="">—</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>
                          {t(`about.gender.${g}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("about.field.color")}</span>
                    <input
                      name="color"
                      defaultValue={detail.color ?? ""}
                      data-testid="about-input-color"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("about.field.markings")}</span>
                    <input
                      name="markings"
                      defaultValue={detail.markings ?? ""}
                      data-testid="about-input-markings"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("about.field.birthDate")}</span>
                    <input
                      type="date"
                      name="birthDate"
                      defaultValue={detail.birthDate ?? ""}
                      max={TODAY}
                      data-testid="about-input-birthDate"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("about.field.registrationNumber")}</span>
                    <input
                      name="registrationNumber"
                      defaultValue={detail.registrationNumber ?? ""}
                      data-testid="about-input-registrationNumber"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("about.roleLabel")}</span>
                    <select
                      name="creatureRole"
                      defaultValue={detail.creatureRole}
                      data-testid="about-input-role"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    >
                      {CREATURE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(`about.role.${role}`)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
                      {t("about.visibilityLabel")}
                      <input
                        type="checkbox"
                        checked={pageVisible}
                        onChange={(e) => setPageVisible(e.target.checked)}
                        data-testid="about-input-visibility"
                        className="size-5 shrink-0 accent-primary"
                      />
                    </label>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {pageVisible ? t("about.visibilityOn") : t("about.visibilityOff")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("about.visibilityHint")}</p>
                  </div>

                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      data-testid="about-save"
                      className="min-h-11 flex-1 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
                    >
                      {busy ? t("about.saving") : t("about.save")}
                    </button>
                    <Dialog.Close className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium">
                      {t("about.cancel")}
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

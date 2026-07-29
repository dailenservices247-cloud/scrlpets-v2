"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createTreeAnimal } from "@/lib/tree/actions";

export function AddAnimalSheet() {
  const t = useTranslations("tree");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const result = await createTreeAnimal(new FormData(event.currentTarget));
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="shrink-0 min-h-11 rounded-lg border border-input px-3 text-sm font-medium text-brand-link"
        data-testid="tree-add-animal-trigger"
      >
        {t("addAnimal")}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <Dialog.Popup
            className="premium-panel w-full max-w-md rounded-t-2xl border border-border p-5 shadow-2xl sm:rounded-2xl"
            data-testid="add-animal-sheet"
          >
            <Dialog.Title className="text-lg font-semibold">{t("addAnimalTitle")}</Dialog.Title>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">{t("fieldName")}</span>
                <input
                  name="name"
                  required
                  className="min-h-11 rounded-lg border border-input bg-transparent p-2"
                  data-testid="add-animal-name"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">{t("fieldSpecies")}</span>
                <input
                  name="species"
                  className="min-h-11 rounded-lg border border-input bg-transparent p-2"
                  data-testid="add-animal-species"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">{t("fieldBreed")}</span>
                <input
                  name="breed"
                  className="min-h-11 rounded-lg border border-input bg-transparent p-2"
                  data-testid="add-animal-breed"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-muted-foreground">{t("fieldGender")}</span>
                  <select
                    name="gender"
                    defaultValue="unknown"
                    className="min-h-11 rounded-lg border border-input bg-background p-2"
                    data-testid="add-animal-gender"
                  >
                    <option value="male">{t("genderMale")}</option>
                    <option value="female">{t("genderFemale")}</option>
                    <option value="unknown">{t("genderUnknown")}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-muted-foreground">{t("fieldRole")}</span>
                  <select
                    name="creatureRole"
                    defaultValue="pet"
                    className="min-h-11 rounded-lg border border-input bg-background p-2"
                    data-testid="add-animal-role"
                  >
                    <option value="pet">{t("rolePet")}</option>
                    <option value="breeding">{t("roleBreeding")}</option>
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-muted-foreground">{t("fieldBirthDate")}</span>
                <input
                  type="date"
                  name="birthDate"
                  className="min-h-11 rounded-lg border border-input bg-transparent p-2"
                  data-testid="add-animal-birth-date"
                />
              </label>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {t("addAnimalError")}
                </p>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <Dialog.Close className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
                  {t("cancel")}
                </Dialog.Close>
                <Button type="submit" variant="solid" disabled={busy} data-testid="add-animal-submit">
                  {busy ? t("adding") : t("addAnimalSubmit")}
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

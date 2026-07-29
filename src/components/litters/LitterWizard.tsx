"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LITTER_SPECIES, LITTER_STATUSES, YOUNG_GENDERS } from "@/lib/litters/constants";
import {
  addYoung,
  createLitter,
  linkYoung,
  unlinkYoung,
  updateLitter,
} from "@/lib/litters/actions";
import type { BreedingCreature, LinkableCreature, MyLitter } from "@/lib/litters/queries";

const TOTAL_STEPS = 4;
const field = "min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm";
const KNOWN_ERRORS = new Set(["name", "not_found", "auth_required"]);

type Basics = {
  name: string;
  species: string;
  breed: string;
  description: string;
  expectedDate: string;
  birthDate: string;
  status: string;
};

type PendingYoung = { key: string; name: string; gender: string };

function toBasics(litter: MyLitter | null): Basics {
  return {
    name: litter?.name ?? "",
    species: litter?.species ?? LITTER_SPECIES[0],
    breed: litter?.breed ?? "",
    description: litter?.description ?? "",
    expectedDate: litter?.expectedDate ?? "",
    birthDate: litter?.birthDate ?? "",
    status: litter?.status ?? LITTER_STATUSES[0],
  };
}

function basicsFormData(basics: Basics, sireId: string, damId: string): FormData {
  const fd = new FormData();
  fd.set("name", basics.name);
  fd.set("species", basics.species);
  fd.set("breed", basics.breed);
  fd.set("description", basics.description);
  fd.set("expectedDate", basics.expectedDate);
  fd.set("birthDate", basics.birthDate);
  fd.set("status", basics.status);
  fd.set("sireId", sireId);
  fd.set("damId", damId);
  return fd;
}

export function LitterWizard({
  litter,
  breedingCreatures,
  linkableCreatures,
  onClose,
  onSaved,
}: {
  litter: MyLitter | null;
  breedingCreatures: BreedingCreature[];
  linkableCreatures: LinkableCreature[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("litters");
  const isEdit = Boolean(litter);
  const [step, setStep] = useState(1);
  const [basics, setBasics] = useState<Basics>(() => toBasics(litter));
  const [sireId, setSireId] = useState(litter?.sireId ?? "");
  const [damId, setDamId] = useState(litter?.damId ?? "");

  const candidates = linkableCreatures.filter(
    (c) => c.litterId === null || c.litterId === litter?.id,
  );
  const originallyLinked = new Set(
    candidates.filter((c) => c.litterId === litter?.id).map((c) => c.id),
  );
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set(originallyLinked));
  const [pendingYoung, setPendingYoung] = useState<PendingYoung[]>([]);
  const [newYoungName, setNewYoungName] = useState("");
  const [newYoungGender, setNewYoungGender] = useState<string>("unknown");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPendingYoung() {
    if (!newYoungName.trim()) return;
    setPendingYoung((prev) => [
      ...prev,
      { key: crypto.randomUUID(), name: newYoungName.trim(), gender: newYoungGender },
    ]);
    setNewYoungName("");
    setNewYoungGender("unknown");
  }

  function removePendingYoung(key: string) {
    setPendingYoung((prev) => prev.filter((p) => p.key !== key));
  }

  function errorMessage(code: string): string {
    return KNOWN_ERRORS.has(code) ? t(`wizard.error.${code}`) : t("wizard.error.generic");
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    const formData = basicsFormData(basics, sireId, damId);

    let litterId: string;
    if (isEdit) {
      const result = await updateLitter(litter!.id, formData);
      if (!result.ok) {
        setBusy(false);
        setError(errorMessage(result.error));
        return;
      }
      litterId = litter!.id;
    } else {
      const result = await createLitter(formData);
      if (!result.ok) {
        setBusy(false);
        setError(errorMessage(result.error));
        return;
      }
      litterId = result.id;
    }

    const toLink = [...checkedIds].filter((id) => !originallyLinked.has(id));
    const toUnlink = [...originallyLinked].filter((id) => !checkedIds.has(id));
    const followUps: Promise<{ ok: boolean }>[] = [];
    if (toLink.length > 0) followUps.push(linkYoung(litterId, toLink));
    if (toUnlink.length > 0) followUps.push(unlinkYoung(litterId, toUnlink));
    for (const p of pendingYoung) {
      const youngForm = new FormData();
      youngForm.set("name", p.name);
      youngForm.set("gender", p.gender);
      followUps.push(addYoung(litterId, youngForm));
    }
    const results = await Promise.all(followUps);
    setBusy(false);
    if (results.some((r) => !r.ok)) {
      setError(t("wizard.error.generic"));
      return;
    }
    onSaved();
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <Dialog.Popup
            className="premium-panel max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-5 sm:max-w-lg sm:rounded-2xl"
            data-testid="litter-wizard"
          >
            <Dialog.Title className="text-lg font-semibold">
              {isEdit ? t("wizard.editTitle") : t("wizard.createTitle")}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              {t("wizard.stepLabel", { step, total: TOTAL_STEPS })}
            </Dialog.Description>

            {step === 1 && (
              <div className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t("wizard.name")}
                  <input
                    value={basics.name}
                    maxLength={80}
                    required
                    onChange={(e) => setBasics((b) => ({ ...b, name: e.target.value }))}
                    data-testid="litter-name"
                    className={field}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    {t("wizard.species")}
                    <select
                      value={basics.species}
                      onChange={(e) => setBasics((b) => ({ ...b, species: e.target.value }))}
                      data-testid="litter-species"
                      className={field}
                    >
                      {LITTER_SPECIES.map((s) => (
                        <option key={s} value={s}>
                          {t(`species.${s}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    {t("wizard.breed")}
                    <input
                      value={basics.breed}
                      maxLength={80}
                      onChange={(e) => setBasics((b) => ({ ...b, breed: e.target.value }))}
                      data-testid="litter-breed"
                      className={field}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t("wizard.description")}
                  <textarea
                    value={basics.description}
                    maxLength={1000}
                    onChange={(e) => setBasics((b) => ({ ...b, description: e.target.value }))}
                    data-testid="litter-description"
                    className="min-h-20 w-full rounded-xl border border-input bg-transparent p-3 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    {t("wizard.expectedDate")}
                    <input
                      type="date"
                      value={basics.expectedDate}
                      onChange={(e) => setBasics((b) => ({ ...b, expectedDate: e.target.value }))}
                      data-testid="litter-expected-date"
                      className={field}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    {t("wizard.birthDate")}
                    <input
                      type="date"
                      value={basics.birthDate}
                      onChange={(e) => setBasics((b) => ({ ...b, birthDate: e.target.value }))}
                      data-testid="litter-birth-date"
                      className={field}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t("wizard.status")}
                  <select
                    value={basics.status}
                    onChange={(e) => setBasics((b) => ({ ...b, status: e.target.value }))}
                    data-testid="litter-status"
                    className={field}
                  >
                    {LITTER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`status.${s}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{t("wizard.parentsNote")}</p>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t("dam")}
                  <select
                    value={damId}
                    onChange={(e) => setDamId(e.target.value)}
                    data-testid="litter-dam"
                    className={field}
                  >
                    <option value="">{t("noneParent")}</option>
                    {breedingCreatures.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  {t("sire")}
                  <select
                    value={sireId}
                    onChange={(e) => setSireId(e.target.value)}
                    data-testid="litter-sire"
                    className={field}
                  >
                    <option value="">{t("noneParent")}</option>
                    {breedingCreatures.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {breedingCreatures.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("wizard.noBreedingAnimals")}</p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <p className="eyebrow">{t("wizard.linkExisting")}</p>
                  {candidates.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">{t("wizard.noLinkable")}</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {candidates.map((c) => (
                        <li key={c.id}>
                          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-input px-3 text-sm">
                            <input
                              type="checkbox"
                              checked={checkedIds.has(c.id)}
                              onChange={() => toggleChecked(c.id)}
                              data-testid="young-link-option"
                            />
                            {c.name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="eyebrow">{t("wizard.addYoung")}</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={newYoungName}
                      maxLength={80}
                      placeholder={t("wizard.youngNamePlaceholder")}
                      onChange={(e) => setNewYoungName(e.target.value)}
                      data-testid="young-add-name"
                      className={field}
                    />
                    <select
                      value={newYoungGender}
                      onChange={(e) => setNewYoungGender(e.target.value)}
                      data-testid="young-add-gender"
                      className="min-h-11 shrink-0 rounded-xl border border-input bg-transparent px-2 text-sm"
                    >
                      {YOUNG_GENDERS.map((g) => (
                        <option key={g} value={g}>
                          {t(`gender.${g}`)}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={!newYoungName.trim()}
                      onClick={addPendingYoung}
                      data-testid="young-add-confirm"
                    >
                      {t("wizard.add")}
                    </Button>
                  </div>
                  {pendingYoung.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {pendingYoung.map((p) => (
                        <li
                          key={p.key}
                          className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/25 px-3 py-2 text-sm"
                          data-testid="young-pending-row"
                        >
                          <span>
                            {p.name} · {t(`gender.${p.gender}`)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removePendingYoung(p.key)}
                            className="text-xs text-destructive"
                            data-testid="young-pending-remove"
                          >
                            {t("wizard.remove")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="mt-4 flex flex-col gap-2 text-sm" data-testid="litter-review">
                <p>
                  <span className="font-semibold">{t("wizard.name")}:</span> {basics.name}
                </p>
                <p>
                  <span className="font-semibold">{t("wizard.species")}:</span>{" "}
                  {t(`species.${basics.species}`)}
                  {basics.breed ? ` · ${basics.breed}` : ""}
                </p>
                <p>
                  <span className="font-semibold">{t("wizard.status")}:</span>{" "}
                  {t(`status.${basics.status}`)}
                </p>
                {basics.expectedDate && (
                  <p>
                    <span className="font-semibold">{t("expected")}:</span> {basics.expectedDate}
                  </p>
                )}
                {basics.birthDate && (
                  <p>
                    <span className="font-semibold">{t("born")}:</span> {basics.birthDate}
                  </p>
                )}
                <p>
                  <span className="font-semibold">{t("dam")}:</span>{" "}
                  {damId ? (breedingCreatures.find((c) => c.id === damId)?.name ?? "") : t("noneParent")}
                </p>
                <p>
                  <span className="font-semibold">{t("sire")}:</span>{" "}
                  {sireId ? (breedingCreatures.find((c) => c.id === sireId)?.name ?? "") : t("noneParent")}
                </p>
                <p>
                  <span className="font-semibold">{t("youngGrid")}:</span>{" "}
                  {t("youngCount", { count: checkedIds.size + pendingYoung.length })}
                </p>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-destructive" role="alert" data-testid="litter-wizard-error">
                {error}
              </p>
            )}

            <div className="mt-5 flex items-center justify-between gap-2">
              <div>
                {step > 1 && (
                  <Button variant="ghost" data-testid="wizard-back" onClick={() => setStep((s) => s - 1)}>
                    {t("wizard.back")}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Dialog.Close
                  className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
                  data-testid="wizard-cancel"
                >
                  {t("cancel")}
                </Dialog.Close>
                {step < TOTAL_STEPS ? (
                  <Button
                    data-testid="wizard-next"
                    disabled={step === 1 && !basics.name.trim()}
                    onClick={() => setStep((s) => s + 1)}
                  >
                    {t("wizard.next")}
                  </Button>
                ) : (
                  <Button variant="solid" data-testid="wizard-save" disabled={busy} onClick={handleSave}>
                    {busy ? t("wizard.saving") : t("wizard.save")}
                  </Button>
                )}
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

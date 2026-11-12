"use client";

import { useState, useMemo } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useTranslations } from "next-intl";
import {
  Heart,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
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

const SPECIES_GESTATION_DAYS: Record<string, { days: number; label: string; term: string }> = {
  dog: { days: 63, label: "63 days (Canine Whelping)", term: "puppies" },
  cat: { days: 65, label: "65 days (Feline Queening)", term: "kittens" },
  rabbit: { days: 31, label: "31 days (Kindling)", term: "kits" },
  bird: { days: 21, label: "21 days (Incubation)", term: "chicks" },
  reptile: { days: 60, label: "60 days (Clutch Incubation)", term: "hatchlings" },
  fish: { days: 28, label: "28 days (Spawning)", term: "fry" },
  insect: { days: 14, label: "14 days (Founding)", term: "nanitics" },
  other: { days: 63, label: "63 days standard", term: "offspring" },
};

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
  const [showGestationCalc, setShowGestationCalc] = useState(false);
  const [matingDate, setMatingDate] = useState("");

  const gestationInfo = SPECIES_GESTATION_DAYS[basics.species] ?? SPECIES_GESTATION_DAYS.dog;
  const calculatedDue = useMemo(() => {
    if (!matingDate) return null;
    const m = new Date(matingDate);
    if (isNaN(m.getTime())) return null;
    const due = new Date(m);
    due.setDate(due.getDate() + gestationInfo.days);
    const ultrasound = new Date(m);
    ultrasound.setDate(ultrasound.getDate() + 28);
    const weaning = new Date(due);
    weaning.setDate(weaning.getDate() + 56);
    return {
      dueStr: due.toISOString().split("T")[0],
      ultrasoundStr: ultrasound.toISOString().split("T")[0],
      weaningStr: weaning.toISOString().split("T")[0],
    };
  }, [matingDate, gestationInfo.days]);

  const selectedDam = breedingCreatures.find((c) => c.id === damId);
  const selectedSire = breedingCreatures.find((c) => c.id === sireId);

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
      // Creation only. An edit is not a new thing entering the world, and
      // counting it would inflate the one step this funnel exists to measure.
      capture(FUNNEL_EVENTS.litterPublished);
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

                {/* Species Selector Pills */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t("wizard.species")}</span>
                    <span className="text-micro text-muted-foreground">{gestationInfo.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LITTER_SPECIES.map((s) => {
                      const isSelected = basics.species === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setBasics((b) => ({ ...b, species: s }))}
                          className={`rounded-full px-2.5 py-1 text-micro font-medium transition ${
                            isSelected
                              ? "border border-primary bg-primary/15 text-primary font-semibold"
                              : "border border-border/70 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          {t(`species.${s}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>

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

                {/* Breeder OS Gestation & Whelping Calculator */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Sparkles className="size-3.5" aria-hidden />
                      <span>Breeder OS · Whelping Forecaster</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGestationCalc((v) => !v)}
                      className="text-micro font-medium text-brand-link hover:underline"
                    >
                      {showGestationCalc ? "Hide Forecaster" : "Calculate from Mating Date"}
                    </button>
                  </div>
                  {showGestationCalc && (
                    <div className="mt-2.5 space-y-2 border-t border-primary/10 pt-2 text-xs">
                      <label className="flex flex-col gap-1 text-micro font-medium text-muted-foreground">
                        Mating / Ovulation Date
                        <input
                          type="date"
                          value={matingDate}
                          onChange={(e) => setMatingDate(e.target.value)}
                          className="min-h-9 w-full rounded-lg border border-input bg-background px-2.5 text-xs text-foreground"
                        />
                      </label>
                      {calculatedDue && (
                        <div className="mt-2 rounded-lg border border-primary/15 bg-background/80 p-2.5 text-micro space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Gestation Window:</span>
                            <span className="font-semibold text-foreground">{gestationInfo.label}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Ultrasound Window (Day 28):</span>
                            <span className="font-mono text-foreground">{calculatedDue.ultrasoundStr}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Projected Whelping / Due:</span>
                            <span className="font-mono font-semibold text-primary">{calculatedDue.dueStr}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">8-Week Placement Window:</span>
                            <span className="font-mono text-foreground">{calculatedDue.weaningStr}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBasics((b) => ({ ...b, expectedDate: calculatedDue.dueStr }))}
                            className="mt-2 w-full rounded-lg bg-primary py-1.5 text-center text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
                          >
                            Apply Expected Due Date ({calculatedDue.dueStr})
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
                        {c.name} {c.breed ? `(${c.breed})` : ""}
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
                        {c.name} {c.breed ? `(${c.breed})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {breedingCreatures.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t("wizard.noBreedingAnimals")}</p>
                )}

                {(selectedDam || selectedSire) && (
                  <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Heart className="size-3.5 text-pink-500" aria-hidden />
                        <span>Breeder OS · Pairing Dossier</span>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-micro font-medium text-primary">
                        Pedigree Lineage Ready
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
                        <p className="text-micro font-semibold uppercase text-muted-foreground">{t("dam")}</p>
                        <p className="mt-0.5 truncate font-semibold text-foreground">
                          {selectedDam ? selectedDam.name : "None selected"}
                        </p>
                        {selectedDam?.breed && (
                          <p className="truncate text-micro text-muted-foreground">{selectedDam.breed}</p>
                        )}
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background/60 p-2.5">
                        <p className="text-micro font-semibold uppercase text-muted-foreground">{t("sire")}</p>
                        <p className="mt-0.5 truncate font-semibold text-foreground">
                          {selectedSire ? selectedSire.name : "None selected"}
                        </p>
                        {selectedSire?.breed && (
                          <p className="truncate text-micro text-muted-foreground">{selectedSire.breed}</p>
                        )}
                      </div>
                    </div>
                  </div>
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
                      aria-label={t("youngGenderLabel")}
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

                <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Scale className="size-3.5" aria-hidden />
                    <span>Breeder OS Growth Velocity Ready</span>
                  </div>
                  <p className="mt-1 text-micro text-muted-foreground">
                    Upon creation, this litter connects directly to daily puppy weight logs, benchmark percentile curves, and buyer waitlists.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-destructive" role="alert" data-testid="litter-wizard-error">
                {error}
              </p>
            )}

            {/* `public read litters` grants SELECT to anon with a qualifier of
                true, so the row is world-readable the moment it is inserted and
                there is no draft state. Say so where the decision is made,
                rather than leaving a breeder to discover it. */}
            {step === TOTAL_STEPS && (
              <p
                className="mt-5 text-xs text-muted-foreground"
                data-testid="litter-visibility-note"
              >
                {t("wizard.visibility")}
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

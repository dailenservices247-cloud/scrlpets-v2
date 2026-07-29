"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog } from "@base-ui/react/dialog";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { addGeneticTest, updateGeneticTest, deleteGeneticTest } from "@/lib/creatures/actions";
import { GENETIC_TEST_TYPES, GENETIC_TEST_RESULTS, resultTone } from "@/lib/creatures/types";
import type { GeneticTest } from "@/lib/creatures/queries";

const TODAY = new Date().toISOString().slice(0, 10);

const TONE_CLASS: Record<"good" | "warn" | "bad", string> = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  bad: "border-red-500/40 bg-red-500/10 text-red-300",
};

function TestForm({
  creatureId,
  slug,
  existing,
  onDone,
}: {
  creatureId: string;
  slug: string;
  existing: GeneticTest | null;
  onDone: () => void;
}) {
  const t = useTranslations("creature");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = existing
      ? await updateGeneticTest(existing.id, slug, formData)
      : await addGeneticTest(creatureId, slug, formData);
    setBusy(false);
    if (!result.ok) {
      setError(t("healthTests.error"));
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form action={submit} className="mt-4 flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{t("healthTests.field.testType")}</span>
        <select
          name="testType"
          defaultValue={existing?.testType ?? GENETIC_TEST_TYPES[0]}
          required
          data-testid="test-input-type"
          className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
        >
          {GENETIC_TEST_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`healthTests.testType.${type}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{t("healthTests.field.conditionName")}</span>
        <input
          name="conditionName"
          required
          maxLength={120}
          defaultValue={existing?.conditionName ?? ""}
          data-testid="test-input-condition"
          className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{t("healthTests.field.result")}</span>
        <select
          name="result"
          defaultValue={existing?.result ?? GENETIC_TEST_RESULTS[0]}
          required
          data-testid="test-input-result"
          className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
        >
          {GENETIC_TEST_RESULTS.map((result) => (
            <option key={result} value={result}>
              {t(`healthTests.result.${result}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t("healthTests.field.grade")}</span>
          <input
            name="grade"
            defaultValue={existing?.grade ?? ""}
            data-testid="test-input-grade"
            className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t("healthTests.field.testDate")}</span>
          <input
            type="date"
            name="testDate"
            defaultValue={existing?.testDate ?? ""}
            max={TODAY}
            data-testid="test-input-date"
            className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t("healthTests.field.geneName")}</span>
          <input
            name="geneName"
            defaultValue={existing?.geneName ?? ""}
            data-testid="test-input-gene"
            className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t("healthTests.field.genotype")}</span>
          <input
            name="genotype"
            defaultValue={existing?.genotype ?? ""}
            data-testid="test-input-genotype"
            className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{t("healthTests.field.provider")}</span>
        <input
          name="provider"
          defaultValue={existing?.provider ?? ""}
          data-testid="test-input-provider"
          className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{t("healthTests.field.certificateNumber")}</span>
        <input
          name="certificateNumber"
          defaultValue={existing?.certificateNumber ?? ""}
          data-testid="test-input-certificate"
          className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{t("healthTests.field.notes")}</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          defaultValue={existing?.notes ?? ""}
          data-testid="test-input-notes"
          className="rounded-xl border border-input bg-transparent p-2 text-sm"
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          data-testid="test-save"
          className="min-h-11 flex-1 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
        >
          {busy ? t("healthTests.saving") : t("healthTests.save")}
        </button>
        <Dialog.Close className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium">
          {t("healthTests.cancel")}
        </Dialog.Close>
      </div>
    </form>
  );
}

/** Public list of genetic_tests (self-reported by the owner, clearly labeled)
 * plus owner-only add/edit/delete. Visibility of the whole section already
 * follows the creature's RLS; this component only adds/removes rows the
 * viewer is entitled to mutate. */
export function HealthTestsSection({
  creatureId,
  slug,
  tests,
  isOwner,
  isDeceased,
}: {
  creatureId: string;
  slug: string;
  tests: GeneticTest[];
  isOwner: boolean;
  isDeceased: boolean;
}) {
  const t = useTranslations("creature");
  const router = useRouter();
  const [formTarget, setFormTarget] = useState<GeneticTest | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GeneticTest | null>(null);
  const [busy, setBusy] = useState(false);

  if (tests.length === 0 && !isOwner) return null;

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteGeneticTest(deleteTarget.id, slug);
    setBusy(false);
    if (result.ok) {
      setDeleteTarget(null);
      router.refresh();
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 pt-4" data-testid="health-tests">
      <div className={`rounded-2xl border p-4 ${isDeceased ? "border-border/50 bg-muted/10" : "premium-panel"}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="eyebrow">{t("healthTests.title")}</h2>
          {isOwner && (
            <button
              type="button"
              onClick={() => setFormTarget("new")}
              data-testid="health-test-add-open"
              className="min-h-11 rounded-lg border border-input px-3 text-xs font-medium"
            >
              {t("healthTests.addCta")}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs font-medium text-muted-foreground" data-testid="health-tests-disclaimer">
          {t("healthTests.disclaimer")}
        </p>

        {tests.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {tests.map((test) => {
              const tone = resultTone(test.result);
              return (
                <li
                  key={test.id}
                  className="rounded-xl border border-border/70 bg-card/60 p-3"
                  data-testid="health-test-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{t(`healthTests.testType.${test.testType}`)}</p>
                      <p className="text-xs text-muted-foreground">{test.conditionName}</p>
                    </div>
                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${TONE_CLASS[tone]}`}
                      data-testid="health-test-result-badge"
                    >
                      {t(`healthTests.result.${test.result}`)}
                    </span>
                  </div>
                  {(test.grade || test.geneName || test.genotype || test.provider || test.testDate || test.certificateNumber) && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {test.grade && (
                        <div>
                          <dt className="inline">{t("healthTests.field.grade")}: </dt>
                          <dd className="inline">{test.grade}</dd>
                        </div>
                      )}
                      {test.geneName && (
                        <div>
                          <dt className="inline">{t("healthTests.field.geneName")}: </dt>
                          <dd className="inline">{test.geneName}</dd>
                        </div>
                      )}
                      {test.genotype && (
                        <div>
                          <dt className="inline">{t("healthTests.field.genotype")}: </dt>
                          <dd className="inline">{test.genotype}</dd>
                        </div>
                      )}
                      {test.provider && (
                        <div>
                          <dt className="inline">{t("healthTests.field.provider")}: </dt>
                          <dd className="inline">{test.provider}</dd>
                        </div>
                      )}
                      {test.testDate && (
                        <div>
                          <dt className="inline">{t("healthTests.field.testDate")}: </dt>
                          <dd className="inline">{test.testDate}</dd>
                        </div>
                      )}
                      {test.certificateNumber && (
                        <div>
                          <dt className="inline">{t("healthTests.field.certificateNumber")}: </dt>
                          <dd className="inline">{test.certificateNumber}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                  {test.notes && <p className="mt-2 text-xs text-muted-foreground">{test.notes}</p>}
                  {isOwner && (
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setFormTarget(test)}
                        data-testid="health-test-edit"
                        className="min-h-11 text-xs font-medium text-brand-link"
                      >
                        {t("healthTests.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(test)}
                        data-testid="health-test-delete"
                        className="min-h-11 text-xs font-medium text-destructive"
                      >
                        {t("healthTests.delete")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground" data-testid="health-tests-empty">
            {t("healthTests.empty")}
          </p>
        )}
      </div>

      <Dialog.Root open={formTarget !== null} onOpenChange={(v) => !v && setFormTarget(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
            <Dialog.Popup
              className="premium-panel w-full max-w-md rounded-2xl border border-border p-5 shadow-2xl"
              data-testid="health-test-dialog"
            >
              <Dialog.Title className="text-lg font-semibold">
                {formTarget === "new" ? t("healthTests.addTitle") : t("healthTests.editTitle")}
              </Dialog.Title>
              {formTarget !== null && (
                <TestForm
                  creatureId={creatureId}
                  slug={slug}
                  existing={formTarget === "new" ? null : formTarget}
                  onDone={() => setFormTarget(null)}
                />
              )}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root open={deleteTarget !== null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <AlertDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <AlertDialog.Popup
              className="premium-panel w-full max-w-sm rounded-2xl border border-border p-5 shadow-2xl"
              data-testid="health-test-delete-dialog"
            >
              <AlertDialog.Title className="text-lg font-semibold">
                {t("healthTests.deleteConfirmTitle")}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("healthTests.deleteConfirmBody")}
              </AlertDialog.Description>
              <div className="mt-5 flex justify-end gap-2">
                <AlertDialog.Close className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                  {t("healthTests.cancel")}
                </AlertDialog.Close>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={busy}
                  data-testid="health-test-delete-confirm"
                  className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? t("healthTests.deleting") : t("healthTests.confirmDelete")}
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}

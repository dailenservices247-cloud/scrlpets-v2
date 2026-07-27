"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { saveAnimalRecord } from "@/lib/records/actions";
import type { AnimalRecord } from "@/lib/records/queries";

/**
 * D6: shows what the OWNER says, labelled as such. No score, no badge, no
 * implied platform verification — the ledger bans dressing a self-claim up as
 * a check we did not perform.
 */
export function AnimalRecordsPanel({
  creatureId,
  slug,
  record,
  isOwner,
}: {
  creatureId: string;
  slug: string;
  record: AnimalRecord | null;
  isOwner: boolean;
}) {
  const t = useTranslations("records");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = [
    { key: "birthDate", value: record?.birthDateDeclared },
    { key: "vaccinations", value: record?.vaccinationsDeclared },
    { key: "healthNotes", value: record?.healthNotesDeclared },
    { key: "pedigreeNotes", value: record?.pedigreeNotesDeclared },
  ].filter((r) => r.value);

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await saveAnimalRecord(creatureId, slug, formData);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (rows.length === 0 && !isOwner) return null;

  return (
    <section className="mx-auto max-w-2xl px-4 py-4" data-testid="animal-records">
      <div className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground" data-testid="records-disclaimer">
          {t("ownerDeclaredNotice")}
        </p>

        {editing ? (
          <form action={onSubmit} className="mt-4 flex flex-col gap-3">
            {(["birthDate", "vaccinations", "healthNotes", "pedigreeNotes"] as const).map((key) => (
              <label key={key} className="flex flex-col gap-1 text-xs">
                <span className="font-medium">{t(`field.${key}`)}</span>
                <input
                  name={key}
                  type={key === "birthDate" ? "date" : "text"}
                  defaultValue={
                    key === "birthDate"
                      ? (record?.birthDateDeclared ?? "")
                      : key === "vaccinations"
                        ? (record?.vaccinationsDeclared ?? "")
                        : key === "healthNotes"
                          ? (record?.healthNotesDeclared ?? "")
                          : (record?.pedigreeNotesDeclared ?? "")
                  }
                  data-testid={`records-input-${key}`}
                  className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                />
              </label>
            ))}
            {error && (
              <p className="text-xs text-destructive" data-testid="records-error">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                data-testid="records-save"
                className="min-h-11 flex-1 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
              >
                {t("save")}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        ) : (
          <>
            {rows.length > 0 ? (
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                {rows.map((r) => (
                  <div key={r.key} className="flex flex-col">
                    <dt className="text-xs text-muted-foreground">{t(`field.${r.key}`)}</dt>
                    <dd data-testid={`records-value-${r.key}`}>{r.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground" data-testid="records-empty">
                {t("empty")}
              </p>
            )}
            {record?.vetAttestedAt && (
              <p className="mt-3 text-xs font-medium text-secondary-foreground">
                {t("vetAttested")}
              </p>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                data-testid="records-edit"
                className="mt-4 min-h-11 w-full rounded-xl border border-input px-4 text-sm font-medium"
              >
                {t("edit")}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

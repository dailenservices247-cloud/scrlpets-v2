"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createReport } from "@/lib/social/actions";

const REASONS = ["spam", "harassment", "scam", "inappropriate", "other"] as const;

export function ReportButton({
  targetKind,
  targetId,
}: {
  targetKind: "post" | "listing" | "profile" | "comment";
  targetId: string;
}) {
  const t = useTranslations("report");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) return;
    setBusy(true);
    setError(false);
    const formData = new FormData();
    formData.set("targetKind", targetKind);
    formData.set("targetId", targetId);
    formData.set("reason", reason);
    formData.set("details", details);
    const result = await createReport(formData);
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setDone(true);
    setOpen(false);
  }

  if (done) {
    return (
      <p className="text-xs text-muted-foreground" role="status" data-testid="report-done">
        {t("done")}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="report-open"
        className="min-h-11 rounded-md border border-input px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        {t("report")}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border/70 bg-card/70 p-3"
      data-testid={`report-form-${targetKind}`}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t("title")}</legend>
        {REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="size-4 accent-primary"
            />
            {t(`reasons.${r}`)}
          </label>
        ))}
      </fieldset>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={2000}
        placeholder={t("detailsPlaceholder")}
        aria-label={t("detailsPlaceholder")}
        className="mt-2 w-full rounded-lg border border-input bg-transparent p-2 text-sm"
        rows={2}
      />
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {t("error")}
        </p>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={busy || !reason}
          data-testid="report-submit"
          className="min-h-11 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}

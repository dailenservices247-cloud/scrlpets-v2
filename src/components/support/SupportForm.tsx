"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { submitSupportTicket } from "@/lib/support/actions";
import { SUPPORT_CATEGORIES } from "@/lib/support/categories";

type Sent = { reference: string; emailSent: boolean; sentTo: string };

/**
 * One form for guests and members. A guest types their own address; a member's
 * ticket is pinned to the account address, so the field is shown but not
 * editable — the action ignores a submitted address for a signed-in session.
 */
export function SupportForm({
  signedIn,
  defaultName,
  defaultEmail,
}: {
  signedIn: boolean;
  defaultName: string;
  defaultEmail: string;
}) {
  const t = useTranslations("support");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await submitSupportTicket(new FormData(event.currentTarget));
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent({
      reference: result.reference,
      emailSent: result.emailSent,
      sentTo: result.sentTo,
    });
  }

  if (sent) {
    return (
      <div className="premium-panel rounded-2xl p-4" data-testid="support-sent" role="status">
        <h2 className="text-lg font-semibold tracking-tight">{t("sentTitle")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("sentReference")}{" "}
          <strong className="font-mono text-foreground" data-testid="support-reference">
            {sent.reference}
          </strong>
        </p>
        {/* The attribute, not the copy, is what a test can hold onto. */}
        <p
          className="mt-2 text-sm leading-6 text-muted-foreground"
          data-testid="support-email-state"
          data-email-sent={String(sent.emailSent)}
        >
          {sent.emailSent
            ? t("sentEmailYes", { email: sent.sentTo })
            : t("sentEmailNo")}
        </p>
        <button
          type="button"
          onClick={() => setSent(null)}
          data-testid="support-file-another"
          className="mt-4 min-h-11 rounded-xl border border-input px-4 text-sm font-medium"
        >
          {t("fileAnother")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" data-testid="support-form">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("nameLabel")}
        <input
          className="min-h-11 rounded border border-input bg-transparent p-2"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={defaultName}
          data-testid="support-name"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("emailLabel")}
        <input
          className="min-h-11 rounded border border-input bg-transparent p-2 read-only:text-muted-foreground"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          readOnly={signedIn}
          defaultValue={defaultEmail}
          data-testid="support-email"
        />
      </label>
      {signedIn && (
        <p className="-mt-1 text-xs leading-5 text-muted-foreground">{t("emailLockedHint")}</p>
      )}

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("categoryLabel")}
        <select
          className="min-h-11 rounded border border-input bg-transparent p-2"
          name="category"
          defaultValue="other"
          data-testid="support-category"
        >
          {SUPPORT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {t(`category.${value}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("subjectLabel")}
        <input
          className="min-h-11 rounded border border-input bg-transparent p-2"
          name="subject"
          required
          minLength={5}
          maxLength={200}
          data-testid="support-subject"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("messageLabel")}
        <textarea
          className="min-h-32 rounded border border-input bg-transparent p-2"
          name="message"
          required
          minLength={10}
          maxLength={10000}
          data-testid="support-message"
        />
      </label>

      {error && (
        <p className="text-sm text-destructive" role="alert" data-testid="support-error">
          {t(`error.${error}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        data-testid="support-submit"
        className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? t("working") : t("submit")}
      </button>
    </form>
  );
}

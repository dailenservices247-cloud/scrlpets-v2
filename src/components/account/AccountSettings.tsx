"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  changeEmail,
  changePassword,
  exportMyData,
  requestAccountDeletion,
} from "@/lib/account/actions";

// R10: the account-safety surface legacy had and v2 was missing —
// email change, password change, data export, deletion request.
export function AccountSettings({ currentEmail }: { currentEmail: string }) {
  const t = useTranslations("account");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(key: string, fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setBusy(key);
    setNotice(null);
    setError(null);
    const result = await fn();
    setBusy(null);
    if (result.ok) setNotice(result.message ? t(`notice.${result.message}`) : t("notice.saved"));
    else setError(t("error.generic"));
  }

  async function download() {
    setBusy("export");
    setError(null);
    const result = await exportMyData();
    setBusy(null);
    if (!result.ok) {
      setError(t("error.generic"));
      return;
    }
    const blob = new Blob([result.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scrlpets-my-data.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice(t("notice.exported"));
  }

  return (
    <div className="flex flex-col gap-4" data-testid="account-settings">
      {notice && (
        <p className="rounded-xl border border-secondary/35 bg-secondary/10 p-3 text-sm" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <section className="premium-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">{t("emailTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("emailBody", { email: currentEmail })}</p>
        <form
          className="mt-3 flex gap-2"
          action={(fd) => run("email", () => changeEmail(fd))}
        >
          <input
            type="email"
            name="email"
            required
            placeholder="new@example.com"
            aria-label={t("emailTitle")}
            data-testid="account-email-input"
            className="min-h-11 flex-1 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy === "email"}
            data-testid="account-email-submit"
            className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
          >
            {t("update")}
          </button>
        </form>
      </section>

      <section className="premium-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">{t("passwordTitle")}</h2>
        <form
          className="mt-3 flex gap-2"
          action={(fd) => run("password", () => changePassword(fd))}
        >
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            aria-label={t("passwordTitle")}
            data-testid="account-password-input"
            className="min-h-11 flex-1 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy === "password"}
            data-testid="account-password-submit"
            className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
          >
            {t("update")}
          </button>
        </form>
      </section>

      <section className="premium-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">{t("exportTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("exportBody")}</p>
        <button
          type="button"
          onClick={download}
          disabled={busy === "export"}
          data-testid="account-export"
          className="mt-3 min-h-11 rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
        >
          {busy === "export" ? t("working") : t("exportAction")}
        </button>
      </section>

      <section className="premium-panel rounded-2xl border-destructive/40 p-4">
        <h2 className="text-sm font-semibold text-destructive">{t("deleteTitle")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("deleteBody")}</p>
        {confirmDelete ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => run("delete", requestAccountDeletion)}
              disabled={busy === "delete"}
              data-testid="account-delete-confirm"
              className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {t("deleteConfirm")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-11 rounded-xl border border-input px-4 text-sm font-medium"
            >
              {t("cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            data-testid="account-delete"
            className="mt-3 min-h-11 rounded-xl border border-destructive/50 px-4 text-sm font-medium text-destructive"
          >
            {t("deleteAction")}
          </button>
        )}
      </section>
    </div>
  );
}

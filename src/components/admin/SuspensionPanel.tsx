"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { reactivateAccount, suspendAccount, type AdminError } from "@/lib/admin/actions";
import type { SuspendedAccount } from "@/lib/admin/queries";

/**
 * E: suspend an account nobody reported. The reason field is required, not
 * optional — the submit button stays disabled without one, and the server
 * action refuses a blank reason regardless of what the UI allows.
 */
export function SuspensionPanel({ suspended }: { suspended: SuspendedAccount[] }) {
  const [reactivateReason, setReactivateReason] = useState<Record<string, string>>({});
  const [reactivateBusy, setReactivateBusy] = useState<string | null>(null);
  const [reactivateError, setReactivateError] = useState<Record<string, AdminError>>({});
  const t = useTranslations("admin");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AdminError | null>(null);

  const ready = username.trim().length > 0 && reason.trim().length >= 4;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const result = await suspendAccount(username, reason);
    setBusy(false);
    if (result.ok) {
      setUsername("");
      setReason("");
      router.refresh();
      return;
    }
    setError(result.error);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="suspension-panel">
      <div className="premium-panel rounded-2xl p-4">
        <p className="text-xs leading-5 text-muted-foreground">{t("suspendHelp")}</p>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t("suspendUsername")}
          aria-label={t("suspendUsername")}
          autoCapitalize="none"
          autoCorrect="off"
          data-testid="suspend-username"
          className="mt-3 min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("suspendReason")}
          aria-label={t("suspendReason")}
          maxLength={500}
          required
          data-testid="suspend-reason"
          className="mt-2 min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !ready}
          data-testid="suspend-submit"
          className="mt-2 min-h-11 w-full rounded-xl border border-destructive/50 px-4 text-sm font-medium text-destructive disabled:opacity-50"
        >
          {t("suspendAccount")}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive" data-testid="suspend-error">
            {t(`suspendError.${error}`)}
          </p>
        )}
      </div>

      {suspended.length === 0 ? (
        <p
          className="py-6 text-center text-sm text-muted-foreground"
          data-testid="suspension-list-empty"
        >
          {t("suspendedEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="suspension-list">
          {suspended.map((s) => (
            <li key={s.profileId} className="premium-panel rounded-2xl p-4">
              <p className="text-sm font-semibold">{s.username ?? s.profileId}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(s.suspendedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                {s.actorUsername ? ` · ${t("suspendedBy", { actor: s.actorUsername })}` : ""}
              </p>
              {/* A suspension with no stated reason is a defect, so it is
                  labelled as one rather than rendered as a blank line. */}
              <p className="mt-1 text-xs" data-testid={`suspension-reason-${s.profileId}`}>
                {s.reason ?? (
                  <span className="text-destructive">{t("suspendedNoReason")}</span>
                )}
              </p>

              {/* Until this existed, suspending was a ONE-WAY DOOR: the only
                  exit was a hand-written statement against production. The
                  reason is recorded exactly like the suspension it reverses. */}
              <input
                value={reactivateReason[s.profileId] ?? ""}
                onChange={(e) =>
                  setReactivateReason((r) => ({ ...r, [s.profileId]: e.target.value }))
                }
                placeholder={t("reactivateReason")}
                aria-label={t("reactivateReason")}
                data-testid={`reactivate-reason-${s.profileId}`}
                className="mt-3 min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              />
              <button
                type="button"
                disabled={reactivateBusy === s.profileId}
                data-testid={`reactivate-submit-${s.profileId}`}
                className="mt-2 min-h-11 w-full rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
                onClick={async () => {
                  setReactivateBusy(s.profileId);
                  setReactivateError((e) => {
                    const next = { ...e };
                    delete next[s.profileId];
                    return next;
                  });
                  const result = await reactivateAccount(
                    s.profileId,
                    reactivateReason[s.profileId] ?? "",
                  );
                  setReactivateBusy(null);
                  if (!result.ok) {
                    setReactivateError((e) => ({ ...e, [s.profileId]: result.error }));
                    return;
                  }
                  router.refresh();
                }}
              >
                {reactivateBusy === s.profileId ? t("reactivating") : t("reactivate")}
              </button>
              <p className="mt-1 text-xs text-muted-foreground">{t("reactivateHelp")}</p>
              {reactivateError[s.profileId] && (
                <p
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                  data-testid={`reactivate-error-${s.profileId}`}
                >
                  {reactivateError[s.profileId] === "not_suspended"
                    ? t("reactivateErrorNotSuspended")
                    : t(`suspendError.${reactivateError[s.profileId]}`)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

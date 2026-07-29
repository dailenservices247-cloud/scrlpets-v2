"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog } from "@base-ui/react/dialog";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { setMemorial, clearMemorial } from "@/lib/creatures/actions";

const TODAY = new Date().toISOString().slice(0, 10);

/** Memorial banner + owner mark/unmark flow. Reversible by design (the DB
 * migration's whole point — legacy's version was permanent). Non-owners see
 * the banner only when deceasedAt is set; owners always get an entry point. */
export function MemorialSection({
  creatureId,
  slug,
  creatureName,
  deceasedAt,
  memorialMessage,
  isOwner,
}: {
  creatureId: string;
  slug: string;
  creatureName: string;
  deceasedAt: string | null;
  memorialMessage: string | null;
  isOwner: boolean;
}) {
  const t = useTranslations("creature");
  const router = useRouter();
  const [markOpen, setMarkOpen] = useState(false);
  const [unmarkOpen, setUnmarkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await setMemorial(creatureId, slug, formData);
    setBusy(false);
    if (!result.ok) {
      setError(t("memorial.error"));
      return;
    }
    setMarkOpen(false);
    router.refresh();
  }

  async function unmark() {
    setBusy(true);
    setError(null);
    const result = await clearMemorial(creatureId, slug);
    setBusy(false);
    if (!result.ok) {
      setError(t("memorial.error"));
      return;
    }
    setUnmarkOpen(false);
    router.refresh();
  }

  if (!deceasedAt) {
    if (!isOwner) return null;
    return (
      <section className="mx-auto max-w-2xl px-4 pt-4" data-testid="memorial-controls">
        <button
          type="button"
          onClick={() => setMarkOpen(true)}
          data-testid="memorial-mark-open"
          className="min-h-11 rounded-xl border border-input px-4 text-sm font-medium text-muted-foreground"
        >
          {t("memorial.markCta")}
        </button>

        <Dialog.Root open={markOpen} onOpenChange={setMarkOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
            <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
              <Dialog.Popup
                className="premium-panel w-full max-w-sm rounded-2xl border border-border p-5 shadow-2xl"
                data-testid="memorial-mark-dialog"
              >
                <Dialog.Title className="text-lg font-semibold">
                  {t("memorial.markDialogTitle", { name: creatureName })}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("memorial.markDialogBody")}
                </Dialog.Description>
                <form action={mark} className="mt-4 flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("memorial.dateLabel")}</span>
                    <input
                      type="date"
                      name="deceasedAt"
                      required
                      max={TODAY}
                      data-testid="memorial-date-input"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("memorial.messageLabel")}</span>
                    <textarea
                      name="memorialMessage"
                      rows={3}
                      maxLength={500}
                      data-testid="memorial-message-input"
                      className="rounded-xl border border-input bg-transparent p-2 text-sm"
                    />
                  </label>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      data-testid="memorial-mark-confirm"
                      className="min-h-11 flex-1 rounded-xl bg-amber-600/90 px-4 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busy ? t("memorial.saving") : t("memorial.confirmMark")}
                    </button>
                    <Dialog.Close className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium">
                      {t("memorial.cancel")}
                    </Dialog.Close>
                  </div>
                </form>
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 pt-4" data-testid="memorial-banner" aria-label={t("memorial.title")}>
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{t("memorial.title")}</p>
        <p className="mt-1 text-sm text-amber-100/90">{t("memorial.bannerSubtitle", { name: creatureName })}</p>
        {memorialMessage && (
          <p className="mt-3 text-sm italic text-amber-100" data-testid="memorial-message">
            &ldquo;{memorialMessage}&rdquo;
          </p>
        )}
        {isOwner && (
          <>
            <button
              type="button"
              onClick={() => setUnmarkOpen(true)}
              data-testid="memorial-unmark-open"
              className="mt-4 min-h-11 rounded-xl border border-amber-500/40 px-4 text-sm font-medium text-amber-100"
            >
              {t("memorial.unmarkCta")}
            </button>
            <AlertDialog.Root open={unmarkOpen} onOpenChange={setUnmarkOpen}>
              <AlertDialog.Portal>
                <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
                <AlertDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
                  <AlertDialog.Popup
                    className="premium-panel w-full max-w-sm rounded-2xl border border-border p-5 shadow-2xl"
                    data-testid="memorial-unmark-dialog"
                  >
                    <AlertDialog.Title className="text-lg font-semibold">
                      {t("memorial.unmarkDialogTitle")}
                    </AlertDialog.Title>
                    <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t("memorial.unmarkDialogBody", { name: creatureName })}
                    </AlertDialog.Description>
                    {error && (
                      <p className="mt-3 text-sm text-destructive" role="alert">
                        {error}
                      </p>
                    )}
                    <div className="mt-5 flex justify-end gap-2">
                      <AlertDialog.Close className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                        {t("memorial.cancel")}
                      </AlertDialog.Close>
                      <button
                        type="button"
                        onClick={unmark}
                        disabled={busy}
                        data-testid="memorial-unmark-confirm"
                        className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
                      >
                        {busy ? t("memorial.saving") : t("memorial.confirmUnmark")}
                      </button>
                    </div>
                  </AlertDialog.Popup>
                </AlertDialog.Viewport>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </>
        )}
      </div>
    </section>
  );
}

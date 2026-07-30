"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { removePackLink } from "@/lib/pack/actions";
import type { PackPerson } from "@/lib/pack/queries";

/**
 * The accepted pack, with removal.
 *
 * Removal is confirmed rather than instant because it is not one-sided: the
 * link row is the connection, so deleting it removes BOTH people from each
 * other's pack. The dialog says that out loud instead of letting "Remove" imply
 * a private mute.
 */
export function PackMemberList({ members }: { members: PackPerson[] }) {
  const t = useTranslations("pack");
  const router = useRouter();
  const [target, setTarget] = useState<PackPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmRemove() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const result = await removePackLink(target.linkId);
    setBusy(false);
    if (!result.ok) {
      setError(t("error"));
      return;
    }
    setTarget(null);
    router.refresh();
  }

  if (members.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground" data-testid="pack-members-empty">
        {t("membersEmpty")}
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3" data-testid="pack-members-list">
        {members.map((m) => (
          <li key={m.linkId} className="premium-panel rounded-2xl p-4" data-testid="pack-member-row">
            <div className="flex items-center gap-3">
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.avatarUrl}
                  alt=""
                  className="size-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/20 font-semibold text-brand-link"
                  aria-hidden
                >
                  {(m.displayName ?? m.username).charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/u/${m.username}`}
                  className="block truncate text-sm font-semibold text-brand-link underline"
                >
                  {m.displayName ?? m.username}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {t(m.origin === "handover" ? "originHandover" : "originInvite")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTarget(m)}
                data-testid={`pack-remove-${m.linkId}`}
                className="min-h-11 shrink-0 rounded-xl border border-input px-3 text-sm font-medium hover:bg-muted"
              >
                {t("remove")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog.Root open={target !== null} onOpenChange={(v) => !v && setTarget(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <AlertDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <AlertDialog.Popup
              className="premium-panel w-full max-w-sm rounded-2xl border border-border p-5 shadow-2xl"
              data-testid="pack-remove-dialog"
            >
              <AlertDialog.Title className="text-lg font-semibold">
                {t("removeTitle", { username: target?.username ?? "" })}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("removeBody")}
              </AlertDialog.Description>
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <AlertDialog.Close className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                  {t("cancel")}
                </AlertDialog.Close>
                <button
                  type="button"
                  onClick={confirmRemove}
                  disabled={busy}
                  data-testid="pack-remove-confirm"
                  className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy ? t("removing") : t("removeConfirm")}
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

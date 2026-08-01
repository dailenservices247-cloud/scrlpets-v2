"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog } from "@base-ui/react/dialog";
import { setCreatureAnchor, verifyCreatureAnchor } from "@/lib/creatures/actions";
import { ANCHOR_TYPES, type AnchorType } from "@/lib/creatures/types";

/**
 * Owner-only registration for the animal's identity anchor, and the handover
 * scan check for everybody else.
 *
 * `anchorValue` is only ever populated for the owner — the page reads it
 * through my_creature_anchor, which returns null to anyone else — so a
 * non-owner render physically has no number to leak.
 *
 * ponytail: registration lives HERE and nowhere else. AddAnimalSheet could
 * carry the same two fields, but it would need its own copy of the duplicate
 * (23505) path, and a breeder adding a litter of eight would be typing chip
 * numbers into a create form before the animals are even scanned. Add it there
 * if bulk intake turns out to be the common case.
 */
export function AnchorSection({
  creatureId,
  slug,
  anchorType,
  anchorValue,
  isOwner,
  canVerify,
}: {
  creatureId: string;
  slug: string;
  anchorType: AnchorType | null;
  anchorValue: string | null;
  isOwner: boolean;
  /** Signed-in non-owner: the buyer, their vet, or the carrier at pickup. */
  canVerify: boolean;
}) {
  const t = useTranslations("creature.anchor");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checking, setChecking] = useState(false);
  const [match, setMatch] = useState<boolean | null>(null);

  // Signed-out visitor: the assurance level above is the whole of what they get.
  if (!isOwner && !canVerify) return null;

  async function save(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await setCreatureAnchor(creatureId, slug, formData);
    setBusy(false);
    if (!result.ok) {
      setError(result.error === "duplicate_anchor" ? "duplicate_anchor" : "generic");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function check(formData: FormData) {
    setChecking(true);
    setMatch(null);
    const result = await verifyCreatureAnchor(creatureId, String(formData.get("scanned") ?? ""));
    setChecking(false);
    // A failed call is reported as a non-match, same as a wrong number: three
    // distinguishable outcomes here would hand a caller the probe the RPC was
    // written to deny.
    setMatch(result.ok ? result.match : false);
  }

  return (
    <div className="mt-3" data-testid="anchor-section">
      {isOwner && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {anchorValue ? (
            <p className="text-xs text-muted-foreground">
              {t("ownerValueLabel")}{" "}
              <span className="font-mono break-all text-foreground" data-testid="anchor-owner-value">
                {anchorValue}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="anchor-owner-empty">
              {t("ownerEmpty")}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            data-testid="anchor-edit-open"
            className="min-h-11 rounded-lg border border-input px-3 text-xs font-medium"
          >
            {anchorValue ? t("editCta") : t("registerCta")}
          </button>
        </div>
      )}

      {canVerify && (
        <form action={check} className="flex flex-wrap items-end gap-2" data-testid="anchor-verify">
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs">
            <span className="font-medium">{t("verifyLabel")}</span>
            <input
              name="scanned"
              required
              autoComplete="off"
              onChange={() => setMatch(null)}
              data-testid="anchor-verify-input"
              className="min-h-11 rounded-xl border border-input bg-transparent px-3 font-mono text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={checking}
            data-testid="anchor-verify-submit"
            className="min-h-11 rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
          >
            {checking ? t("verifying") : t("verifyCta")}
          </button>
          {match !== null && (
            <p
              role="status"
              data-testid={match ? "anchor-verify-match" : "anchor-verify-no-match"}
              className={`w-full text-xs ${match ? "text-secondary-foreground" : "text-destructive"}`}
            >
              {match ? t("verifyMatch") : t("verifyNoMatch")}
            </p>
          )}
          <p className="w-full text-xs text-muted-foreground">{t("verifyHint")}</p>
        </form>
      )}

      {isOwner && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
            <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
              <Dialog.Popup
                className="premium-panel w-full max-w-md rounded-2xl border border-border p-5 shadow-2xl"
                data-testid="anchor-edit-dialog"
              >
                <Dialog.Title className="text-lg font-semibold">{t("editTitle")}</Dialog.Title>
                <Dialog.Description className="mt-2 text-xs leading-5 text-muted-foreground">
                  {t("editBody")}
                </Dialog.Description>
                <form action={save} className="mt-4 flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("typeLabel")}</span>
                    <select
                      name="anchorType"
                      defaultValue={anchorType ?? ANCHOR_TYPES[0]}
                      data-testid="anchor-input-type"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
                    >
                      {ANCHOR_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`type.${type}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-medium">{t("valueLabel")}</span>
                    <input
                      name="anchorValue"
                      defaultValue={anchorValue ?? ""}
                      maxLength={64}
                      autoComplete="off"
                      data-testid="anchor-input-value"
                      className="min-h-11 rounded-xl border border-input bg-transparent px-3 font-mono text-sm"
                    />
                    <span className="text-muted-foreground">{t("valueHint")}</span>
                  </label>

                  {error && (
                    <p
                      className="text-xs text-destructive"
                      role="alert"
                      data-testid={error === "duplicate_anchor" ? "anchor-duplicate-error" : "anchor-error"}
                    >
                      {error === "duplicate_anchor" ? t("duplicateError") : t("error")}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      data-testid="anchor-save"
                      className="min-h-11 flex-1 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
                    >
                      {busy ? t("saving") : t("save")}
                    </button>
                    <Dialog.Close className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium">
                      {t("cancel")}
                    </Dialog.Close>
                  </div>
                </form>
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteLitter } from "@/lib/litters/actions";
import { LitterWizard } from "./LitterWizard";
import type { BreedingCreature, LinkableCreature, MyLitter } from "@/lib/litters/queries";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LittersPanel({
  litters,
  breedingCreatures,
  linkableCreatures,
}: {
  litters: MyLitter[];
  breedingCreatures: BreedingCreature[];
  linkableCreatures: LinkableCreature[];
}) {
  const t = useTranslations("litters");
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingLitter, setEditingLitter] = useState<MyLitter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MyLitter | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  function openCreate() {
    setEditingLitter(null);
    setWizardOpen(true);
  }

  function openEdit(litter: MyLitter) {
    setEditingLitter(litter);
    setWizardOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteError(false);
    const result = await deleteLitter(deleteTarget.id);
    setBusy(false);
    if (!result.ok) {
      setDeleteError(true);
      return;
    }
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div>
      <div className="px-4 pb-3">
        <Button variant="secondary" data-testid="record-litter-cta" onClick={openCreate}>
          {t("recordCta")}
        </Button>
      </div>

      <div className="px-4 pb-8">
        {litters.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="litters-empty">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="litters-list">
            {litters.map((l) => {
              const expected = formatDate(l.expectedDate);
              const born = formatDate(l.birthDate);
              return (
                <li key={l.id} className="premium-panel rounded-2xl p-4" data-testid="litter-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/litters/${l.id}`}
                        className="truncate text-base font-semibold hover:underline"
                        data-testid="litter-open"
                      >
                        {l.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {l.species ? t(`species.${l.species}`) : t("speciesUnset")}
                        {l.breed ? ` · ${l.breed}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground">
                      {t(`status.${l.status}`)}
                    </span>
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{t("youngCount", { count: l.youngCount })}</span>
                    {expected && (
                      <span>
                        {t("expected")}: {expected}
                      </span>
                    )}
                    {born && (
                      <span>
                        {t("born")}: {born}
                      </span>
                    )}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" data-testid="litter-edit" onClick={() => openEdit(l)}>
                      {t("edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="litter-delete"
                      onClick={() => {
                        setDeleteError(false);
                        setDeleteTarget(l);
                      }}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {wizardOpen && (
        <LitterWizard
          key={editingLitter?.id ?? "new"}
          litter={editingLitter}
          breedingCreatures={breedingCreatures}
          linkableCreatures={linkableCreatures}
          onClose={() => setWizardOpen(false)}
          onSaved={() => {
            setWizardOpen(false);
            router.refresh();
          }}
        />
      )}

      <AlertDialog.Root
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <AlertDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <AlertDialog.Popup
              className="premium-panel w-full max-w-sm rounded-2xl border border-border p-5 shadow-2xl"
              data-testid="litter-delete-dialog"
            >
              <AlertDialog.Title className="text-lg font-semibold">{t("deleteTitle")}</AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("deleteBody")}
              </AlertDialog.Description>
              {deleteError && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {t("deleteError")}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <AlertDialog.Close className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                  {t("cancel")}
                </AlertDialog.Close>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={busy}
                  className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                  data-testid="litter-delete-confirm"
                >
                  {busy ? t("deleting") : t("delete")}
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

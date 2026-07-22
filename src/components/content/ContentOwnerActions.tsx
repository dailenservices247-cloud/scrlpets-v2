"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteListing,
  deletePost,
} from "@/lib/compose/actions";
import { capture } from "@/lib/analytics";
import { getFeedDestination } from "@/lib/feed/destinations";
import type { FeedItem } from "@/lib/feed/types";

// punch list A14: owner controls live behind a single FB/IG-style ⋯ menu
// instead of exposed Edit/Delete buttons.
export function ContentOwnerActions({ item }: { item: FeedItem }) {
  const t = useTranslations("content");
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (item.type === "promo") return null;

  const isListing = item.type === "listing";
  const editHref = isListing
    ? `/listing/${item.id}/edit`
    : `/post/${item.id}/edit`;

  async function remove() {
    setBusy(true);
    setError(null);
    const result = isListing
      ? await deleteListing(item.id)
      : await deletePost(item.id);
    setBusy(false);
    if (!result.ok) {
      setError(t("deleteError"));
      return;
    }

    capture("content_deleted", {
      content_type: isListing ? "listing" : "post",
      delete_semantics: "soft",
    });
    setConfirmOpen(false);
    const destination = getFeedDestination(item).href;
    if (pathname === destination) router.push("/");
    else router.refresh();
  }

  return (
    <div data-testid={`owner-actions-${item.id}`}>
      <Menu.Root>
        <Menu.Trigger
          className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          aria-label={t("moreOptions")}
          data-testid="owner-menu"
        >
          <MoreHorizontal className="size-5" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={4} className="z-50">
            <Menu.Popup className="min-w-40 rounded-xl border border-border bg-popover p-1 shadow-xl">
              <Menu.Item
                className="flex w-full cursor-pointer items-center rounded-lg px-3 py-2.5 text-sm font-medium outline-none data-[highlighted]:bg-muted"
                data-testid="edit-content"
                onClick={() => router.push(editHref)}
              >
                {t("edit")}
              </Menu.Item>
              <Menu.Item
                className="flex w-full cursor-pointer items-center rounded-lg px-3 py-2.5 text-sm font-medium text-destructive outline-none data-[highlighted]:bg-destructive/10"
                data-testid="delete-content"
                onClick={() => setConfirmOpen(true)}
              >
                {isListing ? t("remove") : t("delete")}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <AlertDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <AlertDialog.Popup
              className="premium-panel w-full max-w-sm rounded-2xl border border-border p-5 shadow-2xl"
              data-testid="delete-dialog"
            >
              <AlertDialog.Title className="text-lg font-semibold">
                {isListing ? t("removeListingTitle") : t("deletePostTitle")}
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {isListing ? t("removeListingBody") : t("deletePostBody")}
              </AlertDialog.Description>
              {error && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <AlertDialog.Close className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                  {t("cancel")}
                </AlertDialog.Close>
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                  data-testid="confirm-delete"
                >
                  {busy ? t("deleting") : isListing ? t("remove") : t("deletePermanently")}
                </button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

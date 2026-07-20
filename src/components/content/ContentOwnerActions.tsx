"use client";

import Link from "next/link";
import { AlertDialog } from "@base-ui/react/alert-dialog";
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

export function ContentOwnerActions({ item }: { item: FeedItem }) {
  const t = useTranslations("content");
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Posts and listings both soft-delete now (Slice B).
      delete_semantics: "soft",
    });
    const destination = getFeedDestination(item).href;
    if (pathname === destination) router.push("/");
    else router.refresh();
  }

  return (
    <div
      className="flex items-center justify-end gap-2"
      data-testid={`owner-actions-${item.id}`}
    >
      <Link
        href={editHref}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-brand-link hover:bg-muted"
        data-testid="edit-content"
      >
        {t("edit")}
      </Link>

      <AlertDialog.Root>
        <AlertDialog.Trigger
          className="rounded-lg border border-red-400/50 bg-red-950/70 px-2.5 py-1.5 text-xs font-medium text-red-200 hover:bg-red-900/80"
          data-testid="delete-content"
        >
          {t("delete")}
        </AlertDialog.Trigger>
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

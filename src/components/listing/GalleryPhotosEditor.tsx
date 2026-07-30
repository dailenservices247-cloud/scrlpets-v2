"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { uploadMedia } from "@/lib/media/upload";
import {
  addListingPhotos,
  loadListingPhotosForEditor,
  removeListingPhoto,
  updateListingPhotoCaption,
} from "@/lib/listings/actions";

type UIPhoto = { id: string | null; url: string; caption: string };

/**
 * V2-01 seller side: up to 10 gallery photos with optional captions, reusing
 * MediaInput's exact upload function (src/lib/media/upload.ts).
 *
 * Edit mode (listingId set) writes through immediately — add/remove/caption
 * each round-trip to listing_photos, RLS-scoped to the seller. Create mode
 * (listingId null, the listing doesn't exist yet) keeps photos as local
 * pending state and reports them up via onPendingPhotosChange; the parent
 * form attaches them once the listing exists (see ListingForm's submit()).
 */
export function GalleryPhotosEditor({
  userId,
  listingId,
  onPendingPhotosChange,
}: {
  userId: string;
  listingId: string | null;
  onPendingPhotosChange?: (photos: { url: string; caption: string }[]) => void;
}) {
  const t = useTranslations("detail");
  const tc = useTranslations("content");
  const tCompose = useTranslations("compose");
  const [photos, setPhotos] = useState<UIPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) return;
    loadListingPhotosForEditor(listingId).then((rows) =>
      setPhotos(rows.map((r) => ({ id: r.id, url: r.photoUrl, caption: r.caption ?? "" }))),
    );
  }, [listingId]);

  function reportPending(next: UIPhoto[]) {
    onPendingPhotosChange?.(next.map(({ url, caption }) => ({ url, caption })));
  }

  async function handleAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setBusy(true);
    const res = await uploadMedia(file, userId);
    if ("error" in res || res.kind !== "image") {
      setBusy(false);
      setErr("type");
      return;
    }
    if (listingId) {
      const added = await addListingPhotos(listingId, [{ url: res.url, caption: "" }]);
      if (!added.ok) {
        setBusy(false);
        setErr(added.error);
        return;
      }
      const rows = await loadListingPhotosForEditor(listingId);
      setBusy(false);
      setPhotos(rows.map((r) => ({ id: r.id, url: r.photoUrl, caption: r.caption ?? "" })));
    } else {
      setBusy(false);
      setPhotos((prev) => {
        const next = [...prev, { id: null, url: res.url, caption: "" }];
        reportPending(next);
        return next;
      });
    }
  }

  async function handleRemove(index: number) {
    const target = photos[index];
    if (listingId && target.id) {
      await removeListingPhoto(target.id, listingId);
    }
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (!listingId) reportPending(next);
      return next;
    });
  }

  function handleCaptionInput(index: number, caption: string) {
    setPhotos((prev) => {
      const next = prev.map((p, i) => (i === index ? { ...p, caption } : p));
      if (!listingId) reportPending(next);
      return next;
    });
  }

  async function handleCaptionCommit(index: number) {
    const target = photos[index];
    if (listingId && target.id) {
      await updateListingPhotoCaption(target.id, listingId, target.caption);
    }
  }

  const atLimit = photos.length >= 10;

  return (
    <div className="flex flex-col gap-2" data-testid="gallery-photos-editor">
      <p className="text-sm text-muted-foreground">
        {t("galleryManageLabel")} ({photos.length}/10)
      </p>
      {photos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {photos.map((p, i) => (
            <li
              key={p.id ?? p.url}
              className="flex items-center gap-2 rounded-lg border border-input p-2"
              data-testid="gallery-editor-photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="size-14 shrink-0 rounded-md object-cover" />
              <input
                className="min-w-0 flex-1 rounded border border-input bg-transparent p-1.5 text-sm"
                placeholder={t("galleryCaptionPlaceholder")}
                value={p.caption}
                maxLength={150}
                onChange={(e) => handleCaptionInput(i, e.target.value)}
                onBlur={() => handleCaptionCommit(i)}
                data-testid={`gallery-editor-caption-${i}`}
              />
              <button
                type="button"
                className="min-h-11 shrink-0 px-1 text-xs text-destructive underline"
                onClick={() => handleRemove(i)}
                data-testid={`gallery-editor-remove-${i}`}
              >
                {tc("removePhoto")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!atLimit && (
        <label className="text-sm text-muted-foreground">
          {busy ? tCompose("uploading") : t("addGalleryPhoto")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAdd}
            className="block mt-1 text-sm"
            disabled={busy}
            data-testid="gallery-editor-add"
          />
        </label>
      )}
      {err && (
        <p className="text-destructive text-sm" data-testid="gallery-editor-error">
          {err === "type"
            ? t("galleryPhotoTypeError")
            : err === "gallery_full"
              ? t("galleryLimitReached")
              : t("galleryAddError")}
        </p>
      )}
    </div>
  );
}

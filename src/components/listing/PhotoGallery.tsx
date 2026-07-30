"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ListingPhoto } from "@/lib/listings/queries";

type GalleryItem = { id: string; photoUrl: string; caption: string | null };

/**
 * V2-01: horizontal swipeable strip (native overflow-x + scroll-snap, no
 * carousel library) with a tap-to-open fullscreen viewer. Falls back to the
 * listing's single cover (media_url) when the gallery table is empty, so
 * every listing created before this shipped still shows its photo.
 */
export function PhotoGallery({
  photos,
  fallbackUrl,
}: {
  photos: ListingPhoto[];
  fallbackUrl: string | null;
}) {
  const t = useTranslations("detail");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const items: GalleryItem[] =
    photos.length > 0
      ? photos.map((p) => ({ id: p.id, photoUrl: p.photoUrl, caption: p.caption }))
      : fallbackUrl
        ? [{ id: "cover", photoUrl: fallbackUrl, caption: null }]
        : [];

  if (items.length === 0) return null;

  const current = openIndex !== null ? items[openIndex] : null;

  function go(delta: number) {
    setOpenIndex((i) => (i === null ? i : (i + delta + items.length) % items.length));
  }

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="listing-gallery">
      <p className="eyebrow">{t("galleryTitle")}</p>
      <div className="mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="shrink-0 snap-start overflow-hidden rounded-xl"
            aria-label={t("viewPhoto")}
            data-testid={`listing-gallery-photo-${i}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.photoUrl} alt={item.caption ?? ""} className="h-40 w-40 object-cover" />
          </button>
        ))}
      </div>

      <Dialog.Root
        open={current !== null}
        onOpenChange={(next) => {
          if (!next) setOpenIndex(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/90" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center">
            <Dialog.Popup
              className="relative flex h-full w-full items-center justify-center px-4 outline-none"
              data-testid="gallery-viewer"
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") go(1);
                if (e.key === "ArrowLeft") go(-1);
                if (e.key === "Escape") setOpenIndex(null);
              }}
            >
              <Dialog.Title className="sr-only">{t("galleryTitle")}</Dialog.Title>
              <Dialog.Close
                className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-black/50 text-white"
                aria-label={t("closeGallery")}
                data-testid="gallery-viewer-close"
              >
                <X className="size-5" aria-hidden />
              </Dialog.Close>

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute left-2 grid size-11 place-items-center rounded-full bg-black/50 text-white sm:left-4"
                  aria-label={t("previousPhoto")}
                  data-testid="gallery-viewer-prev"
                >
                  <ChevronLeft className="size-6" aria-hidden />
                </button>
              )}

              {current && (
                <div className="flex max-w-full flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.photoUrl}
                    alt={current.caption ?? ""}
                    className="max-h-[70vh] max-w-full rounded-lg object-contain"
                  />
                  <p className="text-sm text-white/80" data-testid="gallery-viewer-counter">
                    {t("photoCounter", { current: (openIndex ?? 0) + 1, total: items.length })}
                  </p>
                  {current.caption && (
                    <p
                      className="max-w-md text-center text-sm text-white"
                      data-testid="gallery-viewer-caption"
                    >
                      {current.caption}
                    </p>
                  )}
                </div>
              )}

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute right-2 grid size-11 place-items-center rounded-full bg-black/50 text-white sm:right-4"
                  aria-label={t("nextPhoto")}
                  data-testid="gallery-viewer-next"
                >
                  <ChevronRight className="size-6" aria-hidden />
                </button>
              )}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

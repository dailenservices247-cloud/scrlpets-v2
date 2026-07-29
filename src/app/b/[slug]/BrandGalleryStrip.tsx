"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@base-ui/react/dialog";
import type { BrandGalleryPhoto } from "@/lib/brand-kit/queries";

/** Facility gallery strip for the public brand page — a simple tap-to-open,
 * full-width lightbox (no carousel/prev-next needed per spec). */
export function BrandGalleryStrip({ photos }: { photos: BrandGalleryPhoto[] }) {
  const t = useTranslations("brandKit");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const open = openIndex !== null ? photos[openIndex] : null;

  return (
    <section className="px-3 pt-3" data-testid="brand-gallery-strip">
      <h2 className="eyebrow mb-2">{t("galleryTitle")}</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="shrink-0 focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="brand-gallery-thumb"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.photoUrl} alt={photo.caption ?? ""} width={112} height={112} className="size-28 rounded-xl object-cover" />
          </button>
        ))}
      </div>

      <Dialog.Root open={open !== null} onOpenChange={(v) => !v && setOpenIndex(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/80" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <Dialog.Popup className="w-full max-w-lg rounded-2xl bg-card p-2" data-testid="brand-gallery-lightbox">
              {open && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={open.photoUrl} alt={open.caption ?? ""} className="w-full rounded-xl object-cover" />
                  {open.caption && <p className="p-2 text-sm text-muted-foreground">{open.caption}</p>}
                </>
              )}
              <Dialog.Close className="mt-2 min-h-11 w-full rounded-xl border border-input text-sm font-medium">
                {t("galleryClose")}
              </Dialog.Close>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

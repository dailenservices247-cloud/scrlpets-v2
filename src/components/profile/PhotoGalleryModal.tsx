"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, PenSquare, X } from "lucide-react";

export type PhotoItem = {
  url: string;
  title?: string;
  subtitle?: string;
};

export function PhotoGalleryModal({
  photos,
  initialIndex = 0,
  onClose,
  isOwner = false,
  editHref,
  onEdit,
}: {
  photos: PhotoItem[];
  initialIndex?: number;
  onClose: () => void;
  isOwner?: boolean;
  editHref?: string;
  onEdit?: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const total = photos.length;
  const current = photos[currentIndex] ?? photos[0];

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goNext, goPrev]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 text-white backdrop-blur-md select-none transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      data-testid="photo-lightbox-modal"
    >
      {/* Top Header Bar */}
      <header className="flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            aria-label="Close photo viewer"
            data-testid="photo-lightbox-close"
          >
            <X className="size-5" />
          </button>
          <div>
            <p className="text-sm font-semibold leading-tight text-white/90">
              {current.title || "Photo"}
            </p>
            {total > 1 && (
              <p className="text-xs text-white/60">
                {currentIndex + 1} of {total}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* External original view */}
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            title="Open original photo"
            aria-label="Open original photo"
          >
            <ExternalLink className="size-4" />
          </a>

          {/* Owner edit action */}
          {isOwner && (
            editHref ? (
              <Link
                href={editHref}
                onClick={onClose}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-4 text-xs font-semibold text-white transition"
                data-testid="photo-lightbox-edit"
              >
                <PenSquare className="size-3.5" />
                <span>Edit Photo</span>
              </Link>
            ) : onEdit ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-4 text-xs font-semibold text-white transition"
                data-testid="photo-lightbox-edit"
              >
                <PenSquare className="size-3.5" />
                <span>Edit Photo</span>
              </button>
            ) : null
          )}
        </div>
      </header>

      {/* Main Photo Canvas */}
      <div className="relative flex flex-1 items-center justify-center p-2 sm:p-6 overflow-hidden">
        {total > 1 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-3 sm:left-6 z-20 grid size-12 place-items-center rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white shadow-lg transition active:scale-95"
            aria-label="Previous photo"
            data-testid="photo-lightbox-prev"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.url}
          src={current.url}
          alt={current.title ?? "Photo view"}
          className="max-h-[72vh] max-w-[92vw] sm:max-h-[78vh] object-contain rounded-xl shadow-2xl transition duration-200"
          data-testid="photo-lightbox-img"
        />

        {total > 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-3 sm:right-6 z-20 grid size-12 place-items-center rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white shadow-lg transition active:scale-95"
            aria-label="Next photo"
            data-testid="photo-lightbox-next"
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {/* Bottom Bar: Caption + Thumbnail Gallery */}
      <footer className="p-4 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        {current.subtitle && (
          <p className="mb-3 text-center text-xs text-white/70">
            {current.subtitle}
          </p>
        )}

        {/* Thumbnail carousel when multiple photos exist */}
        {total > 1 && (
          <div className="mx-auto flex max-w-xl items-center justify-center gap-2 overflow-x-auto py-1">
            {photos.map((item, idx) => (
              <button
                key={item.url + idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative size-12 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  currentIndex === idx
                    ? "border-primary ring-2 ring-primary/80 scale-105"
                    : "border-white/20 opacity-50 hover:opacity-90"
                }`}
                aria-label={`Jump to photo ${idx + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </footer>
    </div>
  );
}

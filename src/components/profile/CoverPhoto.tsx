"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Eye, X } from "lucide-react";
import { PhotoGalleryModal, type PhotoAlbum, type PhotoItem } from "./PhotoGalleryModal";

/**
 * Person cover photo. Deliberately identical to the brand banner in
 * BrandProfileHeader (same height, same crop, same panel it sits inside) so a
 * person and a brand read as the same kind of page.
 * Enhanced with Facebook-style click actions and album viewer.
 */
export function CoverPhoto({
  url,
  name,
  isOwner = false,
  editHref = "/settings/profile",
  albums = [],
  otherPhotos = [],
}: {
  url: string | null | undefined;
  name?: string;
  isOwner?: boolean;
  editHref?: string;
  albums?: PhotoAlbum[];
  otherPhotos?: PhotoItem[];
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!url) return null;

  const photos: PhotoItem[] = [
    {
      url,
      title: name ? `${name}'s cover photo` : "Cover photo",
      subtitle: "Cover Photo",
      albumId: "cover_photos",
      albumTitle: "Cover Photos",
    },
    ...otherPhotos.filter((p) => p.url !== url),
  ];

  return (
    <>
      <div
        onClick={() => setSheetOpen(true)}
        className="group relative h-32 w-full cursor-pointer overflow-hidden transition active:opacity-95"
        role="button"
        tabIndex={0}
        aria-label="View cover photo options"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSheetOpen(true);
          }
        }}
        data-testid="profile-cover-trigger"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className="h-32 w-full object-cover transition duration-200 group-hover:brightness-95"
          data-testid="profile-cover"
        />
        <span
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
          aria-hidden
        >
          {isOwner ? <Camera className="size-4" /> : <Eye className="size-4" />}
        </span>
      </div>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-sm transition-opacity duration-150"
          role="dialog"
          aria-modal="true"
          onClick={() => setSheetOpen(false)}
          data-testid="cover-photo-action-sheet"
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-border bg-card p-4 shadow-2xl transition-transform duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-semibold text-base">Cover Photo</h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close options"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  setLightboxOpen(true);
                }}
                className="flex w-full min-h-12 items-center gap-3.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/70 active:scale-[0.99]"
                data-testid="action-view-cover"
              >
                <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-brand-link">
                  <Eye className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">See cover photo</p>
                  <p className="text-xs text-muted-foreground">View full size and high resolution</p>
                </div>
              </button>

              {isOwner && (
                <Link
                  href={editHref}
                  onClick={() => setSheetOpen(false)}
                  className="flex w-full min-h-12 items-center gap-3.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/70 active:scale-[0.99]"
                  data-testid="action-update-cover"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-accent/20 text-accent-foreground">
                    <Camera className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Choose new cover photo</p>
                    <p className="text-xs text-muted-foreground">Update or change this image</p>
                  </div>
                </Link>
              )}
            </div>

            <div className="mt-4 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-full min-h-11 rounded-xl border border-input font-semibold text-sm transition hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxOpen && (
        <PhotoGalleryModal
          photos={photos}
          albums={albums}
          initialAlbumId="cover_photos"
          initialIndex={0}
          onClose={() => setLightboxOpen(false)}
          isOwner={isOwner}
          editHref={editHref}
        />
      )}
    </>
  );
}

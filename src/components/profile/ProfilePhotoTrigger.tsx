"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Eye, Folder, Images, X } from "lucide-react";
import { PhotoGalleryModal, type PhotoAlbum, type PhotoItem } from "./PhotoGalleryModal";

export function ProfilePhotoTrigger({
  avatarUrl,
  name,
  isOwner = false,
  editHref,
  albums = [],
  className = "size-18 rounded-2xl",
  imgClassName = "size-18 rounded-2xl object-cover ring-1 ring-border/80",
  fallbackClassName = "grid size-18 place-items-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground ring-1 ring-border/80",
  testId = "profile-avatar-trigger",
  typeLabel = "profile picture",
}: {
  avatarUrl: string | null | undefined;
  name: string;
  isOwner?: boolean;
  editHref?: string;
  albums?: PhotoAlbum[];
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  testId?: string;
  typeLabel?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("all");
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Flatten all photos across albums
  const allPhotos: PhotoItem[] = [];
  for (const alb of albums) {
    for (const p of alb.photos) {
      if (!allPhotos.some((existing) => existing.url === p.url)) {
        allPhotos.push(p);
      }
    }
  }
  // Ensure avatar is included if not in albums
  if (avatarUrl && !allPhotos.some((p) => p.url === avatarUrl)) {
    allPhotos.unshift({
      url: avatarUrl,
      title: `${name}'s ${typeLabel}`,
      subtitle: typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1),
      albumId: "profile_pictures",
      albumTitle: "Profile Pictures",
    });
  }

  function handlePhotoClick() {
    setSheetOpen(true);
  }

  function openAlbum(albumId = "all", index = 0) {
    setSelectedAlbumId(albumId);
    setLightboxIndex(index);
    setSheetOpen(false);
    setLightboxOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePhotoClick}
        className={`group relative block cursor-pointer transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-ring active:scale-[0.98] ${className}`}
        aria-label={`View ${name}'s ${typeLabel} and photo albums`}
        data-testid={testId}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className={`${imgClassName} transition group-hover:ring-2 group-hover:ring-primary/60`}
          />
        ) : (
          <div className={`${fallbackClassName} transition group-hover:ring-2 group-hover:ring-primary/60`}>
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}

        {/* Small subtle camera / view indicator overlay on hover */}
        <span
          className="absolute inset-0 grid place-items-center rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-white"
          aria-hidden
        >
          {isOwner ? <Camera className="size-5" /> : <Eye className="size-5" />}
        </span>
      </button>

      {/* Facebook-style Action Sheet Modal */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-sm transition-opacity duration-150"
          role="dialog"
          aria-modal="true"
          onClick={() => setSheetOpen(false)}
          data-testid="photo-action-sheet"
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-border bg-card p-4 shadow-2xl transition-transform duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-3">
                {avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt=""
                    className="size-11 rounded-full object-cover ring-1 ring-border"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-base leading-snug">{name}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{typeLabel}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close options"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Options List */}
            <div className="mt-3 space-y-2">
              {avatarUrl ? (
                <button
                  type="button"
                  onClick={() => openAlbum("profile_pictures", 0)}
                  className="flex w-full min-h-12 items-center gap-3.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/70 active:scale-[0.99]"
                  data-testid="action-view-photo"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-brand-link">
                    <Eye className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">See {typeLabel}</p>
                    <p className="text-xs text-muted-foreground">View full size and high resolution</p>
                  </div>
                </button>
              ) : allPhotos.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openAlbum("all", 0)}
                  className="flex w-full min-h-12 items-center gap-3.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/70 active:scale-[0.99]"
                  data-testid="action-view-photo"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-primary/15 text-brand-link">
                    <Eye className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">See photos ({allPhotos.length})</p>
                    <p className="text-xs text-muted-foreground">Browse photos from posts and gallery</p>
                  </div>
                </button>
              ) : null}

              {/* Structured Albums List */}
              {albums.length > 0 && (
                <div className="pt-1">
                  <div className="px-1 py-1.5 flex items-center justify-between">
                    <p className="eyebrow flex items-center gap-1.5">
                      <Folder className="size-3 text-brand-link" />
                      <span>Photo Albums ({albums.length})</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => openAlbum("all", 0)}
                      className="text-xs text-brand-link font-medium hover:underline"
                    >
                      View All ({allPhotos.length})
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {albums.map((album) => (
                      <button
                        key={album.id}
                        type="button"
                        onClick={() => openAlbum(album.id, 0)}
                        className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5 text-left transition hover:bg-muted/50 active:scale-[0.99]"
                        data-testid={`action-album-${album.id}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {album.photos[0]?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={album.photos[0].url}
                              alt=""
                              className="size-9 rounded-lg object-cover ring-1 ring-border"
                            />
                          ) : (
                            <div className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                              <Images className="size-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{album.title}</p>
                            {album.description && (
                              <p className="truncate text-micro text-muted-foreground">
                                {album.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="font-mono text-xs font-semibold text-muted-foreground shrink-0">
                          {album.photos.length}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isOwner && editHref && (
                <Link
                  href={editHref}
                  onClick={() => setSheetOpen(false)}
                  className="flex w-full min-h-12 items-center gap-3.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted/70 active:scale-[0.99]"
                  data-testid="action-update-photo"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-accent/20 text-accent-foreground">
                    <Camera className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">
                      {avatarUrl ? `Choose new ${typeLabel}` : `Add ${typeLabel}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {avatarUrl ? "Update or change this image" : "Upload a profile photo"}
                    </p>
                  </div>
                </Link>
              )}
            </div>

            {/* Cancel Button */}
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

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <PhotoGalleryModal
          photos={allPhotos}
          albums={albums}
          initialAlbumId={selectedAlbumId}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          isOwner={isOwner}
          editHref={editHref}
        />
      )}
    </>
  );
}

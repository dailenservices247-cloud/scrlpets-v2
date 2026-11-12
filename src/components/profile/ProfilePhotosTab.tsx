"use client";

import { useState, useMemo } from "react";
import { Camera, Copy, Heart, MessageSquare, Play, Sparkles } from "lucide-react";
import { PhotoGalleryModal, type PhotoAlbum, type PhotoItem } from "./PhotoGalleryModal";

export type InstagramStylePhotoItem = PhotoItem & {
  type?: "photo" | "video" | "reel";
  isCarousel?: boolean;
  carouselCount?: number;
  likeCount?: number;
  commentCount?: number;
};

export function ProfilePhotosTab({
  photos = [],
  albums = [],
  username,
  displayName,
}: {
  photos: InstagramStylePhotoItem[];
  albums: PhotoAlbum[];
  username: string;
  displayName?: string | null;
}) {
  const [activeAlbumId, setActiveAlbumId] = useState<string>("all");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Filter photos based on selected album highlight
  const filteredPhotos = useMemo(() => {
    if (activeAlbumId === "all") return photos;
    const album = albums.find((a) => a.id === activeAlbumId);
    if (!album) return photos;
    return photos.filter((p) => p.albumId === activeAlbumId);
  }, [activeAlbumId, photos, albums]);

  function handlePhotoClick(index: number) {
    setSelectedPhotoIndex(index);
    setLightboxOpen(true);
  }

  return (
    <div
      className="space-y-4"
      data-testid="profile-photos-tab"
      data-username={username}
      data-display-name={displayName ?? ""}
    >
      {/* 1. Instagram-Style Album Highlights (Stories Bar) */}
      {albums.length > 0 && (
        <div className="border-b border-border/60 pb-4 pt-1">
          <div className="flex gap-4 overflow-x-auto px-1 pb-1 scrollbar-none">
            {/* "All Photos" Highlight Bubble */}
            <button
              type="button"
              onClick={() => setActiveAlbumId("all")}
              className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
              data-testid="album-bubble-all"
            >
              <div
                className={`grid size-17 place-items-center rounded-full p-0.5 transition ${
                  activeAlbumId === "all"
                    ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 ring-2 ring-primary/70"
                    : "border-2 border-border/80 group-hover:border-foreground/40"
                }`}
              >
                <div className="grid size-full place-items-center rounded-full bg-card overflow-hidden">
                  {photos[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photos[0].url}
                      alt="All photos"
                      className="size-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <Sparkles className="size-6 text-primary" />
                  )}
                </div>
              </div>
              <span
                className={`text-xs max-w-18 truncate tracking-tight ${
                  activeAlbumId === "all"
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                }`}
              >
                All ({photos.length})
              </span>
            </button>

            {/* Individual Album Highlights */}
            {albums.map((album) => {
              const active = activeAlbumId === album.id;
              const cover = album.photos[0]?.url;
              return (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => setActiveAlbumId(album.id)}
                  className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
                  data-testid={`album-bubble-${album.id}`}
                >
                  <div
                    className={`grid size-17 place-items-center rounded-full p-0.5 transition ${
                      active
                        ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 ring-2 ring-primary/70"
                        : "border-2 border-border/80 group-hover:border-foreground/40"
                    }`}
                  >
                    <div className="grid size-full place-items-center rounded-full bg-card overflow-hidden">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt={album.title}
                          className="size-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <Camera className="size-6 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs max-w-18 truncate tracking-tight ${
                      active
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {album.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Instagram 3-Column Square Media Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Camera className="mx-auto size-12 opacity-30" />
          <p className="mt-3 text-sm font-medium">No photos in this album</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-1.5" data-testid="instagram-photo-grid">
          {filteredPhotos.map((item, idx) => (
            <button
              key={`${item.url}-${idx}`}
              type="button"
              onClick={() => handlePhotoClick(idx)}
              className="group relative aspect-square w-full overflow-hidden bg-muted/40 focus:outline-none"
              aria-label={item.title ?? `Photo ${idx + 1}`}
              data-testid={`grid-photo-${idx}`}
            >
              {/* Media Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.title ?? ""}
                className="size-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
              />

              {/* Top-Right Badge: Multi-Photo Carousel or Video Icon */}
              {item.isCarousel ? (
                <div
                  className="absolute right-2 top-2 grid size-6 place-items-center rounded-md bg-black/60 text-white backdrop-blur-sm"
                  title="Multi-photo post"
                >
                  <Copy className="size-3.5" />
                </div>
              ) : item.type === "video" || item.type === "reel" ? (
                <div
                  className="absolute right-2 top-2 grid size-6 place-items-center rounded-md bg-black/60 text-white backdrop-blur-sm"
                  title="Video clip"
                >
                  <Play className="size-3.5 fill-white" />
                </div>
              ) : null}

              {/* Instagram Hover Scrim with Heart & Comment counters */}
              <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/45 text-white opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <Heart className="size-4 fill-white" />
                  <span>{item.likeCount ?? 12}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <MessageSquare className="size-4 fill-white" />
                  <span>{item.commentCount ?? 3}</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 3. Instagram Lightbox Modal */}
      {lightboxOpen && (
        <PhotoGalleryModal
          photos={filteredPhotos}
          albums={albums}
          initialAlbumId={activeAlbumId}
          initialIndex={selectedPhotoIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

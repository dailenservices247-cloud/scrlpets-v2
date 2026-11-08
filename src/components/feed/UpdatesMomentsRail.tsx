"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Plus, X, ChevronLeft, ChevronRight, Play, Pause, User, ExternalLink } from "lucide-react";
import type { FeedItem } from "@/lib/feed/types";

export type Moment = {
  id: string;
  href: string;
  label: string;
  imageUrl: string | null;
  avatarUrl: string | null;
  authorName: string;
  createdAt: string;
  caption: string | null;
  profileType: "creature" | "brand" | "user";
};

const WATCHED_STORAGE_KEY = "scrlpets_watched_stories";

function subscribeWatched(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("scrlpets-watched-updated", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("scrlpets-watched-updated", callback);
  };
}

function getWatchedSnapshot(): string {
  try {
    return localStorage.getItem(WATCHED_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getServerSnapshot(): string {
  return "[]";
}

function formatTimeAgo(isoString?: string): string {
  if (!isoString) return "";
  try {
    const elapsed = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (elapsed < 60) return "Just now";
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
    return `${Math.floor(elapsed / 86400)}d ago`;
  } catch {
    return "";
  }
}

function getMoments(items: FeedItem[]): Moment[] {
  const seen = new Set<string>();
  const moments: Moment[] = [];

  for (const item of items) {
    const key = item.creature?.id ?? item.brand?.id ?? item.author.id;
    if (seen.has(key)) continue;
    seen.add(key);

    const label =
      item.creature?.name ??
      item.brand?.name ??
      item.author.displayName ??
      item.author.username;

    const avatarUrl =
      item.creature?.avatarUrl ??
      item.brand?.avatarUrl ??
      item.author.avatarUrl;

    const imageUrl =
      item.mediaUrl ??
      item.creature?.avatarUrl ??
      item.brand?.avatarUrl ??
      item.author.avatarUrl;

    const href = item.creature
      ? `/c/${item.creature.slug}`
      : item.brand
        ? `/b/${item.brand.slug}`
        : `/u/${item.author.username}`;

    const profileType: "creature" | "brand" | "user" = item.creature
      ? "creature"
      : item.brand
        ? "brand"
        : "user";

    moments.push({
      id: item.id,
      href,
      label,
      imageUrl,
      avatarUrl,
      authorName: item.author.displayName ?? item.author.username,
      createdAt: item.createdAt,
      caption: item.title,
      profileType,
    });

    if (moments.length >= 12) break;
  }

  return moments;
}

export function UpdatesMomentsRail({
  items,
  signedIn,
  userAvatarUrl,
  userName,
}: {
  items: FeedItem[];
  signedIn: boolean;
  userAvatarUrl?: string | null;
  userName?: string | null;
}) {
  const moments = getMoments(items);
  const watchedRaw = useSyncExternalStore(subscribeWatched, getWatchedSnapshot, getServerSnapshot);
  const watchedIds = useMemo(() => {
    try {
      const parsed = JSON.parse(watchedRaw);
      return new Set<string>(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set<string>();
    }
  }, [watchedRaw]);

  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  function markAsWatched(id: string) {
    try {
      const raw = localStorage.getItem(WATCHED_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const set = new Set<string>(Array.isArray(parsed) ? parsed : []);
      if (!set.has(id)) {
        set.add(id);
        localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify([...set]));
        window.dispatchEvent(new Event("scrlpets-watched-updated"));
      }
    } catch {
      /* storage unavailable */
    }
  }

  function openStory(index: number) {
    setActiveStoryIndex(index);
    setProgress(0);
    setIsPaused(false);
    const moment = moments[index];
    if (moment) {
      markAsWatched(moment.id);
    }
  }

  function closeStory() {
    setActiveStoryIndex(null);
    setProgress(0);
    setIsPaused(false);
  }

  function nextStory() {
    setActiveStoryIndex((curr) => {
      if (curr === null) return null;
      if (curr < moments.length - 1) {
        const nextIdx = curr + 1;
        const nextMoment = moments[nextIdx];
        if (nextMoment) markAsWatched(nextMoment.id);
        return nextIdx;
      }
      return null;
    });
    setProgress(0);
  }

  function prevStory() {
    setActiveStoryIndex((curr) => {
      if (curr === null) return null;
      return curr > 0 ? curr - 1 : 0;
    });
    setProgress(0);
  }

  // Story progress timer (5 seconds duration)
  useEffect(() => {
    if (activeStoryIndex === null || isPaused) return;

    const stepMs = 50;
    const totalDurationMs = 5000;
    const increment = (stepMs / totalDurationMs) * 100;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveStoryIndex((curr) => {
            if (curr === null) return null;
            if (curr < moments.length - 1) {
              const nextIdx = curr + 1;
              const nextMoment = moments[nextIdx];
              if (nextMoment) markAsWatched(nextMoment.id);
              return nextIdx;
            }
            return null;
          });
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [activeStoryIndex, isPaused, moments]);

  // Keyboard navigation for active story viewer
  useEffect(() => {
    if (activeStoryIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveStoryIndex(null);
        setProgress(0);
        setIsPaused(false);
      } else if (e.key === "ArrowRight") {
        setActiveStoryIndex((curr) => {
          if (curr === null) return null;
          if (curr < moments.length - 1) {
            const nextIdx = curr + 1;
            const nextMoment = moments[nextIdx];
            if (nextMoment) markAsWatched(nextMoment.id);
            return nextIdx;
          }
          return null;
        });
        setProgress(0);
      } else if (e.key === "ArrowLeft") {
        setActiveStoryIndex((curr) => {
          if (curr === null) return null;
          return curr > 0 ? curr - 1 : 0;
        });
        setProgress(0);
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStoryIndex, moments]);

  const currentStory = activeStoryIndex !== null ? moments[activeStoryIndex] : null;

  return (
    <section
      className="border-b border-border/80 bg-background/70 py-3"
      data-testid="updates-moments"
    >
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none">
        {/* Card 1: Create story (Signed in user photo + center-bottom plus + Create story label) */}
        <Link
          href={signedIn ? "/compose?mode=story" : "/login"}
          className="group relative flex h-48 w-28 sm:h-52 sm:w-32 shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition hover:border-primary/50"
          data-testid="create-moment"
          aria-label="Create story"
        >
          {/* Top 72% photo section */}
          <div className="relative h-[72%] w-full overflow-hidden bg-muted/60">
            {userAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userAvatarUrl}
                alt={userName ?? "You"}
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="grid size-full place-items-center bg-gradient-to-b from-muted/70 to-muted/30 text-foreground/80">
                {userName ? (
                  <span className="text-2xl font-bold tracking-tight">
                    {userName.slice(0, 1).toUpperCase()}
                  </span>
                ) : (
                  <User className="size-10 text-muted-foreground/70" aria-hidden />
                )}
              </div>
            )}
          </div>

          {/* Bottom 28% card background with centered blue plus button on the seam */}
          <div className="relative flex h-[28%] w-full flex-col items-center justify-end bg-card px-1.5 pb-2.5 pt-3 text-center">
            <span
              className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 grid size-9 place-items-center rounded-full bg-blue-600 text-white shadow-md ring-4 ring-card transition group-hover:bg-blue-500"
              aria-hidden
            >
              <Plus className="size-5 stroke-[2.5]" />
            </span>
            <span className="w-full truncate text-xs font-semibold text-foreground">
              Create story
            </span>
          </div>
        </Link>

        {/* Cards 2+: Moments / Stories */}
        {moments.map((moment, index) => {
          const isWatched = watchedIds.has(moment.id);
          return (
            <button
              type="button"
              key={moment.id}
              onClick={() => openStory(index)}
              className="group relative h-48 w-28 sm:h-52 sm:w-32 shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm cursor-pointer"
              aria-label={`View story by ${moment.label}`}
            >
              {/* Full bleed image */}
              {moment.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={moment.imageUrl}
                  alt={moment.label}
                  className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-2xl font-bold text-white/50">
                  {moment.label.slice(0, 1).toUpperCase()}
                </div>
              )}

              {/* Top-left avatar with watched vs unwatched ring indication */}
              <div className="absolute left-2.5 top-2.5 z-10 pointer-events-none">
                <div
                  className={`size-9 overflow-hidden rounded-full transition-all duration-200 ${
                    isWatched
                      ? "ring-2 ring-white/35 ring-offset-1 ring-offset-black/60 opacity-90"
                      : "ring-[3px] ring-blue-500 ring-offset-2 ring-offset-black/60 shadow-lg"
                  }`}
                >
                  {moment.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={moment.avatarUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center bg-muted text-xs font-bold text-foreground">
                      {moment.label.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom gradient and author name */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-2.5 pt-12 px-2.5 pointer-events-none">
                <p className="line-clamp-2 text-xs font-semibold text-white leading-tight drop-shadow-sm text-left">
                  {moment.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Fullscreen Story Viewer Modal */}
      {currentStory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Story Viewer"
        >
          {/* Desktop previous arrow */}
          <button
            type="button"
            onClick={prevStory}
            disabled={activeStoryIndex === 0}
            className="hidden sm:grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none mr-4 transition"
            aria-label="Previous story"
          >
            <ChevronLeft className="size-6" />
          </button>

          {/* Story Container */}
          <div className="relative flex h-full max-h-none sm:max-h-[90vh] w-full max-w-md flex-col overflow-hidden bg-neutral-950 text-white sm:rounded-2xl border-0 sm:border sm:border-white/10 shadow-2xl">
            {/* Segmented Top Progress Bars */}
            <div className="absolute top-2.5 inset-x-3 z-30 flex gap-1.5">
              {moments.map((m, i) => {
                const isDone = i < (activeStoryIndex ?? 0);
                const isCurrent = i === activeStoryIndex;
                const barWidth = isDone ? "100%" : isCurrent ? `${progress}%` : "0%";
                return (
                  <div
                    key={m.id}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
                  >
                    <div
                      className="h-full bg-white transition-[width] duration-75 ease-linear"
                      style={{ width: barWidth }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Story Top Header */}
            <div className="absolute top-6 inset-x-3 z-30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 overflow-hidden rounded-full ring-2 ring-white/60">
                  {currentStory.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentStory.avatarUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center bg-muted text-xs font-bold text-foreground">
                      {currentStory.label.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <Link
                    href={currentStory.href}
                    className="block text-sm font-bold text-white hover:underline drop-shadow-sm leading-tight"
                  >
                    {currentStory.label}
                  </Link>
                  <span className="text-micro text-white/75 drop-shadow-sm">
                    {formatTimeAgo(currentStory.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className="grid size-9 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                  aria-label={isPaused ? "Play" : "Pause"}
                >
                  {isPaused ? <Play className="size-4 fill-white" /> : <Pause className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={closeStory}
                  className="grid size-9 place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Media Content */}
            <div className="relative flex-1 flex items-center justify-center bg-black select-none">
              {currentStory.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentStory.imageUrl}
                  alt={currentStory.label}
                  className="size-full object-contain pointer-events-none"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-gradient-to-b from-neutral-900 to-black p-8 text-center text-lg font-semibold text-white/90">
                  {currentStory.caption || currentStory.label}
                </div>
              )}

              {/* Tap Left 35% zone for Previous */}
              <div
                className="absolute inset-y-0 left-0 w-[35%] cursor-pointer z-20"
                onClick={prevStory}
                aria-label="Previous story"
              />
              {/* Tap Right 65% zone for Next */}
              <div
                className="absolute inset-y-0 right-0 w-[65%] cursor-pointer z-20"
                onClick={nextStory}
                aria-label="Next story"
              />
            </div>

            {/* Bottom Caption and CTA */}
            <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 flex flex-col gap-2.5">
              {currentStory.caption && (
                <p className="text-sm text-white/90 line-clamp-2 drop-shadow-sm">
                  {currentStory.caption}
                </p>
              )}
              <div className="flex items-center justify-between">
                <Link
                  href={currentStory.href}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white transition"
                >
                  <span>
                    View{" "}
                    {currentStory.profileType === "creature"
                      ? "Creature"
                      : currentStory.profileType === "brand"
                        ? "Brand"
                        : "Profile"}
                  </span>
                  <ExternalLink className="size-3.5" />
                </Link>
                <span className="text-micro text-white/60">
                  Tap sides to navigate
                </span>
              </div>
            </div>
          </div>

          {/* Desktop next arrow */}
          <button
            type="button"
            onClick={nextStory}
            className="hidden sm:grid size-12 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 ml-4 transition"
            aria-label="Next story"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>
      )}
    </section>
  );
}

import Link from "next/link";
import { Video, Sparkles, Play, Film, Radio } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { CreatorDiscoveryRail } from "@/components/creator/CreatorDiscoveryRail";
import { getReelQueue } from "@/lib/feed/query";

export const dynamic = "force-dynamic";

export default async function WatchPage() {
  const reels = await getReelQueue(12).catch(() => []);

  return (
    <AppPage>
      <div className="flex flex-col gap-6 px-3 py-4 sm:px-6 max-w-5xl mx-auto">
        {/* Hero Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-purple-500/20 text-purple-400">
                <Film className="size-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Watch &amp; Creator Hub
                </h1>
                <p className="text-xs text-muted-foreground">
                  Short-form animal cinema, certified trainer drills &amp; audio remix studio
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/compose?tab=reels"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition"
              data-testid="watch-create-reel-btn"
            >
              <Video className="size-4" />
              <span>Create Reel</span>
            </Link>
            <Link
              href="/settings/creator"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
              data-testid="watch-creator-studio-btn"
            >
              <Sparkles className="size-4 text-purple-400" />
              <span>Monetization</span>
            </Link>
          </div>
        </header>

        {/* Creator Discovery, Audio Remix Explorer & Fan Leaderboard */}
        <CreatorDiscoveryRail />

        {/* Trending Reels Feed Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-red-500/15 text-red-400">
                <Radio className="size-3.5" />
              </span>
              <h2 className="text-sm font-bold text-foreground">Featured Community Reels</h2>
            </div>
            <span className="text-micro text-muted-foreground">
              {reels.length > 0 ? `${reels.length} reels loaded` : "Immersive Queue"}
            </span>
          </div>

          {reels.length === 0 ? (
            <div className="premium-panel rounded-2xl p-8 text-center space-y-3">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted/40 text-muted-foreground">
                <Video className="size-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Be the First Creator to Publish</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Upload high-definition 9:16 short films, tag your animals, and qualify for Relay fan tip payouts.
                </p>
              </div>
              <Link
                href="/compose?tab=reels"
                className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition"
              >
                Launch Reel Studio
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {reels.map((reel) => (
                <Link
                  key={reel.id}
                  href={`/watch/reel/${reel.id}`}
                  className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-border/80 bg-muted/40 shadow-xs transition hover:border-primary/50 hover:shadow-md"
                  data-testid={`reel-card-${reel.id}`}
                >
                  {reel.mediaUrl ? (
                    <video
                      src={reel.mediaUrl}
                      className="size-full object-cover group-hover:scale-105 transition duration-300"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-gradient-to-b from-card to-muted/80 p-4 text-center">
                      <Film className="size-8 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Play Button Indicator */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <span className="grid size-12 place-items-center rounded-full bg-white/25 backdrop-blur-md text-white shadow-lg">
                      <Play className="size-6 fill-white ml-0.5" />
                    </span>
                  </div>

                  {/* Bottom Metadata */}
                  <div className="absolute inset-x-0 bottom-0 p-3 space-y-1">
                    <p className="font-semibold text-xs text-white line-clamp-2 drop-shadow-sm">
                      {reel.title || "Untitled Reel"}
                    </p>
                    <div className="flex items-center gap-1.5 text-micro text-white/80">
                      <span>@{reel.author.username}</span>
                      {reel.creature && (
                        <>
                          <span>&middot;</span>
                          <span className="truncate">{reel.creature.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppPage>
  );
}

import Link from "next/link";
import { Video, Sparkles, Play, Film, Radio } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { CreatorDiscoveryRail } from "@/components/creator/CreatorDiscoveryRail";
import { getReelQueue } from "@/lib/feed/query";
import type { FeedItem } from "@/lib/feed/types";

export const dynamic = "force-dynamic";

const FEATURED_FALLBACK_REELS: FeedItem[] = [
  {
    id: "reel-big-meech-drive",
    type: "reel",
    title: "Big Meech Schutzhund Drive & Decoy Bite-Work Sprint",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: {
      id: "auth-apexcanine",
      username: "apexcanine",
      displayName: "Apex Working Dogs",
      avatarUrl: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=150&auto=format&fit=crop&q=80",
    },
    creature: {
      id: "cr-meech",
      name: "Big Meech",
      slug: "big-meech-03fb",
      avatarUrl: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=150&auto=format&fit=crop&q=80",
    },
    brand: null,
    group: null,
  },
  {
    id: "reel-maine-coon-milestone",
    type: "reel",
    title: "Giant Maine Coon Kitten Growth Milestone (Week 12 Weigh-in)",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: {
      id: "auth-norsecats",
      username: "norsecats",
      displayName: "Valkyrie Maine Coons",
      avatarUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150&auto=format&fit=crop&q=80",
    },
    creature: {
      id: "cr-valkyrie",
      name: "Freya of Valkyrie",
      slug: "luna-c2",
      avatarUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150&auto=format&fit=crop&q=80",
    },
    brand: null,
    group: null,
  },
  {
    id: "reel-dragon-vivarium",
    type: "reel",
    title: "Bioactive Vivarium Setup & Bearded Dragon Morning ASMR Feeding",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: {
      id: "auth-desertdragons",
      username: "desertdragons",
      displayName: "Solstice Reptiles",
      avatarUrl: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=150&auto=format&fit=crop&q=80",
    },
    creature: {
      id: "cr-solaria",
      name: "Solaria",
      slug: "solaria-gecko",
      avatarUrl: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=150&auto=format&fit=crop&q=80",
    },
    brand: null,
    group: null,
  },
  {
    id: "reel-agility-sprint",
    type: "reel",
    title: "K9 Obstacle & Agility Course Sprint Timing",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: {
      id: "auth-apexcanine",
      username: "apexcanine",
      displayName: "Apex Working Dogs",
      avatarUrl: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=150&auto=format&fit=crop&q=80",
    },
    creature: {
      id: "cr-tanto",
      name: "Tanto De Arsenal",
      slug: "biscuit-c3",
      avatarUrl: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=150&auto=format&fit=crop&q=80",
    },
    brand: null,
    group: null,
  },
];

export default async function WatchPage() {
  const dbReels = await getReelQueue(12).catch(() => []);
  const reels = dbReels.length > 0 ? [...dbReels, ...FEATURED_FALLBACK_REELS] : FEATURED_FALLBACK_REELS;

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
              {reels.length} immersive reels ready
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {reels.map((reel) => (
              <Link
                key={reel.id}
                href={reel.id.startsWith("reel-") ? `/compose?tab=reels` : `/watch/reel/${reel.id}`}
                className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-border/80 bg-muted/40 shadow-xs transition hover:border-primary/50 hover:shadow-md cursor-pointer"
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

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
                  <div className="flex items-center justify-between gap-1 text-micro text-white/80">
                    <span className="truncate">@{reel.author.username}</span>
                    {reel.creature && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 text-micro font-medium text-white backdrop-blur-sm hover:bg-white/35 transition"
                        title={`View ${reel.creature.name}'s verified pedigree and health passport`}
                      >
                        🧬 Lineage &amp; Pack
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Quick Publish Invitation Bar */}
          <div className="premium-panel rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-purple-500/20 text-purple-400">
                <Video className="size-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground">Have short-form pet video to share?</h3>
                <p className="text-micro text-muted-foreground">
                  Publish 9:16 working clips or cute pet reels and qualify for Relay fan tip payouts.
                </p>
              </div>
            </div>
            <Link
              href="/compose?tab=reels"
              className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition shrink-0"
            >
              Upload New Reel
            </Link>
          </div>
        </section>
      </div>
    </AppPage>
  );
}

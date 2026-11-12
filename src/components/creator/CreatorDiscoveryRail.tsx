"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Music,
  Award,
  Video,
  ChevronRight,
} from "lucide-react";
import { TipCreatorModal } from "./TipCreatorModal";
import { cn } from "@/lib/utils";

export type FeaturedCreator = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  badge: string;
  bio: string;
  reelsCount: number;
  followersCount: string;
  monthlyTips: string;
};

export type AudioTrack = {
  id: string;
  title: string;
  author: string;
  duration: string;
  usageCount: string;
  tag: string;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  specialty: string;
  weeklyTips: string;
  badgeColor: string;
};

const FEATURED_CREATORS: FeaturedCreator[] = [
  {
    id: "cr-1",
    username: "apexcanine",
    displayName: "Apex Working Dogs",
    avatarUrl: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=150&auto=format&fit=crop&q=80",
    badge: "Verified Master Trainer",
    bio: "Presa Canario & Malinois drive conditioning, Schutzhund drills & bite-work telemetry.",
    reelsCount: 48,
    followersCount: "34.2K",
    monthlyTips: "$1,480",
  },
  {
    id: "cr-2",
    username: "norsecats",
    displayName: "Valkyrie Maine Coons",
    avatarUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150&auto=format&fit=crop&q=80",
    badge: "Champion Cattery Creator",
    bio: "Giant European Maine Coon lineage, raw nutrition recipes & giant kitten milestones.",
    reelsCount: 62,
    followersCount: "28.9K",
    monthlyTips: "$1,120",
  },
  {
    id: "cr-3",
    username: "desertdragons",
    displayName: "Solstice Reptiles",
    avatarUrl: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=150&auto=format&fit=crop&q=80",
    badge: "Herpetology Specialist",
    bio: "Morph genetics, bioactive vivarium builds & bearded dragon feeding ASMR.",
    reelsCount: 35,
    followersCount: "19.5K",
    monthlyTips: "$840",
  },
];

const TRENDING_TRACKS: AudioTrack[] = [
  {
    id: "audio-puppy-sprint",
    title: "Puppy Sprint Play (Original Ambient)",
    author: "Apex Audio Labs",
    duration: "0:28",
    usageCount: "2.4K reels",
    tag: "High Energy",
  },
  {
    id: "audio-coffeetime-purr",
    title: "Morning Sun Purrs & Paws (ASMR Binaural)",
    author: "Valkyrie Soundscapes",
    duration: "0:45",
    usageCount: "1.8K reels",
    tag: "Relaxing ASMR",
  },
  {
    id: "audio-kennel-drill",
    title: "K9 Obstacle Beat (Sync Drop)",
    author: "Scrlpets Beat Vault",
    duration: "0:30",
    usageCount: "940 reels",
    tag: "Training Drill",
  },
];

const FAN_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    username: "apexcanine",
    displayName: "Apex Working Dogs",
    avatarUrl: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=150&auto=format&fit=crop&q=80",
    specialty: "Protection K9 Work",
    weeklyTips: "$540.00",
    badgeColor: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  },
  {
    rank: 2,
    username: "norsecats",
    displayName: "Valkyrie Maine Coons",
    avatarUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=150&auto=format&fit=crop&q=80",
    specialty: "Maine Coon Heritage",
    weeklyTips: "$410.00",
    badgeColor: "text-slate-300 bg-slate-500/15 border-slate-500/30",
  },
  {
    rank: 3,
    username: "desertdragons",
    displayName: "Solstice Reptiles",
    avatarUrl: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=150&auto=format&fit=crop&q=80",
    specialty: "Herpetology Habitat",
    weeklyTips: "$285.00",
    badgeColor: "text-amber-600 bg-amber-700/15 border-amber-700/30",
  },
];

export function CreatorDiscoveryRail() {
  const [activeTipCreator, setActiveTipCreator] = useState<FeaturedCreator | null>(null);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const toggleFollow = (username: string) => {
    setFollowingMap((prev) => ({
      ...prev,
      [username]: !prev[username],
    }));
  };

  return (
    <div className="space-y-6" data-testid="creator-discovery-rail">
      {/* Section 1: Verified Pet Creator Spotlight */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-purple-500/20 text-purple-400">
              <Sparkles className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Verified Creator Spotlights</h2>
              <p className="text-micro text-muted-foreground">
                Animal filmmakers, master trainers &amp; pedigree breed documentarians
              </p>
            </div>
          </div>
          <Link
            href="/settings/creator"
            className="text-micro font-semibold text-brand-link hover:underline inline-flex items-center gap-1"
          >
            <span>Creator Studio</span>
            <ChevronRight className="size-3" />
          </Link>
        </div>

        {/* Creator Cards Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FEATURED_CREATORS.map((creator) => {
            const isFollowing = followingMap[creator.username];
            return (
              <div
                key={creator.id}
                className="group flex flex-col justify-between rounded-xl border border-border/70 bg-card/60 p-3.5 transition hover:border-purple-500/40 hover:bg-card"
                data-testid={`creator-card-${creator.username}`}
              >
                <div>
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={creator.avatarUrl}
                      alt={creator.displayName}
                      className="size-11 rounded-full object-cover ring-2 ring-purple-500/30"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/p/${creator.username}`}
                        className="font-bold text-xs text-foreground hover:underline truncate block"
                      >
                        {creator.displayName}
                      </Link>
                      <span className="text-micro text-muted-foreground block truncate">
                        @{creator.username}
                      </span>
                      <span className="inline-block mt-0.5 rounded-full bg-purple-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-purple-400">
                        {creator.badge}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-micro text-muted-foreground line-clamp-2 leading-relaxed">
                    {creator.bio}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-micro text-muted-foreground border-t border-border/50 pt-2">
                    <span>
                      <strong className="text-foreground">{creator.followersCount}</strong> fans
                    </span>
                    <span>
                      <strong className="text-foreground">{creator.reelsCount}</strong> reels
                    </span>
                  </div>
                </div>

                {/* Actions: Follow & Tip */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFollow(creator.username)}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer",
                      isFollowing
                        ? "border border-border bg-muted/60 text-foreground hover:bg-muted"
                        : "bg-primary text-primary-foreground hover:opacity-90",
                    )}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTipCreator(creator)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition cursor-pointer"
                    data-testid={`tip-creator-${creator.username}`}
                  >
                    <span>⭐️ Tip</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 2: Trending Audio Remix Explorer */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <Music className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Trending Audio &amp; Soundtracks</h2>
              <p className="text-micro text-muted-foreground">
                Remix trending pet audio clips into your next short-form video reel
              </p>
            </div>
          </div>
          <Link
            href="/compose?tab=reels"
            className="rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-micro font-semibold text-primary hover:bg-primary/20 transition inline-flex items-center gap-1"
          >
            <Video className="size-3" />
            <span>Create Reel</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {TRENDING_TRACKS.map((track) => (
            <div
              key={track.id}
              className="flex flex-col justify-between rounded-xl border border-border/70 bg-card/60 p-3 hover:border-emerald-500/40 transition"
              data-testid={`audio-track-${track.id}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Music className="size-3.5" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-xs text-foreground truncate max-w-[160px]">
                        {track.title}
                      </h3>
                      <p className="text-micro text-muted-foreground">
                        {track.author} &middot; {track.duration}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-micro font-medium text-emerald-400">
                    {track.tag}
                  </span>
                </div>

                <div className="mt-2 text-micro text-muted-foreground">
                  Used in <strong className="text-foreground">{track.usageCount}</strong>
                </div>
              </div>

              <div className="mt-3">
                <Link
                  href={`/compose?tab=reels&audio=${encodeURIComponent(track.id)}`}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition"
                >
                  <Sparkles className="size-3" />
                  <span>Use Audio in Reel</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Fan Tipping Leaderboard & Creator Monetization */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
              <Award className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Weekly Fan Tipping Leaderboard</h2>
              <p className="text-micro text-muted-foreground">
                Top community-supported pet creators &middot; Direct weekly deposit payout
              </p>
            </div>
          </div>
          <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-micro text-muted-foreground">
            Cycle ends in 2 days
          </span>
        </div>

        <div className="space-y-2">
          {FAN_LEADERBOARD.map((item) => (
            <div
              key={item.rank}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-xs"
              data-testid={`leaderboard-rank-${item.rank}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border text-micro font-bold",
                    item.badgeColor,
                  )}
                >
                  {item.rank}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.avatarUrl}
                  alt={item.displayName}
                  className="size-8 rounded-full object-cover"
                />
                <div>
                  <Link
                    href={`/p/${item.username}`}
                    className="font-bold text-foreground hover:underline block"
                  >
                    {item.displayName}
                  </Link>
                  <span className="text-micro text-muted-foreground">
                    @{item.username} &middot; {item.specialty}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-micro text-muted-foreground block">Weekly Tips</span>
                  <span className="font-bold text-amber-400 font-mono">{item.weeklyTips}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setActiveTipCreator({
                      id: `cr-${item.rank}`,
                      username: item.username,
                      displayName: item.displayName,
                      avatarUrl: item.avatarUrl,
                      badge: item.specialty,
                      bio: "",
                      reelsCount: 0,
                      followersCount: "",
                      monthlyTips: item.weeklyTips,
                    })
                  }
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-micro font-bold text-amber-300 hover:bg-amber-500/20 transition cursor-pointer"
                >
                  Tip
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tip Creator Modal Integration */}
      {activeTipCreator && (
        <TipCreatorModal
          creatorUsername={activeTipCreator.username}
          creatorName={activeTipCreator.displayName}
          onClose={() => setActiveTipCreator(null)}
        />
      )}
    </div>
  );
}

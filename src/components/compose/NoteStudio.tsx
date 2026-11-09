"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Smile, Music, Clock, Check, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const MOODS = [
  { emoji: "🐾", label: "Playful" },
  { emoji: "💤", label: "Sleeping" },
  { emoji: "🎾", label: "Active" },
  { emoji: "🦴", label: "Snacking" },
  { emoji: "🎓", label: "Training" },
  { emoji: "🩺", label: "Resting" },
  { emoji: "🏖️", label: "Exploring" },
  { emoji: "❤️", label: "Cuddling" },
];

const TRACKS = [
  { id: "1", title: "Lofi Paws", artist: "Scrlpets Chill", duration: "0:30" },
  { id: "2", title: "Sunny Afternoon Wag", artist: "Acoustic Canine", duration: "0:30" },
  { id: "3", title: "Purr & Rain", artist: "Feline Ambient", duration: "0:30" },
  { id: "4", title: "Puppy Joy Ride", artist: "Upbeat Beats", duration: "0:30" },
];

export function NoteStudio({
  actorName,
  avatarUrl,
}: {
  userId: string;
  actorName: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const [thought, setThought] = useState("");
  const [selectedMood, setSelectedMood] = useState(MOODS[0]);
  const [selectedTrack, setSelectedTrack] = useState<typeof TRACKS[0] | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [audience, setAudience] = useState<"friends" | "followers">("friends");
  const [published, setPublished] = useState(false);

  const charLimit = 60;
  const charsLeft = charLimit - thought.length;

  function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!thought.trim()) return;
    setPublished(true);
    setTimeout(() => {
      router.push("/");
    }, 800);
  }

  return (
    <div className="space-y-6 pt-2" data-testid="note-studio">
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Share a 24-Hour Note</h2>
            <p className="text-meta text-muted-foreground">
              A quick thought bubble visible to friends for 24 hours
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-1 text-micro font-semibold text-accent">
            <Clock className="size-3" />
            24 Hours
          </span>
        </div>

        {/* Live Preview Bubble */}
        <div className="mt-6 flex flex-col items-center justify-center p-6 rounded-2xl border border-border/60 bg-muted/40">
          <div className="relative flex flex-col items-center">
            {/* Thought Bubble */}
            <div className="relative mb-2 max-w-xs rounded-2xl border border-border bg-card px-4 py-2.5 shadow-md text-center">
              <span className="text-sm font-medium text-foreground">
                {thought.trim() ? thought : "What's on your pet's mind today?"}
              </span>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 size-3 rotate-45 border-r border-b border-border bg-card" />
              <div className="mt-1 flex items-center justify-center gap-1.5 text-micro text-muted-foreground">
                <span>{selectedMood.emoji} {selectedMood.label}</span>
                {selectedTrack && (
                  <span className="text-brand-link flex items-center gap-0.5">
                    <Music className="size-2.5" />
                    {selectedTrack.title}
                  </span>
                )}
              </div>
            </div>

            {/* Avatar with Mood Bubble */}
            <div className="relative mt-1">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 rounded-full object-cover ring-2 ring-primary/40"
                />
              ) : (
                <div className="grid size-14 place-items-center rounded-full bg-primary/20 text-lg font-bold text-brand-link ring-2 ring-primary/40">
                  {actorName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-card border border-border text-xs shadow-xs">
                {selectedMood.emoji}
              </span>
            </div>
            <span className="mt-2 text-xs font-semibold text-muted-foreground">{actorName}</span>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handlePublish} className="mt-5 space-y-4">
          <div>
            <div className="flex items-center justify-between pb-1">
              <label htmlFor="note-text" className="text-xs font-medium text-foreground">
                Your 24-hour thought
              </label>
              <span
                className={cn(
                  "text-micro font-medium",
                  charsLeft < 10 ? "text-accent font-semibold" : "text-muted-foreground"
                )}
              >
                {charsLeft} chars remaining
              </span>
            </div>
            <input
              id="note-text"
              type="text"
              maxLength={charLimit}
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              placeholder="e.g., Milo learned to catch a frisbee! 🥏"
              className="w-full min-h-12 rounded-xl border border-input bg-background px-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="note-input-text"
            />
          </div>

          {/* Interactive Picker Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMoodPicker(!showMoodPicker);
                setShowMusicPicker(false);
              }}
              className="flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground hover:bg-muted transition"
              data-testid="note-toggle-mood"
            >
              <Smile className="size-3.5 text-accent" />
              <span>Mood: {selectedMood.emoji} {selectedMood.label}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowMusicPicker(!showMusicPicker);
                setShowMoodPicker(false);
              }}
              className="flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground hover:bg-muted transition"
              data-testid="note-toggle-music"
            >
              <Music className="size-3.5 text-brand-link" />
              <span>{selectedTrack ? selectedTrack.title : "Add Song"}</span>
            </button>

            <div className="flex items-center gap-1 rounded-lg border border-input bg-card p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAudience("friends")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition font-medium",
                  audience === "friends" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Friends
              </button>
              <button
                type="button"
                onClick={() => setAudience("followers")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition font-medium",
                  audience === "followers" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Followers
              </button>
            </div>
          </div>

          {/* Mood Selector Drawer */}
          {showMoodPicker && (
            <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm" data-testid="mood-picker">
              <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Select your pet&apos;s mood
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => {
                      setSelectedMood(m);
                      setShowMoodPicker(false);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl border transition",
                      selectedMood.label === m.label
                        ? "border-primary bg-primary/15 text-brand-link"
                        : "border-border/60 hover:bg-muted/50"
                    )}
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <span className="text-micro font-medium truncate w-full text-center">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Music Selector Drawer */}
          {showMusicPicker && (
            <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm" data-testid="music-picker">
              <div className="flex items-center justify-between mb-2">
                <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                  Pick a 30s background track
                </p>
                {selectedTrack && (
                  <button
                    type="button"
                    onClick={() => setSelectedTrack(null)}
                    className="text-micro text-destructive hover:underline"
                  >
                    Remove song
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {TRACKS.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => {
                      setSelectedTrack(track);
                      setShowMusicPicker(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between p-2 rounded-xl border text-left transition",
                      selectedTrack?.id === track.id
                        ? "border-primary bg-primary/15"
                        : "border-border/60 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 place-items-center rounded-lg bg-primary/20 text-brand-link">
                        <Music className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{track.title}</p>
                        <p className="text-micro text-muted-foreground">{track.artist}</p>
                      </div>
                    </div>
                    <span className="text-micro text-muted-foreground">{track.duration}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action button */}
          <button
            type="submit"
            disabled={!thought.trim() || published}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            data-testid="submit-note-btn"
          >
            {published ? (
              <>
                <Check className="size-4" />
                <span>Note Shared to Friends!</span>
              </>
            ) : (
              <>
                <Send className="size-4" />
                <span>Share Note (24 Hours)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

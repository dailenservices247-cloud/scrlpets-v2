"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Type,
  Image as ImageIcon,
  Music,
  Repeat,
  LayoutGrid,
  Camera,
  Globe,
  Users,
  Star,
  Check,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORY_THEMES = [
  { id: "amber", name: "Sunset Amber", bg: "from-amber-600 via-orange-600 to-rose-700" },
  { id: "forest", name: "Deep Forest", bg: "from-emerald-700 via-teal-800 to-stone-900" },
  { id: "indigo", name: "Midnight Indigo", bg: "from-indigo-900 via-purple-900 to-slate-950" },
  { id: "berry", name: "Neon Berry", bg: "from-rose-600 via-pink-700 to-purple-800" },
  { id: "dark", name: "Scrlpets Velvet", bg: "from-[#202124] to-[#121316]" },
];

const FONTS = [
  { id: "sans", name: "Modern", className: "font-sans" },
  { id: "serif", name: "Classic", className: "font-serif" },
  { id: "mono", name: "Technical", className: "font-mono" },
];

export function StoryStudio({
  actorName,
}: {
  userId: string;
  actorName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"media" | "text">("media");
  const [textContent, setTextContent] = useState("");
  const [selectedTheme, setSelectedTheme] = useState(STORY_THEMES[0]);
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);
  const [boomerang, setBoomerang] = useState(false);
  const [collageLayout, setCollageLayout] = useState<"single" | "2-split" | "4-grid">("single");
  const [musicTrack, setMusicTrack] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<"public" | "followers" | "close_friends">("public");
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [published, setPublished] = useState(false);

  function handleAddMockPhoto() {
    if (mediaFiles.length >= 4) return;
    const mockPhotos = [
      "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80",
    ];
    setMediaFiles([...mediaFiles, mockPhotos[mediaFiles.length % mockPhotos.length]]);
  }

  function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setPublished(true);
    setTimeout(() => {
      router.push("/");
    }, 800);
  }

  return (
    <div className="space-y-6 pt-2" data-testid="story-studio">
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Create Story</h2>
            <p className="text-meta text-muted-foreground">
              Photos, collages, and moments that stay on your profile for 24 hours
            </p>
          </div>
          {/* Privacy Dropdown Pill */}
          <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-card p-1 text-xs">
            <button
              type="button"
              onClick={() => setPrivacy("public")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg transition font-medium",
                privacy === "public" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Globe className="size-3" />
              Public
            </button>
            <button
              type="button"
              onClick={() => setPrivacy("followers")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg transition font-medium",
                privacy === "followers" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="size-3" />
              Followers
            </button>
            <button
              type="button"
              onClick={() => setPrivacy("close_friends")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg transition font-medium",
                privacy === "close_friends" ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Star className="size-3" />
              Close Friends
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("media")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition",
              mode === "media"
                ? "border-primary bg-primary/15 text-brand-link"
                : "border-border/70 bg-card text-muted-foreground hover:bg-muted"
            )}
            data-testid="story-mode-media"
          >
            <ImageIcon className="size-4" />
            <span>Photo / Video Story</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition",
              mode === "text"
                ? "border-primary bg-primary/15 text-brand-link"
                : "border-border/70 bg-card text-muted-foreground hover:bg-muted"
            )}
            data-testid="story-mode-text"
          >
            <Type className="size-4" />
            <span>Text Story</span>
          </button>
        </div>

        {/* Story Canvas / Preview */}
        <div className="mt-5 flex justify-center">
          <div
            className={cn(
              "relative aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-3xl border border-border shadow-2xl flex flex-col justify-between p-4 bg-gradient-to-br",
              mode === "text" ? selectedTheme.bg : "bg-black"
            )}
            data-testid="story-canvas"
          >
            {/* Top Bar with User Info */}
            <div className="relative z-10 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-white/20 text-xs font-bold backdrop-blur-xs">
                  {actorName.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-xs font-semibold drop-shadow-md">{actorName}</span>
              </div>
              {musicTrack && (
                <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-micro font-medium backdrop-blur-xs">
                  <Music className="size-2.5" />
                  {musicTrack}
                </span>
              )}
            </div>

            {/* Canvas Body */}
            {mode === "text" ? (
              <div className="flex flex-1 items-center justify-center text-center p-3">
                <p
                  className={cn(
                    "text-lg font-bold text-white drop-shadow-md break-words w-full",
                    selectedFont.className
                  )}
                >
                  {textContent.trim() ? textContent : "Tap below to type your story..."}
                </p>
              </div>
            ) : (
              <div className="absolute inset-0 z-0 flex items-center justify-center">
                {mediaFiles.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 p-4 text-center text-muted-foreground">
                    <Camera className="size-8 text-white/50" />
                    <p className="text-xs text-white/70">No media selected yet</p>
                  </div>
                ) : collageLayout === "single" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaFiles[0]}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : collageLayout === "2-split" ? (
                  <div className="grid size-full grid-rows-2 gap-1 bg-black">
                    {mediaFiles.slice(0, 2).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt="" className="size-full object-cover" />
                    ))}
                  </div>
                ) : (
                  <div className="grid size-full grid-cols-2 grid-rows-2 gap-1 bg-black">
                    {mediaFiles.slice(0, 4).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt="" className="size-full object-cover" />
                    ))}
                  </div>
                )}
                {boomerang && (
                  <span className="absolute bottom-4 left-4 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-micro font-bold text-amber-300 backdrop-blur-xs">
                    <Repeat className="size-3" />
                    Looping
                  </span>
                )}
              </div>
            )}

            {/* Bottom Status */}
            <div className="relative z-10 text-center text-micro text-white/70">
              24-Hour Expiration
            </div>
          </div>
        </div>

        {/* Modality Specific Controls */}
        {mode === "text" ? (
          <div className="mt-5 space-y-4">
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="What's happening right now?"
              className="w-full min-h-24 rounded-xl border border-input bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="story-text-input"
            />
            {/* Themes */}
            <div>
              <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Gradient Background
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {STORY_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme)}
                    className={cn(
                      "size-8 shrink-0 rounded-full bg-gradient-to-br transition ring-offset-2 ring-offset-background",
                      theme.bg,
                      selectedTheme.id === theme.id ? "ring-2 ring-primary" : "hover:opacity-80"
                    )}
                    aria-label={theme.name}
                  />
                ))}
              </div>
            </div>

            {/* Font Style */}
            <div>
              <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Font Style
              </p>
              <div className="flex gap-2">
                {FONTS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => setSelectedFont(font)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-semibold transition",
                      selectedFont.id === font.id
                        ? "border-primary bg-primary/15 text-brand-link"
                        : "border-border/70 bg-card hover:bg-muted"
                    )}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Media Story Tools: Boomerang, Collage, Music, Camera Roll */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddMockPhoto}
                className="flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground hover:bg-muted transition"
                data-testid="story-add-photo"
              >
                <Upload className="size-3.5 text-blue-400" />
                <span>Add Photo ({mediaFiles.length}/4)</span>
              </button>

              <button
                type="button"
                onClick={() => setBoomerang(!boomerang)}
                className={cn(
                  "flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition",
                  boomerang
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                    : "border-input bg-card text-foreground hover:bg-muted"
                )}
                data-testid="story-toggle-boomerang"
              >
                <Repeat className="size-3.5" />
                <span>Boomerang</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (collageLayout === "single") setCollageLayout("2-split");
                  else if (collageLayout === "2-split") setCollageLayout("4-grid");
                  else setCollageLayout("single");
                }}
                className={cn(
                  "flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition",
                  collageLayout !== "single"
                    ? "border-primary bg-primary/15 text-brand-link"
                    : "border-input bg-card text-foreground hover:bg-muted"
                )}
                data-testid="story-toggle-collage"
              >
                <LayoutGrid className="size-3.5" />
                <span>Layout: {collageLayout}</span>
              </button>

              <button
                type="button"
                onClick={() => setMusicTrack(musicTrack ? null : "Upbeat Paws 🎵")}
                className={cn(
                  "flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition",
                  musicTrack
                    ? "border-rose-500/50 bg-rose-500/15 text-rose-400"
                    : "border-input bg-card text-foreground hover:bg-muted"
                )}
                data-testid="story-toggle-music"
              >
                <Music className="size-3.5" />
                <span>{musicTrack ?? "Add Sound"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Submit Story */}
        <button
          type="button"
          onClick={handlePublish}
          disabled={published}
          className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          data-testid="submit-story-btn"
        >
          {published ? (
            <>
              <Check className="size-4" />
              <span>Story Published!</span>
            </>
          ) : (
            <span>Share to Story</span>
          )}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Clapperboard,
  Music,
  FileEdit,
  Wand2,
  Sparkles,
  Check,
  Play,
  Upload,
  DollarSign,
  Tag,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  { id: "beat-drop", name: "Fast Beat Drop", clips: "4 clips", duration: "12s" },
  { id: "glow-up", name: "Puppy Glow-Up", clips: "2 clips", duration: "15s" },
  { id: "agility", name: "Agility & Sprint", clips: "6 clips", duration: "20s" },
  { id: "chill", name: "Cozy Day Recap", clips: "3 clips", duration: "18s" },
];

const EFFECTS = [
  { id: "none", name: "Original" },
  { id: "golden", name: "Golden Hour" },
  { id: "vibrant", name: "Vibrant Paws" },
  { id: "greenscreen", name: "Green Screen" },
];

export function ReelStudio({
  actorName,
}: {
  userId: string;
  actorName: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null);
  const [selectedEffect, setSelectedEffect] = useState(EFFECTS[0]);
  const [selectedAudio, setSelectedAudio] = useState<string | null>("Trending Pet Beats #1 🎶");
  const [caption, setCaption] = useState("");
  const [allowRemix, setAllowRemix] = useState(true);
  const [autoCaptions, setAutoCaptions] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);
  const [published, setPublished] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "monetization" | "templates" | "drafts" | "settings">("create");

  // Video File State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  // Monetization & Dossier Tagging
  const [enableMonetization, setEnableMonetization] = useState(true);
  const [enableFanTips, setEnableFanTips] = useState(true);
  const [isSponsored, setIsSponsored] = useState(false);
  const [sponsorBrand, setSponsorBrand] = useState("");
  const [taggedCreature, setTaggedCreature] = useState("Big Meech (Presa Canario)");
  const [linkPedigreeDossier, setLinkPedigreeDossier] = useState(true);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreviewUrl(url);
    }
  }

  function handleSaveDraft() {
    setHasDraft(true);
  }

  function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setPublished(true);
    setTimeout(() => {
      router.push("/");
    }, 800);
  }

  return (
    <div className="space-y-6 pt-2" data-testid="reel-studio">
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
        {/* Header Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Reels Studio</h2>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.2 text-micro font-semibold text-amber-300">
                Creator &amp; Monetized
              </span>
            </div>
            <p className="text-meta text-muted-foreground">
              Create and monetize short-form videos with fan tips, music, and pedigree tags
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/80 bg-card p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition font-medium",
                activeTab === "create" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Studio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("monetization")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1",
                activeTab === "monetization" ? "bg-amber-500/20 text-amber-300" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <DollarSign className="size-3" />
              <span>Monetize</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("templates")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition font-medium",
                activeTab === "templates" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Templates
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("drafts")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition font-medium",
                activeTab === "drafts" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Drafts {hasDraft ? "(1)" : ""}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition font-medium",
                activeTab === "settings" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Settings
            </button>
          </div>
        </div>

        {activeTab === "create" && (
          <div className="mt-4 space-y-4">
            {/* Viewfinder Preview */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-3xl border border-border bg-black shadow-2xl flex flex-col justify-between p-4 cursor-pointer group"
              data-testid="reel-viewfinder"
            >
              {videoPreviewUrl ? (
                <video
                  src={videoPreviewUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 size-full object-cover"
                />
              ) : null}

              {/* Gradient Overlay for controls */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between text-white text-xs">
                <span className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs font-semibold">
                  <Clapperboard className="size-3 text-brand-link" />
                  Reel
                </span>
                {enableFanTips && (
                  <span className="flex items-center gap-1 bg-rose-500/80 px-2 py-0.5 rounded-full backdrop-blur-xs text-micro font-semibold">
                    <Heart className="size-2.5 text-white" />
                    Fan Tips On
                  </span>
                )}
              </div>

              {/* Center Camera Mock / Effect Display */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center">
                {videoPreviewUrl ? (
                  <div className="grid size-12 place-items-center rounded-full bg-white/20 border border-white/30 text-white backdrop-blur-xs opacity-75 group-hover:opacity-100 transition">
                    <Play className="size-5 text-white ml-0.5" />
                  </div>
                ) : (
                  <div className="grid size-14 place-items-center rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-xs group-hover:bg-white/20 transition">
                    <Upload className="size-6 text-white" />
                  </div>
                )}
                <span className="mt-2 text-micro font-medium text-white/90">
                  {videoFile ? videoFile.name : "Tap to upload video from phone or library"}
                </span>
                <span className="text-micro text-white/60">Supports MP4, MOV, WebM (9:16)</span>
              </div>

              {/* Bottom Captions & User */}
              <div className="relative z-10 text-white text-xs space-y-1">
                {linkPedigreeDossier && taggedCreature && (
                  <span className="inline-flex items-center gap-1 bg-primary/80 px-2 py-0.5 rounded-full text-micro font-semibold backdrop-blur-xs">
                    <Tag className="size-2.5" />
                    {taggedCreature}
                  </span>
                )}
                <p className="font-semibold">{actorName}</p>
                <p className="text-meta text-white/80 line-clamp-2">
                  {caption.trim() ? caption : "Add a reel caption..."}
                </p>
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={handleFileChange}
              className="hidden"
              data-testid="reel-file-input"
            />

            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
                data-testid="reel-upload-btn"
              >
                <Upload className="size-3.5 text-brand-link" />
                <span>{videoFile ? "Change Video" : "Select Video File"}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAudio(selectedAudio ? null : "Upbeat Paws Rhythm 🐾")}
                className="flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
                data-testid="reel-audio-btn"
              >
                <Music className="size-3.5 text-brand-link" />
                <span>{selectedAudio ?? "Choose Audio"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextIndex = (EFFECTS.findIndex((e) => e.id === selectedEffect.id) + 1) % EFFECTS.length;
                  setSelectedEffect(EFFECTS[nextIndex]);
                }}
                className="flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
                data-testid="reel-effect-btn"
              >
                <Wand2 className="size-3.5 text-brand-link" />
                <span>Effect: {selectedEffect.name}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDraft}
                className="flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
                data-testid="reel-draft-btn"
              >
                <FileEdit className="size-3.5 text-muted-foreground" />
                <span>Save Draft</span>
              </button>
            </div>

            {/* Caption Input */}
            <div>
              <label htmlFor="reel-caption" className="text-xs font-medium text-foreground pb-1 block">
                Reel Caption &amp; Hashtags
              </label>
              <textarea
                id="reel-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption... e.g. #puppylove #dogtraining #scrlpets #presacanario"
                className="w-full min-h-20 rounded-xl border border-input bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="reel-caption-input"
              />
            </div>
          </div>
        )}

        {/* Monetization & Pedigree Tagging Tab */}
        {activeTab === "monetization" && (
          <div className="mt-4 space-y-4" data-testid="reel-monetization-panel">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-foreground">Creator Monetization Engine</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Earn fan tips and in-stream revenue on this reel, direct-deposited to your Relay Financial account.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card">
                <div>
                  <p className="text-xs font-semibold text-foreground">Enable Fan Tips &amp; Stars</p>
                  <p className="text-micro text-muted-foreground">Allow viewers to send $2, $5, or $10 micro-tips</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableFanTips}
                  onChange={(e) => setEnableFanTips(e.target.checked)}
                  className="size-4 rounded border-input text-primary accent-primary"
                  data-testid="toggle-fan-tips-reel"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card">
                <div>
                  <p className="text-xs font-semibold text-foreground">In-Stream Ad Revenue Share</p>
                  <p className="text-micro text-muted-foreground">Receive 70% net share of sponsor impressions on this clip</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableMonetization}
                  onChange={(e) => setEnableMonetization(e.target.checked)}
                  className="size-4 rounded border-input text-primary accent-primary"
                  data-testid="toggle-ad-rev-reel"
                />
              </div>

              {/* Tag Pedigree Dossier */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Tag Animal / Pedigree Dossier</p>
                    <p className="text-micro text-muted-foreground">
                      Surfaces a clickable &ldquo;View Pedigree &amp; Lineage&rdquo; pill directly on the video
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={linkPedigreeDossier}
                    onChange={(e) => setLinkPedigreeDossier(e.target.checked)}
                    className="size-4 rounded border-input text-primary accent-primary"
                  />
                </div>
                {linkPedigreeDossier && (
                  <input
                    value={taggedCreature}
                    onChange={(e) => setTaggedCreature(e.target.value)}
                    placeholder="Search your creatures... e.g. Big Meech"
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground"
                    data-testid="tagged-creature-input"
                  />
                )}
              </div>

              {/* Sponsorship disclosure */}
              <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Paid Partnership Disclosure</p>
                    <p className="text-micro text-muted-foreground">
                      Complies with FTC guidelines for sponsored animal products or supplements
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSponsored}
                    onChange={(e) => setIsSponsored(e.target.checked)}
                    className="size-4 rounded border-input text-primary accent-primary"
                  />
                </div>
                {isSponsored && (
                  <input
                    value={sponsorBrand}
                    onChange={(e) => setSponsorBrand(e.target.value)}
                    placeholder="Sponsoring brand name (e.g. Victor Super Premium Pet Food)"
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="mt-4 space-y-3" data-testid="reel-templates-panel">
            <p className="text-xs text-muted-foreground">
              Select a pre-timed beat template to assemble your pet clips automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(tmpl);
                    setActiveTab("create");
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border text-left transition",
                    selectedTemplate?.id === tmpl.id
                      ? "border-primary bg-primary/15"
                      : "border-border/70 bg-card hover:bg-muted/50"
                  )}
                >
                  <div>
                    <p className="text-xs font-semibold text-foreground">{tmpl.name}</p>
                    <p className="text-micro text-muted-foreground">{tmpl.clips} · {tmpl.duration}</p>
                  </div>
                  <Sparkles className="size-4 text-brand-link" />
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "drafts" && (
          <div className="mt-4 space-y-3" data-testid="reel-drafts-panel">
            {hasDraft ? (
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card">
                <div>
                  <p className="text-xs font-semibold text-foreground">Draft Reel #1</p>
                  <p className="text-micro text-muted-foreground">Saved today with audio: {selectedAudio}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("create")}
                  className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-brand-link hover:bg-muted"
                >
                  Resume
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground p-6 text-center border border-dashed rounded-xl">
                No saved drafts yet.
              </p>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="mt-4 space-y-3" data-testid="reel-settings-panel">
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card">
              <div>
                <p className="text-xs font-semibold text-foreground">Auto-generate Captions</p>
                <p className="text-micro text-muted-foreground">Automatically transcribe audio speech</p>
              </div>
              <input
                type="checkbox"
                checked={autoCaptions}
                onChange={(e) => setAutoCaptions(e.target.checked)}
                className="size-4 rounded border-input text-primary"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card">
              <div>
                <p className="text-xs font-semibold text-foreground">Allow Remix &amp; Stitches</p>
                <p className="text-micro text-muted-foreground">Let others create duets with your pet clip</p>
              </div>
              <input
                type="checkbox"
                checked={allowRemix}
                onChange={(e) => setAllowRemix(e.target.checked)}
                className="size-4 rounded border-input text-primary"
              />
            </div>
          </div>
        )}

        {/* Submit Action */}
        <button
          type="button"
          onClick={handlePublish}
          disabled={published}
          className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          data-testid="submit-reel-btn"
        >
          {published ? (
            <>
              <Check className="size-4" />
              <span>Reel Published &amp; Monetized!</span>
            </>
          ) : (
            <span>Share &amp; Monetize Reel</span>
          )}
        </button>
      </div>
    </div>
  );
}

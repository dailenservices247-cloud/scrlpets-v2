"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clapperboard,
  Music,
  FileEdit,
  Wand2,
  Sparkles,
  Check,
  Play,
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
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null);
  const [selectedEffect, setSelectedEffect] = useState(EFFECTS[0]);
  const [selectedAudio, setSelectedAudio] = useState<string | null>("Trending Pet Beats #1 🎶");
  const [caption, setCaption] = useState("");
  const [allowRemix, setAllowRemix] = useState(true);
  const [autoCaptions, setAutoCaptions] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);
  const [published, setPublished] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "templates" | "drafts" | "settings">("create");

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
            <h2 className="text-base font-semibold text-foreground">Reels Studio</h2>
            <p className="text-meta text-muted-foreground">
              Create short-form pet video reels with music, effects, and templates
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-card p-1 text-xs">
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
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-3xl border border-border bg-black shadow-2xl flex flex-col justify-between p-4">
              <div className="flex items-center justify-between text-white text-xs">
                <span className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-xs font-semibold">
                  <Clapperboard className="size-3" />
                  Reel
                </span>
                {selectedAudio && (
                  <span className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-xs text-micro truncate max-w-[140px]">
                    <Music className="size-2.5 text-brand-link shrink-0" />
                    {selectedAudio}
                  </span>
                )}
              </div>

              {/* Center Camera Mock / Effect Display */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="grid size-14 place-items-center rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-xs">
                  <Play className="size-6 text-white ml-0.5" />
                </div>
                <span className="mt-2 text-micro font-medium text-white/80">
                  {selectedEffect.id !== "none" ? `Effect: ${selectedEffect.name}` : "Tap record or upload"}
                </span>
              </div>

              {/* Bottom Captions & User */}
              <div className="text-white text-xs">
                <p className="font-semibold">{actorName}</p>
                <p className="text-meta text-white/80 line-clamp-2 mt-0.5">
                  {caption.trim() ? caption : "Add a reel caption..."}
                </p>
              </div>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
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
                Reel Caption & Hashtags
              </label>
              <textarea
                id="reel-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption... e.g. #puppylove #dogtraining #scrlpets"
                className="w-full min-h-20 rounded-xl border border-input bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="reel-caption-input"
              />
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
                <p className="text-xs font-semibold text-foreground">Allow Remix & Stitches</p>
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
              <span>Reel Published!</span>
            </>
          ) : (
            <span>Share Reel</span>
          )}
        </button>
      </div>
    </div>
  );
}

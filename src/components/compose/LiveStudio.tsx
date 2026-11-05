"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Radio,
  Video,
  KeyRound,
  Copy,
  Check,
  Users,
  MessageSquare,
  Tv,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Canine Training & Play",
  "Puppy & Litter Cam",
  "Feline Habitat & Play",
  "Grooming & Coat Care",
  "Show Dog & Ring Prep",
  "Equine & Barn Life",
  "Exotics & Reptiles",
  "Community Q&A",
];

export function LiveStudio({
  actorName,
}: {
  userId: string;
  actorName: string;
}) {
  const router = useRouter();
  const [streamTitle, setStreamTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [streamMode, setStreamMode] = useState<"camera" | "rtmp">("camera");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  const streamUrl = "rtmps://live.scrlpets.com:443/app";
  const streamKey = "sk_live_scrl_" + actorName.toLowerCase().replace(/[^a-z0-9]/g, "") + "_99f24";

  function handleCopyKey() {
    navigator.clipboard?.writeText?.(streamKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function handleToggleBroadcast() {
    if (!isBroadcasting) {
      setIsBroadcasting(true);
      setViewerCount(14);
    } else {
      setIsBroadcasting(false);
      setViewerCount(0);
      router.push("/");
    }
  }

  return (
    <div className="space-y-6 pt-2" data-testid="live-studio">
      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Scrlpets Live Broadcast Studio</h2>
            <p className="text-meta text-muted-foreground">
              Stream live video to your followers or connect professional broadcast software
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {isBroadcasting ? (
              <span className="flex items-center gap-1.5 rounded-full border border-red-500/50 bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">
                <span className="size-2 rounded-full bg-red-500" />
                LIVE ({viewerCount} viewers)
              </span>
            ) : (
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                Offline
              </span>
            )}
          </div>
        </div>

        {/* Mode Selector */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setStreamMode("camera")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition",
              streamMode === "camera"
                ? "border-red-500/50 bg-red-500/15 text-red-400"
                : "border-border/70 bg-card text-muted-foreground hover:bg-muted"
            )}
            data-testid="live-mode-camera"
          >
            <Video className="size-4" />
            <span>Webcam / Device Camera</span>
          </button>
          <button
            type="button"
            onClick={() => setStreamMode("rtmp")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition",
              streamMode === "rtmp"
                ? "border-red-500/50 bg-red-500/15 text-red-400"
                : "border-border/70 bg-card text-muted-foreground hover:bg-muted"
            )}
            data-testid="live-mode-rtmp"
          >
            <Tv className="size-4" />
            <span>OBS / RTMP Encoder</span>
          </button>
        </div>

        {/* Studio Viewfinder Preview */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black flex flex-col justify-between p-4 shadow-xl">
            <div className="flex items-center justify-between text-white text-xs">
              <span className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs font-semibold">
                <Radio className="size-3 text-red-500" />
                {isBroadcasting ? "ON AIR" : "STREAM PREVIEW"}
              </span>
              {isBroadcasting && (
                <span className="flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                  <Users className="size-3 text-brand-link" />
                  {viewerCount} watching
                </span>
              )}
            </div>

            <div className="flex flex-col items-center justify-center text-center">
              <div className="grid size-14 place-items-center rounded-full bg-white/10 border border-white/20 text-white backdrop-blur-xs">
                <Video className="size-6 text-white" />
              </div>
              <p className="mt-2 text-xs font-medium text-white/80">
                {isBroadcasting
                  ? "Broadcasting Live Video"
                  : streamMode === "camera"
                  ? "Camera ready — click 'Go Live' below"
                  : "Connect your RTMP stream key in OBS"}
              </p>
            </div>

            <div className="text-white text-xs bg-gradient-to-t from-black/80 to-transparent p-2 -mx-4 -mb-4">
              <p className="font-semibold">{streamTitle.trim() ? streamTitle : "Live Animal Stream"}</p>
              <p className="text-micro text-white/70">{category} · {actorName}</p>
            </div>
          </div>

          {/* Live Chat Drawer */}
          <div className="rounded-2xl border border-border/70 bg-card p-3 flex flex-col justify-between h-56 lg:h-auto">
            <div>
              <div className="flex items-center gap-1.5 pb-2 border-b border-border/60 text-xs font-semibold text-foreground">
                <MessageSquare className="size-3.5 text-brand-link" />
                <span>Live Chat</span>
              </div>
              <div className="mt-2 space-y-2 text-xs">
                <div className="rounded-lg bg-muted/40 p-2 text-muted-foreground text-micro">
                  <span className="font-semibold text-foreground">Scrlpets Bot:</span> Welcome to the stream! Keep the chat supportive and respectful of animals.
                </div>
                {isBroadcasting && (
                  <>
                    <div className="rounded-lg bg-muted/20 p-2 text-micro">
                      <span className="font-semibold text-brand-link">SarahPaws:</span> Aww look at that pup! 🐶
                    </div>
                    <div className="rounded-lg bg-muted/20 p-2 text-micro">
                      <span className="font-semibold text-emerald-400">GoldenClub:</span> Hello from Ohio! Great setup.
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="pt-2 border-t border-border/60">
              <input
                type="text"
                disabled={!isBroadcasting}
                placeholder={isBroadcasting ? "Send a message..." : "Chat opens when live"}
                className="w-full rounded-lg border border-input bg-muted/30 px-2.5 py-1.5 text-xs focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* RTMP Setup Details */}
        {streamMode === "rtmp" && (
          <div className="mt-5 space-y-3 rounded-xl border border-border/80 bg-card p-4" data-testid="rtmp-setup-box">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <KeyRound className="size-4 text-amber-400" />
              <span>Broadcast Software Setup (OBS, GoPro, Streamlabs)</span>
            </div>
            <div>
              <label className="text-micro text-muted-foreground block pb-1">Server URL</label>
              <input
                type="text"
                readOnly
                value={streamUrl}
                className="w-full rounded-lg border border-input bg-muted/40 px-3 py-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-micro text-muted-foreground block pb-1">Stream Key (Keep secret)</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  readOnly
                  value={streamKey}
                  className="w-full rounded-lg border border-input bg-muted/40 px-3 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="flex items-center gap-1 rounded-lg border border-input bg-muted/50 px-3 text-xs font-semibold hover:bg-muted"
                >
                  {copiedKey ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span>{copiedKey ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stream Settings */}
        <div className="mt-5 space-y-3">
          <div>
            <label htmlFor="stream-title" className="text-xs font-medium text-foreground pb-1 block">
              Stream Title
            </label>
            <input
              id="stream-title"
              type="text"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              placeholder="e.g. Afternoon Puppy Training Session & Q&A"
              className="w-full min-h-11 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="live-title-input"
            />
          </div>

          <div>
            <label htmlFor="stream-category" className="text-xs font-medium text-foreground pb-1 block">
              Category
            </label>
            <select
              id="stream-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="live-category-select"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Broadcast Trigger */}
        <button
          type="button"
          onClick={handleToggleBroadcast}
          className={cn(
            "mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
            isBroadcasting
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-red-600 text-white hover:bg-red-700"
          )}
          data-testid="live-broadcast-btn"
        >
          <Radio className="size-4" />
          <span>{isBroadcasting ? "End Live Broadcast" : "Start Live Broadcast"}</span>
        </button>
      </div>
    </div>
  );
}

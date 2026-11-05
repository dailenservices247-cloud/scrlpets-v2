"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPost, editPost } from "@/lib/compose/actions";
import { applyAttribution } from "./attribution";
import type { ComposeAttribution } from "./ComposerTabs";
import { MediaInput } from "./MediaInput";
import { isVideoUrl } from "@/lib/media/media-kind";
import { isEmbedUrl, parseEmbedUrl } from "@/lib/media/embeds";
import { EmbedPlayer } from "@/components/feed/EmbedPlayer";
import { CreaturePicker } from "./CreaturePicker";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";
import type { MyGroup } from "@/lib/groups/queries";
import {
  Link2,
  Upload,
  Share2,
  X,
  MapPin,
  Smile,
  Sparkles,
  HeartHandshake,
  Music,
  Calendar,
  Globe,
  Users,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PostFormProps =
  | {
      userId: string;
      creatures: { id: string; name: string }[];
      attribution: ComposeAttribution;
      groups?: MyGroup[];
      disabled?: boolean;
      onSwitchToListing?: () => void;
      edit?: never;
    }
  | {
      userId: string;
      edit: {
        id: string;
        body: string;
        mediaUrl: string | null;
        returnPath: string;
      };
      creatures?: never;
      attribution?: never;
      groups?: never;
      disabled?: never;
      onSwitchToListing?: never;
    };

export function PostForm(props: PostFormProps) {
  const { userId, onSwitchToListing } = props;
  const edit = props.edit;
  const creatures = props.creatures ?? [];
  const attribution = props.attribution;
  const groups = props.groups ?? [];
  const disabled = props.disabled ?? false;
  const isEditing = Boolean(edit);
  const t = useTranslations("compose");
  const tc = useTranslations("content");
  const router = useRouter();
  const [body, setBody] = useState(edit?.body ?? "");
  const [mediaUrl, setMediaUrl] = useState<string | null>(edit?.mediaUrl ?? null);
  // F4: a video upload or social embed turns the post into a reel or long video.
  const [videoKind, setVideoKind] = useState<"reel" | "long_video">("reel");
  const [mediaMode, setMediaMode] = useState<"upload" | "link">("upload");
  const [socialLinkInput, setSocialLinkInput] = useState("");
  const [socialLinkError, setSocialLinkError] = useState<string | null>(null);
  const [syndicate, setSyndicate] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>(["youtube", "instagram", "facebook"]);
  const [creatureId, setCreatureId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [feeling, setFeeling] = useState<{ emoji: string; label: string } | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [lifeUpdate, setLifeUpdate] = useState<string | null>(null);
  const [musicTrack, setMusicTrack] = useState<string | null>(null);
  const [fundraiser, setFundraiser] = useState<string | null>(null);
  const [eventTag, setEventTag] = useState<string | null>(null);
  const [audience, setAudience] = useState<"public" | "friends" | "only_me">("public");
  const [activeDrawer, setActiveDrawer] = useState<"feeling" | "location" | "lifeUpdate" | "music" | "fundraiser" | "event" | null>(null);
  const [drawerInput, setDrawerInput] = useState("");

  const FEELINGS = [
    { emoji: "🐾", label: "Playful" },
    { emoji: "💤", label: "Sleepy" },
    { emoji: "🥳", label: "Celebrating" },
    { emoji: "🎓", label: "Training" },
    { emoji: "🏖️", label: "Exploring" },
    { emoji: "❤️", label: "Loved" },
    { emoji: "🩺", label: "Recovering" },
  ];

  const LIFE_UPDATES = [
    "🐶 Welcomed New Family Pet",
    "🎂 Pet Birthday Celebration",
    "🎓 Training School Graduation",
    "🏆 Show Ring Championship / Title",
    "🌈 In Loving Memory & Gotcha Day",
  ];

  const MUSIC_TRACKS = [
    "Lofi Paws (Chill Beats) 🎵",
    "Puppy Joy Ride (Upbeat) 🎶",
    "Gentle Rain & Purrs (Ambient) 🌧️",
    "Field Sprint (Energetic) 🐕",
  ];
  // Group posts are person-voice only, matching the in-group composer; group_id
  // is frozen after publish (RESTRICTIVE update policy), so editing never shows it.
  const groupChoiceVisible =
    !isEditing && groups.length > 0 && attribution?.postingAsType === "person";
  const chosenGroup = groupChoiceVisible ? groups.find((g) => g.id === groupId) ?? null : null;

  function handleSocialLinkChange(url: string) {
    setSocialLinkInput(url);
    setSocialLinkError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setMediaUrl(null);
      return;
    }
    const parsed = parseEmbedUrl(trimmed);
    if (parsed) {
      setMediaUrl(trimmed);
      setVideoKind(parsed.kind === "reel" ? "reel" : "long_video");
    } else {
      setSocialLinkError("Please enter a valid YouTube, Instagram, Facebook, TikTok, or Twitch link.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    let finalBody = body;
    const metaTags: string[] = [];
    if (feeling) metaTags.push(`— feeling ${feeling.emoji} ${feeling.label}`);
    if (location) metaTags.push(`at 📍 ${location}`);
    if (lifeUpdate) metaTags.push(`✨ ${lifeUpdate}`);
    if (musicTrack) metaTags.push(`🎵 Listening to ${musicTrack}`);
    if (fundraiser) metaTags.push(`❤️ Supporting: ${fundraiser}`);
    if (eventTag) metaTags.push(`📅 Event: ${eventTag}`);
    if (metaTags.length > 0) {
      const summary = metaTags.join(" · ");
      finalBody = finalBody.trim() ? `${finalBody}\n\n${summary}` : summary;
    }

    const fd = new FormData();
    fd.set("body", finalBody);
    fd.set("mediaUrl", mediaUrl ?? "");
    if (!edit && (isVideoUrl(mediaUrl) || isEmbedUrl(mediaUrl))) {
      fd.set("contentType", videoKind);
    }
    if (syndicate) {
      fd.set("syndicate", "true");
      fd.set("syndicatePlatforms", platforms.join(","));
    }
    let res;
    if (edit) {
      res = await editPost(edit.id, fd);
    } else {
      if (creatureId) fd.set("creatureId", creatureId);
      if (chosenGroup) fd.set("groupId", chosenGroup.id);
      applyAttribution(fd, attribution!);
      res = await createPost(fd);
    }
    setBusy(false);
    if (!res.ok) {
      setErr(t("errorRequired"));
      return;
    }
    if (edit) {
      capture("content_edited", { content_type: "post", has_media: !!mediaUrl });
      router.push(edit.returnPath);
    } else {
      capture("post_created", {
        has_media: !!mediaUrl,
        has_creature: !!creatureId,
        in_group: !!chosenGroup,
      });
      // A group post lives on the group timeline — land where it landed.
      router.push(chosenGroup ? `/groups/${chosenGroup.slug}` : "/");
    }
    // Same race as ListingForm: a refresh in the same tick as a push cancels the
    // navigation, leaving the form up with the save already written. It has not
    // bitten here yet because these targets render fast, which is exactly why it
    // is worth removing before one of them does not.

  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 pt-4"
      data-testid={isEditing ? "edit-post-form" : "post-form"}
    >
      {/* Audience selector */}
      {!isEditing && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card p-1 text-xs">
            <button
              type="button"
              onClick={() => setAudience("public")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg transition font-medium",
                audience === "public" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Globe className="size-3" />
              Public
            </button>
            <button
              type="button"
              onClick={() => setAudience("friends")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg transition font-medium",
                audience === "friends" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="size-3" />
              Friends
            </button>
            <button
              type="button"
              onClick={() => setAudience("only_me")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-lg transition font-medium",
                audience === "only_me" ? "bg-primary/20 text-brand-link" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Lock className="size-3" />
              Only Me
            </button>
          </div>
        </div>
      )}

      {/* Facebook-style status badges pill */}
      {(feeling || location || lifeUpdate || musicTrack || fundraiser || eventTag) && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/80 bg-muted/30 p-2.5 text-xs">
          {feeling && (
            <span className="flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-amber-300">
              <span>{feeling.emoji} Feeling {feeling.label}</span>
              <button type="button" onClick={() => setFeeling(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </span>
          )}
          {location && (
            <span className="flex items-center gap-1 rounded-md bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-blue-300">
              <MapPin className="size-3" />
              <span>{location}</span>
              <button type="button" onClick={() => setLocation(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </span>
          )}
          {lifeUpdate && (
            <span className="flex items-center gap-1 rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-purple-300">
              <Sparkles className="size-3" />
              <span>{lifeUpdate}</span>
              <button type="button" onClick={() => setLifeUpdate(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </span>
          )}
          {musicTrack && (
            <span className="flex items-center gap-1 rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-rose-300">
              <Music className="size-3" />
              <span>{musicTrack}</span>
              <button type="button" onClick={() => setMusicTrack(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </span>
          )}
          {fundraiser && (
            <span className="flex items-center gap-1 rounded-md bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-red-300">
              <HeartHandshake className="size-3" />
              <span>{fundraiser}</span>
              <button type="button" onClick={() => setFundraiser(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </span>
          )}
          {eventTag && (
            <span className="flex items-center gap-1 rounded-md bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 text-teal-300">
              <Calendar className="size-3" />
              <span>{eventTag}</span>
              <button type="button" onClick={() => setEventTag(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </span>
          )}
        </div>
      )}

      <textarea
        className="min-h-28 rounded border border-input bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder={t("bodyPlaceholder")}
        aria-label={t("bodyPlaceholder")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        data-testid="post-body"
      />

      {/* Facebook-style 'Add to your post' bar */}
      {!isEditing && (
        <div className="flex flex-wrap items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-2.5" data-testid="post-facebook-toolbar">
          <span className="text-xs font-semibold text-foreground">Add to your post</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Upload File"
              onClick={() => {
                setMediaMode("upload");
                setActiveDrawer(null);
              }}
              className="grid size-8 place-items-center rounded-lg text-emerald-400 hover:bg-muted/60 transition"
              data-testid="post-add-photo"
            >
              <Upload className="size-4" />
            </button>
            <button
              type="button"
              title="Feelings / Activity"
              onClick={() => setActiveDrawer(activeDrawer === "feeling" ? null : "feeling")}
              className={cn(
                "grid size-8 place-items-center rounded-lg transition",
                activeDrawer === "feeling" ? "bg-amber-500/20 text-amber-300" : "text-amber-400 hover:bg-muted/60"
              )}
              data-testid="post-add-feeling"
            >
              <Smile className="size-4" />
            </button>
            <button
              type="button"
              title="Check in / Location"
              onClick={() => setActiveDrawer(activeDrawer === "location" ? null : "location")}
              className={cn(
                "grid size-8 place-items-center rounded-lg transition",
                activeDrawer === "location" ? "bg-blue-500/20 text-blue-300" : "text-blue-400 hover:bg-muted/60"
              )}
              data-testid="post-add-location"
            >
              <MapPin className="size-4" />
            </button>
            <button
              type="button"
              title="Life Update / Milestone"
              onClick={() => setActiveDrawer(activeDrawer === "lifeUpdate" ? null : "lifeUpdate")}
              className={cn(
                "grid size-8 place-items-center rounded-lg transition",
                activeDrawer === "lifeUpdate" ? "bg-purple-500/20 text-purple-300" : "text-purple-400 hover:bg-muted/60"
              )}
              data-testid="post-add-milestone"
            >
              <Sparkles className="size-4" />
            </button>
            <button
              type="button"
              title="Music"
              onClick={() => setActiveDrawer(activeDrawer === "music" ? null : "music")}
              className={cn(
                "grid size-8 place-items-center rounded-lg transition",
                activeDrawer === "music" ? "bg-rose-500/20 text-rose-300" : "text-rose-400 hover:bg-muted/60"
              )}
              data-testid="post-add-music"
            >
              <Music className="size-4" />
            </button>
            <button
              type="button"
              title="Fundraiser / Cause"
              onClick={() => setActiveDrawer(activeDrawer === "fundraiser" ? null : "fundraiser")}
              className={cn(
                "grid size-8 place-items-center rounded-lg transition",
                activeDrawer === "fundraiser" ? "bg-red-500/20 text-red-300" : "text-red-400 hover:bg-muted/60"
              )}
              data-testid="post-add-fundraiser"
            >
              <HeartHandshake className="size-4" />
            </button>
            <button
              type="button"
              title="Event"
              onClick={() => setActiveDrawer(activeDrawer === "event" ? null : "event")}
              className={cn(
                "grid size-8 place-items-center rounded-lg transition",
                activeDrawer === "event" ? "bg-teal-500/20 text-teal-300" : "text-teal-400 hover:bg-muted/60"
              )}
              data-testid="post-add-event"
            >
              <Calendar className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Drawers for Facebook-style attachments */}
      {activeDrawer === "feeling" && (
        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm" data-testid="drawer-feeling">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground mb-2">How are you or your pet feeling?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FEELINGS.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => {
                  setFeeling(f);
                  setActiveDrawer(null);
                }}
                className="flex items-center gap-2 p-2 rounded-lg border border-border/60 hover:bg-muted text-xs font-medium"
              >
                <span>{f.emoji}</span>
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeDrawer === "location" && (
        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm" data-testid="drawer-location">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Where are you?</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Central Bark Dog Park or City, State"
              value={drawerInput}
              onChange={(e) => setDrawerInput(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (drawerInput.trim()) {
                  setLocation(drawerInput.trim());
                  setDrawerInput("");
                  setActiveDrawer(null);
                }
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Set Location
            </button>
          </div>
        </div>
      )}

      {activeDrawer === "lifeUpdate" && (
        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm" data-testid="drawer-milestone">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground mb-2">Choose a Life Update</p>
          <div className="space-y-1.5">
            {LIFE_UPDATES.map((update) => (
              <button
                key={update}
                type="button"
                onClick={() => {
                  setLifeUpdate(update);
                  setActiveDrawer(null);
                }}
                className="w-full text-left p-2 rounded-lg border border-border/60 hover:bg-muted text-xs font-medium"
              >
                {update}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeDrawer === "music" && (
        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm" data-testid="drawer-music">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground mb-2">Attach background audio</p>
          <div className="space-y-1.5">
            {MUSIC_TRACKS.map((track) => (
              <button
                key={track}
                type="button"
                onClick={() => {
                  setMusicTrack(track);
                  setActiveDrawer(null);
                }}
                className="w-full text-left p-2 rounded-lg border border-border/60 hover:bg-muted text-xs font-medium flex items-center justify-between"
              >
                <span>{track}</span>
                <span className="text-micro text-muted-foreground">0:30 snippet</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeDrawer === "fundraiser" && (
        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm" data-testid="drawer-fundraiser">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Link a pet fundraiser / cause</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Milo's Cruciate Surgery Fund ($1,200 goal)"
              value={drawerInput}
              onChange={(e) => setDrawerInput(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (drawerInput.trim()) {
                  setFundraiser(drawerInput.trim());
                  setDrawerInput("");
                  setActiveDrawer(null);
                }
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Add Cause
            </button>
          </div>
        </div>
      )}

      {activeDrawer === "event" && (
        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm" data-testid="drawer-event">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Link an event or meetup</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Annual Golden Retriever Meetup · Saturday 10am"
              value={drawerInput}
              onChange={(e) => setDrawerInput(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (drawerInput.trim()) {
                  setEventTag(drawerInput.trim());
                  setDrawerInput("");
                  setActiveDrawer(null);
                }
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Attach Event
            </button>
          </div>
        </div>
      )}
      {isEditing && mediaUrl && (
        <div className="rounded-xl border border-border/70 p-3" data-testid="current-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl} alt="" className="max-h-56 w-full rounded-lg object-cover" />
          <Button type="button" variant="outline" className="mt-3" onClick={() => setMediaUrl(null)}>
            {tc("removePhoto")}
          </Button>
        </div>
      )}

      {!isEditing && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
            <button
              type="button"
              onClick={() => {
                setMediaMode("upload");
                if (isEmbedUrl(mediaUrl)) setMediaUrl(null);
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                mediaMode === "upload"
                  ? "bg-primary/15 text-brand-link"
                  : "text-muted-foreground hover:bg-muted/40"
              }`}
              data-testid="tab-media-upload"
            >
              <Upload className="size-3.5" />
              <span>Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMediaMode("link");
                if (!isEmbedUrl(mediaUrl)) setMediaUrl(null);
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                mediaMode === "link"
                  ? "bg-primary/15 text-brand-link"
                  : "text-muted-foreground hover:bg-muted/40"
              }`}
              data-testid="tab-media-link"
            >
              <Link2 className="size-3.5" />
              <span>Paste Video Link (YouTube, IG, FB, TikTok)</span>
            </button>
          </div>

          {mediaMode === "upload" ? (
            <MediaInput userId={userId} onUploaded={(url) => setMediaUrl(url)} />
          ) : (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">
                Paste YouTube, Instagram Reel, Facebook Video, or TikTok link:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... or https://instagram.com/reel/..."
                  value={socialLinkInput}
                  onChange={(e) => handleSocialLinkChange(e.target.value)}
                  className="flex-1 min-h-10 rounded-lg border border-input bg-transparent px-3 py-2 text-xs"
                  data-testid="social-link-input"
                />
                {socialLinkInput && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full"
                    onClick={() => handleSocialLinkChange("")}
                    aria-label="Clear link"
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
              {socialLinkError && (
                <p className="text-xs text-destructive" role="alert">
                  {socialLinkError}
                </p>
              )}
              {mediaUrl && isEmbedUrl(mediaUrl) && (
                <div className="rounded-xl border border-border/70 p-3 bg-muted/20">
                  <p className="text-micro text-muted-foreground mb-2 font-medium">Embed Preview</p>
                  <EmbedPlayer src={mediaUrl} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isEditing && (
        <MediaInput userId={userId} onUploaded={(url) => setMediaUrl(url)} />
      )}

      {!isEditing && (isVideoUrl(mediaUrl) || isEmbedUrl(mediaUrl)) && (
        <div className="flex flex-col gap-1.5 self-start">
          <p className="text-micro font-medium text-muted-foreground">Select Format:</p>
          <div className="flex gap-1 rounded-full bg-muted/45 p-1" role="group" aria-label={t("videoKindLabel")}>
            <button
              key="reel"
              type="button"
              onClick={() => setVideoKind("reel")}
              aria-pressed={videoKind === "reel"}
              data-testid="video-kind-reel"
              className={
                "min-h-9 rounded-full px-4 text-xs font-semibold transition " +
                (videoKind === "reel" ? "bg-primary/15 text-brand-link" : "text-muted-foreground hover:bg-muted")
              }
            >
              Reel / Short (Vertical)
            </button>
            <button
              key="long_video"
              type="button"
              onClick={() => setVideoKind("long_video")}
              aria-pressed={videoKind === "long_video"}
              data-testid="video-kind-long_video"
              className={
                "min-h-9 rounded-full px-4 text-xs font-semibold transition " +
                (videoKind === "long_video" ? "bg-primary/15 text-brand-link" : "text-muted-foreground hover:bg-muted")
              }
            >
              Full Video / Stream (16:9)
            </button>
          </div>
        </div>
      )}
      {!isEditing && (
        <CreaturePicker creatures={creatures} value={creatureId} onChange={setCreatureId} />
      )}
      {groupChoiceVisible && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("groupLabel")}
          <select
            value={groupId ?? ""}
            onChange={(e) => setGroupId(e.target.value || null)}
            data-testid="post-group-select"
            className="min-h-11 rounded border border-input bg-transparent p-2"
          >
            <option value="">{t("groupNone")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {/* Groups are public and posting into one redirects to the group
              timeline, so without this the author never finds out their post
              also went to every feed on the site. Said BEFORE the choice, not
              after the post. */}
          <span className="text-xs font-normal text-muted-foreground" data-testid="group-public-notice">
            {t("groupPublicNotice")}
          </span>
        </label>
      )}
      {!isEditing && (
        <div className="rounded-xl border border-border/60 bg-muted/15 p-3" data-testid="post-syndication-panel">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={syndicate}
              onChange={(e) => setSyndicate(e.target.checked)}
              className="size-4 rounded border-border accent-primary cursor-pointer"
              data-testid="post-syndicate-checkbox"
            />
            <div className="flex items-center gap-2">
              <Share2 className="size-3.5 text-brand-link" />
              <span className="text-xs font-semibold">
                Auto-syndicate to connected channels
              </span>
            </div>
          </label>
          <p className="mt-1 text-micro text-muted-foreground pl-6.5">
            Broadcasts this post, reel, full video, or live stream announcement directly to your connected channels upon publishing.
          </p>
          {syndicate && (
            <div className="mt-3 flex flex-wrap items-center gap-2 pl-6.5" data-testid="syndication-platform-toggles">
              {[
                { id: "youtube", label: "YouTube" },
                { id: "instagram", label: "Instagram" },
                { id: "facebook", label: "Facebook" },
                { id: "tiktok", label: "TikTok" },
              ].map((plat) => {
                const active = platforms.includes(plat.id);
                return (
                  <button
                    key={plat.id}
                    type="button"
                    onClick={() => {
                      setPlatforms((prev) =>
                        prev.includes(plat.id)
                          ? prev.filter((p) => p !== plat.id)
                          : [...prev, plat.id]
                      );
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-micro font-medium transition",
                      active
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {active ? `✓ ${plat.label}` : `+ ${plat.label}`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {onSwitchToListing && !isEditing && (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border/80 bg-muted/15 p-2.5">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-lg bg-primary/15 text-brand-link text-xs">
              🏷️
            </span>
            <span className="text-xs text-muted-foreground">
              Selling or reserving an animal?
            </span>
          </div>
          <button
            type="button"
            onClick={onSwitchToListing}
            className="text-xs font-semibold text-brand-link hover:underline"
          >
            Create Animal Listing →
          </button>
        </div>
      )}

      {err && <p className="text-destructive text-sm">{err}</p>}
      <Button type="submit" disabled={busy || disabled} data-testid="post-submit">
        {isEditing ? tc("saveChanges") : t("submitPost")}
      </Button>
    </form>
  );
}

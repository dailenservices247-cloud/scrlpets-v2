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
import { Link2, Upload, Share2, X } from "lucide-react";

type PostFormProps =
  | {
      userId: string;
      creatures: { id: string; name: string }[];
      attribution: ComposeAttribution;
      groups?: MyGroup[];
      disabled?: boolean;
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
    };

export function PostForm(props: PostFormProps) {
  const { userId } = props;
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
  const [creatureId, setCreatureId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    const fd = new FormData();
    fd.set("body", body);
    fd.set("mediaUrl", mediaUrl ?? "");
    if (!edit && (isVideoUrl(mediaUrl) || isEmbedUrl(mediaUrl))) {
      fd.set("contentType", videoKind);
    }
    if (syndicate) {
      fd.set("syndicate", "true");
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
      <textarea
        className="min-h-28 rounded border border-input bg-transparent p-2"
        placeholder={t("bodyPlaceholder")}
        aria-label={t("bodyPlaceholder")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        data-testid="post-body"
      />
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
                Auto-syndicate to connected channels (YouTube, IG, FB)
              </span>
            </div>
          </label>
          <p className="mt-1 text-micro text-muted-foreground pl-6.5">
            Broadcasts this post, reel, full video, or live stream announcement directly to your connected channels upon publishing.
          </p>
        </div>
      )}

      {err && <p className="text-destructive text-sm">{err}</p>}
      <Button type="submit" disabled={busy || disabled} data-testid="post-submit">
        {isEditing ? tc("saveChanges") : t("submitPost")}
      </Button>
    </form>
  );
}

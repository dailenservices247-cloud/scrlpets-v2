"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPost, editPost } from "@/lib/compose/actions";
import { applyAttribution } from "./attribution";
import type { ComposeAttribution } from "./ComposerTabs";
import { MediaInput } from "./MediaInput";
import { isVideoUrl } from "@/lib/media/media-kind";
import { CreaturePicker } from "./CreaturePicker";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";
import type { MyGroup } from "@/lib/groups/queries";

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
  // F4: a video upload turns the post into a reel or long video.
  const [videoKind, setVideoKind] = useState<"reel" | "long_video">("reel");
  const [creatureId, setCreatureId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Group posts are person-voice only, matching the in-group composer; group_id
  // is frozen after publish (RESTRICTIVE update policy), so editing never shows it.
  const groupChoiceVisible =
    !isEditing && groups.length > 0 && attribution?.postingAsType === "person";
  const chosenGroup = groupChoiceVisible ? groups.find((g) => g.id === groupId) ?? null : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("body", body);
    fd.set("mediaUrl", mediaUrl ?? "");
    if (!edit && isVideoUrl(mediaUrl)) fd.set("contentType", videoKind);
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
    router.refresh();
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
      <MediaInput userId={userId} onUploaded={(url) => setMediaUrl(url)} />
      {!isEditing && isVideoUrl(mediaUrl) && (
        <div className="flex gap-1 rounded-full bg-muted/45 p-1 self-start" role="group" aria-label={t("videoKindLabel")}>
          {(["reel", "long_video"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setVideoKind(kind)}
              aria-pressed={videoKind === kind}
              data-testid={`video-kind-${kind}`}
              className={
                "min-h-9 rounded-full px-4 text-sm font-medium transition " +
                (videoKind === kind ? "bg-primary/15 text-brand-link" : "text-muted-foreground hover:bg-muted")
              }
            >
              {kind === "reel" ? t("videoKindReel") : t("videoKindLong")}
            </button>
          ))}
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
        </label>
      )}
      {err && <p className="text-destructive text-sm">{err}</p>}
      <Button type="submit" disabled={busy || disabled} data-testid="post-submit">
        {isEditing ? tc("saveChanges") : t("submitPost")}
      </Button>
    </form>
  );
}

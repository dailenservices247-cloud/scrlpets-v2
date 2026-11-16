"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, Image as ImageIcon } from "lucide-react";
import { updateProfile } from "@/lib/profiles/actions";
import { MediaInput } from "@/components/compose/MediaInput";
import { Button } from "@/components/ui/button";

export function ProfileEditForm({
  userId,
  username,
  initial,
}: {
  userId: string;
  username: string;
  initial: {
    displayName: string | null;
    bio: string | null;
    avatarUrl?: string | null;
    coverUrl?: string | null;
  };
}) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activeAvatar = avatarUrl || initial.avatarUrl;
  const activeCover = coverUrl || initial.coverUrl;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("displayName", displayName);
    fd.set("bio", bio);
    // ponytail: uploading replaces, and there is no "remove" — same ceiling the
    // avatar has had since slice 2. Add one control that clears both when
    // someone actually asks to take a picture back down.
    if (avatarUrl) fd.set("avatarUrl", avatarUrl);
    if (coverUrl) fd.set("coverUrl", coverUrl);
    const res = await updateProfile(fd);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "error");
      return;
    }
    router.push(`/u/${username}?tab=about`);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="premium-panel space-y-6 rounded-2xl p-5 sm:p-6"
      data-testid="profile-edit-form"
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">Visual Identity</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Cover banner and public avatar displayed across your profile, cards, and moments.
        </p>

        {/* Visual Preview Header */}
        <div className="relative mt-4">
          <div className="relative h-36 w-full overflow-hidden rounded-xl border border-border/70 bg-muted/40 sm:h-44">
            {activeCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeCover}
                alt="Profile cover banner preview"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground/60">
                <ImageIcon className="size-8" aria-hidden />
                <span className="text-micro font-medium uppercase tracking-wider">No cover banner set</span>
              </div>
            )}
          </div>

          {/* Overlapping Avatar Circle */}
          <div className="relative -mt-10 ml-4 flex items-end gap-3 sm:-mt-12 sm:ml-6">
            <div className="relative size-20 overflow-hidden rounded-full border-4 border-background bg-card shadow-md sm:size-24">
              {activeAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeAvatar}
                  alt="Profile avatar preview"
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                  <Camera className="size-6 text-muted-foreground/50" aria-hidden />
                </div>
              )}
            </div>
            <div className="pb-2">
              <p className="text-sm font-bold text-foreground">
                {displayName.trim() || username}
              </p>
              <p className="text-xs text-muted-foreground">@{username}</p>
            </div>
          </div>
        </div>

        {/* Media Pickers */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <fieldset className="rounded-xl border border-border/70 bg-card/40 p-3">
            <legend className="px-1 text-xs font-semibold text-foreground">
              {t("avatar")}
            </legend>
            <MediaInput userId={userId} onUploaded={setAvatarUrl} imagesOnly />
          </fieldset>
          <fieldset className="rounded-xl border border-border/70 bg-card/40 p-3">
            <legend className="px-1 text-xs font-semibold text-foreground">
              {t("cover")}
            </legend>
            <MediaInput userId={userId} onUploaded={setCoverUrl} imagesOnly />
          </fieldset>
        </div>
      </div>

      {/* Public Profile Details */}
      <div className="space-y-4 border-t border-border/60 pt-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="displayName">
              {t("displayName")}
            </label>
            <span className="text-micro text-muted-foreground">{displayName.length}/80</span>
          </div>
          <input
            id="displayName"
            maxLength={80}
            className="min-h-11 w-full rounded-xl border border-input bg-card/50 px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name or verified kennel brand"
            data-testid="edit-display-name"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="bio">
              {t("bio")}
            </label>
            <span className="text-micro text-muted-foreground">{bio.length}/500</span>
          </div>
          <textarea
            id="bio"
            maxLength={500}
            className="min-h-28 w-full resize-y rounded-xl border border-input bg-card/50 p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell your pack about yourself, your breeding program, or your companion animals..."
            data-testid="edit-bio"
          />
        </div>
      </div>

      {err && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {err}
        </p>
      )}

      <Button
        type="submit"
        disabled={busy}
        data-testid="edit-save"
        className="min-h-11 w-full rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
      >
        {busy ? "Saving changes..." : t("save")}
      </Button>
    </form>
  );
}

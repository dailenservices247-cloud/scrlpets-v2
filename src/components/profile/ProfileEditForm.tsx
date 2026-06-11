"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  initial: { displayName: string | null; bio: string | null };
}) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("displayName", displayName);
    fd.set("bio", bio);
    if (avatarUrl) fd.set("avatarUrl", avatarUrl);
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
    <form onSubmit={submit} className="flex flex-col gap-4" data-testid="profile-edit-form">
      <label className="text-sm text-muted-foreground" htmlFor="displayName">
        {t("displayName")}
      </label>
      <input
        id="displayName"
        className="rounded border border-input bg-transparent p-2"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        data-testid="edit-display-name"
      />
      <label className="text-sm text-muted-foreground" htmlFor="bio">
        {t("bio")}
      </label>
      <textarea
        id="bio"
        className="min-h-24 rounded border border-input bg-transparent p-2"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        data-testid="edit-bio"
      />
      <MediaInput userId={userId} onUploaded={setAvatarUrl} />
      {err && <p className="text-destructive text-sm">{err}</p>}
      <Button type="submit" disabled={busy} data-testid="edit-save">
        {t("save")}
      </Button>
    </form>
  );
}

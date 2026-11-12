"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Camera, Image as ImageIcon, Sparkles, Clapperboard, ExternalLink, Dna, PawPrint, Stethoscope } from "lucide-react";
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
  const [persona, setPersona] = useState<"creator" | "breeder" | "pet_parent" | "pro">("creator");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`scrlpets_user_persona_${userId}`);
      if (stored && ["creator", "breeder", "pet_parent", "pro"].includes(stored)) {
        setTimeout(() => setPersona(stored as "creator" | "breeder" | "pet_parent" | "pro"), 0);
      }
    } catch {
      // Ignore
    }
  }, [userId]);

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
    try {
      localStorage.setItem(`scrlpets_user_persona_${userId}`, persona);
    } catch {
      // Ignore
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

      {/* Account Persona & Profile Mode */}
      <div className="space-y-3 border-t border-border/60 pt-4" data-testid="account-persona-selector">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Profile Persona &amp; Focus</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose how you use Scrlpets. Tailors your dashboard, reels composer, and monetization features.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {/* Creator Persona */}
          <button
            type="button"
            onClick={() => setPersona("creator")}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
              persona === "creator"
                ? "border-amber-500/80 bg-amber-500/10 ring-1 ring-amber-500/30"
                : "border-border/70 bg-card/40 hover:bg-muted/40"
            }`}
            data-testid="persona-creator"
          >
            <div className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
              persona === "creator" ? "bg-amber-500/20 text-amber-300" : "bg-muted text-muted-foreground"
            }`}>
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">Content Creator</span>
                {persona === "creator" && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-micro font-semibold text-amber-300">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-micro text-muted-foreground">
                Upload short-form video reels, build a fan following, and monetize via fan tips and ad revenue.
              </p>
            </div>
          </button>

          {/* Breeder Persona */}
          <button
            type="button"
            onClick={() => setPersona("breeder")}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
              persona === "breeder"
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border/70 bg-card/40 hover:bg-muted/40"
            }`}
            data-testid="persona-breeder"
          >
            <div className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
              persona === "breeder" ? "bg-primary/20 text-brand-link" : "bg-muted text-muted-foreground"
            }`}>
              <Dna className="size-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-foreground">Breeder &amp; Kennel</span>
              <p className="mt-0.5 text-micro text-muted-foreground">
                Manage registered stock, litters, 4-gen pedigree trees, health testing, and buyer protection sales.
              </p>
            </div>
          </button>

          {/* Pet Guardian Persona */}
          <button
            type="button"
            onClick={() => setPersona("pet_parent")}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
              persona === "pet_parent"
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border/70 bg-card/40 hover:bg-muted/40"
            }`}
            data-testid="persona-pet-parent"
          >
            <div className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
              persona === "pet_parent" ? "bg-primary/20 text-brand-link" : "bg-muted text-muted-foreground"
            }`}>
              <PawPrint className="size-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-foreground">Pet Parent &amp; Family</span>
              <p className="mt-0.5 text-micro text-muted-foreground">
                Share photos, track companion animal health, and discover adoptable animals in your region.
              </p>
            </div>
          </button>

          {/* Care Pro Persona */}
          <button
            type="button"
            onClick={() => setPersona("pro")}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
              persona === "pro"
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border/70 bg-card/40 hover:bg-muted/40"
            }`}
            data-testid="persona-pro"
          >
            <div className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
              persona === "pro" ? "bg-primary/20 text-brand-link" : "bg-muted text-muted-foreground"
            }`}>
              <Stethoscope className="size-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-foreground">Care Provider / Vet / Trainer</span>
              <p className="mt-0.5 text-micro text-muted-foreground">
                Offer bookable services, stud management, transport, or mobile grooming appointments.
              </p>
            </div>
          </button>
        </div>

        {persona === "creator" && (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <div className="flex items-center gap-2 text-amber-300">
              <Clapperboard className="size-4 shrink-0" />
              <span>
                Creator Mode Active: Fan tipping enabled. Payouts route to your Relay Financial account.
              </span>
            </div>
            <Link
              href="/settings/creator"
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-link hover:underline ml-2"
            >
              <span>Creator Studio</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        )}
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

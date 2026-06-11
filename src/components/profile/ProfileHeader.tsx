import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Profile } from "@/lib/profiles/queries";

export async function ProfileHeader({ profile, isOwn }: { profile: Profile; isOwn: boolean }) {
  const t = await getTranslations("profile");
  return (
    <header className="flex items-center gap-3 p-4" data-testid="profile-header">
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground">
          {(profile.displayName ?? profile.username).slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold">{profile.displayName ?? profile.username}</h1>
        <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
      </div>
      {isOwn && (
        <Link
          href="/settings/profile"
          className="rounded-md border border-input px-3 py-1 text-sm text-brand-link"
          data-testid="edit-profile-link"
        >
          {t("edit")}
        </Link>
      )}
    </header>
  );
}

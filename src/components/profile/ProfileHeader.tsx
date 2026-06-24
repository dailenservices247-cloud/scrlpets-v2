import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Profile } from "@/lib/profiles/queries";
import { MessageButton } from "@/components/messaging/MessageButton";

export async function ProfileHeader({
  profile,
  isOwn,
  viewerSignedIn,
  metrics,
}: {
  profile: Profile;
  isOwn: boolean;
  viewerSignedIn: boolean;
  metrics: { label: string; value: string | number; testId: string }[];
}) {
  const t = await getTranslations("profile");
  return (
    <section className="px-3 pt-4" data-testid="profile-header">
      <div className="premium-panel rounded-2xl p-4">
        <header className="flex items-start gap-3">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              width={72}
              height={72}
              className="size-18 rounded-2xl object-cover ring-1 ring-border/80"
            />
          ) : (
            <div className="grid size-18 place-items-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground ring-1 ring-border/80">
              {(profile.displayName ?? profile.username).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t("profileLabel")}</p>
            <h1 className="mt-1 truncate text-2xl font-semibold leading-tight">{profile.displayName ?? profile.username}</h1>
            <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
          </div>
          {isOwn ? (
            <Link
              href="/settings/profile"
              className="rounded-md border border-input px-3 py-2 text-sm font-medium text-brand-link"
              data-testid="edit-profile-link"
            >
              {t("edit")}
            </Link>
          ) : (
            viewerSignedIn && <MessageButton profileId={profile.id} />
          )}
        </header>

        <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground" data-testid="profile-bio-preview">
          {profile.bio ?? t("noBio")}
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-2" data-testid="profile-metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2" data-testid={metric.testId}>
              <dt className="text-xs text-muted-foreground">{metric.label}</dt>
              <dd className="mt-1 text-lg font-semibold">{metric.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

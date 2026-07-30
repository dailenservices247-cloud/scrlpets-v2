import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { Card } from "@/components/ui/card";
import type { FollowListKind, Profile } from "@/lib/profiles/queries";

/**
 * Shared body for /u/[username]/followers and /u/[username]/following. Both
 * routes render the exact array the profile header counted, so the number and
 * the names behind it are the same query.
 */
export async function FollowListPage({
  profile,
  kind,
  people,
}: {
  profile: Profile;
  kind: FollowListKind;
  people: Profile[];
}) {
  const t = await getTranslations("profile");
  const owner = profile.displayName ?? profile.username;

  return (
    <AppPage>
      <section className="px-3 pt-4" data-testid={`follow-list-${kind}`}>
        <Link href={`/u/${profile.username}`} className="text-sm text-brand-link underline">
          {t("backToProfile")}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold leading-tight">
          {kind === "followers" ? t("followersTitle") : t("followingTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("followListSubtitle", { name: owner, count: people.length })}
        </p>
      </section>

      {people.length === 0 ? (
        <p
          className="px-3 py-12 text-center text-sm text-muted-foreground"
          data-testid="follow-list-empty"
        >
          {kind === "followers" ? t("followersEmpty") : t("followingEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 p-3" data-testid="follow-list">
          {people.map((person) => (
            <li key={person.id}>
              <Link
                href={`/u/${person.username}`}
                className="block focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="follow-list-row"
              >
                <Card className="premium-panel flex-row items-center gap-3 rounded-2xl p-3">
                  {person.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.avatarUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="size-11 rounded-xl object-cover ring-1 ring-border/80"
                    />
                  ) : (
                    <span
                      className="grid size-11 place-items-center rounded-xl bg-primary text-base font-semibold text-primary-foreground"
                      aria-hidden
                    >
                      {(person.displayName ?? person.username).slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {person.displayName ?? person.username}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{person.username}
                    </span>
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppPage>
  );
}

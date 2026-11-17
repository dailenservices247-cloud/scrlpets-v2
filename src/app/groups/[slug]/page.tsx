import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { FeedList } from "@/components/feed/FeedList";
import { GroupPostForm } from "@/components/groups/GroupPostForm";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { joinGroup, leaveGroup } from "@/lib/groups/actions";
import { getGroupBySlug, listGroupPosts } from "@/lib/groups/queries";
import { listGuidesForGroup } from "@/lib/guides/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = await getGroupBySlug(slug);
  if (!group) return {};
  return { title: group.name, description: group.description ?? undefined };
}

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const [user, t, { tab }] = await Promise.all([
    getSessionUser(),
    getTranslations("groups"),
    searchParams,
  ]);
  const group = await getGroupBySlug(slug, user?.id);
  if (!group) notFound();

  // Two surfaces per community: what members are saying, and what has been
  // written down for them. Plain links rather than a client tab widget — the
  // page is a server render either way.
  const active = tab === "guides" ? "guides" : "posts";
  const posts = active === "posts" ? await listGroupPosts(group.id, user?.id) : [];
  const guides = active === "guides" ? await listGuidesForGroup(group.id) : [];
  // Join/leave are bound server actions on plain forms — the page re-renders
  // from the database, so the button can never show a membership the row store
  // disagrees with.
  const toggle = (group.viewerIsMember ? leaveGroup : joinGroup).bind(null, group.id, slug);

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <Link href="/groups" className="text-sm text-brand-link underline">
          {t("backToGroups")}
        </Link>
        <p className="eyebrow mt-4">{group.species}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight" data-testid="group-name">
          {group.name}
        </h1>
        {group.description && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{group.description}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground" data-testid="group-member-count">
          {t("memberCount", { count: group.memberCount })}
        </p>

        {user ? (
          <form action={toggle} className="mt-4">
            <button
              type="submit"
              aria-pressed={group.viewerIsMember}
              data-testid="group-join-button"
              className={
                // Button system #3: soft wine tint for the standard action.
                group.viewerIsMember
                  ? "min-h-11 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
                  : "min-h-11 rounded-lg bg-primary/15 px-4 py-2 text-sm font-medium text-brand-link hover:bg-primary/25"
              }
            >
              {group.viewerIsMember ? t("leave") : t("join")}
            </button>
          </form>
        ) : (
          <Link
            href={loginHrefFor(`/groups/${slug}`)}
            className="mt-4 inline-block min-h-11 rounded-lg bg-primary/15 px-4 py-2 text-sm font-medium text-brand-link hover:bg-primary/25"
            data-testid="group-signin-to-join"
          >
            {t("signInToJoin")}
          </Link>
        )}
      </section>

      <nav className="flex gap-2 px-4 pb-3" aria-label={t("sectionsLabel")}>
        {(["posts", "guides"] as const).map((value) => (
          <Link
            key={value}
            href={`/groups/${slug}${value === "guides" ? "?tab=guides" : ""}`}
            aria-current={active === value ? "page" : undefined}
            data-testid={`group-tab-${value}`}
            className={
              active === value
                ? "min-h-11 rounded-lg bg-primary/15 px-4 py-2 text-sm font-semibold text-brand-link"
                : "min-h-11 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
            }
          >
            {value === "guides" ? t("tabGuides") : t("tabPosts")}
          </Link>
        ))}
      </nav>

      {active === "guides" ? (
        guides.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground" data-testid="group-guides-empty">
            {t("guidesEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3 px-4 py-4" data-testid="group-guides-list">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/guides/${guide.slug}`}
                  className="block rounded-2xl border bg-card p-4 transition hover:bg-accent/40"
                  data-testid="group-guide-link"
                >
                  <p className="mt-1 font-semibold">{guide.title}</p>
                  {guide.summary && (
                    <p className="mt-1 text-sm text-muted-foreground">{guide.summary}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          {user && group.viewerIsMember ? (
            <section className="border-y border-border/60 px-4 py-4">
              <GroupPostForm groupId={group.id} slug={slug} userId={user.id} />
            </section>
          ) : (
            <p className="border-y border-border/60 px-4 py-4 text-sm text-muted-foreground" data-testid="group-join-to-post">
              {t("joinToPost")}
            </p>
          )}

          {posts.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground" data-testid="group-posts-empty">
              {t("postsEmpty")}
            </p>
          ) : (
            // Group posts ARE post rows, so the feed tiles render reactions,
            // comments and author-or-manager controls with no group-specific code.
            <FeedList items={posts} showTabs={false} viewerId={user?.id ?? null} />
          )}
        </>
      )}
    </AppPage>
  );
}

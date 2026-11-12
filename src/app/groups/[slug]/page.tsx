import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Sparkles, Dna, ArrowRight } from "lucide-react";
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

        {/* Breed Hub Highlights: Stud Spotlight & Litter Registry */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2" data-testid="breed-hub-spotlight">
          {/* Stud Spotlight */}
          <div className="premium-panel rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/20 px-2 py-0.5 text-micro font-semibold text-brand-link">
                <Dna className="size-3" />
                Featured Stud Spotlight
              </span>
              <span className="text-micro font-medium text-emerald-400">Health Clearances Passed</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Big Meech — Presa Canario Stud</h3>
              <p className="text-micro text-muted-foreground">
                Standing in Columbus, OH · OFA Hips/Elbows Clear · PennHIP 0.28 · 100% Negative DNA
              </p>
            </div>
            <div className="pt-1 flex items-center gap-2">
              <Link
                href="/c/big-meech"
                className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-primary px-3 text-micro font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <span>View Pedigree Tree</span>
                <ArrowRight className="size-3" />
              </Link>
              <Link
                href="/services"
                className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-input bg-card px-2.5 text-micro font-medium text-foreground hover:bg-muted"
              >
                <span>Request Breeding</span>
              </Link>
            </div>
          </div>

          {/* Pinned Litter Announcements */}
          <div className="premium-panel rounded-2xl border border-border/70 bg-card/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-micro font-semibold text-amber-300">
                <Sparkles className="size-3" />
                Verified Whelping Roster
              </span>
              <span className="text-micro text-muted-foreground">Held Payment Protected</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Danu&apos;s Ark Litter &ldquo;C&rdquo; Reserve</h3>
              <p className="text-micro text-muted-foreground">
                Sired by Big Meech · Expected Fall 2026 · Microchipped &amp; 48-hr Vet Guarantee
              </p>
            </div>
            <div className="pt-1">
              <Link
                href="/litters"
                className="inline-flex min-h-8 items-center gap-1 text-micro font-semibold text-brand-link hover:underline"
              >
                <span>Explore Active Breed Litters &amp; Weight Ledgers</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
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

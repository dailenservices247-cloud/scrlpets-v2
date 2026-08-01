import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { BookmarkButton } from "@/components/guides/BookmarkButton";
import { getSessionUser } from "@/lib/auth/session";
import { getGuideBySlug, getMyBookmarkedGuideIds } from "@/lib/guides/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};
  return { title: guide.title, description: guide.summary ?? undefined };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [guide, t, viewer] = await Promise.all([
    getGuideBySlug(slug),
    getTranslations("guides"),
    getSessionUser(),
  ]);
  if (!guide) notFound();
  const bookmarked = viewer ? (await getMyBookmarkedGuideIds()).has(guide.id) : false;

  return (
    <AppPage>
      <div className="px-4 py-6" data-testid="guide-detail">
        <Link href="/guides" className="text-sm text-brand-link underline">
          {t("backToGuides")}
        </Link>
        <p className="eyebrow mt-4">{t(`audience.${guide.audience}`)}</p>
        <h1 className="mt-1 text-2xl font-bold">{guide.title}</h1>
        {guide.summary && <p className="mt-2 text-sm text-muted-foreground">{guide.summary}</p>}
        {/* Nothing to show a guest reading an uncategorised guide, so the row is
            omitted rather than rendered as an empty gap. */}
        {(viewer || guide.category || guide.species) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {guide.category && (
              <span className="rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                {guide.category}
              </span>
            )}
            {guide.species && (
              <span className="rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                {guide.species}
              </span>
            )}
            {viewer && (
              <span className="ml-auto">
                <BookmarkButton guideId={guide.id} bookmarked={bookmarked} label={guide.title} />
              </span>
            )}
          </div>
        )}
        {/* ponytail: blank-line paragraphs, no markdown dependency. Add a renderer
            when a guide actually needs headings or lists. */}
        <div className="mt-5 flex flex-col gap-4 text-sm leading-relaxed">
          {guide.body.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </div>
    </AppPage>
  );
}

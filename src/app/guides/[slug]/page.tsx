import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getGuideBySlug } from "@/lib/guides/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};
  return { title: guide.title, description: guide.summary ?? undefined };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [guide, t] = await Promise.all([getGuideBySlug(slug), getTranslations("guides")]);
  if (!guide) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6" data-testid="guide-detail">
      <Link href="/guides" className="text-sm text-brand-link underline">
        {t("backToGuides")}
      </Link>
      <p className="eyebrow mt-4">{t(`audience.${guide.audience}`)}</p>
      <h1 className="mt-1 text-2xl font-bold">{guide.title}</h1>
      {guide.summary && <p className="mt-2 text-sm text-muted-foreground">{guide.summary}</p>}
      {/* ponytail: blank-line paragraphs, no markdown dependency. Add a renderer
          when a guide actually needs headings or lists. */}
      <div className="mt-5 flex flex-col gap-4 text-sm leading-relaxed">
        {guide.body.split(/\n{2,}/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </main>
  );
}

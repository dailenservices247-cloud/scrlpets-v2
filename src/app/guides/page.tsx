import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listGuides } from "@/lib/guides/queries";

export const metadata = {
  title: "Guides",
  description: "Care, breeding and buying guides on Scrlpets.",
};

// D5: public education surface. Empty until Dailen approves and publishes.
export default async function GuidesPage() {
  const t = await getTranslations("guides");
  const guides = await listGuides();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      {guides.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground" data-testid="guides-empty">
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3" data-testid="guides-list">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="block rounded-2xl border bg-card p-4 transition hover:bg-accent/40"
              >
                <p className="eyebrow">{t(`audience.${g.audience}`)}</p>
                <p className="mt-1 font-semibold">{g.title}</p>
                {g.summary && (
                  <p className="mt-1 text-sm text-muted-foreground">{g.summary}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { getMyCreatures } from "@/lib/compose/actions";
import { ComposerTabs } from "@/components/compose/ComposerTabs";

export default async function ComposePage() {
  const t = await getTranslations("compose");
  const user = (await getSessionUser())!; // middleware guarantees auth on /compose
  const creatures = await getMyCreatures();
  return (
    <main className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">{t("title")}</h1>
        <Link href="/" className="text-sm text-brand-link underline" aria-label="Back to feed">
          ←
        </Link>
      </header>
      <ComposerTabs userId={user.id} creatures={creatures} />
    </main>
  );
}

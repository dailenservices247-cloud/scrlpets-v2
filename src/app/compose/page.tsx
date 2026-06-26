import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { getMyCreatures } from "@/lib/compose/actions";
import { AppPage } from "@/components/app/AppPage";
import { ComposerTabs } from "@/components/compose/ComposerTabs";
import { getProfileById } from "@/lib/profiles/queries";

export default async function ComposePage() {
  const t = await getTranslations("compose");
  const user = (await getSessionUser())!; // middleware guarantees auth on /compose
  const [creatures, profile] = await Promise.all([getMyCreatures(), getProfileById(user.id)]);
  const actorName = profile?.displayName ?? profile?.username ?? user.email ?? "You";
  return (
    <AppPage>
      <section className="px-3 pb-3 pt-4">
        <div className="premium-panel rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Composer</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("title")}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Choose the identity, intent, and subject before publishing.
              </p>
            </div>
            <Link href="/" className="rounded-md border border-input px-3 py-2 text-sm font-medium text-brand-link" aria-label="Back to feed">
              Feed
            </Link>
          </div>
        </div>
      </section>
      <ComposerTabs userId={user.id} actorName={actorName} creatures={creatures} />
    </AppPage>
  );
}

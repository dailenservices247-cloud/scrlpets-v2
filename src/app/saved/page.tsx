import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { loginHrefFor } from "@/lib/auth/redirect";
import { getSavedPosts } from "@/lib/social/reactions";
import { redirect } from "next/navigation";

function destination(subtype: string | null, postId: string) {
  if (subtype === "reel") return `/watch/reel/${postId}`;
  if (subtype === "long_video") return `/watch/${postId}`;
  return `/post/${postId}`;
}

export default async function SavedPage() {
  const user = await getSessionUser();
  if (!user) redirect(loginHrefFor("/saved"));
  const t = await getTranslations("reactions");
  const items = await getSavedPosts(user.id);

  return (
    <AppPage>
      <section className="px-4 pb-3 pt-6">
        <p className="eyebrow">{t("savedLabel")}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("savedTitle")}</h1>
      </section>
      <section className="px-4 pb-10">
        {items.length === 0 ? (
          <div
            className="mt-10 rounded-2xl border border-border/70 bg-card/70 p-8 text-center"
            data-testid="saved-empty"
          >
            <p className="text-sm text-muted-foreground">{t("savedEmpty")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="saved-list">
            {items.map((item) => (
              <li key={item.postId}>
                <Link
                  href={destination(item.subtype, item.postId)}
                  className="block rounded-xl border border-border/70 bg-card/70 p-4 hover:border-primary/40"
                  data-testid="saved-item"
                >
                  <p className="line-clamp-2 text-sm">
                    {item.title ?? t("savedUntitled")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppPage>
  );
}

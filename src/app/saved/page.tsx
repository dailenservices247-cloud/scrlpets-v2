import Link from "next/link";
import { Bookmark, ChevronRight, FileText, Film, Video } from "lucide-react";
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

function SubtypeIcon({ subtype }: { subtype: string | null }) {
  if (subtype === "reel") return <Film className="size-3.5" aria-hidden />;
  if (subtype === "long_video") return <Video className="size-3.5" aria-hidden />;
  return <FileText className="size-3.5" aria-hidden />;
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
            className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/50 p-12 text-center"
            data-testid="saved-empty"
          >
            <span className="grid size-12 place-items-center rounded-full bg-muted/40 text-muted-foreground">
              <Bookmark className="size-6" aria-hidden />
            </span>
            <p className="mt-3 text-base font-semibold text-foreground">{t("savedEmpty")}</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Tap the bookmark button on any post, video, or moment in your feed to save it for later.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Explore Feed
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5" data-testid="saved-list">
            {items.map((item) => (
              <li key={item.postId}>
                <Link
                  href={destination(item.subtype, item.postId)}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 transition hover:border-primary/40 hover:bg-card/90"
                  data-testid="saved-item"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-micro font-medium uppercase text-muted-foreground">
                        <SubtypeIcon subtype={item.subtype} />
                        {item.subtype ?? "post"}
                      </span>
                      <time className="text-micro text-muted-foreground" dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </time>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-foreground">
                      {item.title ?? t("savedUntitled")}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppPage>
  );
}

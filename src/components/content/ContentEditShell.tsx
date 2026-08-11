import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { PostForm } from "@/components/compose/PostForm";
import { ListingForm } from "@/components/compose/ListingForm";
import type {
  EditableListing,
  EditablePost,
  LockedAttribution,
} from "@/lib/content/queries";

function postReturnPath(post: EditablePost) {
  if (post.contentType === "reel") return `/watch/reel/${post.id}`;
  if (post.contentType === "long_video") return `/watch/${post.id}`;
  return `/post/${post.id}`;
}

function LockedAttributionPanel({
  attribution,
  labels,
}: {
  attribution: LockedAttribution;
  labels: {
    title: string;
    explanation: string;
    postingAs: string;
    about: string;
  };
}) {
  return (
    <fieldset
      disabled
      className="premium-panel rounded-2xl p-4 disabled:opacity-80"
      data-testid="locked-attribution"
    >
      <legend className="px-1 text-sm font-semibold">{labels.title}</legend>
      <p className="mb-4 text-sm leading-6 text-muted-foreground">{labels.explanation}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">{labels.postingAs}</span>
          <input
            value={attribution.postingAsLabel}
            readOnly
            className="w-full rounded-xl border border-input bg-muted/35 p-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">{labels.about}</span>
          <input
            value={attribution.aboutLabel}
            readOnly
            className="w-full rounded-xl border border-input bg-muted/35 p-2"
          />
        </label>
      </div>
    </fieldset>
  );
}

export async function ContentEditShell({
  userId,
  content,
}: {
  userId: string;
  content: EditablePost | EditableListing;
}) {
  const t = await getTranslations("content");
  const returnPath =
    content.kind === "post" ? postReturnPath(content) : `/listing/${content.id}`;

  return (
    <AppPage showBottomNav={false}>
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-3 pb-10">
        <header className="premium-panel rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{t("editLabel")}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                {content.kind === "post" ? t("editPost") : t("editListing")}
              </h1>
            </div>
            <Link
              href={returnPath}
              className="rounded-md border border-input px-3 py-2 text-sm font-medium text-brand-link"
            >
              {t("cancel")}
            </Link>
          </div>
        </header>

        <LockedAttributionPanel
          attribution={content.attribution}
          labels={{
            title: t("lockedAttribution"),
            explanation: t("lockedAttributionBody"),
            postingAs: t("postingAs"),
            about: t("about"),
          }}
        />

        <section className="premium-panel rounded-2xl p-4">
          {content.kind === "post" ? (
            <PostForm
              userId={userId}
              edit={{
                id: content.id,
                body: content.body,
                mediaUrl: content.mediaUrl,
                returnPath,
              }}
            />
          ) : (
            <ListingForm
              userId={userId}
              edit={{
                id: content.id,
                title: content.title,
                price: content.price,
                mediaUrl: content.mediaUrl,
                returnPath,
                hasAnimal: content.hasAnimal,
                depositPercent: content.depositPercent,
                inspectionHours: content.inspectionHours,
                guarantee: content.guarantee,
              }}
            />
          )}
        </section>
      </section>
    </AppPage>
  );
}

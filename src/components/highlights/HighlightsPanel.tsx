"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteHighlight } from "@/lib/highlights/actions";
import type { Highlight } from "@/lib/highlights/queries";
import { isVideoUrl } from "@/lib/media/media-kind";
import { HighlightComposer } from "./HighlightComposer";

/**
 * ponytail: tapping a highlight expands its media inline instead of opening a
 * tap-through story player with timers and progress bars. Same content, a tenth
 * of the code; build the player when someone asks for auto-advance.
 */
export function HighlightsPanel({
  creatureId,
  slug,
  creatureName,
  highlights,
  canManage,
  viewerId,
}: {
  creatureId: string;
  slug: string;
  creatureName: string;
  highlights: Highlight[];
  canManage: boolean;
  viewerId: string | null;
}) {
  const t = useTranslations("highlights");
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  // ponytail: two-tap confirm instead of an AlertDialog. Deleting a highlight
  // is unrecoverable, so it must not happen on one stray tap — but it destroys
  // a grouping, not the media, so it does not warrant a modal.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const open = highlights.find((h) => h.id === openId) ?? null;

  async function remove(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setBusy(true);
    const result = await deleteHighlight(id, slug);
    setBusy(false);
    if (result.ok) {
      setOpenId(null);
      setConfirmingId(null);
      router.refresh();
    }
  }

  return (
    <section
      className="mx-auto max-w-2xl px-4 py-4"
      data-testid="highlights"
      aria-labelledby="highlights-title"
    >
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="highlights-title" className="text-sm font-semibold">
            {t("title")}
          </h2>
          {canManage && !composing && (
            <button
              type="button"
              onClick={() => setComposing(true)}
              data-testid="highlight-add"
              className="min-h-11 rounded-xl border border-input px-3 text-sm font-medium"
            >
              {t("addCta")}
            </button>
          )}
        </div>

        {composing && viewerId && (
          <HighlightComposer
            creatureId={creatureId}
            slug={slug}
            userId={viewerId}
            onDone={() => {
              setComposing(false);
              router.refresh();
            }}
            onCancel={() => setComposing(false)}
          />
        )}

        {highlights.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground" data-testid="highlights-empty">
            {t("empty", { name: creatureName })}
          </p>
        ) : (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1" data-testid="highlights-rail">
            {highlights.map((highlight) => {
              const cover = highlight.mediaUrls[0] ?? null;
              const isOpen = openId === highlight.id;
              return (
                <button
                  key={highlight.id}
                  type="button"
                  onClick={() => {
                    setOpenId(isOpen ? null : highlight.id);
                    setConfirmingId(null);
                  }}
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? "highlight-viewer" : undefined}
                  data-testid="highlight-card"
                  className="w-24 shrink-0 text-left focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {cover && !isVideoUrl(cover) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt=""
                      width={96}
                      height={96}
                      className={`size-24 rounded-full object-cover ring-2 ${
                        isOpen ? "ring-primary" : "ring-border/80"
                      }`}
                    />
                  ) : (
                    <span
                      className={`grid size-24 place-items-center rounded-full bg-secondary text-xl text-secondary-foreground ring-2 ${
                        isOpen ? "ring-primary" : "ring-border/80"
                      }`}
                      aria-hidden
                    >
                      {highlight.title.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="mt-1 block truncate text-xs font-medium">
                    {highlight.title}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {open && (
          <div
            id="highlight-viewer"
            className="mt-4 border-t border-border/70 pt-4"
            data-testid="highlight-viewer"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold" data-testid="highlight-viewer-title">
                {open.title}
              </h3>
              <div className="flex items-center gap-2">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => remove(open.id)}
                    disabled={busy}
                    data-testid="highlight-delete"
                    className="min-h-11 text-xs font-medium text-destructive disabled:opacity-50"
                  >
                    {confirmingId === open.id ? t("confirmDelete") : t("delete")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  data-testid="highlight-close"
                  className="min-h-11 text-xs font-medium text-brand-link"
                >
                  {t("close")}
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {open.mediaUrls.map((url) => (
                <div key={url} data-testid="highlight-media">
                  {isVideoUrl(url) ? (
                    <video
                      src={url}
                      controls
                      muted
                      playsInline
                      className="aspect-square w-full rounded-xl bg-black object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      width={320}
                      height={320}
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

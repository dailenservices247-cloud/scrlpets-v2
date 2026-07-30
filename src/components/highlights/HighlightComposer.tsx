"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MediaInput } from "@/components/compose/MediaInput";
import { createHighlight } from "@/lib/highlights/actions";
import {
  MAX_HIGHLIGHT_MEDIA,
  MAX_HIGHLIGHT_TITLE,
  validateHighlight,
  type HighlightError,
} from "@/lib/highlights/limits";

const KNOWN_ERRORS: HighlightError[] = [
  "title_required",
  "title_too_long",
  "media_required",
  "too_much_media",
];

/**
 * Reuses the existing picker and uploader — a highlight is the same media the
 * composer already handles, just gathered into a set. The ten-item cap is
 * enforced HERE (the picker disappears at ten) so the owner never meets the
 * CHECK constraint; the server re-validates because a client cap is a courtesy,
 * not a control.
 */
export function HighlightComposer({
  creatureId,
  slug,
  userId,
  onDone,
  onCancel,
}: {
  creatureId: string;
  slug: string;
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("highlights");
  const [title, setTitle] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atCap = mediaUrls.length >= MAX_HIGHLIGHT_MEDIA;
  const valid = validateHighlight({ title, mediaUrls });

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await createHighlight(creatureId, slug, title, mediaUrls);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/70 p-3" data-testid="highlight-composer">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">{t("titleLabel")}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_HIGHLIGHT_TITLE}
          placeholder={t("titlePlaceholder")}
          data-testid="highlight-title-input"
          className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
        />
      </label>

      <p className="text-xs text-muted-foreground" data-testid="highlight-media-count">
        {t("mediaCount", { count: mediaUrls.length, max: MAX_HIGHLIGHT_MEDIA })}
      </p>

      {atCap ? (
        <p className="text-xs text-muted-foreground" role="note" data-testid="highlight-cap-note">
          {t("capReached", { max: MAX_HIGHLIGHT_MEDIA })}
        </p>
      ) : (
        <MediaInput
          userId={userId}
          onUploaded={(url) => {
            if (url) setMediaUrls((current) => [...current, url]);
          }}
        />
      )}

      {mediaUrls.length > 0 && (
        <ul className="flex flex-wrap gap-2" data-testid="highlight-media-list">
          {mediaUrls.map((url, index) => (
            <li key={url} className="flex items-center gap-1">
              <span className="rounded-lg border border-border/70 px-2 py-1 text-xs">
                {t("mediaItem", { index: index + 1 })}
              </span>
              <button
                type="button"
                onClick={() => setMediaUrls((current) => current.filter((u) => u !== url))}
                aria-label={t("removeMedia", { index: index + 1 })}
                data-testid="highlight-media-remove"
                className="min-h-11 px-1 text-xs font-medium text-destructive"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert" data-testid="highlight-error">
          {KNOWN_ERRORS.includes(error as HighlightError)
            ? t(`error.${error as HighlightError}`)
            : t("error.generic")}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !valid.ok}
          data-testid="highlight-save"
          className="min-h-11 flex-1 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
        >
          {busy ? t("saving") : t("save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

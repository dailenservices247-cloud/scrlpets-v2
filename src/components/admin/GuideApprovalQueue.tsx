"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { publishGuide } from "@/lib/guides/actions";
import type { GuideDetail } from "@/lib/guides/queries";

// D5/A7: read the draft in full, then publish. No approval, no public page.
export function GuideApprovalQueue({ drafts }: { drafts: GuideDetail[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function approve(guide: GuideDetail) {
    setBusy(guide.slug);
    const result = await publishGuide(guide);
    setBusy(null);
    if (result.ok) router.refresh();
  }

  if (drafts.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground" data-testid="guide-queue-empty">
        {t("guidesEmpty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="guide-queue">
      {drafts.map((g) => (
        <li key={g.slug} className="premium-panel rounded-2xl p-4" data-testid="admin-guide-row">
          <p className="eyebrow">{t(`guideAudience.${g.audience}`)}</p>
          <p className="mt-1 text-sm font-semibold">{g.title}</p>
          {g.summary && <p className="mt-1 text-xs text-muted-foreground">{g.summary}</p>}
          <button
            type="button"
            onClick={() => setOpen(open === g.slug ? null : g.slug)}
            data-testid={`guide-preview-${g.slug}`}
            className="mt-3 min-h-11 w-full rounded-xl border border-input px-4 text-sm font-medium"
          >
            {open === g.slug ? t("hideDraft") : t("readDraft")}
          </button>
          {open === g.slug && (
            <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed">
              {g.body.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => approve(g)}
            disabled={busy === g.slug}
            data-testid={`guide-publish-${g.slug}`}
            className="mt-2 min-h-11 w-full rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
          >
            {t("publishGuide")}
          </button>
        </li>
      ))}
    </ul>
  );
}

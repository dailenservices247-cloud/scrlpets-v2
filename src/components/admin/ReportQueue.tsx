"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { resolveReport, type ModerationDecision } from "@/lib/moderation/actions";
import type { OpenReport } from "@/lib/moderation/queries";

const TARGET_HREF: Record<OpenReport["targetKind"], (id: string) => string | null> = {
  post: (id) => `/post/${id}`,
  listing: (id) => `/listing/${id}`,
  profile: () => null,
  comment: () => null,
};

// D4: human review. Hiding content and suspending an account are both audited.
export function ReportQueue({ reports }: { reports: OpenReport[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function decide(id: string, decision: ModerationDecision) {
    setBusy(id);
    const result = await resolveReport(id, decision, notes[id]);
    setBusy(null);
    if (result.ok) router.refresh();
  }

  if (reports.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground" data-testid="report-queue-empty">
        {t("reportsEmpty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="report-queue">
      {reports.map((r) => {
        const href = TARGET_HREF[r.targetKind](r.targetId);
        return (
          <li key={r.id} className="premium-panel rounded-2xl p-4" data-testid="admin-report-row">
            <p className="text-sm font-semibold">
              {t(`targetKind.${r.targetKind}`)} · {t(`reason.${r.reason}`)}
            </p>
            {r.details && <p className="mt-1 text-xs text-muted-foreground">{r.details}</p>}
            {href && (
              <a href={href} className="mt-1 block text-xs text-brand-link underline">
                {t("viewTarget")}
              </a>
            )}
            <input
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              placeholder={t("notesPlaceholder")}
              aria-label={t("notesPlaceholder")}
              data-testid={`report-notes-${r.id}`}
              className="mt-3 min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => decide(r.id, "dismissed")}
                disabled={busy === r.id}
                data-testid={`report-dismiss-${r.id}`}
                className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
              >
                {t("dismiss")}
              </button>
              <button
                type="button"
                onClick={() => decide(r.id, "content_hidden")}
                disabled={busy === r.id}
                data-testid={`report-hide-${r.id}`}
                className="min-h-11 flex-1 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
              >
                {t("hideContent")}
              </button>
              <button
                type="button"
                onClick={() => decide(r.id, "account_suspended")}
                disabled={busy === r.id}
                data-testid={`report-suspend-${r.id}`}
                className="min-h-11 flex-1 rounded-xl border border-destructive/50 px-4 text-sm font-medium text-destructive disabled:opacity-50"
              >
                {t("suspendAccount")}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { reviewSellerProgram } from "@/lib/verification/actions";
import type { RejectionReason, SellerProgram } from "@/lib/verification/queries";

/**
 * Typed against RejectionReason so this list cannot name a code the database
 * would reject. Declared here rather than imported as a value because
 * verification/queries.ts imports the server Supabase client — same reason
 * PROGRAM_TYPES is declared inside VerificationPanel.
 */
const REJECTION_REASONS: readonly RejectionReason[] = [
  "not_found",
  "expired",
  "name_mismatch",
  "authority_unrecognised",
  "other",
];

// D4/A2: manual review of program credentials against public records.
export function ProgramReviewQueue({
  programs,
}: {
  programs: (SellerProgram & { profileId: string })[];
}) {
  const t = useTranslations("admin");
  // The reason strings are read from the APPLICANT's namespace on purpose: the
  // reviewer picks from the exact wording the applicant will be shown, so the
  // choice is made with the consequence visible rather than from a staff-only
  // paraphrase that can drift away from it.
  const tv = useTranslations("verification");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Defaults to `other` ("contact support") — the honest fallback if a reviewer
  // rejects without touching the picker. The definer refuses a null.
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    const result = await reviewSellerProgram(id, decision, notes[id], reasons[id] ?? "other");
    setBusy(null);
    if (result.ok) router.refresh();
  }

  if (programs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground" data-testid="admin-queue-empty">
        {t("queueEmpty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="admin-queue">
      {programs.map((p) => (
        <li key={p.id} className="premium-panel rounded-2xl p-4" data-testid="admin-program-row">
          <p className="text-sm font-semibold">{t(`programType.${p.programType}`)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {p.issuingAuthority} · {p.credentialNumber}
          </p>
          {p.publicUrl && (
            <a
              href={p.publicUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 block truncate text-xs text-brand-link underline"
            >
              {p.publicUrl}
            </a>
          )}
          <input
            value={notes[p.id] ?? ""}
            onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
            placeholder={t("notesPlaceholder")}
            aria-label={t("notesPlaceholder")}
            data-testid={`admin-notes-${p.id}`}
            className="mt-3 min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <label className="mt-2 flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {t("rejectionReasonLabel")}
            <select
              value={reasons[p.id] ?? "other"}
              onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))}
              data-testid={`admin-reason-${p.id}`}
              className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm text-foreground"
            >
              {REJECTION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {tv(`rejectionReason.${reason}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => decide(p.id, "approved")}
              disabled={busy === p.id}
              data-testid={`admin-approve-${p.id}`}
              className="min-h-11 flex-1 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
            >
              {t("approve")}
            </button>
            <button
              type="button"
              onClick={() => decide(p.id, "rejected")}
              disabled={busy === p.id}
              data-testid={`admin-reject-${p.id}`}
              className="min-h-11 flex-1 rounded-xl border border-destructive/50 px-4 text-sm font-medium text-destructive disabled:opacity-50"
            >
              {t("reject")}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

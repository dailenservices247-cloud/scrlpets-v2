"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateTicket } from "@/lib/admin/actions";
import type { SupportTicketRow } from "@/lib/admin/queries";

/**
 * E: the support lifecycle legacy never had — its admin queue could display a
 * ticket but never change its status. Notes APPEND (the definer concatenates),
 * so the history of a ticket is not overwritten by the last person to touch it.
 */
export function SupportTicketQueue({ tickets }: { tickets: SupportTicketRow[] }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function move(id: string, status: "open" | "in_progress" | "resolved") {
    setBusy(id);
    const result = await updateTicket(id, status, notes[id]);
    setBusy(null);
    if (result.ok) {
      setNotes((n) => ({ ...n, [id]: "" }));
      router.refresh();
    }
  }

  if (tickets.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground" data-testid="ticket-queue-empty">
        {t("ticketsEmpty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="ticket-queue">
      {tickets.map((ticket) => (
        <li key={ticket.id} className="premium-panel rounded-2xl p-4" data-testid="admin-ticket-row">
          <p className="eyebrow">
            {t(`ticketCategory.${ticket.category}`)} · {t(`ticketStatus.${ticket.status}`)}
          </p>
          <p className="mt-1 text-sm font-semibold">{ticket.subject}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ticket.name} · {ticket.email} ·{" "}
            {new Date(ticket.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
          </p>
          <button
            type="button"
            onClick={() => setOpen(open === ticket.id ? null : ticket.id)}
            aria-expanded={open === ticket.id}
            data-testid={`ticket-read-${ticket.id}`}
            className="mt-3 min-h-11 w-full rounded-xl border border-input px-4 text-sm font-medium"
          >
            {open === ticket.id ? t("hideMessage") : t("readMessage")}
          </button>
          {open === ticket.id && (
            <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed">
              {ticket.message.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              {ticket.adminNotes && (
                <p className="whitespace-pre-line text-xs text-muted-foreground">
                  {ticket.adminNotes}
                </p>
              )}
            </div>
          )}
          <input
            value={notes[ticket.id] ?? ""}
            onChange={(e) => setNotes((n) => ({ ...n, [ticket.id]: e.target.value }))}
            placeholder={t("notesPlaceholder")}
            aria-label={t("notesPlaceholder")}
            data-testid={`ticket-notes-${ticket.id}`}
            className="mt-2 min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {ticket.status !== "in_progress" && (
              <button
                type="button"
                onClick={() => move(ticket.id, "in_progress")}
                disabled={busy === ticket.id}
                data-testid={`ticket-progress-${ticket.id}`}
                className="min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
              >
                {t("ticketStatus.in_progress")}
              </button>
            )}
            <button
              type="button"
              onClick={() => move(ticket.id, "resolved")}
              disabled={busy === ticket.id}
              data-testid={`ticket-resolve-${ticket.id}`}
              className="min-h-11 flex-1 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
            >
              {t("resolveTicket")}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

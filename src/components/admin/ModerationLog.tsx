import { getTranslations } from "next-intl/server";
import type { ModerationLogRow } from "@/lib/admin/queries";

/**
 * E: the audit viewer over moderation_actions. Read-only on purpose — the table
 * has a select policy and nothing else, so there is no edit or delete to build
 * even if someone wanted one. A server component because nothing here reacts.
 */
export async function ModerationLog({ entries }: { entries: ModerationLogRow[] }) {
  const t = await getTranslations("admin");

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground" data-testid="audit-log-empty">
        {t("auditEmpty")}
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2" data-testid="audit-log">
      {entries.map((e) => (
        <li key={e.id} className="rounded-xl border border-border/60 bg-card/60 p-3">
          <p className="text-sm font-medium">
            {t(`auditAction.${e.action}`)}
            {e.targetKind ? ` · ${t(`targetKind.${e.targetKind}`)}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("auditActor", { actor: e.actorUsername ?? t("auditActorUnknown") })} ·{" "}
            {new Date(e.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
          </p>
          {/* No stated reason is itself the finding, so it is rendered rather
              than skipped — an unexplained decision should be visible. */}
          <p className="mt-1 text-xs">
            {e.notes ?? <span className="text-muted-foreground">{t("auditNoNotes")}</span>}
          </p>
        </li>
      ))}
    </ol>
  );
}

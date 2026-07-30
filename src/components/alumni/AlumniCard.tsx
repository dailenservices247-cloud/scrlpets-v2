import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { setAlumniMuteForm } from "@/lib/alumni/actions";
import type { AlumniRecord } from "@/lib/alumni/queries";

/**
 * One handed-over animal, from whichever side the viewer is on.
 *
 * The species-adapted role badge does the vocabulary work: a cat's record says
 * "Cattery", a parrot's says "Aviary", an unknown species says "Breeder". The
 * entries themselves are just "updates", so nothing here has to reach for a
 * dog-shaped word.
 *
 * Mute is a plain bound server action — the list re-renders from the database,
 * so the button can never show a mute state the row store disagrees with.
 */
export async function AlumniCard({ record }: { record: AlumniRecord }) {
  const t = await getTranslations("alumni");
  const counterpartyName = record.counterparty
    ? (record.counterparty.displayName ?? record.counterparty.username)
    : t("unknownParty");
  // The animal's own name is the heading; a deleted profile leaves the record
  // (and its history) intact, so the card stays and says so.
  const heading = record.creature?.name ?? t("animalGone");

  return (
    <li className="premium-panel rounded-2xl p-4" data-testid="alumni-row">
      <div className="flex items-start gap-3">
        {record.creature?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={record.creature.avatarUrl}
            alt=""
            className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-border"
          />
        ) : (
          <span
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-lg text-secondary-foreground"
            aria-hidden
          >
            {heading.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{record.breederRoleBadge}</p>
          <h2 className="mt-1 truncate text-base font-semibold">
            <Link
              href={`/pack/alumni/${record.id}`}
              className="text-brand-link underline"
              data-testid={`alumni-open-${record.id}`}
            >
              {heading}
            </Link>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground" data-testid="alumni-counterparty">
            {t(record.viewerSide === "breeder" ? "sideNowWith" : "sideRaisedBy", {
              name: counterpartyName,
            })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("handoverAt", { date: new Date(record.handoverAt) })}
          </p>
        </div>
      </div>
      <form action={setAlumniMuteForm.bind(null, record.id, !record.muted)} className="mt-3">
        <button
          type="submit"
          aria-pressed={record.muted}
          data-testid={`alumni-mute-${record.id}`}
          className="min-h-11 w-full rounded-xl border border-input px-4 text-sm font-medium hover:bg-muted"
        >
          {t(record.muted ? "unmute" : "mute")}
        </button>
      </form>
    </li>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TileMedia } from "@/components/feed/TileMedia";
import { relativeTime } from "@/lib/feed/relative-time";
import type { AlumniRecord, AlumniUpdate } from "@/lib/alumni/queries";

/**
 * The shared timeline. BOTH parties see the same entries in the same order —
 * there is no per-side filtering, because the point of the surface is that the
 * person who raised the animal and the person who has them now are looking at
 * one conversation rather than two mirrored ones.
 *
 * Every entry renders the author's own profile, resolved from the post's
 * author_id. The side label is derived by comparing that author_id with the
 * alumni row, so an entry cannot be attributed to the reader by accident — the
 * exact defect the legacy timeline shipped.
 */
export async function AlumniTimeline({
  record,
  updates,
  viewerId,
}: {
  record: AlumniRecord;
  updates: AlumniUpdate[];
  viewerId: string;
}) {
  const t = await getTranslations("alumni");

  if (updates.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground" data-testid="alumni-updates-empty">
        {t("updatesEmpty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="alumni-updates-list">
      {updates.map((u) => (
        <li key={u.id} className="premium-panel rounded-2xl p-4" data-testid="alumni-update">
          <div className="flex items-center gap-3">
            {u.author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={u.author.avatarUrl}
                alt=""
                className="size-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-brand-link"
                aria-hidden
              >
                {(u.author.displayName ?? u.author.username).charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <Link
                href={`/u/${u.author.username}`}
                className="block truncate text-sm font-semibold text-brand-link underline"
                data-testid="alumni-update-author"
              >
                {u.author.displayName ?? u.author.username}
              </Link>
              <p className="truncate text-xs text-muted-foreground" data-testid="alumni-update-side">
                {/* The role badge carries the species; "You" is only ever shown
                    against the viewer's own real author id. */}
                {u.authorSide === "breeder" ? record.breederRoleBadge : t("roleOwner")}
                {u.author.id === viewerId ? ` · ${t("you")}` : ` · @${u.author.username}`}
              </p>
            </div>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={u.createdAt}>
              {relativeTime(u.createdAt)}
            </time>
          </div>
          {u.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{u.body}</p>}
          <TileMedia src={u.mediaUrl} alt="" />
        </li>
      ))}
    </ul>
  );
}

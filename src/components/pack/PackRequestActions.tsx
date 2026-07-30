import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/session";
import { getPackLinkState } from "@/lib/pack/queries";
import { acceptPackRequestForm, declinePackRequestForm } from "@/lib/pack/actions";

/**
 * Accept / Decline for one pack request.
 *
 * Plain forms bound to server actions, exactly like the group join/leave pair:
 * no client component, no optimistic state, and the surface re-renders from the
 * database afterwards — so the buttons can never show a decision the row store
 * disagrees with. Decline deletes the link, which is also what "remove" does;
 * see removePackLink.
 */
export async function PackRequestControls({ linkId }: { linkId: string }) {
  const t = await getTranslations("pack");
  return (
    <div className="mt-3 flex gap-2" data-testid="pack-request-controls">
      <form action={acceptPackRequestForm.bind(null, linkId)} className="flex-1">
        <button
          type="submit"
          data-testid={`pack-accept-${linkId}`}
          className="min-h-11 w-full rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link hover:bg-primary/25"
        >
          {t("accept")}
        </button>
      </form>
      <form action={declinePackRequestForm.bind(null, linkId)} className="flex-1">
        <button
          type="submit"
          data-testid={`pack-decline-${linkId}`}
          className="min-h-11 w-full rounded-xl border border-destructive/50 px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          {t("decline")}
        </button>
      </form>
    </div>
  );
}

/**
 * DROP-IN FOR THE NOTIFICATIONS SURFACE.
 *
 * Render this under a `pack_invite` notification, passing the notification's
 * `target_id` (its `target_kind` is `pack_link`):
 *
 *     {n.kind === "pack_invite" && n.targetId && (
 *       <PackRequestActions linkId={n.targetId} />
 *     )}
 *
 * It renders nothing at all when the request is already accepted, was declined
 * or withdrawn, or the viewer is the person who sent it — a notification
 * outlives the request it points at, and offering Accept on a dead link would
 * be a lie. Nesting it inside the notification's own <Link> would put a form in
 * an anchor, so place it as a sibling of the link, not a child.
 *
 * ponytail: one read per pack-invite notification. The list is capped at 50 and
 * few of those rows are invites; batch through getPackLinkState's table if pack
 * invites ever dominate someone's notifications.
 */
export async function PackRequestActions({ linkId }: { linkId: string }) {
  const [user, link] = await Promise.all([getSessionUser(), getPackLinkState(linkId)]);
  if (!user || !link) return null;
  if (link.status !== "pending" || link.addresseeId !== user.id) return null;
  return <PackRequestControls linkId={linkId} />;
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { getNotifications, notificationHref } from "@/lib/notifications/queries";
import { groupNotifications, isActionable } from "@/lib/notifications/grouping";
import { MarkAllRead } from "@/components/notifications/MarkAllRead";
import { ClearAll } from "@/components/notifications/ClearAll";
import { NotificationAnnouncer } from "@/components/notifications/NotificationAnnouncer";
import { PackRequestActions } from "@/components/pack/PackRequestActions";
import { relativeTime } from "@/lib/feed/relative-time";

// R12: the in-app notification center (D7 — in-app only).
export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  await getSessionUser(); // proxy gates /notifications
  const items = await getNotifications();
  const groups = groupNotifications(items);
  const unread = items.filter((n) => !n.read).length;

  return (
    <AppPage>
      <NotificationAnnouncer initialUnread={unread} />
      <header className="flex items-center justify-between px-3 pb-2 pt-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <div className="flex items-center gap-1">
          {unread > 0 && <MarkAllRead />}
          {items.length > 0 && <ClearAll />}
        </div>
      </header>
      {groups.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground" data-testid="notifications-empty">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col" data-testid="notifications-list">
          {groups.map((n) => (
            <li key={n.id} className="flex items-center gap-2 border-b border-border/60 pr-3">
              <Link
                href={notificationHref(n)}
                className={
                  "flex min-w-0 flex-1 items-center gap-3 px-3 py-3 transition hover:bg-muted/40 " +
                  (n.read ? "" : "bg-primary/5")
                }
                data-testid="notification-item"
              >
                {n.actorAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.actorAvatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/20 font-semibold text-brand-link">
                    {n.actorName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{n.actorName}</span>
                  {n.othersCount > 0 && <> {t("andOthers", { count: n.othersCount })}</>}{" "}
                  {t(`kind.${n.kind}`)}
                </span>
                <time className="shrink-0 text-xs text-muted-foreground" dateTime={n.createdAt}>
                  {relativeTime(n.createdAt)}
                </time>
              </Link>
              {/* Sibling of the link, never a child: PackRequestActions renders
                  forms, and a form inside an anchor is invalid markup. It
                  returns null once the request is no longer answerable. */}
              {isActionable(n.kind) && n.targetKind === "pack_link" && n.targetId && (
                <PackRequestActions linkId={n.targetId} />
              )}
            </li>
          ))}
        </ul>
      )}
    </AppPage>
  );
}
